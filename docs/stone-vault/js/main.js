import { initI18n, getLocale, onLocaleChange } from './i18n.js';

const COPY = {
  en: {
    fullscreen: 'Fullscreen', exit: 'Exit fullscreen', language: 'Language',
    fullscreenError: 'Fullscreen is unavailable. The exhibition will continue in this window.',
    startupError: 'The exhibition could not start. Please reload the page.',
  },
  he: {
    fullscreen: 'מסך מלא', exit: 'יציאה ממסך מלא', language: 'שפה',
    fullscreenError: 'מסך מלא אינו זמין. התצוגה תימשך בחלון זה.',
    startupError: 'לא ניתן להתחיל את התצוגה. יש לטעון את העמוד מחדש.',
  },
};
const fullscreen = document.getElementById('exhibit-fullscreen');
const status = document.getElementById('exhibit-status');
let errorKey = null;

function localize() {
  const copy = COPY[getLocale()];
  fullscreen.textContent = document.fullscreenElement ? copy.exit : copy.fullscreen;
  fullscreen.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
  document.querySelector('.lang-toggle').setAttribute('aria-label', copy.language);
  status.textContent = errorKey ? copy[errorKey] : '';
}
await initI18n();
onLocaleChange(localize);
localize();

if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
  fullscreen.hidden = false;
  document.addEventListener('fullscreenchange', localize);
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      if (errorKey === 'fullscreenError') errorKey = null;
    } catch (error) {
      console.warn('[fullscreen]', error);
      if (!errorKey) errorKey = 'fullscreenError';
    }
    localize();
  });
}
try {
  const { initVault } = await import('./vault.js');
  initVault();
} catch (error) {
  console.error('[vault] startup', error);
  errorKey = 'startupError';
  localize();
}
