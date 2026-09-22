// One active-time clock per exhibit: hidden time is never replayed.
export function createExhibitClock(element, tick, activity = () => {}, visibilityChanged = () => {}) {
  let visible = false, paused = false, active = false, stopped = false, away = false;
  let present = false;
  let frame = 0, previous = null;
  function render(now) {
    if (!active) return;
    const delta = previous === null ? 0 : Math.min((now - previous) / 1000, 0.25);
    previous = now;
    tick(delta);
    if (active) frame = requestAnimationFrame(render);
  }
  function sync() {
    const nextPresent = !stopped && visible && !document.hidden && !away;
    const changedVisibility = nextPresent !== present;
    present = nextPresent;
    const next = present && !paused;
    if (next === active) {
      if (changedVisibility) visibilityChanged(present);
      return;
    }
    active = next;
    previous = null;
    cancelAnimationFrame(frame);
    activity(active);
    if (active) frame = requestAnimationFrame(render);
    element.dataset.running = String(active);
    if (changedVisibility) visibilityChanged(present);
  }
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  });
  observer.observe(element);
  document.addEventListener('visibilitychange', sync);
  const leave = () => { away = true; sync(); };
  const returnToPage = () => { away = false; sync(); };
  window.addEventListener('pagehide', leave);
  window.addEventListener('pageshow', returnToPage);
  return {
    get active() { return active; },
    get visible() { return visible && !document.hidden && !stopped && !away; },
    get paused() { return paused; },
    set paused(value) { paused = value; sync(); },
    dispose() {
      stopped = true;
      sync();
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', returnToPage);
    },
  };
}
