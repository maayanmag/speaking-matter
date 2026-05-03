// carousel.js — horizontal scroll-snap carousel for the four station cards.
//
// Wires up the prev/next buttons, the dot indicators, the header nav links
// (data-station-link), and keyboard arrow navigation when the track is focused.
// Uses native CSS scroll-snap for the actual scrolling — JS only nudges
// `scrollLeft` and reflects state.

const TRACK_SEL = '#stations-track';
const DOT_SEL   = '[data-dot]';
const PREV_SEL  = '[data-carousel-prev]';
const NEXT_SEL  = '[data-carousel-next]';
const NAV_SEL   = '[data-station-link]';
const HINT_SEL  = '#carousel-swipe-hint';

let track, prevBtn, nextBtn, hint;
let dots = [];
let cards = [];
let activeIdx = 0;
let hintHidden = false;

function isRTL() {
  return document.documentElement.dir === 'rtl';
}

function dismissHint() {
  if (hintHidden || !hint) return;
  hintHidden = true;
  hint.classList.add('is-hidden');
}

function cardAt(idx) { return cards[idx]; }

function scrollToCard(idx, smooth = true) {
  const card = cardAt(idx);
  if (!card || !track) return;
  const trackRect = track.getBoundingClientRect();
  const cardRect  = card.getBoundingClientRect();
  // Compute target scrollLeft so the card aligns with the start edge.
  const delta = cardRect.left - trackRect.left;
  track.scrollTo({
    left: track.scrollLeft + delta,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

function setActive(idx) {
  if (idx !== 0) dismissHint();
  activeIdx = idx;
  dots.forEach((d, i) => d.setAttribute('aria-current', i === idx ? 'true' : 'false'));
  if (prevBtn) prevBtn.disabled = idx === 0;
  if (nextBtn) nextBtn.disabled = idx === cards.length - 1;
  // Keep the active chip visible when the chip strip is horizontally scrollable (mobile).
  const activeDot = dots[idx];
  if (activeDot && typeof activeDot.scrollIntoView === 'function') {
    activeDot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

// Detect which card is centered in the viewport via IntersectionObserver.
function observeActive() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    let bestIdx = activeIdx;
    let bestRatio = 0;
    for (const entry of entries) {
      const idx = Number(entry.target.dataset.cardIdx);
      if (entry.intersectionRatio > bestRatio) {
        bestRatio = entry.intersectionRatio;
        bestIdx = idx;
      }
    }
    if (bestRatio > 0.4 && bestIdx !== activeIdx) setActive(bestIdx);
  }, {
    root: track,
    threshold: [0.25, 0.5, 0.75],
  });
  cards.forEach((c) => io.observe(c));
}

function bindControls() {
  prevBtn?.addEventListener('click', () => {
    const next = Math.max(0, activeIdx - 1);
    scrollToCard(next);
  });
  nextBtn?.addEventListener('click', () => {
    const next = Math.min(cards.length - 1, activeIdx + 1);
    scrollToCard(next);
  });

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const idx = Number(dot.dataset.dot);
      scrollToCard(idx);
    });
  });

  // Header nav: clicks on Touch/Code/Vault/Fictions scroll the carousel into
  // view first, then snap to the right card.
  document.querySelectorAll(NAV_SEL).forEach((link) => {
    link.addEventListener('click', (e) => {
      const idx = Number(link.dataset.stationLink);
      if (Number.isNaN(idx)) return;
      e.preventDefault();
      // Bring the carousel section into view (vertically), then snap horizontally.
      const stationsSection = track.closest('.stations');
      if (stationsSection) stationsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Wait for the smooth scroll to settle before nudging the carousel.
      setTimeout(() => scrollToCard(idx), 450);
    });
  });

  // Keyboard navigation when the track has focus.
  track?.addEventListener('keydown', (e) => {
    const forward  = isRTL() ? 'ArrowLeft'  : 'ArrowRight';
    const backward = isRTL() ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === forward) {
      e.preventDefault();
      scrollToCard(Math.min(cards.length - 1, activeIdx + 1));
    } else if (e.key === backward) {
      e.preventDefault();
      scrollToCard(Math.max(0, activeIdx - 1));
    }
  });
}

export function initCarousel() {
  track   = document.querySelector(TRACK_SEL);
  if (!track) return;
  prevBtn = document.querySelector(PREV_SEL);
  nextBtn = document.querySelector(NEXT_SEL);
  hint    = document.querySelector(HINT_SEL);
  dots    = Array.from(document.querySelectorAll(DOT_SEL));
  cards   = Array.from(track.querySelectorAll('.card'));
  if (!cards.length) return;
  setActive(0);
  bindControls();
  observeActive();
  // Auto-dismiss hint after 8s if user hasn't interacted.
  if (hint) setTimeout(dismissHint, 8000);
  // Any direct scroll/touch on the track also dismisses the hint.
  track.addEventListener('scroll', dismissHint, { passive: true, once: true });
  track.addEventListener('touchstart', dismissHint, { passive: true, once: true });
}
