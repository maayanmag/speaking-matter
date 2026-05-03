#!/usr/bin/env python3
"""
optimise_stone_codes.py
=======================

The raw stone_code_large.png files from milestone_4/5 are ~1 MB each at
1768×3910px (a tall hex-grid). For web display we want WebP versions at
800px wide (still very crisp) plus retain the originals for the typing
animation in Station 2.

Outputs `<id>.webp` next to each `<id>.png` in `assets/stone-codes/`.

Usage:
    cd portal
    python3 tools/optimise_stone_codes.py
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("ERROR: Pillow not installed. Run: pip install Pillow")


PORTAL_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = PORTAL_DIR / "assets" / "stone-codes"
TARGET_WIDTH = 800
WEBP_QUALITY = 80


def main() -> int:
    if not SRC_DIR.exists():
        sys.exit(f"ERROR: {SRC_DIR} not found")

    total_in = total_out = n = 0
    for png in sorted(SRC_DIR.glob("*.png")):
        out = png.with_suffix(".webp")
        with Image.open(png) as im:
            im = im.convert("RGB")
            if im.width > TARGET_WIDTH:
                ratio = TARGET_WIDTH / im.width
                im = im.resize((TARGET_WIDTH, round(im.height * ratio)), Image.LANCZOS)
            im.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)
        in_size = png.stat().st_size
        out_size = out.stat().st_size
        total_in += in_size
        total_out += out_size
        n += 1
        print(f"  ✓ {png.name:<35}  {in_size//1024:>5} KB  →  {out_size//1024:>4} KB webp")

    print(f"\n{n} files · {total_in/1024/1024:.2f} MB → {total_out/1024/1024:.2f} MB webp")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
