"""
Cross-document claim comparison module for Veris.

Provides deterministic heuristics plus bounded LLM-assisted semantic comparison
for detecting matches, conflicts, and contradictions across document claims.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field, validator


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

class NormalizedClaim(BaseModel):
    """A single extracted claim normalized into comparable fields."""

    subject: str = Field(default="", description="Entity or topic the claim is about")
    attribute: str = Field(default="", description="Property being claimed")
    value: str = Field(default="", description="Raw value string")
    value_type: str = Field(default="text", description="one of: number, date, text, entity")
    unit: Optional[str] = Field(default=None, description="Unit of measure if numeric")
    period: Optional[str] = Field(default=None, description="Time period the claim covers")
    entity_id: Optional[str] = Field(default=None, description="Canonical entity identifier")
    source_doc_id: str = Field(default="", description="Document the claim came from")
    evidence: str = Field(default="", description="Supporting quote / snippet")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Extraction confidence 0-1")

    @validator("value_type")
    def _validate_value_type(cls, v: str) -> str:
        allowed = {"number", "date", "text", "entity"}
        if v not in allowed:
            raise ValueError(f"value_type must be one of {allowed}")
        return v

    @validator("confidence")
    def _validate_confidence(cls, v: float) -> float:
        return max(0.0, min(1.0, v))


class ComparisonResult(BaseModel):
    """Result of comparing two claims."""

    matching: bool = Field(description="True if claims agree")
    conflict: bool = Field(description="True if claims contradict")
    category: str = Field(description="one of: match, conflict, uncertain, entity-mismatch, period-difference")
    explanation: str = Field(description="Human-readable explanation")
    preserved: Dict[str, Any] = Field(default_factory=dict, description="Original fields preserved for audit")


# ---------------------------------------------------------------------------
# Payload normalization
# ---------------------------------------------------------------------------

def normalize_payload(payload: Dict[str, Any], source_doc_id: str = "") -> NormalizedClaim:
    """Normalize a raw claim dict into a NormalizedClaim."""
    return NormalizedClaim(
        subject=str(payload.get("subject", "") or "").strip(),
        attribute=str(payload.get("attribute", "") or "").strip(),
        value=str(payload.get("value", "") or "").strip(),
        value_type=str(payload.get("value_type", "text") or "text").strip().lower(),
        unit=str(payload.get("unit", "") or "").strip() or None,
        period=str(payload.get("period", "") or "").strip() or None,
        entity_id=str(payload.get("entity_id", "") or "").strip() or None,
        source_doc_id=str(source_doc_id or payload.get("source_doc_id", "") or "").strip(),
        evidence=str(payload.get("evidence", "") or "").strip(),
        confidence=float(payload.get("confidence", 1.0) or 1.0),
    )


# ---------------------------------------------------------------------------
# Deterministic comparison primitives
# ---------------------------------------------------------------------------

_NUMBER_RE = re.compile(r"[-+]?\d[\d,]*\.?\d*")


def _parse_number(text: str) -> Optional[float]:
    """Extract the first number from text, handling commas and signs."""
    if not text:
        return None
    m = _NUMBER_RE.search(text.replace(",", ""))
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None


def _parse_date(text: str) -> Optional[date]:
    """Parse common date formats. Returns None if unparseable."""
    if not text:
        return None
    text = text.strip()
    formats = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%m/%d/%Y",
        "%d/%m/%Y",
        "%B %d, %Y",
        "%b %d, %Y",
        "%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _values_conflict_num(v1: str, v2: str, tolerance: float = 0.0) -> Tuple[bool, Optional[str]]:
    """Compare two numeric values. Returns (conflict, explanation)."""
    n1 = _parse_number(v1)
    n2 = _parse_number(v2)
    if n1 is None or n2 is None:
        return False, "could not parse one or both values as numbers"
    diff = abs(n1 - n2)
    if diff <= tolerance:
        return False, f"values agree ({n1} vs {n2})"
    return True, f"values differ ({n1} vs {n2}, diff={diff:.4g})"


def _values_conflict_date(v1: str, v2: str) -> Tuple[bool, Optional[str]]:
    """Compare two dates. Returns (conflict, explanation)."""
    d1 = _parse_date(v1)
    d2 = _parse_date(v2)
    if d1 is None or d2 is None:
        return False, "could not parse one or both values as dates"
    if d1 == d2:
        return False, f"dates agree ({d1.isoformat()})"
    delta = abs((d1 - d2).days)
    return True, f"dates differ ({d1.isoformat()} vs {d2.isoformat()}, {delta} days apart)"


def _texts_match(t1: str, t2: str, threshold: float = 0.8) -> Tuple[bool, Optional[str]]:
    """Simple token-overlap text similarity. Returns (match, explanation)."""
    if not t1 or not t2:
        return bool(t1 == t2), "empty text comparison"
    s1 = set(t1.lower().split())
    s2 = set(t2.lower().split())
    if not s1 or not s2:
        return False, "one text is empty after tokenization"
    overlap = len(s1 & s2)
    union = len(s1 | s2)
    jaccard = overlap / union if union else 0.0
    if jaccard >= threshold:
        return True, f"texts match (Jaccard={jaccard:.2f})"
    return False, f"texts differ (Jaccard={jaccard:.2f})"


# ---------------------------------------------------------------------------
# Public comparison API
# ---------------------------------------------------------------------------

def compare(
    claim_a: Dict[str, Any],
    claim_b: Dict[str, Any],
    source_doc_id_a: str = "",
    source_doc_id_b: str = "",
    use_llm: bool = False,
    llm_timeout: float = 5.0,
) -> ComparisonResult:
    """Compare two claims and return a ComparisonResult.

    Deterministic heuristics handle number, date, text, and entity comparisons.
    If use_llm is True and deterministic result is "uncertain", falls back to
    _llm_semantic_compare().
    """
    ca = normalize_payload(claim_a, source_doc_id_a)
    cb = normalize_payload(claim_b, source_doc_id_b)

    preserved: Dict[str, Any] = {
        "claim_a": ca.dict(),
        "claim_b": cb.dict(),
    }

    # Entity mismatch check (when entity_ids are present and differ)
    if ca.entity_id and cb.entity_id and ca.entity_id != cb.entity_id:
        return ComparisonResult(
            matching=False,
            conflict=False,
            category="entity-mismatch",
            explanation=(
                f"Different entities: '{ca.entity_id}' vs '{cb.entity_id}'. "
                f"Cannot compare claims about different entities."
            ),
            preserved=preserved,
        )

    # Period difference check (when periods are present and differ)
    if ca.period and cb.period and ca.period != cb.period:
        return ComparisonResult(
            matching=False,
            conflict=False,
            category="period-difference",
            explanation=(
                f"Different time periods: '{ca.period}' vs '{cb.period}'. "
                f"Claims cover different periods and may not be directly comparable."
            ),
            preserved=preserved,
        )

    # Value-type-based comparison
    vt_a = ca.value_type
    vt_b = cb.value_type

    # If types differ, try to coerce or fall back to text
    if vt_a != vt_b:
        if vt_a == "number" or vt_b == "number":
            vt_a = vt_b = "number"
        elif vt_a == "date" or vt_b == "date":
            vt_a = vt_b = "date"

    conflict: bool = False
    matching: bool = False
    explanation: str = ""
    category: str = "uncertain"

    if vt_a == "number" and vt_b == "number":
        conflict, explanation = _values_conflict_num(ca.value, cb.value)
        matching = not conflict
        category = "conflict" if conflict else "match"

    elif vt_a == "date" and vt_b == "date":
        conflict, explanation = _values_conflict_date(ca.value, cb.value)
        matching = not conflict
        category = "conflict" if conflict else "match"

    else:
        match, explanation = _texts_match(ca.value, cb.value)
        matching = match
        conflict = not match
        category = "match" if match else "conflict"

    # Adjust confidence weighting
    if ca.confidence < 0.5 or cb.confidence < 0.5:
        if category == "conflict":
            category = "uncertain"
        explanation += f" (low extraction confidence: {ca.confidence:.2f}, {cb.confidence:.2f})"

    # LLM fallback for uncertain cases
    if use_llm and category == "uncertain":
        llm_result = _llm_semantic_compare(ca, cb, timeout=llm_timeout)
        if llm_result:
            category = llm_result.get("category", category)
            matching = llm_result.get("matching", matching)
            conflict = llm_result.get("conflict", conflict)
            explanation = llm_result.get("explanation", explanation)
            preserved["llm_assisted"] = True

    return ComparisonResult(
        matching=matching,
        conflict=conflict,
        category=category,
        explanation=explanation,
        preserved=preserved,
    )


# ---------------------------------------------------------------------------
# LLM-assisted semantic comparison (with timeout/fallback)
# ---------------------------------------------------------------------------

def _llm_semantic_compare(
    claim_a: NormalizedClaim,
    claim_b: NormalizedClaim,
    timeout: float = 5.0,
) -> Optional[Dict[str, Any]]:
    """Use an LLM to semantically compare two claims.

    Attempts to call Groq (or OpenAI-compatible) API.  On any failure
    (timeout, network, missing key, parse error) returns None so the caller
    can fall back to the deterministic result.
    """
    try:
        import os
        import json

        api_key = os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None

        try:
            import httpx
        except ImportError:
            return None

        base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
        model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

        prompt = (
            "You are a careful claim-comparison assistant. Compare the two "
            "normalized claims below and return ONLY a JSON object with keys: "
            "matching (bool), conflict (bool), category (one of: match, "
            "conflict, uncertain), explanation (string).\n\n"
            f"Claim A: subject={claim_a.subject!r}, attribute={claim_a.attribute!r}, "
            f"value={claim_a.value!r}, type={claim_a.value_type!r}, "
            f"unit={claim_a.unit!r}, period={claim_a.period!r}, "
            f"entity_id={claim_a.entity_id!r}\n"
            f"Claim B: subject={claim_b.subject!r}, attribute={claim_b.attribute!r}, "
            f"value={claim_b.value!r}, type={claim_b.value_type!r}, "
            f"unit={claim_b.unit!r}, period={claim_b.period!r}, "
            f"entity_id={claim_b.entity_id!r}\n"
        )

        with httpx.Client(timeout=timeout) as client:
            resp = client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.0,
                    "max_tokens": 300,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"]["content"]
        content = content.strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\n", "", content)
            content = re.sub(r"\n```$", "", content)
        result = json.loads(content)
        return {
            "matching": bool(result.get("matching", False)),
            "conflict": bool(result.get("conflict", False)),
            "category": str(result.get("category", "uncertain")),
            "explanation": str(result.get("explanation", "")),
        }

    except Exception:
        return None


# ---------------------------------------------------------------------------
# Batch comparison helper
# ---------------------------------------------------------------------------

def compare_all_pairs(
    claims: List[Dict[str, Any]],
    source_doc_ids: Optional[List[str]] = None,
    use_llm: bool = False,
) -> List[ComparisonResult]:
    """Compare all unique pairs of claims. Returns list of ComparisonResult."""
    results: List[ComparisonResult] = []
    n = len(claims)
    for i in range(n):
        for j in range(i + 1, n):
            sid_a = source_doc_ids[i] if source_doc_ids else ""
            sid_b = source_doc_ids[j] if source_doc_ids else ""
            results.append(
                compare(claims[i], claims[j], sid_a, sid_b, use_llm=use_llm)
            )
    return results


if __name__ == "__main__":
    c1 = {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number", "entity_id": "company_A", "period": "2024"}
    c2 = {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number", "entity_id": "company_A", "period": "2024"}
    c3 = {"subject": "Revenue", "attribute": "total", "value": "1500000", "value_type": "number", "entity_id": "company_A", "period": "2024"}
    c4 = {"subject": "Revenue", "attribute": "total", "value": "2024-01-15", "value_type": "date", "entity_id": "company_A", "period": "Q1"}

    print("Match:", compare(c1, c2))
    print("Conflict (num):", compare(c1, c3))
    print("Conflict (date):", compare(c4, {"subject": "Revenue", "attribute": "total", "value": "2024-06-15", "value_type": "date", "entity_id": "company_A", "period": "Q1"}))
    print("Entity mismatch:", compare(c1, {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number", "entity_id": "company_B", "period": "2024"}))
    print("Period difference:", compare(c1, {"subject": "Revenue", "attribute": "total", "value": "1000000", "value_type": "number", "entity_id": "company_A", "period": "2023"}))
