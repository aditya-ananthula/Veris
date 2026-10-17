"""Phase 3 persistence: SQLite sidecar for structured intelligence.

ChromaDB keeps doing vector retrieval (ephemeral by default, opt-in persistent
via VERIS_CHROMA_DIR). This module stores everything Chroma cannot: document
registry with versions + content hashes, validated entities/facts/relationships,
and per-fact provenance. stdlib sqlite3 only — no new dependency.
"""
import hashlib
import json
import os
import sqlite3
import threading
import time

import config

SCHEMA_VERSION = 1

_SCHEMA = """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at REAL);
CREATE TABLE IF NOT EXISTS documents (
    doc_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    extension TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'indexed',
    extraction_status TEXT NOT NULL DEFAULT 'pending',
    extraction_error TEXT DEFAULT NULL,
    chunks INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(session_id);
CREATE TABLE IF NOT EXISTS entities (
    entity_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    normalized TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'unknown',
    aliases TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'resolved',
    created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entities_session ON entities(session_id);
CREATE TABLE IF NOT EXISTS facts (
    fact_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    attribute TEXT NOT NULL,
    value TEXT NOT NULL,
    value_type TEXT NOT NULL DEFAULT 'string',
    unit TEXT DEFAULT NULL,
    period TEXT DEFAULT NULL,
    entity_id TEXT DEFAULT NULL,
    evidence TEXT NOT NULL DEFAULT '',
    char_start INTEGER DEFAULT NULL,
    char_end INTEGER DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'validated',
    validation_notes TEXT NOT NULL DEFAULT '',
    created_at REAL NOT NULL,
    FOREIGN KEY (doc_id) REFERENCES documents(doc_id)
);
CREATE INDEX IF NOT EXISTS idx_facts_session ON facts(session_id);
CREATE INDEX IF NOT EXISTS idx_facts_doc ON facts(doc_id);
CREATE INDEX IF NOT EXISTS idx_facts_entity ON facts(entity_id);
CREATE TABLE IF NOT EXISTS relationships (
    rel_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    src_entity_id TEXT NOT NULL,
    rel_type TEXT NOT NULL,
    dst_entity_id TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    evidence TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'validated',
    created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rel_session ON relationships(session_id);
"""

_lock = threading.Lock()

def _connect(path=None):
    db_path = path or config.SQLITE_PATH
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(path=None):
    with _lock:
        conn = _connect(path)
        try:
            conn.executescript(_SCHEMA)
            row = conn.execute("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1").fetchone()
            if row is None:
                conn.execute(
                    "INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
                    (SCHEMA_VERSION, time.time()),
                )
            conn.commit()
        finally:
            conn.close()
    return path or config.SQLITE_PATH

def stable_id(*parts):
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:24]

def _now():
    return time.time()

def upsert_document(session_id, filename, extension, content_hash, chunks, status="indexed",
                    extraction_status="pending", extraction_error=None, path=None):
    """Register a document version. Same (session, filename, hash) -> same doc_id
    (idempotent re-upload). Same name + new hash -> version bump, old facts kept
    under the previous doc_id for change comparison."""
    init_db(path)
    with _lock:
        conn = _connect(path)
        try:
            existing = conn.execute(
                "SELECT doc_id, content_hash, version FROM documents WHERE session_id=? AND filename=? ORDER BY version DESC LIMIT 1",
                (session_id, filename),
            ).fetchone()
            if existing and existing["content_hash"] == content_hash:
                doc_id = existing["doc_id"]
                conn.execute(
                    "UPDATE documents SET chunks=?, status=?, extraction_status=?, extraction_error=?, updated_at=? WHERE doc_id=?",
                    (chunks, status, extraction_status, extraction_error, _now(), doc_id),
                )
            else:
                version = (existing["version"] + 1) if existing else 1
                doc_id = stable_id(session_id, filename, content_hash)
                conn.execute(
                    "INSERT OR REPLACE INTO documents (doc_id, session_id, filename, extension, content_hash, version, status, extraction_status, extraction_error, chunks, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (doc_id, session_id, filename, extension, content_hash, version, status,
                     extraction_status, extraction_error, chunks, _now(), _now()),
                )
            conn.commit()
            return doc_id
        finally:
            conn.close()

def set_extraction_state(doc_id, extraction_status, extraction_error=None, path=None):
    init_db(path)
    with _lock:
        conn = _connect(path)
        try:
            conn.execute(
                "UPDATE documents SET extraction_status=?, extraction_error=?, updated_at=? WHERE doc_id=?",
                (extraction_status, extraction_error, _now(), doc_id),
            )
            conn.commit()
        finally:
            conn.close()

def get_document(doc_id, path=None):
    init_db(path)
    conn = _connect(path)
    try:
        row = conn.execute("SELECT * FROM documents WHERE doc_id=?", (doc_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def list_documents(session_id, path=None):
    init_db(path)
    conn = _connect(path)
    try:
        rows = conn.execute(
            "SELECT * FROM documents WHERE session_id=? ORDER BY filename COLLATE NOCASE", (session_id,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def delete_session_document(session_id, filename, path=None):
    """Remove registry rows + facts/rels for one filename. Returns doc_ids removed."""
    init_db(path)
    with _lock:
        conn = _connect(path)
        try:
            ids = [r["doc_id"] for r in conn.execute(
                "SELECT doc_id FROM documents WHERE session_id=? AND filename=?", (session_id, filename))]
            for doc_id in ids:
                conn.execute("DELETE FROM relationships WHERE doc_id=?", (doc_id,))
                conn.execute("DELETE FROM facts WHERE doc_id=?", (doc_id,))
                if conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='contradictions'").fetchone():
                    conn.execute("DELETE FROM contradictions WHERE fact_a_id=? OR fact_b_id=?", (doc_id, doc_id))
                conn.execute("DELETE FROM documents WHERE doc_id=?", (doc_id,))
            conn.commit()
            return ids
        finally:
            conn.close()


def supersede_older_versions(session_id, filename, keep_doc_id, path=None):
    """Called when a document is re-ingested with changed content.

    Prior versions of the same filename are marked 'superseded' and their
    facts, relationships, and contradiction rows are removed so re-processing
    never leaves stale facts behind. Unrelated documents and findings are
    preserved. Idempotent: a no-op when there are no older versions
    (e.g. identical re-upload). Returns the superseded doc_ids.
    """
    init_db(path)
    with _lock:
        conn = _connect(path)
        try:
            rows = conn.execute(
                "SELECT doc_id FROM documents WHERE session_id=? AND filename=? "
                "AND doc_id<>? AND status<>'superseded'",
                (session_id, filename, keep_doc_id),
            ).fetchall()
            ids = [r["doc_id"] for r in rows]
            for doc_id in ids:
                conn.execute("DELETE FROM relationships WHERE doc_id=?", (doc_id,))
                conn.execute("DELETE FROM facts WHERE doc_id=?", (doc_id,))
                if conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='contradictions'").fetchone():
                    conn.execute("DELETE FROM contradictions WHERE fact_a_id=? OR fact_b_id=?", (doc_id, doc_id))
                conn.execute(
                    "UPDATE documents SET status='superseded', updated_at=? WHERE doc_id=?",
                    (_now(), doc_id),
                )
            conn.commit()
            return ids
        finally:
            conn.close()

def normalize_name(name):
    import re
    import unicodedata
    text = unicodedata.normalize("NFKC", (name or "").strip().casefold())
    text = re.sub(r"\s+", " ", text)
    return text.strip(" .,;:'\"")

def upsert_entity(session_id, canonical_name, entity_type="unknown", alias=None, path=None):
    """Conservative resolution: same (session, normalized-name, type) -> same entity.
    Different types never merge. Ambiguous mentions stay 'unresolved' via status."""
    init_db(path)
    normalized = normalize_name(canonical_name)
    if not normalized:
        return None
    entity_type = (entity_type or "unknown").strip().lower() or "unknown"
    entity_id = stable_id(session_id, normalized, entity_type)
    with _lock:
        conn = _connect(path)
        try:
            row = conn.execute("SELECT * FROM entities WHERE entity_id=?", (entity_id,)).fetchone()
            aliases = json.loads(row["aliases"]) if row else []
            for candidate in {canonical_name.strip(), (alias or "").strip()}:
                if candidate and candidate not in aliases:
                    aliases.append(candidate)
            if row:
                conn.execute("UPDATE entities SET aliases=? WHERE entity_id=?",
                             (json.dumps(aliases[:20]), entity_id))
            else:
                conn.execute(
                    "INSERT INTO entities (entity_id, session_id, canonical_name, normalized, entity_type, aliases, status, created_at) VALUES (?,?,?,?,?,?,?,?)",
                    (entity_id, session_id, canonical_name.strip(), normalized, entity_type,
                     json.dumps(aliases[:20] or [canonical_name.strip()]), "resolved", _now()),
                )
            conn.commit()
            return entity_id
        finally:
            conn.close()

def list_entities(session_id, path=None):
    init_db(path)
    conn = _connect(path)
    try:
        rows = conn.execute(
            "SELECT * FROM entities WHERE session_id=? ORDER BY canonical_name COLLATE NOCASE", (session_id,)
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["aliases"] = json.loads(d["aliases"] or "[]")
            d["fact_count"] = conn.execute(
                "SELECT COUNT(*) c FROM facts WHERE entity_id=?", (d["entity_id"],)).fetchone()["c"]
            out.append(d)
        return out
    finally:
        conn.close()

def save_facts(session_id, doc_id, fact_dicts, path=None):
    """Persist validated facts. Replaces prior facts for this doc_id atomically."""
    init_db(path)
    with _lock:
        conn = _connect(path)
        try:
            conn.execute("DELETE FROM relationships WHERE doc_id=?", (doc_id,))
            conn.execute("DELETE FROM facts WHERE doc_id=?", (doc_id,))
            for f in fact_dicts:
                fact_id = stable_id(doc_id, f["subject"], f["attribute"], f["value"], f.get("evidence", "")[:80])
                conn.execute(
                    "INSERT INTO facts (fact_id, session_id, doc_id, subject, attribute, value, value_type, unit, period, entity_id, evidence, char_start, char_end, status, validation_notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (fact_id, session_id, doc_id, f["subject"], f["attribute"], f["value"],
                     f.get("value_type", "string"), f.get("unit"), f.get("period"),
                     f.get("entity_id"), f.get("evidence", "")[:2000],
                     f.get("char_start"), f.get("char_end"),
                     f.get("status", "validated"), f.get("validation_notes", ""), _now()),
                )
            conn.commit()
            return len(fact_dicts)
        finally:
            conn.close()

def save_relationships(session_id, doc_id, rel_dicts, path=None):
    init_db(path)
    with _lock:
        conn = _connect(path)
        try:
            for r in rel_dicts:
                rel_id = stable_id(doc_id, r["src_entity_id"], r["rel_type"], r["dst_entity_id"])
                conn.execute(
                    "INSERT OR IGNORE INTO relationships (rel_id, session_id, src_entity_id, rel_type, dst_entity_id, doc_id, evidence, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                    (rel_id, session_id, r["src_entity_id"], r["rel_type"], r["dst_entity_id"],
                     doc_id, r.get("evidence", "")[:2000], r.get("status", "validated"), _now()),
                )
            conn.commit()
            return len(rel_dicts)
        finally:
            conn.close()

def search_facts(session_id, query="", entity_id=None, doc_id=None, limit=50, path=None):
    init_db(path)
    conn = _connect(path)
    try:
        sql = "SELECT f.*, d.filename FROM facts f JOIN documents d ON d.doc_id=f.doc_id WHERE f.session_id=?"
        params = [session_id]
        if entity_id:
            sql += " AND f.entity_id=?"
            params.append(entity_id)
        if doc_id:
            sql += " AND f.doc_id=?"
            params.append(doc_id)
        if query:
            sql += " AND (f.subject LIKE ? OR f.attribute LIKE ? OR f.value LIKE ? OR f.evidence LIKE ?)"
            like = f"%{query}%"
            params += [like, like, like, like]
        sql += " ORDER BY f.created_at DESC LIMIT ?"
        params.append(max(1, min(limit, 200)))
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()

def list_relationships(session_id, path=None):
    init_db(path)
    conn = _connect(path)
    try:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM relationships WHERE session_id=? ORDER BY created_at DESC LIMIT 200", (session_id,)).fetchall()]
    finally:
        conn.close()


def get_stats(session_id, path=None):
    """Return combined summary counts for the Knowledge overview."""
    init_db(path)
    conn = _connect(path)
    try:
        doc_count = conn.execute(
            "SELECT COUNT(*) FROM documents WHERE session_id=? AND status!='superseded'", (session_id,)
        ).fetchone()[0]
        ent_count = conn.execute(
            "SELECT COUNT(*) FROM entities WHERE session_id=?", (session_id,)
        ).fetchone()[0]
        fact_count = conn.execute(
            "SELECT COUNT(*) FROM facts WHERE session_id=?", (session_id,)
        ).fetchone()[0]
        rel_count = conn.execute(
            "SELECT COUNT(*) FROM relationships WHERE session_id=?", (session_id,)
        ).fetchone()[0]
        chunks_total = conn.execute(
            "SELECT COALESCE(SUM(chunks), 0) FROM documents WHERE session_id=? AND status!='superseded'", (session_id,)
        ).fetchone()[0]
        return {
            "documents": doc_count,
            "entities": ent_count,
            "facts": fact_count,
            "relationships": rel_count,
            "chunks": chunks_total,
        }
    finally:
        conn.close()


def get_document_graph(session_id, path=None):
    """Return documents with inter-document edges based on shared entities."""
    init_db(path)
    conn = _connect(path)
    try:
        docs = conn.execute(
            "SELECT * FROM documents WHERE session_id=? AND status!='superseded' ORDER BY created_at DESC",
            (session_id,)
        ).fetchall()
        doc_list = [dict(r) for r in docs]
        doc_ids = {d["doc_id"] for d in doc_list}

        # For each doc, fetch top topics/entities mentioned
        for d in doc_list:
            top_subjects = conn.execute(
                "SELECT subject, COUNT(*) as cnt FROM facts WHERE doc_id=? GROUP BY subject ORDER BY cnt DESC LIMIT 6",
                (d["doc_id"],)
            ).fetchall()
            d["key_topics"] = [r["subject"] for r in top_subjects]

        # Entity -> set of doc_ids that mention it (via facts)
        ent_docs = {}
        facts = conn.execute(
            "SELECT doc_id, entity_id FROM facts WHERE session_id=? AND entity_id IS NOT NULL",
            (session_id,)
        ).fetchall()
        for f in facts:
            ent_docs.setdefault(f["entity_id"], set()).add(f["doc_id"])

        edge_map = {}
        for ent, doc_set in ent_docs.items():
            ds = sorted(doc_set)
            for i in range(len(ds)):
                for j in range(i + 1, len(ds)):
                    key = tuple(sorted([ds[i], ds[j]]))
                    edge_map[key] = edge_map.get(key, 0) + 1

        # Also bridge via relationships (entities connected to entities in other docs)
        rels = conn.execute(
            "SELECT src_entity_id, dst_entity_id FROM relationships WHERE session_id=?",
            (session_id,)
        ).fetchall()
        for r in rels:
            src_docs = ent_docs.get(r["src_entity_id"], set())
            dst_docs = ent_docs.get(r["dst_entity_id"], set())
            for da in src_docs:
                for db in dst_docs:
                    if da == db:
                        continue
                    key = tuple(sorted([da, db]))
                    edge_map[key] = edge_map.get(key, 0) + 1

        edges = []
        for (da, db), count in edge_map.items():
            if da in doc_ids and db in doc_ids:
                sim_score = min(0.98, max(0.25, round(count / (count + 2), 2)))
                edges.append({
                    "source": da,
                    "target": db,
                    "weight": count,
                    "similarity": sim_score,
                    "rel_type": "shared_entities",
                    "evidence": f"{count} shared entity/connection{'s' if count > 1 else ''}",
                })

        return {"documents": doc_list, "edges": edges}
    finally:
        conn.close()


def get_entity_detail(session_id, entity_id, path=None):
    """Return entity plus its facts and related entities (via relationships)."""
    init_db(path)
    conn = _connect(path)
    try:
        row = conn.execute(
            "SELECT * FROM entities WHERE entity_id=? AND session_id=?", (entity_id, session_id)
        ).fetchone()
        if not row:
            return None
        ent = dict(row)
        ent["aliases"] = json.loads(ent["aliases"] or "[]")

        facts = conn.execute(
            "SELECT f.*, d.filename AS filename FROM facts f LEFT JOIN documents d ON f.doc_id=d.doc_id WHERE f.entity_id=? AND f.session_id=? ORDER BY f.created_at DESC LIMIT 50",
            (entity_id, session_id)
        ).fetchall()
        fact_dicts = []
        for f in facts:
            fd = dict(f)
            fd["filename"] = fd.get("filename") or ""
            fact_dicts.append(fd)
        ent["facts"] = fact_dicts
        ent["fact_count"] = conn.execute(
            "SELECT COUNT(*) c FROM facts WHERE entity_id=? AND session_id=?", (entity_id, session_id)
        ).fetchone()["c"]

        rel_rows = conn.execute(
            "SELECT * FROM relationships WHERE session_id=? AND (src_entity_id=? OR dst_entity_id=?)",
            (session_id, entity_id, entity_id)
        ).fetchall()
        related_ids = set()
        for r in rel_rows:
            rid = r["dst_entity_id"] if r["src_entity_id"] == entity_id else r["src_entity_id"]
            related_ids.add(rid)
        related_entities = []
        for rid in related_ids:
            er = conn.execute(
                "SELECT entity_id, canonical_name, entity_type, aliases, status FROM entities WHERE entity_id=?",
                (rid,)
            ).fetchone()
            if er:
                e = dict(er)
                e["aliases"] = json.loads(e["aliases"] or "[]")
                related_entities.append(e)
        ent["related_entities"] = related_entities
        ent["related_count"] = len(related_entities)
        return ent
    finally:
        conn.close()
