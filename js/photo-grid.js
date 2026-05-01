// photo-grid.js — hydrate the Station 5 documentation grid from the manifest.
//
// Pulls ./assets/photos/manifest.json (produced by tools/optimise_photos.py),
// filters in display-order, and renders <figure> elements with WebP + JPG fallback.

const MANIFEST_URL = './assets/photos/manifest.json';
const TARGET = '#photo-grid';
// Stations to surface in the documentation grid (skip 'hero' + per-station inline photos).
const ALLOWED_STATIONS = new Set([
  'station-1', 'station-2', 'station-3', 'station-4', 'station-5', 'documentation',
]);

function figureMarkup(entry) {
  return `
    <figure>
      <picture>
        <source srcset="${entry.webp}" type="image/webp" />
        <img src="${entry.jpg}" alt="${entry.caption}" loading="lazy" decoding="async" />
      </picture>
      <figcaption>${entry.caption} · ${entry.credit}</figcaption>
    </figure>
  `.trim();
}

export async function initPhotoGrid() {
  const target = document.querySelector(TARGET);
  if (!target) return;
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    const filtered = items.filter((e) => ALLOWED_STATIONS.has(e.station));
    target.innerHTML = filtered.map(figureMarkup).join('\n');
  } catch (err) {
    console.warn('[photo-grid] failed to hydrate:', err);
  }
}
