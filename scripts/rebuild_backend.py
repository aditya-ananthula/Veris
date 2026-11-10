from pathlib import Path

def edit(name, old, new):
    p = Path(name)
    text = p.read_text(encoding='utf-8-sig')
    assert old in text, (name, old[:80])
    p.write_text(text.replace(old, new), encoding='utf-8')

edit('config.py', 'os.environ.get("VERIS_CHROMA_DIR", "").strip()', 'os.environ.get("VERIS_CHROMA_DIR", os.path.join(DATA_DIR, "vectors")).strip()')
edit('intel_store.py', 'CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(session_id);', '''CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(session_id);
CREATE TABLE IF NOT EXISTS document_sources (
    doc_id TEXT PRIMARY KEY, content BLOB NOT NULL, size_bytes INTEGER NOT NULL
);''')
edit('intel_store.py', '"SELECT * FROM documents WHERE session_id=? ORDER BY filename COLLATE NOCASE"', '"SELECT d.*, s.size_bytes, s.doc_id IS NOT NULL AS source_available FROM documents d LEFT JOIN document_sources s ON s.doc_id=d.doc_id WHERE session_id=? ORDER BY created_at DESC"')
edit('intel_store.py', '''        return [dict(r) for r in rows]
    finally:
        conn.close()

def delete_session_document''', '''        result = []
        for row in rows:
            d = dict(row)
            facts = conn.execute("SELECT subject, attribute, value, entity_id FROM facts WHERE doc_id=? AND status='validated'", (d['doc_id'],)).fetchall()
            d['key_topics'] = sorted({f['subject'] for f in facts})[:12]
            d['entity_count'] = len({f['entity_id'] for f in facts if f['entity_id']})
            d['summary'] = next((f['value'] for f in facts if f['attribute'] == 'summary'), None)
            result.append(d)
        return result
    finally:
        conn.close()

def delete_session_document''')
edit('intel_store.py', '''            for doc_id in ids:
                conn.execute("DELETE FROM relationships WHERE doc_id=?", (doc_id,))''', '''            for doc_id in ids:
                _delete_contradictions(conn, doc_id)
                conn.execute("DELETE FROM relationships WHERE doc_id=?", (doc_id,))''')
edit('intel_store.py', '''                if conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='contradictions'").fetchone():
                    conn.execute("DELETE FROM contradictions WHERE fact_a_id=? OR fact_b_id=?", (doc_id, doc_id))''', '')
edit('intel_store.py', '''                conn.execute("DELETE FROM documents WHERE doc_id=?", (doc_id,))''', '''                conn.execute("DELETE FROM document_sources WHERE doc_id=?", (doc_id,))
                conn.execute("DELETE FROM documents WHERE doc_id=?", (doc_id,))
            _prune_entities(conn, session_id)''')
edit('intel_store.py', '''        try:
            conn.execute("DELETE FROM relationships WHERE doc_id=?", (doc_id,))''', '''        try:
            _delete_contradictions(conn, doc_id)
            conn.execute("DELETE FROM relationships WHERE doc_id=?", (doc_id,))''')
edit('intel_store.py', '"INSERT INTO facts (', '"INSERT OR IGNORE INTO facts (')
# No semantic relationship can be inferred from arbitrary neighboring entity names.
edit('intel_extract.py', '''                sent_lower = sent.lower()
                for trigger, rname in COMMON_VERBS:
                    if trigger in sent_lower:
                        rel_type = rname
                        break
''', '')
edit('intel_extract.py', '''        if not src or not dst or src == dst:
''', '''        if not src or not dst or src == dst or rel.evidence.strip() not in document_text:
''')
edit('intel_extract.py', '- Each fact needs verbatim evidence', '- Relationships must preserve the subject as src and object as dst. Use mentioned_with only for symmetric co-occurrence. Never infer a directional verb from co-occurrence.\n- Each fact needs verbatim evidence')
# Eliminate expiry of user data, including persistent collections.
p = Path('rag_core.py'); s = p.read_text(encoding='utf-8')
a = s.index('    for collection in backend.list_collections():'); b = s.index('    collection = backend.get_or_create_collection(', a)
s = s[:a] + s[b:]
p.write_text(s, encoding='utf-8')
