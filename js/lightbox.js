// lightbox.js — fullscreen deep-zoom image viewer + gallery navigation.
//
// Two open modes:
//   - openWith(src, caption)            → single image (existing behaviour)
//   - openGalleryAt(items, idx)         → navigable gallery of {src, caption}
//
// Any element with `data-zoom-src="..."` (and optional `data-zoom-caption`)
// becomes a single-image trigger. Photo grids call openGalleryAt directly.
//
// Image interactions:
//   - Wheel zooms in/out around the cursor (no Ctrl required)
//   - Pinch-zoom on touch (browser handles via touch-action)
//   - Double-click zooms 2× into the cursor point; on max → snaps back to fit
//   - +/− buttons step zoom; ⤢ button fits image to viewport
//   - Click-and-drag pans when zoomed past fit
//   - Arrow keys ←/→, on-screen ‹/›, or swipe to navigate gallery
//   - A small badge in the corner shows the current zoom %

const MIN_SCALE = 0.1;
const MAX_SCALE = 16;
const STEP = 1.6;     // for +/− buttons
const DBL_FACTOR = 2; // for double-click

let dialog, stage, zoom, img, captionEl, percentEl, counterEl, prevBtn, nextBtn;
let natW = 0, natH = 0;
let scale = 1;
let fitScale = 1;

let gallery = [];   // [{src, caption}]
let galleryIdx = -1;

function applySize() {
  zoom.style.width  = (natW * scale) + 'px';
  zoom.style.height = (natH * scale) + 'px';
  if (percentEl) percentEl.textContent = Math.round(scale * 100) + '%';
}

function fit() {
  if (!natW || !natH) return;
  const sW = stage.clientWidth  / natW;
  const sH = stage.clientHeight / natH;
  fitScale = Math.min(sW, sH);
  scale = fitScale;
  applySize();
  // Centre the (now-smaller-than-stage) image
  requestAnimationFrame(() => {
    stage.scrollLeft = Math.max(0, (zoom.offsetWidth  - stage.clientWidth)  / 2);
    stage.scrollTop  = Math.max(0, (zoom.offsetHeight - stage.clientHeight) / 2);
  });
}

// Set scale while keeping the image-point under (clientX, clientY) fixed.
function zoomAt(newScale, clientX, clientY) {
  newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
  if (Math.abs(newScale - scale) < 1e-6) return;

  const stageRect = stage.getBoundingClientRect();
  const px = (clientX - stageRect.left);
  const py = (clientY - stageRect.top);
  const imgX = (stage.scrollLeft + px) / scale;
  const imgY = (stage.scrollTop  + py) / scale;

  scale = newScale;
  applySize();

  stage.scrollLeft = imgX * scale - px;
  stage.scrollTop  = imgY * scale - py;
}

function zoomCentre(newScale) {
  const r = stage.getBoundingClientRect();
  zoomAt(newScale, r.left + r.width / 2, r.top + r.height / 2);
}

function updateNavUI() {
  const inGallery = gallery.length > 1;
  if (prevBtn) prevBtn.hidden = !inGallery;
  if (nextBtn) nextBtn.hidden = !inGallery;
  if (counterEl) {
    if (inGallery) {
      counterEl.hidden = false;
      counterEl.textContent = `${galleryIdx + 1} / ${gallery.length}`;
    } else {
      counterEl.hidden = true;
      counterEl.textContent = '';
    }
  }
  if (prevBtn) prevBtn.disabled = inGallery && galleryIdx <= 0;
  if (nextBtn) nextBtn.disabled = inGallery && galleryIdx >= gallery.length - 1;
}

function loadImage(src, caption) {
  if (!img) return;
  if (captionEl) captionEl.textContent = caption || '';
  img.alt = caption || '';
  natW = natH = 0;
  scale = 1;
  zoom.style.width = '0px';
  zoom.style.height = '0px';
  img.onload = () => {
    natW = img.naturalWidth;
    natH = img.naturalHeight;
    fit();
  };
  img.src = src;
  updateNavUI();
}

function ensureOpen() {
  if (!dialog) return;
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

export function openWith(src, caption = '') {
  if (!dialog || !img) return;
  gallery = [];
  galleryIdx = -1;
  ensureOpen();
  loadImage(src, caption);
}

export function openGalleryAt(items, idx) {
  if (!dialog || !img || !Array.isArray(items) || !items.length) return;
  gallery = items;
  galleryIdx = Math.max(0, Math.min(idx, items.length - 1));
  ensureOpen();
  const cur = gallery[galleryIdx];
  loadImage(cur.src, cur.caption);
}

function navigate(delta) {
  if (gallery.length < 2) return;
  const next = galleryIdx + delta;
  if (next < 0 || next >= gallery.length) return;
  galleryIdx = next;
  const cur = gallery[galleryIdx];
  loadImage(cur.src, cur.caption);
}

function close() {
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
  if (img) img.removeAttribute('src');
  gallery = [];
  galleryIdx = -1;
  updateNavUI();
}

function bindStageInteractions() {
  // Mouse drag panning (only meaningful when zoomed past fit)
  let dragging = false;
  let startX = 0, startY = 0, scrollX = 0, scrollY = 0;
  stage.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    stage.classList.add('is-grabbing');
    startX = e.clientX; startY = e.clientY;
    scrollX = stage.scrollLeft; scrollY = stage.scrollTop;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    stage.scrollLeft = scrollX - (e.clientX - startX);
    stage.scrollTop  = scrollY - (e.clientY - startY);
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    stage.classList.remove('is-grabbing');
  });

  // Wheel to zoom (no modifier required)
  stage.addEventListener('wheel', (e) => {
    if (!dialog.open) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAt(scale * factor, e.clientX, e.clientY);
  }, { passive: false });

  // Double-click to dive into the point; on near-max → reset to fit
  stage.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (scale >= MAX_SCALE * 0.6) fit();
    else zoomAt(scale * DBL_FACTOR, e.clientX, e.clientY);
  });

  // Re-fit on viewport resize if user has not interacted
  const ro = new ResizeObserver(() => {
    if (Math.abs(scale - fitScale) < 0.01) fit();
  });
  ro.observe(stage);

  // Touch swipe for gallery nav (only when at fit-scale to avoid hijacking pan)
  let touchStartX = 0, touchStartY = 0, touchActive = false;
  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { touchActive = false; return; }
    if (Math.abs(scale - fitScale) > 0.05) { touchActive = false; return; }
    touchActive = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      navigate(dx < 0 ? +1 : -1);
    }
    touchActive = false;
  });
}

function bindKeyboard() {
  dialog.addEventListener('keydown', (e) => {
    if (!dialog.open) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); navigate(+1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1); }
  });
}

export function initLightbox() {
  dialog    = document.getElementById('lightbox');
  stage     = document.getElementById('lightbox-stage');
  zoom      = document.getElementById('lightbox-zoom');
  img       = document.getElementById('lightbox-img');
  captionEl = document.getElementById('lightbox-caption');
  percentEl = document.getElementById('lightbox-zoom-pct');
  counterEl = document.getElementById('lightbox-counter');
  prevBtn   = dialog?.querySelector('[data-nav="prev"]');
  nextBtn   = dialog?.querySelector('[data-nav="next"]');
  if (!dialog || !stage || !img || !zoom) return;

  // Single-image triggers (e.g. hex picture). Gallery triggers wire themselves.
  document.querySelectorAll('[data-zoom-src]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      openWith(trigger.dataset.zoomSrc, trigger.dataset.zoomCaption || '');
    });
  });

  // Close button + click-on-backdrop
  dialog.querySelector('[data-close-lightbox]')?.addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  dialog.addEventListener('cancel', close);

  // +/− and reset buttons
  dialog.querySelectorAll('[data-zoom]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.zoom;
      if (v === 'reset') fit();
      else if (v === '+1') zoomCentre(scale * STEP);
      else if (v === '-1') zoomCentre(scale / STEP);
    });
  });

  // Prev / Next nav
  prevBtn?.addEventListener('click', () => navigate(-1));
  nextBtn?.addEventListener('click', () => navigate(+1));

  bindStageInteractions();
  bindKeyboard();
}
