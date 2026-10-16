"""
Phase 4: Cross-document contradiction scanning.

Scans all validated facts in a session's store and compares claims about the
same (subject, attribute) pair across documents to surface matches, conflicts,
and contradictions. Uses intel_compare for deterministic comparison.

Results are persisted to a `contradictions` table for idempotent re-scanning
and stable conflict IDs (so the frontend can update / resolve individual
conflicts). All comparison evidence includes provenance (doc_id, fact_id,
evidence snippet).
"""
from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional, Tuple

import intel_compare
import intel_store


def _now() -> float:
    return time.time()


def _stable_id(session_id: str, fact_a_id: str, fact_b_id: str) -> str:
    """Deterministic conflict id from the two fact ids + session."""
    return intel_store.stable_id(session_id, fact_a_id, fact_b_id)


_SCHEMA = """
CREATE TABLE IF NOT EXISTS contradictions (
    conflict_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    attribute TEXT NOT NULL,
    value_a TEXT NOT NULL,
    value_b TEXT NOT NULL,
    doc_a TEXT NOT NULL,
    doc_b TEXT NOT NULL,
    fact_a_id TEXT NOT NULL,
    fact_b_id TEXT NOT NULL,
    matching INTEGER NOT NULL DEFAULT 0,
    conflict INTEGER NOT NULL DEFAULT 0,
    explanation TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL,
    evidence_a TEXT NOT NULL DEFAULT '',
    evidence_b TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_contradictions_session ON contradictions(session_id);
CREATE INDEX IF NOT EXISTS idx_contradictions_status ON contradictions(session_id, status);
CREATE INDEX IF NOT EXISTS idx_contradictions_category ON contradictions(category);
"""


def _connect(path=None):
    import config
    import sqlite3
    import os
    db_path = path or config.SQLITE_PATH
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(path=None):
    with _connect(path) as conn:
        conn.executescript(_SCHEMA)
        conn.commit()

def _load_facts(session_id: str, path=None) -> List[Dict[str, Any]]:
    """Load all validated/uncertain facts for a session, keyed for comparison."""
    return intel_store.search_facts(session_id, path=path, limit=1000)


def _group_by_subject_attribute(facts: List[Dict[str, Any]]) -> Dict[Tuple[str, str], List[Dict[str, Any]]]:
    """Group facts by (subject, attribute) so we compare claims about the same thing."""
    groups: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
    for f in facts:
        key = (str(f.get("subject", "")).strip().lower(), str(f.get("attribute", "")).strip().lower())
        groups.setdefault(key, []).append(f)
    return groups

def scan_contradictions(session_id: str, path=None, use_llm: bool = False) -> Dict[str, Any]:
    """
    Scan all facts in a session for contradictions.

    Idempotent: re-running replaces existing contradiction rows for this session.
    Returns stats plus the list of contradiction records.
    """
    init_db(path)
    facts = _load_facts(session_id, path=path)
    groups = _group_by_subject_attribute(facts)

    records: List[Dict[str, Any]] = []
    conflict_count = 0
    match_count = 0
    uncertain_count = 0
    entity_mismatch_count = 0
    period_diff_count = 0

    for (subject, attribute), group in groups.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                fa = group[i]
                fb = group[j]

                claim_a = intel_compare.normalize_payload(
                    {
                        "subject": fa.get("subject", ""),
                        "attribute": fa.get("attribute", ""),
                        "value": fa.get("value", ""),
                        "value_type": fa.get("value_type", "text"),
                        "unit": fa.get("unit"),
                        "period": fa.get("period"),
                        "entity_id": fa.get("entity_id"),
                        "evidence": fa.get("evidence", ""),
                        "confidence": fa.get("confidence", 1.0) or 1.0,
                    },
                    source_doc_id=fa.get("doc_id", ""),
                )
                claim_b = intel_compare.normalize_payload(
                    {
                        "subject": fb.get("subject", ""),
                        "attribute": fb.get("attribute", ""),
                        "value": fb.get("value", ""),
                        "value_type": fb.get("value_type", "text"),
                        "unit": fb.get("unit"),
                        "period": fb.get("period"),
                        "entity_id": fb.get("entity_id"),
                        "evidence": fb.get("evidence", ""),
                        "confidence": fb.get("confidence", 1.0) or 1.0,
                    },
                    source_doc_id=fb.get("doc_id", ""),
                )

                result = intel_compare.compare(
                    {
                        "subject": fa.get("subject", ""),
                        "attribute": fa.get("attribute", ""),
                        "value": fa.get("value", ""),
                        "value_type": fa.get("value_type", "text"),
                        "unit": fa.get("unit"),
                        "period": fa.get("period"),
                        "entity_id": fa.get("entity_id"),
                        "evidence": fa.get("evidence", ""),
                        "confidence": fa.get("confidence", 1.0) or 1.0,
                    },
                    {
                        "subject": fb.get("subject", ""),
                        "attribute": fb.get("attribute", ""),
                        "value": fb.get("value", ""),
                        "value_type": fb.get("value_type", "text"),
                        "unit": fb.get("unit"),
                        "period": fb.get("period"),
                        "entity_id": fb.get("entity_id"),
                        "evidence": fb.get("evidence", ""),
                        "confidence": fb.get("confidence", 1.0) or 1.0,
                    },
                    use_llm=use_llm,
                )

                if result.category == "conflict":
                    conflict_count += 1
                elif result.category == "match":
                    match_count += 1
                elif result.category == "uncertain":
                    uncertain_count += 1
                elif result.category == "entity-mismatch":
                    entity_mismatch_count += 1
                elif result.category == "period-difference":
                    period_diff_count += 1

                records.append(
                    {
                        "conflict_id": _stable_id(session_id, str(fa["fact_id"]), str(fb["fact_id"])),
                        "session_id": session_id,
                        "category": result.category,
                        "subject": subject,
                        "attribute": attribute,
                        "value_a": claim_a.value,
                        "value_b": claim_b.value,
                        "doc_a": claim_a.source_doc_id or fa.get("doc_id", ""),
                        "doc_b": claim_b.source_doc_id or fb.get("doc_id", ""),
                        "fact_a_id": str(fa["fact_id"]),
                        "fact_b_id": str(fb["fact_id"]),
                        "matching": bool(result.matching),
                        "conflict": bool(result.conflict),
                        "explanation": result.explanation,
                        "status": "open",
                        "created_at": _now(),
                        "updated_at": _now(),
                        "evidence_a": claim_a.evidence,
                        "evidence_b": claim_b.evidence,
                    }
                )

    with _connect(path) as conn:
        conn.execute("DELETE FROM contradictions WHERE session_id=?", (session_id,))
        for r in records:
            conn.execute(
                """INSERT INTO contradictions
                   (conflict_id, session_id, category, subject, attribute, value_a, value_b,
                    doc_a, doc_b, fact_a_id, fact_b_id, matching, conflict, explanation,
                    status, created_at, updated_at, evidence_a, evidence_b)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    r["conflict_id"], r["session_id"], r["category"], r["subject"], r["attribute"],
                    r["value_a"], r["value_b"], r["doc_a"], r["doc_b"], r["fact_a_id"], r["fact_b_id"],
                    int(r["matching"]), int(r["conflict"]), r["explanation"], r["status"],
                    r["created_at"], r["updated_at"], r["evidence_a"], r["evidence_b"],
                ),
            )
        conn.commit()

    return {
        "session_id": session_id,
        "total_compared": len(records),
        "conflicts": conflict_count,
        "matches": match_count,
        "uncertain": uncertain_count,
        "entity_mismatches": entity_mismatch_count,
        "period_differences": period_diff_count,
        "records": records,
    }

def list_contradictions(session_id: str, status: Optional[str] = None, path=None) -> List[Dict[str, Any]]:
    """List stored contradiction records for a session, optionally filtered by status."""
    init_db(path)
    with _connect(path) as conn:
        sql = "SELECT * FROM contradictions WHERE session_id=?"
        params: List[Any] = [session_id]
        if status:
            sql += " AND status=?"
            params.append(status)
        sql += " ORDER BY created_at DESC LIMIT 500"
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]


def get_contradiction(conflict_id: str, path=None) -> Optional[Dict[str, Any]]:
    """Fetch a single contradiction record by id."""
    init_db(path)
    with _connect(path) as conn:
        row = conn.execute("SELECT * FROM contradictions WHERE conflict_id=?", (conflict_id,)).fetchone()
        return dict(row) if row else None


def update_contradiction(conflict_id: str, patch: Dict[str, Any], path=None) -> Optional[Dict[str, Any]]:
    """Update mutable fields (status, validation_notes) on a contradiction record."""
    allowed = {"status", "validation_notes"}
    fields = {k: v for k, v in patch.items() if k in allowed}
    if not fields:
        return get_contradiction(conflict_id, path=path)
    fields["updated_at"] = _now()
    set_clause = ", ".join(f"{k}=?" for k in fields)
    params = list(fields.values()) + [conflict_id]
    with _connect(path) as conn:
        conn.execute(f"UPDATE contradictions SET {set_clause} WHERE conflict_id=?", params)
        conn.commit()
    return get_contradiction(conflict_id, path=path)


def get_contradiction_stats(session_id: str, path=None) -> Dict[str, Any]:
    """Aggregate stats for the contradictions dashboard."""
    init_db(path)
    with _connect(path) as conn:
        rows = conn.execute(
            """SELECT category, status, COUNT(*) c FROM contradictions
               WHERE session_id=? GROUP BY category, status""",
            (session_id,),
        ).fetchall()
        total = conn.execute(
            "SELECT COUNT(*) FROM contradictions WHERE session_id=?", (session_id,)
        ).fetchone()[0]

    stats: Dict[str, Any] = {
        "session_id": session_id,
        "total": total,
        "open": 0,
        "resolved": 0,
        "dismissed": 0,
        "by_category": {},
    }
    for r in rows:
        cat = r["category"]
        st = r["status"]
        cnt = r["c"]
        stats["by_category"].setdefault(cat, {"total": 0, "open": 0, "resolved": 0, "dismissed": 0})
        stats["by_category"][cat]["total"] += cnt
        if st == "open":
            stats["open"] += cnt
            stats["by_category"][cat]["open"] += cnt
        elif st == "resolved":
            stats["resolved"] += cnt
            stats["by_category"][cat]["resolved"] += cnt
        elif st == "dismissed":
            stats["dismissed"] += cnt
            stats["by_category"][cat]["dismissed"] += cnt
    return stats