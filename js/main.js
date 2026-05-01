// Speaking Matter — entry point.
// Boots i18n, hydrates the photo grid, sets up smooth scroll + reveals,
// and lazy-loads the Station 4 inline 3D viewer behind an IntersectionObserver.

import { initI18n } from './i18n.js';
import { initPhotoGrid } from './photo-grid.js';
import { initSmoothScroll, initReveals } from './scrolly.js';
import { initStation4 } from './station-4-stones.js';

async function boot() {
  // i18n must run first — it fills the visible content.
  await initI18n();
  initSmoothScroll();
  initReveals();
  initPhotoGrid();
  initStation4();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
