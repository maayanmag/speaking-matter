#!/usr/bin/env python3
"""
extract_docx_to_json.py
=======================

Parse the Hebrew .docx files in `/texts/` and emit a structured JSON locale
file (`portal/content/i18n.he.json`) ready for hydration via `js/i18n.js`.

The Hebrew text is NOT yet displayed on the live English-only site — but we
extract it now so a future EN/HE toggle has a clean source of truth.

Mapping (file → locale key):

    אבני המקום - טקסט ראשי.docx   → meta.intro          (main exhibition text)
    חותמות.docx                    → station-1.he       (stamps)
    תבליטים.docx                    → station-1.he.alt   (reliefs)
    קוד האבן.docx                   → station-2.he       (stone code)
    כספת האבן.docx                  → station-3.he       (stone vault)
    אבנים אפשריות.docx              → station-4.he       (possible stones)
    lables for stamps.docx         → labels.stamps      (stamp labels)

Each value is an array of paragraph strings (preserving paragraph breaks)
so the i18n hydrator can render <p> blocks.

Usage
-----
    cd portal
    python3 tools/extract_docx_to_json.py

Requires
--------
    pip install python-docx
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    from docx import Document
except ImportError:
    sys.exit("ERROR: python-docx not installed. Run: pip install python-docx")


PORTAL_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = PORTAL_DIR.parent
TEXTS_DIR = PROJECT_DIR / "texts"
OUTPUT = PORTAL_DIR / "content" / "i18n.he.json"

# Filename glob → dotted locale key path.
# Globs (not exact names) handle filename variants — e.g. the main text file
# has cantillation marks (niqqud) and a leading space that defy simple matching.
DOCX_MAP = {
    "*טקסט ראשי*.docx": "meta.intro",
    "חותמות.docx": "station-1.he",
    "תבליטים.docx": "station-1.alt",
    "קוד האבן.docx": "station-2.he",
    "כספת האבן.docx": "station-3.he",
    "אבנים אפשריות.docx": "station-4.he",
    "lables for stamps.docx": "labels.stamps",
}


def extract_paragraphs(path: Path) -> list[str]:
    """Return non-empty paragraphs from a .docx, preserving order."""
    doc = Document(path)
    paras: list[str] = []
    for p in doc.paragraphs:
        text = (p.text or "").strip()
        # collapse internal whitespace runs
        text = re.sub(r"[ \t]+", " ", text)
        if text:
            paras.append(text)
    return paras


def set_deep(obj: dict, dotted_key: str, value) -> None:
    """Set `obj['a']['b']` from dotted 'a.b'."""
    keys = dotted_key.split(".")
    for key in keys[:-1]:
        obj = obj.setdefault(key, {})
    obj[keys[-1]] = value


def main() -> int:
    if not TEXTS_DIR.exists():
        sys.exit(f"ERROR: texts dir not found: {TEXTS_DIR}")

    locale: dict = {
        "_source": "Extracted from /texts/*.docx by tools/extract_docx_to_json.py",
        "_note": "Each value is a list of paragraph strings (preserves paragraph breaks for <p> rendering).",
    }

    found = 0
    for pattern, key in DOCX_MAP.items():
        # glob match (case-sensitive) so we can handle filename variants
        matches = [p for p in TEXTS_DIR.glob(pattern) if not p.name.startswith("~$")]
        if not matches:
            print(f"  · SKIP   {pattern}  (no match)")
            continue
        path = matches[0]
        paras = extract_paragraphs(path)
        if not paras:
            print(f"  · EMPTY  {path.name}")
            continue
        set_deep(locale, key, paras)
        print(f"  ✓ {key:<18} ← {path.name}  ({len(paras)} paragraphs)")
        found += 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(locale, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUTPUT.relative_to(PORTAL_DIR)}  ({found} files extracted)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
