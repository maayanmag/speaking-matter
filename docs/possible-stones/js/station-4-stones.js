import { getLocale, onLocaleChange } from './i18n.js';
import { createExhibitClock } from './exhibit-clock.js';

const POSTER_SECONDS = 10;
const LOAD_TIMEOUT_SECONDS = 30;
const FAILURE_SECONDS = 3;
const MEDIA_VERSION = 'motion-20260923-2';
// Collection labels retain their registered spelling in both interface languages.
const COLLECTION = {
  scoria: 'Scoria Golan Hights',
  calcite: 'Calcite Jerusalem',
  kurkar: 'Kurkar, Tel Aviv',
  cityFlint: 'Flint City of David',
  limestone: 'Galilee Limestone',
  aravaFlint: 'Patinated Flint Arava',
  ahmar: 'Oxidized Basalt Golan (Ahmar)',
  jerusalemFlint: 'Flint Jerusalem 01',
  golanFlint: 'Flint Golan 01',
};
const STONES = [
  ['ps_01', 'scoria', 'calcite'],
  ['ps_02', 'calcite', 'scoria'],
  ['ps_03', 'kurkar', 'cityFlint'],
  ['ps_04', 'limestone', 'aravaFlint'],
  ['ps_05', 'aravaFlint', 'kurkar'],
  ['ps_09', 'scoria', 'ahmar'],
  ['ps_10', 'calcite', 'jerusalemFlint'],
  ['ps_11', 'kurkar', 'golanFlint'],
].map(([id, body, skin]) => ({ id, body: COLLECTION[body], skin: COLLECTION[skin] }));

const COPY = {
  he: {
    title: 'אבנים אפשריות', body: 'גוף', skin: 'עור', pause: 'השהיה', play: 'המשך',
    loading: 'טוענים אבן…', failed: 'טעינת האבן נכשלה. אפשר לנסות שוב; במצב ניגון נעבור לאבן הבאה.',
    unavailable: 'לא ניתן לטעון את האבנים. יש לבדוק את קובצי הווידאו והתמונות ולנסות שוב.',
    blocked: 'הדפדפן עצר את הניגון האוטומטי. לחצו להתחלה.',
    retry: 'ניסיון חוזר', start: 'התחלת ניגון',
  },
  en: {
    title: 'Possible Stones', body: 'Body', skin: 'Skin', pause: 'Pause', play: 'Play',
    loading: 'Loading stone…', failed: 'Stone could not load. Retry, or playback will advance to the next stone.',
    unavailable: 'No stones could load. Check the local video and poster files, then retry.',
    blocked: 'The browser blocked automatic playback. Press Start to continue.',
    retry: 'Retry', start: 'Start playback',
  },
};

export function initStation4() {
  const host = document.getElementById('ps-viewer');
  if (!host || host.dataset.initialized) return;
  host.dataset.initialized = 'true';
  const canvas = document.getElementById('ps-canvas');
  const info = document.getElementById('ps-info');
  const nav = document.getElementById('ps-nav');
  const loading = document.getElementById('ps-loading');
  const statusText = document.getElementById('ps-loading-text');
  const progress = document.getElementById('ps-progress-bar');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pause = document.createElement('button');
  const retry = document.createElement('button');
  const start = document.createElement('button');
  for (const button of [pause, retry, start]) {
    button.type = 'button';
    button.className = 'exhibit-button';
  }
  pause.setAttribute('aria-controls', 'ps-canvas');
  retry.hidden = start.hidden = true;
  loading.append(retry, start);
  info.innerHTML = '<p class="ps-id" dir="ltr"></p><h2></h2><p data-body></p><p data-skin></p>';
  const copy = () => COPY[getLocale()] || COPY.en;
  let active = null, incoming = null, desired = 0, current = -1;
  let userPaused = false, blocked = false, disposed = false;
  let dwell = 0, failureElapsed = 0, errorIndex = null, status = null;
  const failures = new Set();
  const buttons = [];
  const slots = Array.from({ length: 2 }, () => {
    const element = document.createElement('div');
    const poster = document.createElement('img');
    const video = document.createElement('video');
    element.className = 'ps-media-slot';
    element.setAttribute('aria-hidden', 'true');
    poster.alt = '';
    video.muted = video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.controls = false;
    video.tabIndex = -1;
    video.setAttribute('disablepictureinpicture', '');
    element.append(poster, video);
    canvas.append(element);
    return { element, poster, video, index: -1, version: 0, cleanup: () => {},
      frameReady: false, posterReady: false, failed: false, playPending: false,
      ended: false, wait: 0, stall: 0, lastTime: 0 };
  });

  function showStatus(key, index = null) {
    status = key ? { key, index } : null;
    loading.classList.toggle('is-hidden', !status);
    loading.setAttribute('aria-hidden', String(!status));
    statusText.textContent = status
      ? `${copy()[key]}${index === null ? '' : ` · ${STONES[index].id.toUpperCase()}`}` : '';
    retry.hidden = !['failed', 'unavailable'].includes(key);
    start.hidden = key !== 'blocked';
    progress.parentElement.hidden = key !== 'loading';
    host.dataset.state = key || (userPaused ? 'paused' : 'ready');
  }

  function labels() {
    pause.textContent = userPaused ? copy().play : copy().pause;
    pause.setAttribute('aria-label', pause.textContent);
    pause.setAttribute('aria-pressed', String(userPaused));
    retry.textContent = copy().retry;
    start.textContent = copy().start;
    host.setAttribute('aria-label', copy().title);
    nav.setAttribute('aria-label', copy().title);
    info.querySelector('h2').textContent = copy().title;
    if (current >= 0) {
      const stone = STONES[current];
      info.querySelector('.ps-id').textContent = stone.id.toUpperCase();
      for (const role of ['body', 'skin']) {
        const name = document.createElement('bdi');
        name.lang = 'en';
        name.dir = 'ltr';
        name.textContent = stone[role];
        info.querySelector(`[data-${role}]`).replaceChildren(`${copy()[role]}: `, name);
      }
    }
    STONES.forEach((stone, index) => {
      buttons[index].setAttribute('aria-label', `${stone.id.toUpperCase()} · ${copy().body}: ${stone.body} / ${copy().skin}: ${stone.skin}`);
      buttons[index].classList.toggle('is-active', index === current);
      buttons[index].setAttribute('aria-current', String(index === current));
    });
    showStatus(status?.key, status?.index);
  }

  function shouldPlay(slot) {
    return !disposed && slot === active && !incoming && errorIndex === null &&
      clock.active && !reduced.matches && !blocked && slot.frameReady && !slot.failed;
  }

  function syncPlayback() {
    for (const slot of slots) {
      if (!shouldPlay(slot)) {
        slot.video.pause();
        continue;
      }
      if (slot.ended) {
        select((current + 1) % STONES.length);
        return;
      }
      if (!slot.video.paused || slot.playPending) continue;
      const version = slot.version;
      slot.playPending = true;
      slot.video.play().then(() => {
        if (slot.version === version && !shouldPlay(slot)) slot.video.pause();
      }).catch(error => {
        if (disposed || slot.version !== version || !shouldPlay(slot)) return;
        if (error.name === 'NotAllowedError') {
          blocked = true;
          showStatus('blocked', current);
        } else if (error.name !== 'AbortError') {
          fail(slot);
        }
      }).finally(() => {
        if (slot.version === version) slot.playPending = false;
      });
    }
  }

  function fail(slot) {
    slot.failed = true;
    slot.video.pause();
    if (disposed || (slot !== incoming && (slot !== active || incoming))) return;
    if (errorIndex === slot.index) return;
    errorIndex = slot.index;
    failures.add(errorIndex);
    failureElapsed = 0;
    blocked = false;
    showStatus(failures.size === STONES.length ? 'unavailable' : 'failed', errorIndex);
    syncPlayback();
  }

  function present() {
    if (!incoming || incoming.failed || disposed || !clock.visible || errorIndex !== null) return;
    const slot = incoming;
    const usePoster = reduced.matches || (userPaused && !slot.frameReady);
    if (usePoster ? !slot.posterReady : !slot.frameReady) return;
    active?.video.pause();
    active?.element.classList.remove('is-current');
    active = slot;
    incoming = null;
    current = slot.index;
    desired = null;
    dwell = 0;
    slot.element.dataset.poster = String(usePoster);
    slot.element.classList.add('is-current');
    host.dataset.currentStone = STONES[current].id;
    progress.style.width = '100%';
    showStatus(null);
    labels();
    syncPlayback();
    // Only the outgoing slot is recycled; the visible frame is never cleared.
    load(slots.find(candidate => candidate !== active), (current + 1) % STONES.length);
  }

  function load(slot, index) {
    slot.cleanup();
    ++slot.version;
    slot.video.pause();
    slot.video.removeAttribute('src');
    slot.video.removeAttribute('poster');
    slot.video.load();
    slot.poster.removeAttribute('src');
    Object.assign(slot, { index, frameReady: false, posterReady: false, failed: false,
      playPending: false, ended: false, wait: 0, stall: 0, lastTime: 0 });
    slot.element.dataset.poster = 'true';
    const version = slot.version;
    const events = new AbortController();
    const options = { signal: events.signal };
    const valid = () => !disposed && slot.version === version;
    let frame = 0, paint = 0, frameRequested = false;
    slot.cleanup = () => {
      events.abort();
      if (frame) slot.video.cancelVideoFrameCallback?.(frame);
      cancelAnimationFrame(paint);
    };
    function ready() {
      if (!valid() || slot.video.readyState < 2 || slot.video.seeking || slot.frameReady) return;
      slot.frameReady = true;
      if (frame) slot.video.cancelVideoFrameCallback?.(frame);
      cancelAnimationFrame(paint);
      if (slot === active && !reduced.matches) {
        slot.element.dataset.poster = 'false';
        syncPlayback();
      }
      present();
    }
    function decoded() {
      if (!valid() || frameRequested || slot.video.readyState < 2 || slot.video.seeking) return;
      // Preloaded clips stay paused at zero. Some browsers never deliver an RVFC
      // for a paused video; loadeddata plus a paint is the decoded-frame fallback.
      frameRequested = true;
      if (slot.video.requestVideoFrameCallback) frame = slot.video.requestVideoFrameCallback(ready);
      paint = requestAnimationFrame(() => { paint = requestAnimationFrame(ready); });
    }
    slot.poster.addEventListener('load', () => {
      if (!valid()) return;
      slot.posterReady = true;
      present();
    }, options);
    slot.poster.addEventListener('error', () => {
      if (valid() && reduced.matches) fail(slot);
    }, options);
    slot.video.addEventListener('loadeddata', decoded, options);
    slot.video.addEventListener('canplay', decoded, options);
    slot.video.addEventListener('seeked', decoded, options);
    slot.video.addEventListener('error', () => {
      if (valid() && slot.video.error && !reduced.matches) fail(slot);
    }, options);
    slot.video.addEventListener('ended', () => {
      if (!valid() || slot !== active || reduced.matches) return;
      slot.ended = true;
      if (!slot.failed) failures.clear();
      if (clock.active && !incoming && errorIndex === null) select((current + 1) % STONES.length);
    }, options);
    slot.video.addEventListener('progress', () => {
      if (!valid() || slot !== incoming || !Number.isFinite(slot.video.duration)) return;
      const buffered = slot.video.buffered;
      if (buffered.length) progress.style.width = `${Math.min(100, buffered.end(buffered.length - 1) / slot.video.duration * 100)}%`;
    }, options);
    const path = `./assets/video/stones/${STONES[index].id}`;
    slot.poster.src = `${path}.jpg?v=${MEDIA_VERSION}`;
    slot.video.poster = `${path}.jpg?v=${MEDIA_VERSION}`;
    if (!reduced.matches) {
      slot.video.src = `${path}.mp4?v=${MEDIA_VERSION}`;
      slot.video.load();
    }
  }

  function select(index, resetFailures = false) {
    if (disposed) return;
    if (resetFailures) failures.clear();
    desired = index;
    errorIndex = null;
    failureElapsed = 0;
    blocked = false;
    active?.video.pause();
    incoming = slots.find(slot => slot !== active);
    progress.style.width = '0%';
    showStatus('loading', index);
    if (incoming.index !== index || incoming.failed || resetFailures) load(incoming, index);
    incoming.wait = 0;
    present();
  }

  const clock = createExhibitClock(host, delta => {
    if (errorIndex !== null) {
      failureElapsed += delta;
      if (failureElapsed >= FAILURE_SECONDS && failures.size < STONES.length) {
        let next = (errorIndex + 1) % STONES.length;
        while (failures.has(next)) next = (next + 1) % STONES.length;
        select(next);
      }
      return;
    }
    if (incoming) {
      present();
    } else if (active) {
      if (reduced.matches) {
        dwell += delta;
        if (dwell >= POSTER_SECONDS) {
          failures.clear();
          select((current + 1) % STONES.length);
        }
      } else if (!blocked) {
        const time = active.video.currentTime;
        active.stall = time === active.lastTime ? active.stall + delta : 0;
        active.lastTime = time;
        if (active.stall >= LOAD_TIMEOUT_SECONDS) fail(active);
      }
    }
    syncPlayback();
  }, () => {
    present();
    syncPlayback();
  }, visible => {
    watchdogPrevious = performance.now();
    if (visible) present();
    syncPlayback();
  });
  // A paused manual selection still needs a visible timeout and Retry control.
  let watchdogPrevious = performance.now();
  const watchdog = setInterval(() => {
    const now = performance.now();
    const delta = Math.min((now - watchdogPrevious) / 1000, 1);
    watchdogPrevious = now;
    if (!clock.visible || !incoming || errorIndex !== null) return;
    incoming.wait += delta;
    if (incoming.wait >= LOAD_TIMEOUT_SECONDS) fail(incoming);
  }, 250);

  STONES.forEach((stone, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = stone.id.slice(3);
    button.addEventListener('click', () => select(index, true));
    buttons.push(button);
    nav.append(button);
  });
  nav.append(pause);
  pause.addEventListener('click', () => {
    userPaused = !userPaused;
    clock.paused = userPaused;
    present();
    syncPlayback();
    labels();
  });
  retry.addEventListener('click', () => select(errorIndex ?? desired ?? current, true));
  start.addEventListener('click', () => {
    blocked = false;
    userPaused = false;
    clock.paused = false;
    showStatus(null);
    labels();
    syncPlayback();
  });
  host.addEventListener('keydown', event => {
    event.stopPropagation();
    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    select(((desired ?? current) + direction + STONES.length) % STONES.length, true);
  });
  const motionChanged = () => {
    slots.forEach(slot => slot.video.pause());
    select(desired ?? Math.max(0, current), true);
  };
  reduced.addEventListener('change', motionChanged);
  const unsubscribe = onLocaleChange(labels);
  labels();
  select(0);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposed = true;
    clearInterval(watchdog);
    clock.dispose();
    unsubscribe();
    reduced.removeEventListener('change', motionChanged);
    for (const slot of slots) {
      slot.cleanup();
      slot.video.pause();
      slot.video.removeAttribute('src');
      slot.video.removeAttribute('poster');
      slot.video.load();
      slot.poster.removeAttribute('src');
    }
  });
}
