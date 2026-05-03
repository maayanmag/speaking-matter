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

import { onLocaleChange } from './i18n.js';

const STONES_URL = './assets/vault/stones.json';
const enc = new TextEncoder();
const dec = new TextDecoder();

let stones = [];
let pickedEncryptId = null;
let pickedDecryptId = null;
let lastCipher = null; // { iv, ct, message } — keep plaintext to compare

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

async function doEncrypt() {
  const msgInput = document.querySelector('.vault__msg');
  const message = msgInput.value.trim();
  if (!pickedEncryptId || !message) return;
  const stone = stones.find((s) => s.id === pickedEncryptId);
  const key = await deriveKey(stone);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(message));
  lastCipher = { iv: bytesToHex(iv), ct: bytesToHex(ct), message };

  // Reveal output panel
  const out = document.querySelector('[data-output]');
  if (out) out.hidden = false;
  pickedDecryptId = null;
  document.querySelectorAll('.vault__stones[data-stones="decrypt"] .vault-stone')
    .forEach((b) => b.setAttribute('aria-pressed', 'false'));
  setVerdict('info', '', 'msg.pick_to_decrypt');

  const hexEl = document.querySelector('[data-hex]');
  if (hexEl) await typeHexInto(hexEl, lastCipher.iv + lastCipher.ct);

  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function doDecrypt(stoneId) {
  if (!lastCipher) return;
  const stone = stones.find((s) => s.id === stoneId);
  const key = await deriveKey(stone);
  const iv = new Uint8Array(lastCipher.iv.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const ct = new Uint8Array(lastCipher.ct.match(/.{2}/g).map((h) => parseInt(h, 16)));
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    setVerdict('success', dec.decode(pt), 'msg.decrypted_with', { stone: stone.name });
  } catch {
    setVerdict('fail', '', 'msg.auth_failed', { stone: stone.name });
  }
}

const verdictMessages = {
  en: {
    'msg.pick_to_decrypt': 'Pick a stone above to decrypt the ciphertext.',
    'msg.decrypted_with':  'DECRYPTED WITH {stone}',
    'msg.auth_failed':     'AUTHENTICATION FAILED · {stone} is the wrong key',
  },
  he: {
    'msg.pick_to_decrypt': 'בחרי אבן למעלה כדי לפענח את הצופן.',
    'msg.decrypted_with':  'פוענח עם {stone}',
    'msg.auth_failed':     'אימות נכשל · {stone} אינה המפתח',
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
  document.querySelectorAll('.vault-stone').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  const out = document.querySelector('[data-output]');
  if (out) out.hidden = true;
  const msg = document.querySelector('.vault__msg');
  if (msg) msg.value = '';
  refreshActionState();
}

function bindActions() {
  document.querySelector('[data-action="encrypt"]')?.addEventListener('click', () => { doEncrypt(); });
  document.querySelector('[data-action="reset"]')?.addEventListener('click', reset);
  document.querySelector('.vault__msg')?.addEventListener('input', refreshActionState);
  document.querySelectorAll('.vault__stones[data-stones="decrypt"]').forEach((host) => {
    host.addEventListener('click', (e) => {
      const btn = e.target.closest('.vault-stone');
      if (btn) { pickHere('decrypt', btn.dataset.stoneId); doDecrypt(btn.dataset.stoneId); }
    });
  });
}

function applyLocaleToStones(locale) {
  currentLocale = locale;
  document.querySelectorAll('.vault-stone__name').forEach((el) => {
    const v = el.dataset[locale === 'he' ? 'nameHe' : 'nameEn'];
    if (v) el.textContent = v;
  });
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
