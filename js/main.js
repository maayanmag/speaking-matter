// Speaking Matter — entry point.
// Boots i18n first (fills visible content), then mounts the carousel,
// modals, lightbox, smooth scroll, photo grid, and (lazily) Station 4.

import { initI18n } from './i18n.js';
import { initPhotoGrid } from './photo-grid.js';
import { initSmoothScroll, initReveals } from './scrolly.js';
import { initStation4 } from './station-4-stones.js';
import { initCarousel } from './carousel.js';
import { initModals } from './modals.js';
import { initLightbox } from './lightbox.js';

async function boot() {
  await initI18n();
  initSmoothScroll();
  initReveals();
  initCarousel();
  initModals();
  initLightbox();
  initPhotoGrid();
  initStation4();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
