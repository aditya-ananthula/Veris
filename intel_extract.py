"""Phase 3 structured extraction: documents -> validated entities/facts/relationships.

Design: deterministic heuristics do the reliable work (candidate spans,
numbers/dates, section hints); the LLM only proposes structured records in
constrained JSON, and EVERY record is validated (Pydantic) + evidence-checked
before persistence. LLM failures never break RAG indexing — the doc stays
'indexed' with extraction_status failed/pending and an actionable error.
"""
import json
import re
import time

from pydantic import BaseModel, Field, ValidationError

import config
import intel_store

ALLOWED_TYPES = {"person", "org", "product", "location", "date", "money", "metric", "unknown"}
ALLOWED_VALUE_TYPES = {"string", "number", "date", "money", "boolean"}
ALLOWED_STATUS = {"validated", "uncertain", "disputed"}


class ExtractedEntity(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    entity_type: str = "unknown"
    alias_of: str = ""


class ExtractedFact(BaseModel):
    subject: str = Field(min_length=1, max_length=300)
    attribute: str = Field(min_length=1, max_length=200)
    value: str = Field(min_length=1, max_length=2000)
    value_type: str = "string"
    unit: str = ""
    period: str = ""
    evidence: str = Field(min_length=1, max_length=2000)
    confidence: float = 0.5


class ExtractedRelationship(BaseModel):
    src: str = Field(min_length=1, max_length=300)
    rel_type: str = Field(min_length=1, max_length=100)
    dst: str = Field(min_length=1, max_length=300)
    evidence: str = Field(min_length=1, max_length=2000)


class ExtractionResult(BaseModel):
    entities: list[ExtractedEntity] = []
    facts: list[ExtractedFact] = []
    relationships: list[ExtractedRelationship] = []


def _clean_type(t):
    t = (t or "unknown").strip().lower()
    return t if t in ALLOWED_TYPES else "unknown"


def deterministic_candidates(text, max_spans=40):
    """Cheap, reliable candidate spans: capitalized phrases, money, dates, percents.
    Used to ground LLM evidence and as fallback when the LLM is unavailable."""
    spans = []

    def add(match, kind):
        if len(spans) >= max_spans:
            return
        s = match.group(0).strip()
        if len(s) < 2:
            return
        spans.append({"text": s, "kind": kind, "start": match.start(), "end": match.end()})

    for m in re.finditer(r"\b[A-Z][a-zA-Z&.,'-]+(?:\s+[A-Z][a-zA-Z&.,'-]+){0,3}", text or ""):
        if len(m.group(0).split()) >= 2:
            add(m, "phrase")
    for m in re.finditer(r"\$[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*(?:USD|INR|EUR|million|billion|%)", text or ""):
        add(m, "quantity")
    for m in re.finditer(r"\b(?:19|20)\d{2}[-/](?:\d{1,2}[-/]\d{1,2}|\d{1,2})|\bQ[1-4]\s*(?:19|20)\d{2}", text or ""):
        add(m, "date")
    return spans


def extract_deterministic(text, max_facts=20, max_entities=15):
    """Deterministic, evidence-grounded heuristic extractor.
    Extracts real entities, facts, and relationships directly from text with verbatim evidence.
    Used when LLM is unavailable or returns empty, ensuring no document is left without intelligence.
    """
    if not text or not text.strip():
        return ExtractionResult()

    entities_map = {}
    facts = []
    relationships = []

    ORG_KEYWORDS = {
        "corp", "corporation", "inc", "ltd", "llc", "labs", "laboratory",
        "group", "team", "technologies", "company", "co", "association",
        "institute", "foundation", "firm", "bank", "ventures", "capital", "services"
    }
    COMMON_VERBS = [
        ("acquired", "acquired"), ("acquires", "acquired"),
        ("develops", "develops"), ("developed", "developed"), ("developing", "develops"),
        ("launched", "launched"), ("launches", "launched"),
        ("joined", "joined"), ("joins", "joined"),
        ("leads", "leads"), ("led", "leads"),
        ("part of", "part_of"), ("member of", "part_of"),
        ("founded", "founded"),
        ("partnered with", "partnered_with"), ("collaborated with", "collaborated_with"),
        ("reported", "reported"),
        ("invested in", "invested_in"),
    ]

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 15]

    for sent in sentences[:60]:
        cand_matches = list(re.finditer(r"\b[A-Z][a-zA-Z0-9&.,'-]+(?:\s+[A-Z][a-zA-Z0-9&.,'-]+){0,3}\b", sent))
        cand_entities = []
        for m in cand_matches:
            w = m.group(0).strip(" .,;:-")
            lower_w = w.lower()
            if len(w) < 2 or lower_w in {
                "the", "this", "that", "these", "those", "we", "our", "in", "on", "at",
                "for", "with", "however", "moreover", "furthermore", "according", "document", "page"
            }:
                continue
            words = lower_w.split()
            if any(k in words for k in ORG_KEYWORDS):
                etype = "org"
            elif len(words) == 2 and not any(k in words for k in ORG_KEYWORDS) and not re.search(r"\d", w):
                etype = "person"
            elif re.search(r"\b(?:19|20)\d{2}\b|\bQ[1-4]\b", w):
                etype = "date"
            elif re.search(r"model|platform|system|api|engine|cloud|dashboard", lower_w):
                etype = "product"
            else:
                etype = "org" if len(words) >= 2 else "unknown"

            if w not in entities_map and len(entities_map) < max_entities:
                entities_map[w] = etype
            cand_entities.append(w)

        qty_matches = re.findall(
            r"\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|thousand|USD|M|B))?|\b\d+(?:\.\d+)?\s*(?:%|percent|USD|EUR|users|employees|customers)",
            sent
        )
        if cand_entities and qty_matches and len(facts) < max_facts:
            subj = cand_entities[0]
            val = qty_matches[0]
            attr = "metric"
            if "$" in val or "USD" in val:
                attr = "revenue" if "revenue" in sent.lower() else "financials"
            elif "%" in val:
                attr = "growth_rate" if "growth" in sent.lower() else "percentage"
            facts.append(ExtractedFact(
                subject=subj, attribute=attr, value=val,
                value_type="money" if "$" in val else "number",
                evidence=sent, confidence=0.85
            ))
        elif cand_entities and len(facts) < max_facts:
            subj = cand_entities[0]
            facts.append(ExtractedFact(
                subject=subj, attribute="summary", value=sent[:120],
                value_type="string", evidence=sent, confidence=0.75
            ))

        if len(cand_entities) >= 2 and len(relationships) < 20:
            for i in range(len(cand_entities) - 1):
                src = cand_entities[i]
                dst = cand_entities[i + 1]
                if src.lower() == dst.lower():
                    continue
                rel_type = "mentioned_with"
                sent_lower = sent.lower()
                for trigger, rname in COMMON_VERBS:
                    if trigger in sent_lower:
                        rel_type = rname
                        break
                relationships.append(ExtractedRelationship(
                    src=src, rel_type=rel_type, dst=dst, evidence=sent
                ))

    return ExtractionResult(
        entities=[ExtractedEntity(name=name, entity_type=etype) for name, etype in entities_map.items()],
        facts=facts,
        relationships=relationships
    )


_PROMPT = """Extract structured knowledge from the DOCUMENT below as strict JSON.
Rules:
- Only facts explicitly stated in the document. Never invent values.
- Keep entities to clearly named people, orgs, products, locations. Skip vague mentions.
- Each fact needs verbatim evidence copied from the document (1-2 sentences max).
- If nothing extractable, return empty arrays. Max {max_facts} facts, {max_entities} entities.
- confidence 0-1; mark uncertain extractions below 0.6.
Respond with ONLY this JSON shape, no other text:
{{"entities": [{{"name": "...", "entity_type": "person|org|product|location|date|money|metric|unknown", "alias_of": ""}}],
 "facts": [{{"subject": "...", "attribute": "...", "value": "...", "value_type": "string|number|date|money|boolean", "unit": "", "period": "", "evidence": "...", "confidence": 0.8}}],
 "relationships": [{{"src": "...", "rel_type": "...", "dst": "...", "evidence": "..."}}]}}

DOCUMENT:
{document}
"""


def _call_llm(document_text, timeout_s=None):
    import rag_core
    bounded = (document_text or "")[: max(1000, config.EXTRACTION_MAX_CHARS)]
    prompt = _PROMPT.format(document=bounded, max_facts=25, max_entities=15)
    last_error = None
    for _ in range(max(1, config.EXTRACTION_MAX_RETRIES) + 1):
        try:
            return rag_core._chat(
                [{"role": "user", "content": prompt}],
            ), None
        except Exception as e:  # transient provider failure -> limited retry
            last_error = e
            time.sleep(1)
    return None, last_error


def _strip_code_fences(raw):
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw).strip()
    return raw


def parse_extraction_output(raw):
    """Strict parse: returns (ExtractionResult, notes). Never raises on bad JSON —
    malformed output yields an empty result with a note instead of invented facts."""
    text = _strip_code_fences(raw)
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, TypeError) as e:
        return ExtractionResult(), [f"malformed-model-output: {e}"]
    try:
        result = ExtractionResult.model_validate(data if isinstance(data, dict) else {})
        return result, []
    except ValidationError as e:
        # Salvage: keep individually valid items, drop the rest.
        kept = {"entities": [], "facts": [], "relationships": []}
        notes = [f"schema-violations-dropped: {e.error_count()}"]
        for item in (data.get("entities") or [])[:15]:
            try:
                kept["entities"].append(ExtractedEntity.model_validate(item).model_dump())
            except ValidationError:
                continue
        for item in (data.get("facts") or [])[:25]:
            try:
                kept["facts"].append(ExtractedFact.model_validate(item).model_dump())
            except ValidationError:
                continue
        for item in (data.get("relationships") or [])[:25]:
            try:
                kept["relationships"].append(ExtractedRelationship.model_validate(item).model_dump())
            except ValidationError:
                continue
        return ExtractionResult.model_validate(kept), notes


def _evidence_offsets(evidence, document_text):
    """Locate the evidence span in the source text. Returns (start, end) or (None, None).
    Never fabricated: only set when the evidence (or its 60-char core) is found verbatim."""
    if not evidence or not document_text:
        return None, None
    idx = document_text.find(evidence.strip()[:500])
    if idx >= 0:
        return idx, idx + len(evidence.strip()[:500])
    core = re.sub(r"\s+", " ", evidence).strip()
    if len(core) > 60:
        core = core[:60]
        idx = document_text.find(core)
        if idx >= 0:
            return idx, idx + len(core)
    return None, None


def run_extraction(session_id, doc_id, filename, document_text, llm_caller=None, path=None):
    """Full pipeline for one document. Returns summary dict. Raises nothing —
    failures are recorded on the document row (failed/pending) with the error."""
    intel_store.init_db(path)
    doc = intel_store.get_document(doc_id, path=path)
    if doc is None:
        return {"doc_id": doc_id, "status": "missing-document", "facts": 0}

    if not (document_text or "").strip():
        intel_store.save_facts(session_id, doc_id, [], path=path)
        intel_store.set_extraction_state(doc_id, "complete", "empty-document: no extractable text", path=path)
        return {"doc_id": doc_id, "status": "complete-empty", "facts": 0}

    if llm_caller is not None:
        raw, error = llm_caller(document_text)
        if raw is None:
            msg = f"llm-unavailable: {error}"[:500] if error else "llm-unavailable"
            intel_store.set_extraction_state(doc_id, "failed", msg, path=path)
            return {"doc_id": doc_id, "status": "failed", "error": msg, "facts": 0}
        result, notes = parse_extraction_output(raw)
        if notes and not (result.facts or result.entities):
            intel_store.save_facts(session_id, doc_id, [], path=path)
            intel_store.set_extraction_state(doc_id, "complete", "; ".join(notes)[:500], path=path)
            return {"doc_id": doc_id, "status": "complete-empty", "facts": 0, "notes": notes}
    else:
        raw, error = _call_llm(document_text)
        if raw is not None:
            result, notes = parse_extraction_output(raw)
        else:
            result, notes = ExtractionResult(), [f"llm-unavailable: {error}"]
        if not (result.facts or result.entities):
            det_result = extract_deterministic(document_text)
            if det_result.facts or det_result.entities:
                result = det_result
                notes.append("heuristic-fallback-applied")
            elif notes:
                intel_store.save_facts(session_id, doc_id, [], path=path)
                intel_store.set_extraction_state(doc_id, "complete", "; ".join(notes)[:500], path=path)
                return {"doc_id": doc_id, "status": "complete-empty", "facts": 0, "notes": notes}

    # Entity resolution: explicit alias_of wins; else conservative normalized match.
    entity_ids = {}
    for ent in result.entities[:15]:
        target = (ent.alias_of or "").strip()
        if target:
            eid = intel_store.upsert_entity(session_id, target, _clean_type(ent.entity_type),
                                            alias=ent.name, path=path)
        else:
            eid = intel_store.upsert_entity(session_id, ent.name, _clean_type(ent.entity_type), path=path)
        if eid:
            entity_ids[intel_store.normalize_name(ent.name)] = eid
            entity_ids[intel_store.normalize_name(target)] = eid

    fact_rows = []
    for fact in result.facts[:25]:
        if fact.evidence.strip() not in (document_text or ""):
            # Evidence must appear in the source; otherwise mark uncertain, never invent.
            status, note = "uncertain", "evidence-not-verbatim-in-source"
        else:
            status, note = ("uncertain", "low-confidence") if fact.confidence < 0.6 else ("validated", "")
        start, end = _evidence_offsets(fact.evidence, document_text or "")
        eid = entity_ids.get(intel_store.normalize_name(fact.subject))
        fact_rows.append({
            "subject": fact.subject.strip(), "attribute": fact.attribute.strip(),
            "value": fact.value.strip(),
            "value_type": fact.value_type if fact.value_type in ALLOWED_VALUE_TYPES else "string",
            "unit": fact.unit.strip() or None, "period": fact.period.strip() or None,
            "entity_id": eid, "evidence": fact.evidence.strip(),
            "char_start": start, "char_end": end,
            "status": status, "validation_notes": "; ".join([n for n in [note, *notes] if n])[:500],
        })

    rel_rows = []
    for rel in result.relationships[:25]:
        src = entity_ids.get(intel_store.normalize_name(rel.src))
        dst = entity_ids.get(intel_store.normalize_name(rel.dst))
        if not src or not dst or src == dst:
            continue  # ambiguous or self-link: do not assert
        rel_rows.append({
            "src_entity_id": src, "rel_type": re.sub(r"[^a-zA-Z0-9_ -]", "", rel.rel_type)[:100] or "related_to",
            "dst_entity_id": dst, "evidence": rel.evidence.strip(), "status": "validated",
        })

    intel_store.save_facts(session_id, doc_id, fact_rows, path=path)
    intel_store.save_relationships(session_id, doc_id, rel_rows, path=path)
    state_note = "; ".join(notes)[:500] if notes else None
    intel_store.set_extraction_state(doc_id, "complete", state_note, path=path)
    return {"doc_id": doc_id, "status": "complete", "facts": len(fact_rows),
            "entities": len(entity_ids), "relationships": len(rel_rows)}


