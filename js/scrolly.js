// Smooth scroll + scroll-triggered reveals.
//
// Lenis wraps native scroll with momentum/easing. We also add a tiny
// IntersectionObserver-based reveal that fades stations in as they enter
// the viewport. Honours `prefers-reduced-motion`.

import Lenis from 'lenis';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initSmoothScroll() {
  if (REDUCED) return; // Respect user preference — keep native scroll.

  const lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    smoothTouch: false,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Make in-page anchor links use Lenis for the scroll
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -32 });
    });
  });

  return lenis;
}

export function initReveals() {
  const els = document.querySelectorAll('.station, .hero__content, .photo-grid figure');
  if (!els.length) return;

  if (REDUCED || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  els.forEach((el) => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
  els.forEach((el) => io.observe(el));
}
