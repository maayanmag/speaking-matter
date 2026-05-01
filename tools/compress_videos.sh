#!/usr/bin/env bash
# compress_videos.sh
# ===================
# Compress the source installation videos into web-friendly H.264 MP4 + VP9 WebM,
# trimmed to ~10 second loops, 1080p max, with a poster JPG snapshot.
#
# Source: ../final_installation_pics_and_vids/Inbar Zak/videos/*.MP4
# Output: assets/video/{stamps,reliefs,possible_stones}.{mp4,webm}
#         assets/video/{...}-poster.jpg
#
# Usage (from portal/):
#   bash tools/compress_videos.sh
#
# Requires: ffmpeg (brew install ffmpeg)

set -euo pipefail

PORTAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$PORTAL_DIR/../final_installation_pics_and_vids/Inbar Zak/videos"
DST_DIR="$PORTAL_DIR/assets/video"
mkdir -p "$DST_DIR"

# Each entry: src_basename | out_name | start_seconds | duration_seconds
# Adjust start/duration to land on the most eloquent moment of each video.
declare -a JOBS=(
  "stamps.MP4|stamps|0|10"
  "reliefs.MP4|reliefs|0|10"
  "possible_stones.MP4|possible_stones|0|10"
)

# Quality target: ~2 MB per 10s clip. crf 30 (mp4) / -b:v 800k (webm) gets us there.
MP4_CRF=30
WEBM_BITRATE="800k"
SCALE="-vf scale='min(1920,iw)':-2:flags=lanczos"

for job in "${JOBS[@]}"; do
  IFS='|' read -r src out start dur <<< "$job"
  in_file="$SRC_DIR/$src"
  if [[ ! -f "$in_file" ]]; then
    echo "  · SKIP  $src (not found)"
    continue
  fi

  echo "  → $src  →  $out.{mp4,webm}  (start ${start}s, ${dur}s)"

  # ── MP4 / H.264 (broadest support, faststart for streaming) ──
  ffmpeg -y -hide_banner -loglevel error \
    -ss "$start" -i "$in_file" -t "$dur" \
    $SCALE -an \
    -c:v libx264 -preset slow -crf "$MP4_CRF" -pix_fmt yuv420p \
    -movflags +faststart \
    "$DST_DIR/$out.mp4"

  # ── WebM / VP9 (smaller for modern browsers) ──
  ffmpeg -y -hide_banner -loglevel error \
    -ss "$start" -i "$in_file" -t "$dur" \
    $SCALE -an \
    -c:v libvpx-vp9 -b:v "$WEBM_BITRATE" -row-mt 1 \
    -deadline good -cpu-used 2 \
    "$DST_DIR/$out.webm"

  # ── Poster JPG (first frame, web-optimised) ──
  ffmpeg -y -hide_banner -loglevel error \
    -ss "$start" -i "$in_file" -frames:v 1 \
    $SCALE -q:v 4 \
    "$DST_DIR/$out-poster.jpg"

  mp4_size=$(du -h "$DST_DIR/$out.mp4" | cut -f1)
  webm_size=$(du -h "$DST_DIR/$out.webm" | cut -f1)
  echo "    ✓ mp4=${mp4_size}  webm=${webm_size}"
done

echo
echo "Total output:"
du -sh "$DST_DIR"
