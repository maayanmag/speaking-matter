const subscribers = new Set();
let locale = new URLSearchParams(location.search).get('lang') === 'he' ? 'he' : 'en';
let initialized = false;

export function getLocale() { return locale; }
export function onLocaleChange(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
export function setLocale(value) {
  if (value !== 'en' && value !== 'he') throw new Error(`Unsupported locale: ${value}`);
  locale = value;
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr';
  for (const language of ['en', 'he']) {
    document.documentElement.classList.toggle(`lang-${language}`, language === locale);
  }
  document.title = locale === 'he' ? 'הצפנה גאולוגית - דומם מדבר' : 'Geological Encryption - Speaking Matter';
  document.querySelectorAll('[data-lang]').forEach(button => {
    button.setAttribute('aria-current', String(button.dataset.lang === locale));
  });
  for (const callback of subscribers) callback(locale);
}
export async function initI18n() {
  if (!initialized) {
    initialized = true;
    document.querySelectorAll('[data-lang]').forEach(button => {
      button.addEventListener('click', () => {
        setLocale(button.dataset.lang);
        const url = new URL(location.href);
        url.searchParams.set('lang', locale);
        history.replaceState(null, '', url);
      });
    });
  }
  setLocale(locale);
}
