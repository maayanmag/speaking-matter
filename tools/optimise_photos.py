#!/usr/bin/env python3
"""
optimise_photos.py
==================

Curate and web-optimise installation photography for the digital exhibition
portal. Reads a hand-curated manifest (CURATED below) mapping source photos
to their portal role + caption, then emits both JPEG (1600px wide @ q=82)
and WebP (1600px wide @ q=78) versions into `portal/assets/photos/`.

Also writes `portal/assets/photos/manifest.json` consumed by the photo grid
on Station 5 and by the hero / station media-frame components.

Usage
-----
    cd portal
    python3 tools/optimise_photos.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("ERROR: Pillow not installed. Run: pip install Pillow")


PORTAL_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = PORTAL_DIR.parent
SRC_INBAR = PROJECT_DIR / "final_installation_pics_and_vids" / "Inbar Zak"
SRC_OMER = PROJECT_DIR / "final_installation_pics_and_vids" / "Omer Devora"
DST = PORTAL_DIR / "assets" / "photos"

TARGET_WIDTH = 1600          # max long-edge for full-size displays
JPEG_QUALITY = 82
WEBP_QUALITY = 78

# Curated selection.
# Each entry: { id, src, station, caption, credit }
# Order in this list = display order in Station 5's grid.
CURATED = [
    # ─── Hero / wide shots ────────────────────────────
    {
        "id": "hero-installation",
        "src": SRC_INBAR / "wider_view_on_the_installation.jpg",
        "station": "hero",
        "caption": "Installation, wide view",
        "credit": "Inbar Zak",
    },
    {
        "id": "hero-stamps-stand",
        "src": SRC_INBAR / "stamps_great_pic.jpg",
        "station": "hero",
        "caption": "Stamps pedestal",
        "credit": "Inbar Zak",
    },

    # ─── Station 1 — Physical Touch ───────────────────
    {
        "id": "s1-finger-on-stamp",
        "src": SRC_INBAR / "finger_on_stamp_clay.jpg",
        "station": "station-1",
        "caption": "Finger on stamp, clay",
        "credit": "Inbar Zak",
    },
    {
        "id": "s1-stamps-closeup",
        "src": SRC_OMER / "stamps closeup.jpg",
        "station": "station-1",
        "caption": "Stamps, close-up",
        "credit": "Omer Devora",
    },
    {
        "id": "s1-hand-on-relief",
        "src": SRC_INBAR / "hand_on_relief.jpg",
        "station": "station-1",
        "caption": "Hand on relief",
        "credit": "Inbar Zak",
    },
    {
        "id": "s1-relief-good",
        "src": SRC_OMER / "relied good.jpg",
        "station": "station-1",
        "caption": "Relief tile",
        "credit": "Omer Devora",
    },

    # ─── Station 2 — Stone Code ───────────────────────
    {
        "id": "s2-code-on-wall",
        "src": SRC_INBAR / "presenting_code_on_wall.jpg",
        "station": "station-2",
        "caption": "Stone Code projected on wall",
        "credit": "Inbar Zak",
    },
    {
        "id": "s2-code-people-around",
        "src": SRC_INBAR / "presenting_code_people_around.jpg",
        "station": "station-2",
        "caption": "Visitors, Stone Code wall",
        "credit": "Inbar Zak",
    },

    # ─── Station 3 — Geological Cryptography ──────────
    {
        "id": "s3-encryption-presenting",
        "src": SRC_INBAR / "presenting_encryption.jpg",
        "station": "station-3",
        "caption": "Demonstrating Stone Vault",
        "credit": "Inbar Zak",
    },
    {
        "id": "s3-encryption-app",
        "src": SRC_OMER / "encryption app.jpg",
        "station": "station-3",
        "caption": "Stone Vault interface",
        "credit": "Omer Devora",
    },
    {
        "id": "s3-encryption-sign",
        "src": SRC_OMER / "encryption sign.jpg",
        "station": "station-3",
        "caption": "Vault signage",
        "credit": "Omer Devora",
    },

    # ─── Station 4 — Possible Stones ──────────────────
    {
        "id": "s4-possible-stones",
        "src": SRC_INBAR / "possible_stones_wide.jpg",
        "station": "station-4",
        "caption": "Possible Stones, wide",
        "credit": "Inbar Zak",
    },
    {
        "id": "s4-stones-1",
        "src": SRC_OMER / "stones1.jpg",
        "station": "station-4",
        "caption": "Source stones",
        "credit": "Omer Devora",
    },

    # ─── Documentation extras ─────────────────────────
    {
        "id": "doc-narrow-stamps",
        "src": SRC_INBAR / "narrow_stamps_pic_good.jpg",
        "station": "documentation",
        "caption": "Stamps, vertical view",
        "credit": "Inbar Zak",
    },
    {
        "id": "doc-with-people",
        "src": SRC_INBAR / "with_people.jpg",
        "station": "documentation",
        "caption": "Opening night",
        "credit": "Inbar Zak",
    },
]


def optimise_one(src: Path, dst_jpg: Path, dst_webp: Path) -> tuple[int, int]:
    """Open source, resize to TARGET_WIDTH, write JPEG + WebP. Return (jpg_bytes, webp_bytes)."""
    with Image.open(src) as im:
        # honour EXIF orientation so portraits aren't sideways
        im = ImageOps.exif_transpose(im).convert("RGB")
        if im.width > TARGET_WIDTH:
            ratio = TARGET_WIDTH / im.width
            im = im.resize((TARGET_WIDTH, round(im.height * ratio)), Image.LANCZOS)
        im.save(dst_jpg, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        im.save(dst_webp, format="WEBP", quality=WEBP_QUALITY, method=6)
    return dst_jpg.stat().st_size, dst_webp.stat().st_size


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []
    total_jpg = total_webp = 0

    for entry in CURATED:
        src: Path = entry["src"]
        if not src.exists():
            print(f"  · MISSING  {src}")
            continue
        dst_jpg = DST / f"{entry['id']}.jpg"
        dst_webp = DST / f"{entry['id']}.webp"
        jpg_size, webp_size = optimise_one(src, dst_jpg, dst_webp)
        total_jpg += jpg_size
        total_webp += webp_size
        manifest.append({
            "id": entry["id"],
            "jpg": f"./assets/photos/{dst_jpg.name}",
            "webp": f"./assets/photos/{dst_webp.name}",
            "station": entry["station"],
            "caption": entry["caption"],
            "credit": entry["credit"],
        })
        print(f"  ✓ {entry['id']:<28}  {jpg_size//1024:>4} KB jpg · {webp_size//1024:>4} KB webp")

    (DST / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nTotals: {total_jpg/1024/1024:.2f} MB jpg · {total_webp/1024/1024:.2f} MB webp"
          f"  ({len(manifest)} photos)")
    print(f"Wrote manifest → assets/photos/manifest.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
