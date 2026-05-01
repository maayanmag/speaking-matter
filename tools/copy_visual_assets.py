#!/usr/bin/env python3
"""
copy_visual_assets.py
=====================

Copy and rename selected visual assets from the milestone folders into
`portal/assets/` for use in the digital exhibition portal.

Sources
-------
- milestone_4/stones/*/stone_code_large.png   → assets/stone-codes/<stone>.png
- milestone_5/more_stones/*/stone_code_large.png → assets/stone-codes/<stone>.png
- milestone_4/stones/*/heightmap_preview.png  → assets/heightmaps/<stone>.png
- milestone_5/more_stones/*/heightmap_preview.png → assets/heightmaps/<stone>.png
- milestone_7/ps_*/preview.png + possible_stone.glb + color.png
                                              → assets/stones/ps_*/...

This script is idempotent — re-running it overwrites the destination files.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

PORTAL_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = PORTAL_DIR.parent
ASSETS = PORTAL_DIR / "assets"


def normalise_stone_id(folder_name: str) -> str:
    """Normalise milestone stone folder names → stable kebab-case ids."""
    return folder_name.lower().strip().replace(" ", "_")


def copy_stone_codes_and_heightmaps() -> int:
    """Copy stone_code_large.png and heightmap_preview.png from milestones 4 & 5."""
    code_dst = ASSETS / "stone-codes"
    height_dst = ASSETS / "heightmaps"
    code_dst.mkdir(parents=True, exist_ok=True)
    height_dst.mkdir(parents=True, exist_ok=True)

    sources = [
        PROJECT_DIR / "milestone_4" / "stones",
        PROJECT_DIR / "milestone_5" / "more_stones",
    ]

    n = 0
    for src_root in sources:
        if not src_root.is_dir():
            continue
        for stone_dir in sorted(src_root.iterdir()):
            if not stone_dir.is_dir():
                continue
            stone_id = normalise_stone_id(stone_dir.name)

            code = stone_dir / "stone_code_large.png"
            if code.exists():
                shutil.copy2(code, code_dst / f"{stone_id}.png")
                n += 1

            heightmap = stone_dir / "heightmap_preview.png"
            # m5 uses a different filename for the same image
            if not heightmap.exists():
                heightmap = stone_dir / "heightmap_large_preview.png"
            if heightmap.exists():
                shutil.copy2(heightmap, height_dst / f"{stone_id}.png")
                n += 1
    return n


def copy_possible_stones() -> int:
    """Copy m7's 11 possible stones (GLB + texture + preview) into assets/stones/."""
    src_root = PROJECT_DIR / "milestone_7"
    if not src_root.is_dir():
        return 0

    dst_root = ASSETS / "stones"
    dst_root.mkdir(parents=True, exist_ok=True)

    n = 0
    for ps_dir in sorted(src_root.glob("ps_*")):
        if not ps_dir.is_dir():
            continue
        dst = dst_root / ps_dir.name
        dst.mkdir(parents=True, exist_ok=True)
        for fname in ("possible_stone.glb", "color.png", "preview.png"):
            src = ps_dir / fname
            if src.exists():
                shutil.copy2(src, dst / fname)
                n += 1
    return n


def main() -> int:
    print("[stone-codes & heightmaps]")
    n_codes = copy_stone_codes_and_heightmaps()
    print(f"  ✓ {n_codes} files copied → assets/stone-codes/  +  assets/heightmaps/")

    print("\n[possible stones]")
    n_ps = copy_possible_stones()
    print(f"  ✓ {n_ps} files copied → assets/stones/ps_*")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
