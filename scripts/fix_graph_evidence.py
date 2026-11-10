from pathlib import Path
p=Path('intel_store.py');s=p.read_text(encoding='utf-8')
a=s.index('        # Also bridge via relationships');b=s.index('        edges = []',a)
s=s[:a]+s[b:]
s=s.replace('"evidence": f"{count} shared entity/connection{\'s\' if count > 1 else \'\'}",', '''"evidence": "Shared entities: " + ", ".join(conn.execute("SELECT canonical_name FROM entities WHERE entity_id=?", (eid,)).fetchone()[0] for eid in sorted(entities_a & entities_b)),''')
p.write_text(s,encoding='utf-8')
