const COPY = {
  en: {
    title: 'Stone Code', brand: 'Speaking Matter', skip: 'Skip to artwork',
    whole: 'Whole image', detail: 'Moving detail', pause: 'Pause', play: 'Play',
    fullscreen: 'Fullscreen', exit: 'Exit fullscreen', enlarge: 'Enlarge image',
    caption: 'The complete image moves slowly through the frame.', still: 'Complete image.',
    legend: 'Reading the image', metaTitle: 'Header',
    meta: 'Source file, mesh size, height statistics and a SHA-256 fingerprint of the data.',
    offset: 'The position of the first byte in this row, written in hexadecimal.',
    hex: 'Each height is scaled to 0–255 and written as two hexadecimal digits, 00–FF. Brighter green means greater height.',
    rowTitle: 'Each row', row: '48 successive height samples. Line breaks organize the display; they are not the stone’s outline.',
    symbols: 'The same bytes mapped to visual symbols. This is a second representation, not a decrypted message.',
    bits: 'The row’s values are combined using XOR. Eight blocks show the resulting byte in binary.',
    original: 'Annotated guide - enlarge', close: 'Close', fit: 'Fit image',
    guideTitle: 'Annotated guide · vector reconstruction', imageError: 'An image could not load. Reload the page to retry.',
    fullscreenError: 'Fullscreen is unavailable. The image remains available in this window.',
    language: 'Language', artwork: 'Stone Code image',
  },
  he: {
    title: 'קוד האבן', brand: 'דומם מדבר', skip: 'דלג לתמונה',
    whole: 'התמונה המלאה', detail: 'תצוגה נעה', pause: 'השהיה', play: 'המשך',
    fullscreen: 'מסך מלא', exit: 'יציאה ממסך מלא', enlarge: 'הגדלת התמונה',
    caption: 'התמונה המלאה עוברת באיטיות במסגרת התצוגה.', still: 'התמונה המלאה.',
    legend: 'מקרא', metaTitle: 'הכותרת',
    meta: 'קובץ המקור, גודל הרשת, נתוני הגובה וטביעת SHA-256 של הנתונים.',
    offset: 'המיקום של הבית הראשון בשורה בתוך רצף הנתונים, בכתיב הקסדצימלי.',
    hex: 'כל גובה מומר למספר בין 0 ל־255, ונכתב בשתי ספרות הקסדצימליות: 00–FF. ירוק בהיר יותר מציין גובה גדול יותר.',
    rowTitle: 'כל שורה', row: '48 דגימות גובה רצופות. החלוקה לשורות מארגנת את התצוגה; היא אינה מתארת את קו המתאר של האבן.',
    symbols: 'אותם בתים מוצגים כסמלים חזותיים. זהו ייצוג נוסף של הנתונים, לא פענוח של מסר מוצפן.',
    bits: 'ערכי השורה משולבים בפעולת XOR. שמונה בלוקים מציגים את הבית שהתקבל בכתיב בינארי.',
    original: 'מקרא מסומן - להגדלה', close: 'סגירה', fit: 'התאמה לחלון',
    guideTitle: 'מקרא מסומן · שחזור וקטורי', imageError: 'לא ניתן לטעון תמונה. יש לטעון את העמוד מחדש.',
    fullscreenError: 'מסך מלא אינו זמין. התמונה ממשיכה להופיע בחלון זה.',
    language: 'שפה', artwork: 'תמונת קוד האבן',
  },
};
const image = document.getElementById('code-image');
const viewport = document.getElementById('viewport');
const artwork = document.getElementById('artwork');
const mode = document.getElementById('mode');
const pause = document.getElementById('pause');
const fullscreen = document.getElementById('fullscreen');
const dialog = document.getElementById('image-dialog');
const dialogImage = document.getElementById('dialog-image');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let locale = new URLSearchParams(location.search).get('lang') === 'he' ? 'he' : 'en';
let whole = reduced.matches, paused = false, offset = 0, direction = 1, hold = 8, previous = null;
let frame = 0, inView = false, running = false, errorKey = null, dialogKind = 'code', disposed = false;
const copy = () => COPY[locale];

function labels() {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr';
  document.documentElement.className = `lang-${locale}`;
  document.title = `${copy().title} - Speaking Matter`;
  document.querySelectorAll('[data-text]').forEach(element => { element.textContent = copy()[element.dataset.text]; });
  document.querySelectorAll('[data-lang]').forEach(button => button.setAttribute('aria-current', String(button.dataset.lang === locale)));
  document.querySelector('.lang-toggle').setAttribute('aria-label', copy().language);
  artwork.setAttribute('aria-label', copy().artwork);
  mode.textContent = whole ? copy().detail : copy().whole;
  mode.setAttribute('aria-pressed', String(whole));
  pause.textContent = paused ? copy().play : copy().pause;
  pause.setAttribute('aria-pressed', String(paused));
  pause.hidden = whole;
  fullscreen.textContent = document.fullscreenElement ? copy().exit : copy().fullscreen;
  document.querySelector('.artwork__caption').textContent = whole ? copy().still : copy().caption;
  document.getElementById('status').textContent = errorKey ? copy()[errorKey] : '';
  document.getElementById('dialog-title').textContent = dialogKind === 'legend' ? copy().guideTitle : `${copy().title} · Flint Golan 01`;
  document.getElementById('zoom').textContent = dialog.classList.contains('is-native') ? copy().fit : '100%';
  const preview = document.getElementById('legend-preview');
  const legendPath = `./assets/legend.${locale}.svg`;
  if (preview.getAttribute('src') !== legendPath) preview.src = legendPath;
  preview.alt = copy().guideTitle;
  if (dialog.open && dialogKind === 'legend' && dialogImage.getAttribute('src') !== legendPath) {
    dialogImage.src = legendPath;
    dialogImage.alt = copy().guideTitle;
  }
}
function draw() { image.style.transform = `translateY(${-offset}px)`; }
function tick(now) {
  if (!running) return;
  const delta = previous === null ? 0 : Math.min((now - previous) / 1000, 0.1);
  previous = now;
  const maximum = Math.max(0, image.clientHeight - viewport.clientHeight);
  if (hold > 0) hold = Math.max(0, hold - delta);
  else if (maximum > 0) {
    offset = Math.max(0, Math.min(maximum, offset + direction * delta * 16));
    if (offset === maximum || offset === 0) { direction *= -1; hold = 8; }
    draw();
  }
  frame = requestAnimationFrame(tick);
}
function sync() {
  const next = !disposed && inView && !document.hidden && !paused && !whole && !dialog.open && image.complete && image.naturalWidth > 0;
  if (next === running) return;
  running = next;
  previous = null;
  cancelAnimationFrame(frame);
  if (running) frame = requestAnimationFrame(tick);
}
function setMode(value) {
  whole = value;
  artwork.classList.toggle('is-whole', whole);
  offset = 0; direction = 1; hold = 8; draw(); labels(); sync();
}
function showImage(kind) {
  dialogKind = kind;
  dialog.classList.remove('is-native');
  document.getElementById('zoom').setAttribute('aria-pressed', 'false');
  dialogImage.src = kind === 'legend' ? `./assets/legend.${locale}.svg` : './assets/stone-code.png';
  dialogImage.alt = kind === 'legend' ? copy().guideTitle : `${copy().title} · Flint Golan 01`;
  labels();
  dialog.showModal();
  sync();
}
document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => {
  locale = button.dataset.lang; labels();
  const url = new URL(location.href); url.searchParams.set('lang', locale); history.replaceState(null, '', url);
}));
mode.addEventListener('click', () => setMode(!whole));
pause.addEventListener('click', () => { paused = !paused; labels(); sync(); });
document.getElementById('open-code').addEventListener('click', () => showImage('code'));
document.getElementById('open-legend').addEventListener('click', () => showImage('legend'));
document.getElementById('close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', sync);
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
document.getElementById('zoom').addEventListener('click', event => {
  event.currentTarget.setAttribute('aria-pressed', String(dialog.classList.toggle('is-native'))); labels();
});
if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
  fullscreen.hidden = false;
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) { console.warn('[fullscreen]', error); errorKey = 'fullscreenError'; labels(); }
  });
}
document.addEventListener('fullscreenchange', labels);
document.addEventListener('visibilitychange', sync);
document.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { errorKey = 'imageError'; labels(); sync(); }));
image.addEventListener('load', sync);
const visibility = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; sync(); });
visibility.observe(artwork);
const resize = new ResizeObserver(() => {
  offset = Math.min(offset, Math.max(0, image.clientHeight - viewport.clientHeight)); draw();
});
resize.observe(viewport);
reduced.addEventListener('change', () => setMode(reduced.matches));
window.addEventListener('pagehide', event => {
  if (event.persisted) { running = false; cancelAnimationFrame(frame); previous = null; return; }
  disposed = true; sync(); visibility.disconnect(); resize.disconnect();
});
window.addEventListener('pageshow', sync);
setMode(whole);
