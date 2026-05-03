// photo-grid.js — hydrate the Station 6 documentation grid from the manifest,
// and wire each figure to open the lightbox in gallery mode (prev/next nav).
//
// Pulls ./assets/photos/manifest.json (produced by tools/optimise_photos.py),
// filters in display-order, renders <figure> elements with WebP + JPG fallback,
// and binds clicks → openGalleryAt(items, idx).

import { openGalleryAt } from './lightbox.js';

const MANIFEST_URL = './assets/photos/manifest.json';
const TARGET = '#photo-grid';
// Stations to surface in the documentation grid.
const ALLOWED_STATIONS = new Set([
  'station-1', 'station-2', 'station-3', 'station-4', 'station-5', 'documentation',
]);

function figureMarkup(entry, idx) {
  return `
    <figure class="photo-grid__item" data-idx="${idx}" tabindex="0" role="button" aria-label="Open image ${idx + 1}">
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
    target.innerHTML = filtered.map((e, i) => figureMarkup(e, i)).join('\n');

    // Build the gallery items array once — prefer the higher-quality JPG for the lightbox
    // (browsers handle the .webp fine too, but JPG is universal and avoids any decode quirks).
    const galleryItems = filtered.map((e) => ({
      src: e.jpg,
      caption: `${e.caption} · ${e.credit}`,
    }));

    target.querySelectorAll('.photo-grid__item').forEach((fig) => {
      const open = () => {
        const idx = parseInt(fig.dataset.idx, 10) || 0;
        openGalleryAt(galleryItems, idx);
      };
      fig.addEventListener('click', open);
      fig.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          open();
        }
      });
    });
  } catch (err) {
    console.warn('[photo-grid] failed to hydrate:', err);
  }
}
