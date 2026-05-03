#!/usr/bin/env python3
"""
build_i18n.py
=============

Build the bilingual (Hebrew + English) locale JSON files consumed by
`portal/js/i18n.js`. Both languages share an identical key structure so
the HE/EN toggle in the site header swaps content cleanly.

Sources
-------
- English (rich):    /texts/english_translations/*.md   (markdown with H2/H3)
- Hebrew  (paragraphs): /texts/*.docx                   (extracted via python-docx)

Output
------
- portal/content/i18n.en.json
- portal/content/i18n.he.json

Key shape
---------
    {
      "meta":     { "site_title", "tagline" },
      "nav":      { "touch", "code", "vault", "fictions", "documentation" },
      "hero":     { "eyebrow", "title", "sub", "scroll_hint" },
      "station-1": { "eyebrow", "title", "body": "<html>", "label" },
      "station-2": { ... },
      "station-3": { ... },
      "station-4": { ... },
      "station-5": { "eyebrow", "title" },
      "footer":   { "tagline", "credits_title", "credits", "code_title", "colophon" }
    }
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import markdown
    from docx import Document
except ImportError as e:
    sys.exit(f"ERROR: missing dep ({e}). Run: pip install markdown python-docx")


PORTAL_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = PORTAL_DIR.parent
TEXTS_DIR = PROJECT_DIR / "texts"
EN_DIR = TEXTS_DIR / "english_translations"

# ─── English markdown → station mapping ───────────────────────────────
# Each EN file → dict of which station to populate.
# We split each MD into "body" (the H2-led prose) and "label" (the
# trailing 50-word gallery label).
EN_FILES = {
    "02_Local_Signature.md":         "station-1",  # stamps
    "05_Relief_Tiles.md":            "station-2",  # reliefs (NEW)
    "04_Stone_Code.md":              "station-3",  # stone code
    "03_Geological_Cryptography.md": "station-4",  # vault
    "01_Possible_Stones.md":         "station-5",  # possible stones / fictions
}

# Optional Hebrew docx → matching key path
HE_FILES = {
    "חותמות.docx":         "station-1",  # stamps
    "תבליטים.docx":         "station-2",  # reliefs
    "קוד האבן.docx":         "station-3",  # stone code
    "כספת האבן.docx":        "station-4",  # vault
    "אבנים אפשריות.docx":    "station-5",  # possible stones
}

# ─── Static UI strings (per locale) ───────────────────────────────────
STATIC = {
    "en": {
        "meta": {
            "site_title": "Speaking Matter",
            "tagline": "A digital twin of the physical exhibition — stones, scans, and cryptography.",
        },
        "nav": {
            "touch": "Stamps",
            "reliefs": "Reliefs",
            "code": "Code",
            "vault": "Vault",
            "fictions": "Fictions",
            "documentation": "Documentation",
        },
        "a11y": {
            "skip": "Skip to content",
        },
        "ui": {
            "read_more": "Read more",
            "zoom_hint": "Click to zoom",
            "zoom_help": "Wheel · pinch · double-click to zoom · drag to pan",
            "swipe_hint": "Swipe or use ◀ ▶ to move between stations",
            "prev_label": "Previous",
            "next_label": "Next",
        },
        "vault": {
            "intro": "Each stone's topography hashes to a 256-bit AES-GCM key. Pick a stone, type a message, and try to decrypt it with the same — or a different — stone.",
            "step1": "1 · Stone (key)",
            "step2": "2 · Message",
            "step3": "3 · Ciphertext (AES-256-GCM, IV ‖ ciphertext)",
            "step4": "4 · Decrypt with:",
            "encrypt": "Encrypt with stone",
            "reset": "Reset",
            "placeholder": "Type a message…",
        },
        "hero": {
            "eyebrow": "Bezalel Academy · M.Des Industrial Design · 2026",
            "title": "Speaking Matter",
            "sub": "A digital twin of the physical exhibition. The visitor moves through five stations — stamps, reliefs, code, vault, fiction — and watches matter transform into data, and back.",
            "scroll_hint": "Scroll",
        },
        "stations": {
            "station-1": {
                "eyebrow": "Station 01 / Local Signature",
                "title": "Stamps press into clay.",
            },
            "station-2": {
                "eyebrow": "Station 02 / Surface Unfolded",
                "title": "Stone skin, laid flat.",
            },
            "station-3": {
                "eyebrow": "Station 03 / Digital Anatomy",
                "title": "Surface becomes signal.",
            },
            "station-4": {
                "eyebrow": "Station 04 / Geological Cryptography",
                "title": "Encrypt with a stone.",
            },
            "station-5": {
                "eyebrow": "Station 05 / Geological Fictions",
                "title": "Stones that never were.",
            },
            "station-6": {
                "eyebrow": "Station 06 / Installation Documentation",
                "title": "The installation.",
            },
        },
        "footer": {
            "tagline": "A graduation project investigating the translation of geological matter into computational form. Bezalel Academy of Arts and Design, M.Des Industrial Design, 2026.",
            "credits_title": "Credits",
            "credits": "Photography:<br />Inbar Zak, Omer Devora",
            "code_title": "Code",
            "colophon": "© 2026 Maayan Magenheim · built with stones, code, and a lot of clay",
        },
    },
    "he": {
        "meta": {
            "site_title": "דומם מדבר",
            "tagline": "תאום דיגיטלי לתערוכה הפיזית — אבנים, סריקה והצפנה.",
        },
        "nav": {
            "touch": "חותמות",
            "reliefs": "תבליטים",
            "code": "קוד",
            "vault": "כספת",
            "fictions": "פיקציות",
            "documentation": "תיעוד",
        },
        "a11y": {
            "skip": "דלג/י לתוכן",
        },
        "ui": {
            "read_more": "קרא/י עוד",
            "zoom_hint": "להגדלה — לחיצה",
            "zoom_help": "גלגלת · צביטה · לחיצה כפולה לזום · גרירה להזזה",
            "swipe_hint": "החלק/י או השתמש/י ב‑◀ ▶ למעבר בין התחנות",
            "prev_label": "הקודמת",
            "next_label": "הבאה",
        },
        "vault": {
            "intro": "כל אבן — הטופוגרפיה שלה הופכת למפתח AES-GCM של 256 ביט. בחרי אבן, הקלידי הודעה, ונסי לפענח עם אותה אבן — או עם אחרת.",
            "step1": "1 · אבן (מפתח)",
            "step2": "2 · הודעה",
            "step3": "3 · צופן (AES-256-GCM ,‏ IV ‖ צופן)",
            "step4": "4 · פענחי באמצעות:",
            "encrypt": "הצפיני עם האבן",
            "reset": "איפוס",
            "placeholder": "הקלידי הודעה…",
        },
        "hero": {
            "eyebrow": "האקדמיה לאמנות ועיצוב בצלאל · M.Des עיצוב תעשייתי · 2026",
            "title": "דומם מדבר",
            "sub": "תאום דיגיטלי לתערוכה הפיזית. המבקר/ת עובר/ת דרך חמש תחנות — חותמות, תבליטים, קוד, כספת, פיקציה — ורואה כיצד החומר הופך לנתונים וחזרה.",
            "scroll_hint": "גלילה",
        },
        "stations": {
            "station-1": {
                "eyebrow": "תחנה 01 / חתימה מקומית",
                "title": "החותמות",
                "label": "האבן הופכת לחותמת. בלחיצה אל החמר היא יוצרת תיעוד פיזי של חתימה גיאולוגית מקומית — מפגש בין זמן גיאולוגי עתיק לבין רגע אנושי שטרם התקשה.",
            },
            "station-2": {
                "eyebrow": "תחנה 02 / משטח שנפרש",
                "title": "התבליטים",
                "label": "עורה של אבן נפרש אל משטח שטוח. מפת גובה דיגיטלית הופכת לתבליט נגיש למגע — וידוי טופוגרפי של כל גרגר, כל בליה, כל זמן.",
            },
            "station-3": {
                "eyebrow": "תחנה 03 / אנטומיה דיגיטלית",
                "title": "קוד האבן",
                "label": "כשמכריחים את האבן לדבר בהקסדצימלי. כל ערך טופוגרפי הופך לבית, והמשטח הופך לרצף סימנים — האבן הופכת לקריאה ומאבדת את משמעותה בו זמנית.",
            },
            "station-4": {
                "eyebrow": "תחנה 04 / קריפטוגרפיה גיאולוגית",
                "title": "כספת האבן",
                "label": "האבן ככספת. הטופוגרפיה המקרית של פני השטח, שנפסלה במשך מיליוני שנים, הופכת למפתח קריפטוגרפי. רק האבן עצמה תוכל לפתוח את ההודעה שננעלה בה.",
            },
            "station-5": {
                "eyebrow": "תחנה 05 / פיקציות גיאולוגיות",
                "title": "אבנים אפשריות",
                "label": "כשאבן לובשת את עורה של אחרת — מה נשאר מזהותה? אבנים אפשריות חוקרת את הגבול בין צורה למשטח, בין גיאולוגיה לפיקציה, ושואלת אם אבן יכולה לשאת זיכרון של מקום שאליו לא הגיעה.",
            },
            "station-6": {
                "eyebrow": "תחנה 06 / תיעוד התערוכה",
                "title": "התערוכה",
            },
        },
        "footer": {
            "tagline": "פרויקט גמר העוסק בתרגום של חומר גיאולוגי לצורה חישובית. האקדמיה לאמנות ועיצוב בצלאל, M.Des עיצוב תעשייתי, 2026.",
            "credits_title": "קרדיטים",
            "credits": "צילום:<br />ענבר זק, עומר דבורה",
            "code_title": "קוד",
            "colophon": "© 2026 מעיין מגנהיים · נבנה מאבנים, קוד, והרבה חמר",
        },
    },
}


# ─── Markdown helpers ─────────────────────────────────────────────────

GALLERY_LABEL_RE = re.compile(
    r"---\s*\n\s*\*\*Gallery Label.*?\*\*\s*\n+(.+?)$",
    re.DOTALL | re.IGNORECASE,
)


def split_md_body_and_label(md_text: str) -> tuple[str, str]:
    """Split a markdown file into (body_md, label_text).

    The English files end with a `---` rule, then `**Gallery Label (50 words):**`,
    then italicised label paragraph. We strip that out into its own field.
    """
    m = GALLERY_LABEL_RE.search(md_text)
    if not m:
        return md_text.strip(), ""
    body = md_text[: m.start()].rstrip()
    # remove trailing '---' if present
    body = re.sub(r"\n-{3,}\s*$", "", body).rstrip()
    label_md = m.group(1).strip()
    # strip italics asterisks if present
    label_md = re.sub(r"^\*+|\*+$", "", label_md).strip()
    return body, label_md


def md_to_html(md_text: str) -> str:
    """Render markdown to HTML, dropping the leading H1 (we use our own title)."""
    if not md_text.strip():
        return ""
    # remove leading H1 line — title comes from STATIC mapping
    cleaned = re.sub(r"^\s*#\s+.*\n", "", md_text, count=1)
    html = markdown.markdown(cleaned, extensions=["extra"])
    return html.strip()


# ─── DOCX helpers ─────────────────────────────────────────────────────

def docx_to_paragraphs(path: Path) -> list[str]:
    doc = Document(path)
    paras = []
    for p in doc.paragraphs:
        text = (p.text or "").strip()
        text = re.sub(r"[ \t]+", " ", text)
        if text:
            paras.append(text)
    return paras


def paragraphs_to_html(paragraphs: list[str]) -> str:
    return "\n".join(f"<p>{p}</p>" for p in paragraphs)


# ─── Build per-language locale ────────────────────────────────────────

def build_en() -> dict:
    locale = json.loads(json.dumps(STATIC["en"]))  # deep copy
    # Inflate stations with body + label from markdown
    for fname, station_key in EN_FILES.items():
        path = EN_DIR / fname
        if not path.exists():
            print(f"  · MISSING (en) {fname}")
            continue
        md = path.read_text(encoding="utf-8")
        body_md, label_md = split_md_body_and_label(md)
        locale["stations"][station_key]["body"] = md_to_html(body_md)
        if label_md:
            locale["stations"][station_key]["label"] = label_md
        print(f"  ✓ en {station_key:<10} ← {fname}")
    return locale


def build_he() -> dict:
    locale = json.loads(json.dumps(STATIC["he"]))
    for fname, station_key in HE_FILES.items():
        # tolerate filename variants (e.g. niqqud, leading space)
        matches = [p for p in TEXTS_DIR.glob(fname) if not p.name.startswith("~$")]
        if not matches:
            print(f"  · MISSING (he) {fname}")
            continue
        paras = docx_to_paragraphs(matches[0])
        if not paras:
            print(f"  · EMPTY (he)   {fname}")
            continue
        locale["stations"][station_key]["body"] = paragraphs_to_html(paras)
        print(f"  ✓ he {station_key:<10} ← {matches[0].name}  ({len(paras)} paras)")
    return locale


def write(locale: dict, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(locale, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    size_kb = out.stat().st_size / 1024
    print(f"    wrote {out.relative_to(PORTAL_DIR)}  ({size_kb:.1f} KB)")


def main() -> int:
    print("Building English locale…")
    en = build_en()
    write(en, PORTAL_DIR / "content" / "i18n.en.json")
    print("\nBuilding Hebrew locale…")
    he = build_he()
    write(he, PORTAL_DIR / "content" / "i18n.he.json")
    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
