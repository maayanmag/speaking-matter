const subscribers = new Set();
let locale = new URLSearchParams(location.search).get('lang') === 'he' ? 'he' : 'en';
let initialized = false;

export function getLocale() { return locale; }

export function onLocaleChange(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function setLocale(value) {
  locale = value === 'he' ? 'he' : 'en';
  const root = document.documentElement;
  root.lang = locale;
  root.dir = locale === 'he' ? 'rtl' : 'ltr';
  for (const language of ['en', 'he']) root.classList.toggle(`lang-${language}`, language === locale);
  document.title = locale === 'he' ? 'אבנים אפשריות — דומם מדבר' : 'Possible Stones — Speaking Matter';
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
