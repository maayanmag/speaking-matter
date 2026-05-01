// lightbox.js — fullscreen zoomable image viewer.
//
// Any element with `data-zoom-src="..."` (and optionally `data-zoom-caption`)
// becomes a trigger. Clicking opens the lightbox dialog, loads the source
// at natural resolution, and provides:
//   - +/- buttons (zoom 50% steps, capped 25%–600%)
//   - "fit" button (reset to fit-to-screen)
//   - click-and-drag panning when zoomed in
//   - mouse-wheel zoom (Ctrl/Cmd + wheel for trackpad pinch)
//   - native pinch-zoom on touch devices (browser handles it)

const STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6];

let dialog, stage, img, captionEl;
let currentScale = 1;
let isFitMode = true;

function findStep(scale, dir) {
  if (dir > 0) {
    for (const s of STEPS) if (s > scale + 0.001) return s;
    return STEPS[STEPS.length - 1];
  } else {
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (STEPS[i] < scale - 0.001) return STEPS[i];
    }
    return STEPS[0];
  }
}

function applyScale(scale) {
  currentScale = Math.max(STEPS[0], Math.min(STEPS[STEPS.length - 1], scale));
  isFitMode = false;
  img.style.maxWidth  = 'none';
  img.style.maxHeight = 'none';
  img.style.transform = `scale(${currentScale})`;
}

function applyFit() {
  isFitMode = true;
  currentScale = 1;
  img.style.maxWidth  = '100%';
  img.style.maxHeight = '100%';
  img.style.transform = 'none';
}

function openWith(src, caption = '') {
  if (!dialog || !img) return;
  img.src = src;
  img.alt = caption;
  captionEl.textContent = caption;
  applyFit();
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  // Once loaded, scroll to centre when zoomed.
  img.onload = () => {
    requestAnimationFrame(() => {
      stage.scrollLeft = (stage.scrollWidth  - stage.clientWidth)  / 2;
      stage.scrollTop  = (stage.scrollHeight - stage.clientHeight) / 2;
    });
  };
}

function close() {
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
  // Free memory
  if (img) img.src = '';
}

function bindStageDrag() {
  let dragging = false;
  let startX = 0, startY = 0;
  let scrollX = 0, scrollY = 0;

  stage.addEventListener('mousedown', (e) => {
    if (isFitMode) return;
    dragging = true;
    stage.classList.add('is-grabbing');
    startX = e.clientX;
    startY = e.clientY;
    scrollX = stage.scrollLeft;
    scrollY = stage.scrollTop;
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

  // Wheel + Ctrl/Meta = zoom (matches trackpad pinch on macOS).
  stage.addEventListener('wheel', (e) => {
    if (!dialog.open) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      applyScale(currentScale * (e.deltaY < 0 ? 1.15 : 0.87));
    }
  }, { passive: false });
}

export function initLightbox() {
  dialog    = document.getElementById('lightbox');
  stage     = document.getElementById('lightbox-stage');
  img       = document.getElementById('lightbox-img');
  captionEl = document.getElementById('lightbox-caption');
  if (!dialog || !stage || !img) return;

  // Open buttons (any element with data-zoom-src)
  document.querySelectorAll('[data-zoom-src]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      openWith(trigger.dataset.zoomSrc, trigger.dataset.zoomCaption || '');
    });
  });

  // Close button + backdrop click
  dialog.querySelector('[data-close-lightbox]')?.addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  // Zoom controls
  dialog.querySelectorAll('[data-zoom]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.zoom;
      if (v === 'reset') {
        applyFit();
      } else if (v === '+1') {
        applyScale(findStep(currentScale, +1));
      } else if (v === '-1') {
        applyScale(findStep(currentScale, -1));
      }
    });
  });

  // Toggle fit/100% on stage click (when not dragging)
  stage.addEventListener('click', (e) => {
    if (e.target === stage || e.target === img) {
      if (isFitMode) applyScale(1);
      else applyFit();
    }
  });

  bindStageDrag();
}
