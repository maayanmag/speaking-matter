// vault.js — Stone Vault: interactive geological encryption demo.
//
// Each stone's `helper_data.json` carries a long hex helper that — in the
// physical install — is used by a fuzzy extractor to reconstruct a 256-bit
// key from a re-scanned heightmap. Here we shortcut to the same metaphor:
//
//     key = SHA-256(stone.helper_hex)
//
// The encryption itself is real AES-256-GCM via the Web Crypto API. Picking
// the wrong stone fails the GCM auth tag and produces a "glitch" verdict.
//
// Artifact metaphor: ciphertext can be downloaded as a `vault.json` file
// (the visitor "carries it away"), and later reopened via the load button.
// Notably the file carries no hint about which stone produced it — only
// the right stone reopens it.

import { onLocaleChange } from './i18n.js';

const STONES_URL = './assets/vault/stones.json';
const VAULT_FORMAT_VERSION = 1;
const enc = new TextEncoder();
const dec = new TextDecoder();

let stones = [];
let pickedEncryptId = null;
let pickedDecryptId = null;
let lastCipher = null; // { iv, ct, message? } — message present only when locally produced
let loadedFilename = null;

const keyCache = new Map(); // stoneId -> CryptoKey

async function deriveKey(stone) {
  if (keyCache.has(stone.id)) return keyCache.get(stone.id);
  const seed = await crypto.subtle.digest('SHA-256', enc.encode(stone.helper_hex));
  const key = await crypto.subtle.importKey(
    'raw', seed, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
  keyCache.set(stone.id, key);
  return key;
}

function bytesToHex(buf) {
  const arr = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, '0');
  return s;
}

function hexToBytes(hex) {
  const m = hex.match(/.{2}/g);
  if (!m) return new Uint8Array(0);
  return new Uint8Array(m.map((h) => parseInt(h, 16)));
}

function groupHex(hex, group = 4, perLine = 8) {
  const groups = hex.match(new RegExp(`.{1,${group}}`, 'g')) || [];
  const lines = [];
  for (let i = 0; i < groups.length; i += perLine) {
    lines.push(groups.slice(i, i + perLine).join(' '));
  }
  return lines.join('\n');
}

function pickHere(role, id) {
  if (role === 'encrypt') pickedEncryptId = id;
  else pickedDecryptId = id;
  document.querySelectorAll(`.vault__stones[data-stones="${role}"] .vault-stone`)
    .forEach((b) => b.setAttribute('aria-pressed', b.dataset.stoneId === id ? 'true' : 'false'));
  refreshActionState();
}

function refreshActionState() {
  const encryptBtn = document.querySelector('[data-action="encrypt"]');
  const msgInput   = document.querySelector('.vault__msg');
  if (encryptBtn) encryptBtn.disabled = !pickedEncryptId || !msgInput?.value.trim();
}

function renderStonePickers() {
  document.querySelectorAll('.vault__stones').forEach((host) => {
    const role = host.dataset.stones;
    host.innerHTML = stones.map((s) => `
      <button type="button" class="vault-stone" data-stone-id="${s.id}" data-role="${role}" aria-pressed="false" aria-label="${s.name}">
        <img class="vault-stone__thumb" src="${s.thumb}" alt="" loading="lazy" />
        <span class="vault-stone__name" data-name-en="${s.name}" data-name-he="${s.name_he}">${s.name}</span>
        <span class="vault-stone__fp">fp ${s.key_fingerprint_sha256.match(/.{1,4}/g).join(' ')}</span>
      </button>
    `).join('');
    host.querySelectorAll('.vault-stone').forEach((btn) => {
      btn.addEventListener('click', () => pickHere(role, btn.dataset.stoneId));
    });
  });
}

async function typeHexInto(el, hex) {
  el.classList.add('vault__hex--typing');
  el.textContent = '';
  const grouped = groupHex(hex, 4, 8);
  // Reveal in chunks for a "stream" feel — fast enough not to be tedious.
  const CHUNK = 16;
  for (let i = 0; i < grouped.length; i += CHUNK) {
    el.textContent += grouped.slice(i, i + CHUNK);
    await new Promise((r) => setTimeout(r, 12));
  }
  el.classList.remove('vault__hex--typing');
}

function showHexStatic(el, hex) {
  el.classList.remove('vault__hex--typing');
  el.textContent = groupHex(hex, 4, 8);
}

function setLoadedBadge(filename) {
  const el = document.querySelector('[data-loaded]');
  if (!el) return;
  if (!filename) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = tr('msg.loaded_from', { file: filename });
}

function showOutputPanel({ fromFile }) {
  const out = document.querySelector('[data-output]');
  if (out) out.hidden = false;
  // Download button: only visible when we encrypted locally
  const dl = document.querySelector('[data-action="download"]');
  if (dl) dl.hidden = fromFile;
  // Loaded badge: only visible when loaded from file
  setLoadedBadge(fromFile ? loadedFilename : null);
  // Reset decrypt selection
  pickedDecryptId = null;
  document.querySelectorAll('.vault__stones[data-stones="decrypt"] .vault-stone')
    .forEach((b) => b.setAttribute('aria-pressed', 'false'));
  setVerdict('info', '', 'msg.pick_to_decrypt');
}

async function doEncrypt() {
  const msgInput = document.querySelector('.vault__msg');
  const message = msgInput.value.trim();
  if (!pickedEncryptId || !message) return;
  const stone = stones.find((s) => s.id === pickedEncryptId);
  const key = await deriveKey(stone);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(message));
  lastCipher = { iv: bytesToHex(iv), ct: bytesToHex(ct), message };
  loadedFilename = null;
  showOutputPanel({ fromFile: false });

  const hexEl = document.querySelector('[data-hex]');
  if (hexEl) await typeHexInto(hexEl, lastCipher.iv + lastCipher.ct);

  document.querySelector('[data-output]').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function doDecrypt(stoneId) {
  if (!lastCipher) return;
  const stone = stones.find((s) => s.id === stoneId);
  const key = await deriveKey(stone);
  const iv = hexToBytes(lastCipher.iv);
  const ct = hexToBytes(lastCipher.ct);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    setVerdict('success', dec.decode(pt), 'msg.decrypted_with', { stone: stone.name });
  } catch {
    setVerdict('fail', '', 'msg.auth_failed', { stone: stone.name });
  }
}

// ─── Download ──────────────────────────────────────────────────────────

function buildVaultFile() {
  if (!lastCipher) return null;
  return {
    speaking_matter_vault: VAULT_FORMAT_VERSION,
    algorithm: 'AES-256-GCM',
    iv: lastCipher.iv,
    ciphertext: lastCipher.ct,
    created_at: new Date().toISOString(),
  };
}

function doDownload() {
  const data = buildVaultFile();
  if (!data) return;
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const ts   = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vault-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Load ──────────────────────────────────────────────────────────────

function isHex(s, minLen = 2) {
  return typeof s === 'string' && s.length >= minLen && /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
}

function validateVaultFile(obj) {
  if (!obj || typeof obj !== 'object') return 'invalid';
  if (obj.speaking_matter_vault !== VAULT_FORMAT_VERSION) return 'wrong_version';
  if (obj.algorithm !== 'AES-256-GCM') return 'wrong_algo';
  if (!isHex(obj.iv) || obj.iv.length !== 24) return 'bad_iv';      // 12 bytes
  if (!isHex(obj.ciphertext, 32)) return 'bad_ct';                  // ≥ 16 bytes (GCM tag alone)
  return null;
}

async function handleLoadedFile(file) {
  const text = await file.text();
  let obj;
  try { obj = JSON.parse(text); }
  catch { setVerdict('fail', '', 'msg.load_invalid'); return; }
  const err = validateVaultFile(obj);
  if (err) { setVerdict('fail', '', `msg.load_${err}`); return; }
  lastCipher = { iv: obj.iv, ct: obj.ciphertext };
  loadedFilename = file.name;
  showOutputPanel({ fromFile: true });
  const hexEl = document.querySelector('[data-hex]');
  if (hexEl) showHexStatic(hexEl, obj.iv + obj.ciphertext);
  document.querySelector('[data-output]').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function bindLoad() {
  const trigger = document.querySelector('[data-action="load"]');
  const input   = document.querySelector('[data-file-input]');
  if (!trigger || !input) return;
  trigger.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleLoadedFile(file);
    e.target.value = ''; // allow re-loading same filename later
  });
}

// ─── Verdict (i18n) ────────────────────────────────────────────────────

const verdictMessages = {
  en: {
    'msg.pick_to_decrypt': 'Pick a stone above to decrypt the ciphertext.',
    'msg.decrypted_with':  'DECRYPTED WITH {stone}',
    'msg.auth_failed':     'AUTHENTICATION FAILED · {stone} is the wrong key',
    'msg.loaded_from':     'Loaded · {file}',
    'msg.load_invalid':         'NOT A VALID JSON FILE',
    'msg.load_wrong_version':   'NOT A SPEAKING MATTER VAULT FILE',
    'msg.load_wrong_algo':      'UNSUPPORTED ALGORITHM',
    'msg.load_bad_iv':          'CORRUPTED VAULT · invalid IV',
    'msg.load_bad_ct':          'CORRUPTED VAULT · invalid ciphertext',
  },
  he: {
    'msg.pick_to_decrypt': 'בחרי אבן למעלה כדי לפענח את הצופן.',
    'msg.decrypted_with':  'פוענח עם {stone}',
    'msg.auth_failed':     'אימות נכשל · {stone} אינה המפתח',
    'msg.loaded_from':     'נטען · {file}',
    'msg.load_invalid':         'קובץ JSON לא תקין',
    'msg.load_wrong_version':   'הקובץ אינו כספת אבן',
    'msg.load_wrong_algo':      'אלגוריתם לא נתמך',
    'msg.load_bad_iv':          'הקובץ פגום · IV לא תקין',
    'msg.load_bad_ct':          'הקובץ פגום · צופן לא תקין',
  },
};
let currentLocale = 'en';

function tr(key, vars = {}) {
  const m = verdictMessages[currentLocale]?.[key] || verdictMessages.en[key] || key;
  return m.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

function setVerdict(state, body, titleKey = '', vars = {}) {
  const v = document.querySelector('[data-verdict]');
  if (!v) return;
  v.dataset.state = state;
  const title = titleKey ? tr(titleKey, vars) : '';
  v.innerHTML = `${title ? `<span class="vault__verdict__title">${title}</span>` : ''}${body || ''}`;
}

function reset() {
  pickedEncryptId = pickedDecryptId = null;
  lastCipher = null;
  loadedFilename = null;
  document.querySelectorAll('.vault-stone').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  const out = document.querySelector('[data-output]');
  if (out) out.hidden = true;
  const msg = document.querySelector('.vault__msg');
  if (msg) msg.value = '';
  setLoadedBadge(null);
  refreshActionState();
}

function bindActions() {
  document.querySelector('[data-action="encrypt"]')?.addEventListener('click', () => { doEncrypt(); });
  document.querySelector('[data-action="reset"]')?.addEventListener('click', reset);
  document.querySelector('[data-action="download"]')?.addEventListener('click', doDownload);
  document.querySelector('.vault__msg')?.addEventListener('input', refreshActionState);
  document.querySelectorAll('.vault__stones[data-stones="decrypt"]').forEach((host) => {
    host.addEventListener('click', (e) => {
      const btn = e.target.closest('.vault-stone');
      if (btn) { pickHere('decrypt', btn.dataset.stoneId); doDecrypt(btn.dataset.stoneId); }
    });
  });
  bindLoad();
}

function applyLocaleToStones(locale) {
  currentLocale = locale;
  document.querySelectorAll('.vault-stone__name').forEach((el) => {
    const v = el.dataset[locale === 'he' ? 'nameHe' : 'nameEn'];
    if (v) el.textContent = v;
  });
  // Refresh the loaded badge in case it was visible
  if (loadedFilename) setLoadedBadge(loadedFilename);
}

export async function initVault() {
  const root = document.getElementById('vault');
  if (!root) return;
  let data;
  try {
    const res = await fetch(STONES_URL);
    data = await res.json();
  } catch (err) {
    console.warn('[vault] failed to load stones:', err);
    return;
  }
  stones = data.stones || [];
  if (!stones.length) return;

  renderStonePickers();
  bindActions();
  refreshActionState();
  // Locale-aware stone names + verdict messages
  onLocaleChange?.((loc) => applyLocaleToStones(loc));
  applyLocaleToStones(document.documentElement.lang || 'en');
}
