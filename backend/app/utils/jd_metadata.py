"""
jd_metadata.py
--------------
Lightweight heuristic extractor for job description metadata.

Extracts job_title and company_name from raw job description text using
regex and line-scanning heuristics. Never raises — returns None for any
field it cannot confidently identify.

Why heuristics and not AI?
  This runs synchronously before the AI call, adding zero latency.
  The extracted fields are display metadata only (shown in history).
  Imperfect extraction is acceptable — users see the data as a hint,
  not as a contract.

Usage:
    from app.utils.jd_metadata import extract_job_metadata
    meta = extract_job_metadata(jd_text)
    job_title = meta["job_title"]    # str | None
    company_name = meta["company_name"]  # str | None
"""

from __future__ import annotations

import re


# ── Constants ─────────────────────────────────────────────────────────────────

# Common seniority / role words that suggest a line is a job title
_TITLE_KEYWORDS = re.compile(
    r"\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|associate|"
    r"engineer|developer|manager|director|analyst|designer|architect|"
    r"scientist|specialist|consultant|coordinator|intern|vp|vice president|"
    r"head of|chief|officer|president|full.?stack|backend|frontend|"
    r"mobile|devops|platform|data|ml|ai|product|project|program)\b",
    re.IGNORECASE,
)

# Company indicator patterns
_COMPANY_PATTERNS = [
    # "at Acme Corp" / "@ Acme Inc"
    re.compile(r"\bat\s+([A-Z][^\n,]{2,50}(?:Inc\.?|Ltd\.?|LLC|Corp\.?|Co\.?|Group|Labs?|Technologies|Tech|Software|Solutions)?)", re.IGNORECASE),
    # "About Acme"
    re.compile(r"^about\s+([A-Z][^\n,]{2,50})", re.IGNORECASE | re.MULTILINE),
    # Lines that contain company suffixes standalone
    re.compile(r"^([A-Z][A-Za-z0-9 &.'-]{1,50}(?:Inc\.?|Ltd\.?|LLC|Corp\.?|Co\.|Group|Labs?|Technologies|Tech|Software|Solutions))\s*$", re.MULTILINE),
]

# Lines to skip entirely when scanning for titles (noise)
_SKIP_LINES = re.compile(
    r"^(job (description|summary|posting|id|req|reference)|"
    r"location|salary|compensation|benefits|requirements?|"
    r"responsibilities|qualifications?|about (us|the|this)|"
    r"we are|we're|our (team|company|mission)|apply now|"
    r"full.?time|part.?time|remote|hybrid|on.?site|\d+|\s*)$",
    re.IGNORECASE,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clean(text: str) -> str:
    """Strip extra whitespace and normalize dashes/quotes."""
    return re.sub(r"\s+", " ", text).strip(" \t\r\n-–—|•")


def _is_title_line(line: str) -> bool:
    """Return True if the line looks like a job title."""
    cleaned = _clean(line)
    if not cleaned or len(cleaned) > 100 or len(cleaned) < 3:
        return False
    if _SKIP_LINES.match(cleaned):
        return False
    if _TITLE_KEYWORDS.search(cleaned):
        return True
    return False


# ── Public API ────────────────────────────────────────────────────────────────

def extract_job_metadata(job_description: str) -> dict[str, str | None]:
    """
    Extract job_title and company_name from raw job description text.

    Parameters
    ----------
    job_description : Raw job description string (300–10,000 chars)

    Returns
    -------
    dict with keys:
        job_title    : str | None — best candidate title, ≤ 100 chars
        company_name : str | None — best candidate company name, ≤ 100 chars
    """
    job_title: str | None = None
    company_name: str | None = None

    try:
        lines = job_description.splitlines()

        # ── Job title: scan first 10 non-empty lines for title keywords ───────
        for line in lines[:10]:
            stripped = _clean(line)
            if stripped and _is_title_line(stripped):
                job_title = stripped[:100]
                break

        # Fallback: first non-empty short line (≤ 80 chars) as title
        if not job_title:
            for line in lines[:5]:
                stripped = _clean(line)
                if stripped and 3 <= len(stripped) <= 80 and not _SKIP_LINES.match(stripped):
                    job_title = stripped[:100]
                    break

        # ── Company name: try patterns against first 500 chars ────────────────
        head = job_description[:500]
        for pattern in _COMPANY_PATTERNS:
            match = pattern.search(head)
            if match:
                candidate = _clean(match.group(1))
                if 2 <= len(candidate) <= 100:
                    company_name = candidate
                    break

    except Exception:  # noqa: BLE001 — never raise from metadata extraction
        pass

    return {"job_title": job_title, "company_name": company_name}
