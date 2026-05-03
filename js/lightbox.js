// lightbox.js — fullscreen deep-zoom image viewer.
//
// Any element with `data-zoom-src="..."` (and optional `data-zoom-caption`)
// becomes a trigger. Clicking opens the lightbox dialog and the image:
//   - Wheel zooms in/out around the cursor (no Ctrl required)
//   - Pinch-zoom on touch (browser handles via touch-action)
//   - Double-click zooms 2× into the cursor point; on max → snaps back to fit
//   - +/− buttons step zoom; ⤢ button fits image to viewport
//   - Click-and-drag pans when zoomed past fit
//   - A small badge in the corner shows the current zoom %

const MIN_SCALE = 0.1;
const MAX_SCALE = 16;
const STEP = 1.6;     // for +/− buttons
const DBL_FACTOR = 2; // for double-click

let dialog, stage, zoom, img, captionEl, percentEl;
let natW = 0, natH = 0;
let scale = 1;
let fitScale = 1;

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
  // Cursor position relative to the stage's visible area:
  const px = (clientX - stageRect.left);
  const py = (clientY - stageRect.top);
  // The point in image-pixel coordinates currently under the cursor:
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

function openWith(src, caption = '') {
  if (!dialog || !img) return;
  if (captionEl) captionEl.textContent = caption;
  img.alt = caption;
  // Reset state for the new image
  natW = natH = 0;
  scale = 1;
  zoom.style.width = '0px';
  zoom.style.height = '0px';
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');

  img.onload = () => {
    natW = img.naturalWidth;
    natH = img.naturalHeight;
    fit();
  };
  img.src = src;
}

function close() {
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
  if (img) img.removeAttribute('src');
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

  // Wheel to zoom (no modifier required — this is a dedicated zoomer)
  stage.addEventListener('wheel', (e) => {
    if (!dialog.open) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAt(scale * factor, e.clientX, e.clientY);
  }, { passive: false });

  // Double-click to dive into the point; on near-max → reset to fit
  stage.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (scale >= MAX_SCALE * 0.6) {
      fit();
    } else {
      zoomAt(scale * DBL_FACTOR, e.clientX, e.clientY);
    }
  });

  // Re-fit on viewport resize if user has not interacted
  const ro = new ResizeObserver(() => {
    if (Math.abs(scale - fitScale) < 0.01) fit();
  });
  ro.observe(stage);
}

export function initLightbox() {
  dialog    = document.getElementById('lightbox');
  stage     = document.getElementById('lightbox-stage');
  zoom      = document.getElementById('lightbox-zoom');
  img       = document.getElementById('lightbox-img');
  captionEl = document.getElementById('lightbox-caption');
  percentEl = document.getElementById('lightbox-zoom-pct');
  if (!dialog || !stage || !img || !zoom) return;

  // Triggers — any element with data-zoom-src
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
  // Close on Escape (native dialog handles, but ensure cleanup)
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

  bindStageInteractions();
}
