// Tiny i18n loader for Speaking Matter.
//
// Usage:
//   import { initI18n, setLocale, getLocale } from './i18n.js';
//   await initI18n();           // boot with stored or default locale
//   await setLocale('he');      // user toggles to Hebrew
//
// HTML elements opt in via:
//   <span data-i18n="nav.touch">Touch</span>            // → textContent
//   <div  data-i18n="..." data-i18n-html="true">…</div> // → innerHTML
//
// Locale JSONs live at ./content/i18n.{en,he}.json and share a key shape
// produced by tools/build_i18n.py.

const SUPPORTED = ['en', 'he'];
const DEFAULT_LOCALE = 'en';
const STORAGE_KEY = 'speakingMatter.locale';

const LOCALE_PATHS = {
  en: './content/i18n.en.json',
  he: './content/i18n.he.json',
};

const RTL_LOCALES = new Set(['he', 'ar', 'fa']);

const cache = new Map(); // locale → parsed JSON
let currentLocale = DEFAULT_LOCALE;
const subscribers = new Set();

// ─── helpers ──────────────────────────────────────────────────────

function getDeep(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function pickStartingLocale() {
  const stored = (() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  })();
  if (stored && SUPPORTED.includes(stored)) return stored;
  // honour browser preference if it's one we support
  const prefs = (navigator.languages || [navigator.language || '']).map(l => l.toLowerCase().slice(0, 2));
  for (const p of prefs) if (SUPPORTED.includes(p)) return p;
  return DEFAULT_LOCALE;
}

async function loadLocale(locale) {
  if (cache.has(locale)) return cache.get(locale);
  const res = await fetch(LOCALE_PATHS[locale], { cache: 'no-cache' });
  if (!res.ok) throw new Error(`[i18n] ${locale}: HTTP ${res.status}`);
  const data = await res.json();
  cache.set(locale, data);
  return data;
}

function applyToDom(data) {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const value = getDeep(data, key);
    if (value == null) return; // leave fallback content in place
    if (el.dataset.i18nHtml === 'true') {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  });
  // Translate placeholder attributes for inputs/textareas.
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const v = getDeep(data, el.getAttribute('data-i18n-placeholder'));
    if (v != null) el.setAttribute('placeholder', v);
  });

  // Update document <title> from the locale's site_title if available
  const title = getDeep(data, 'meta.site_title');
  if (title) document.title = `${title} — Digital Exhibition`;
}

function applyDirAndLang(locale) {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
  // Convenience class for locale-specific CSS overrides
  for (const l of SUPPORTED) root.classList.toggle(`lang-${l}`, l === locale);
}

function updateToggleButtons(locale) {
  document.querySelectorAll('.lang-toggle [data-lang]').forEach((btn) => {
    const isActive = btn.dataset.lang === locale;
    btn.setAttribute('aria-current', isActive ? 'true' : 'false');
  });
}

// ─── public API ────────────────────────────────────────────────────

export function getLocale() { return currentLocale; }

export function onLocaleChange(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export async function setLocale(locale) {
  if (!SUPPORTED.includes(locale) || locale === currentLocale) return;
  let data;
  try {
    data = await loadLocale(locale);
  } catch (err) {
    console.error(err);
    return;
  }
  currentLocale = locale;
  applyDirAndLang(locale);
  applyToDom(data);
  updateToggleButtons(locale);
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* ignore */ }
  subscribers.forEach((fn) => fn(locale));
}

export async function initI18n() {
  const locale = pickStartingLocale();
  let data;
  try {
    data = await loadLocale(locale);
  } catch (err) {
    console.warn(`[i18n] failed to load ${locale}, falling back to ${DEFAULT_LOCALE}`, err);
    data = await loadLocale(DEFAULT_LOCALE);
    currentLocale = DEFAULT_LOCALE;
    applyDirAndLang(DEFAULT_LOCALE);
    applyToDom(data);
    updateToggleButtons(DEFAULT_LOCALE);
    return;
  }
  currentLocale = locale;
  applyDirAndLang(locale);
  applyToDom(data);
  updateToggleButtons(locale);

  // Wire up the header buttons
  document.querySelectorAll('.lang-toggle [data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLocale(btn.dataset.lang));
  });
}
