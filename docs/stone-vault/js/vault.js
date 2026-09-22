import { getLocale, onLocaleChange } from './i18n.js';
import { createExhibitClock } from './exhibit-clock.js';
import { sampleHeightmap } from './vault-heightmap.mjs?v=meshflow-20260921-1';
import { traceSha256, wordHex } from './vault-sha256.mjs?v=meshflow-20260921-1';
import { createMeshView, validateMesh } from './vault-mesh.js?v=meshflow-20260922-3';

const PHASES = ['selection', 'mesh', 'unwrap', 'heightmap', 'sampling', 'sha', 'plaintext', 'encrypting', 'ciphertext'];
const SECONDS = [5, 5, 7.5, 3.75, 5, 10, 5, 8.75, 9];
const COPY = {
  he: {
    title: 'הצפנה גאולוגית',
    phases: ['בחירת אבן', 'רשת תלת־ממד', 'פריסת UV', 'מפת גבהים', 'דגימת ערכים', 'חישוב SHA-256', 'קידוד UTF-8', 'הצפנת AES-256-GCM', 'טקסט מוצפן'],
    help: [
      'נבחרת אחת משלוש אבנים שנסרקו מראש. בהמשך, המדידות שלה ישמשו ליצירת מפתח ההצפנה.',
      'הסריקה מתארת את צורת האבן באמצעות משולשים קטנים. הסיבוב מאפשר לראות את המבנה שלה מכמה צדדים.',
      'פני האבן נפרשים למפה שטוחה, כמו פריסה של מעטפת. כל נקודה נשארת קשורה למקום שממנו הגיעה על האבן.',
      'בכל תא במפה נשמר גובה שנמדד בסריקה. בהיר מציין גובה גדול יותר; אזורים ריקים אינם חלק מפני האבן.',
      'הגבהים נכתבים כמספרים שהמחשב יכול לעבד. המספרים שמופיעים כאן נלקחים מהתאים במפה.',
      'המדידות עוברות חישוב שמפיק רצף קצר באורך קבוע: מפתח ההצפנה. המספרים המתחלפים מציגים צעדים אמיתיים בחישוב.',
      'גם המסר מיוצג במחשב כמספרים. כאן רואים את הטקסט ואת המספרים שמייצגים את התווים שלו, לפני ההצפנה.',
      'מספרי המסר, למעלה, משולבים עם רצף שנוצר בעזרת המפתח. בשורה התחתונה מתקבל המידע המוצפן.',
      'המסר הפך לרצף שאינו קריא כטקסט. לצדו נשמרים מספר פתיחה אקראי וקוד בדיקה, שמאפשר לזהות שינוי במידע.',
    ],
    pause: 'השהיה', play: 'המשך', loading: 'טעינת נתוני הסריקה',
    error: 'לא ניתן להשלים את התהליך. יש לטעון את העמוד מחדש.',
    key: 'מפתח הצפנה · 256 סיביות', block: 'בלוק', round: 'סבב', samples: 'דגימות',
    input: 'בתי קלט', stream: 'זרם מפתח AES-CTR', output: 'בתי פלט', bytes: 'בתים',
  },
  en: {
    title: 'Geological encryption',
    phases: ['Stone selection', '3D mesh', 'UV unwrap', 'Heightmap', 'Value sampling', 'SHA-256 calculation', 'UTF-8 encoding', 'AES-256-GCM encryption', 'Ciphertext'],
    help: [
      'One of three previously scanned stones is selected. Its measurements will be used to create the encryption key.',
      'The scan describes the stone’s shape using small triangles. Rotation lets you inspect that structure from different sides.',
      'The stone’s surface is unfolded into a flat map, like opening out a wrapper. Each point stays linked to its original place on the stone.',
      'Each map cell stores a height measured from the scan. Brighter cells mean greater height; empty areas are not part of the surface.',
      'Heights are written as numbers the computer can process. The numbers shown here come directly from cells in the map.',
      'A calculation turns the measurements into a short sequence of fixed length: the encryption key. The changing numbers show real steps in that calculation.',
      'Computers also represent messages as numbers. Here you see the text and the numbers representing its characters, before encryption.',
      'The message numbers, at the top, are combined with a sequence produced using the key. The bottom row contains the encrypted information.',
      'The message is now a sequence that cannot be read as text. It is stored with a random starting value and a check value that can detect changes to the data.',
    ],
    pause: 'Pause', play: 'Play', loading: 'Loading scan data',
    error: 'The process could not complete. Reload the page to retry.',
    key: 'Encryption key · 256 bits', block: 'Block', round: 'Round', samples: 'samples',
    input: 'Input bytes', stream: 'AES-CTR keystream', output: 'Output bytes', bytes: 'bytes',
  },
};
const hex = buffer => [...new Uint8Array(buffer)].map(n => n.toString(16).padStart(2, '0')).join('');
const grouped = (text, size = 8) => text.match(new RegExp(`.{1,${size}}`, 'g'))?.join(' ') || '';
const clamp = n => Math.min(1, Math.max(0, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
async function getJSON(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

export function initVault() {
  const host = document.getElementById('vault');
  if (!host || host.dataset.initialized) return;
  host.dataset.initialized = 'true';
  host.innerHTML = `
    <header class="vault-journey__head"><h2 data-name></h2><button class="exhibit-button" type="button" data-pause></button></header>
    <div class="vault-journey__heading"><span data-step dir="ltr"></span><h3 data-label role="status" aria-describedby="vault-stage-help"></h3><bdi data-stone-name dir="ltr" lang="en"></bdi></div>
    <p class="vault-journey__help" id="vault-stage-help" data-stage-help></p>
    <div class="vault-journey__stage">
      <section class="vault-scene vault-selection" data-scene="selection"><div data-stones></div></section>
      <section class="vault-scene vault-geometry" data-scene="geometry">
        <canvas data-mesh aria-hidden="true"></canvas>
        <div class="vault-samples" data-samples><p dir="ltr">cell → Z → uint16 LE</p><pre data-values dir="ltr"></pre><p data-byte-count dir="ltr"></p></div>
        <p class="vault-geometry__caption" data-geometry-caption dir="ltr"></p>
      </section>
      <section class="vault-scene vault-hash" data-scene="sha" dir="ltr">
        <div class="vault-hash__input"><span data-hash-counter></span><code data-block-words></code></div>
        <div class="vault-hash__operations"><span data-round></span><code data-operation></code></div>
        <div class="vault-registers" data-registers></div>
        <p class="vault-hash__formula" data-formula></p>
        <div class="vault-hash__result" data-hash-result><span>SHA-256 → 256 bits</span><code data-hash-digest></code></div>
      </section>
      <section class="vault-scene vault-message" data-scene="plaintext">
        <p data-message-title dir="auto"></p><pre data-plaintext dir="ltr"></pre>
        <div class="vault-utf" dir="ltr"><span>UTF-8</span><code data-utf></code></div>
      </section>
      <section class="vault-scene vault-encryption" data-scene="encrypting">
        <div class="vault-encryption__meta"><span data-aes-counter></span><code data-counter dir="ltr"></code></div>
        <div class="vault-byte-row"><span data-input-label></span><code data-input-chars dir="ltr"></code><div data-input-bytes class="vault-bytes" dir="ltr"></div></div>
        <div class="vault-byte-row"><span data-stream-label></span><span class="vault-xor" dir="ltr">⊕</span><div data-stream-bytes class="vault-bytes" dir="ltr"></div></div>
        <div class="vault-byte-row vault-byte-row--output"><span data-output-label></span><span class="vault-xor" dir="ltr">=</span><div data-output-bytes class="vault-bytes" dir="ltr"></div></div>
        <p data-aes-note dir="ltr">AES-256-GCM · CTR + GHASH · tag 128 bits</p>
      </section>
      <section class="vault-scene vault-cipher" data-scene="ciphertext" dir="ltr">
        <p data-cipher-title></p><pre data-ciphertext></pre><dl><dt>Nonce · 96 bits</dt><dd data-nonce></dd><dt>Authentication tag · 128 bits</dt><dd data-tag></dd></dl>
      </section>
      <div class="vault-key" data-key-slot><span data-key-label></span><code data-key dir="ltr"></code></div>
    </div>
    <footer class="vault-journey__foot"><span data-position dir="ltr"></span><span data-detail></span></footer>`;
  const el = selector => host.querySelector(selector);
  const scenes = [...host.querySelectorAll('[data-scene]')];
  const pause = el('[data-pause]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fields = new Map(), samples = new Map(), traces = new Map();
  const registers = Array.from({ length: 8 }, (_, i) => {
    const item = document.createElement('div');
    const name = document.createElement('span'), value = document.createElement('code');
    name.textContent = 'ABCDEFGH'[i]; item.append(name, value); el('[data-registers]').append(item);
    return value;
  });
  const byteRows = ['input', 'stream', 'output'].map(name => Array.from({ length: 16 }, () => {
    const cell = document.createElement('span'); el(`[data-${name}-bytes]`).append(cell); return cell;
  }));
  let messages = [], stones = [], stoneCards = [];
  let index = 0, phaseIndex = 0, elapsed = 0, frameElapsed = 0;
  let loaded = false, busy = false, failed = false, disposed = false, version = 0;
  let locale = getLocale(), digest = '', encrypted = null, keyTask = null, cipherTask = null;
  let view;
  const copy = () => COPY[locale];
  const phase = () => PHASES[phaseIndex];
  const message = () => messages[index];
  const stone = () => stones.find(s => s.id === message().stoneId);
  const field = () => fields.get(stone().id);
  const sample = () => samples.get(stone().id);

  function fail(error) {
    if (disposed) return;
    console.error('[vault]', error);
    failed = true; busy = false;
    host.dataset.phase = 'error';
    scenes.forEach(scene => { scene.hidden = true; });
    el('[data-key-slot]').hidden = true;
    el('[data-label]').textContent = copy().error;
    el('[data-detail]').textContent = '';
    el('[data-stage-help]').textContent = '';
  }
  function chrome() {
    el('[data-name]').textContent = copy().title;
    pause.textContent = clock.paused ? copy().play : copy().pause;
    pause.setAttribute('aria-pressed', String(clock.paused));
    el('[data-key-label]').textContent = copy().key;
    el('[data-input-label]').textContent = copy().input;
    el('[data-stream-label]').textContent = copy().stream;
    el('[data-output-label]').textContent = copy().output;
    if (loaded && !failed) {
      el('[data-label]').textContent = copy().phases[phaseIndex];
      el('[data-stage-help]').textContent = copy().help[phaseIndex];
      el('[data-label]').title = copy().help[phaseIndex];
    }
  }
  async function computeKey() {
    if (keyTask) return keyTask;
    const ownVersion = version, selected = stone();
    keyTask = (async () => {
      const bytes = samples.get(selected.id).bytes;
      const trace = traces.get(selected.id);
      const result = await crypto.subtle.digest('SHA-256', bytes);
      const actual = hex(result);
      if (actual !== trace.hex || actual !== selected.expectedSha256 || actual !== fields.get(selected.id).expectedSha256) {
        throw new Error('SHA-256 trace / mesh digest mismatch');
      }
      if (disposed || ownVersion !== version) return;
      digest = actual; host.dataset.key = digest;
      return result;
    })();
    return keyTask;
  }
  async function encrypt() {
    if (cipherTask) return cipherTask;
    const ownVersion = version, text = message().text;
    cipherTask = (async () => {
      const raw = await computeKey();
      if (disposed || ownVersion !== version) return;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plain = new TextEncoder().encode(text);
      const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
      const result = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, plain));
      const ctrKey = await crypto.subtle.importKey('raw', raw, 'AES-CTR', false, ['encrypt']);
      const counter = new Uint8Array(16); counter.set(iv); counter[15] = 2;
      const stream = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CTR', counter, length: 32 }, ctrKey, new Uint8Array(plain.length)));
      if (plain.some((value, i) => (value ^ stream[i]) !== result[i])) throw new Error('GCM/CTR byte mismatch');
      if (disposed || ownVersion !== version) return;
      encrypted = { iv, plain, stream, payload: result.slice(0, -16), tag: result.slice(-16) };
      host.dataset.encrypted = 'true';
    })();
    return cipherTask;
  }
  function renderHash(p) {
    const trace = traces.get(stone().id), total = trace.blocks.length;
    // First quarter: one block's rounds. Middle half: remaining blocks.
    const time = p * 8;
    const step = time < 2 ? Math.min(63, Math.floor(time / 2 * 64))
      : Math.min(total * 64 - 1, 64 + Math.floor((time - 2) / 4 * (total - 1) * 64));
    const blockIndex = Math.floor(step / 64), round = step % 64;
    const block = trace.blocks[blockIndex], complete = time >= 6;
    const state = complete ? trace.blocks.at(-1).after : block.rounds[round + 1];
    el('[data-hash-counter]').textContent = `\u206612,300\u2069 ${copy().bytes} + padding → \u2066${total} × 512 bits\u2069 · ${copy().block} \u2066${blockIndex + 1} / ${total}\u2069`;
    el('[data-block-words]').textContent = [...block.words].map(wordHex).join(' ');
    el('[data-round]').textContent = `${copy().round} \u2066${complete ? 64 : round + 1} / 64\u2069`;
    el('[data-operation]').textContent = `W[t] ${wordHex(block.schedule[round])}  +  K[t] ${wordHex(trace.constants[round])}`;
    registers.forEach((reg, i) => { reg.textContent = wordHex(state[i]); });
    el('[data-registers]').classList.toggle('is-final', complete);
    el('[data-formula]').textContent = complete ? 'H[i] = H[i] + working[i]  (mod 2³²)'
      : 'Σ₁(E) = ROTR⁶(E) ⊕ ROTR¹¹(E) ⊕ ROTR²⁵(E)   ·   Ch / Maj / + mod 2³²';
    el('[data-hash-result]').style.opacity = String(complete ? 1 : 0);
    el('[data-hash-digest]').textContent = complete ? grouped(digest) : '';
    host.style.setProperty('--key-dock', String(complete ? smooth((time - 6) / 2) : 0));
  }
  function renderEncryption(p) {
    if (!encrypted) return;
    const { plain, stream, payload, iv } = encrypted;
    const blocks = Math.ceil(plain.length / 16);
    const position = Math.min(blocks - 0.001, p * blocks);
    const block = Math.floor(position), within = reduced.matches ? 1 : position % 1;
    const start = block * 16;
    el('[data-aes-counter]').textContent = `${copy().block} \u2066${block + 1} / ${blocks}\u2069 · 16 ${copy().bytes}`;
    el('[data-counter]').textContent = `CTR = ${hex(iv)} ${wordHex(block + 2)}`;
    el('[data-input-chars]').textContent = new TextDecoder().decode(plain.slice(start, start + 16)).replace(/\n/g, '↵');
    [plain, stream, payload].forEach((bytes, r) => byteRows[r].forEach((cell, i) => {
      const value = bytes[start + i];
      cell.textContent = value === undefined ? '—' : value.toString(16).padStart(2, '0');
      cell.style.opacity = String(r < 2 || reduced.matches ? 1 : clamp((within - i / 32) * 4));
      cell.style.transform = r === 2 && !reduced.matches ? `translateY(${(1 - smooth(within * 2)) * -14}px)` : '';
    }));
  }
  function render() {
    if (!loaded || failed || disposed) return;
    const current = phase(), p = reduced.matches ? 1 : clamp(elapsed / SECONDS[phaseIndex]);
    host.dataset.elapsed = elapsed.toFixed(3);
    if (current === 'selection') {
      const settle = smooth((p - 0.45) / 0.55);
      stoneCards.forEach((card, i) => {
        const chosen = stones[i].id === stone().id;
        const origin = (i - 1) * 32;
        card.classList.toggle('is-selected', chosen);
        card.style.left = `${50 + origin * (chosen ? 1 - settle : 1 + settle * 0.6)}%`;
        card.style.opacity = String(chosen ? 1 : 1 - settle);
        card.style.transform = `translate(-50%, -50%) scale(${chosen ? 1 + settle * 0.65 : 1 - settle * 0.25})`;
      });
    }
    if (['mesh', 'unwrap', 'heightmap', 'sampling'].includes(current)) {
      view.render(current, p, reduced.matches);
      el('[data-geometry-caption]').textContent = current === 'mesh'
        ? `${field().source.triangleCount.toLocaleString('en')} source triangles · ${view.triangleCount.toLocaleString('en')} displayed`
        : current === 'unwrap' ? 'XYZ → UV · barycentric interpolation'
        : `64 × 64 · Z ∈ [0, 1] · ${sample().validCount.toLocaleString('en')} ${copy().samples}`;
      if (current === 'sampling') {
        const start = Math.min(4090, Math.floor(p * 4096));
        el('[data-values]').textContent = Array.from({ length: 6 }, (_, j) => {
          const i = start + j, h = field().heights[i];
          return `${String(i).padStart(4, '0')}  ${h === null ? '   —   ' : h.toFixed(5)}  ${grouped(hex(sample().bytes.slice(12 + i * 3, 15 + i * 3)), 2)}`;
        }).join('\n');
        el('[data-byte-count]').textContent = `SVHM0001 + 4,096 × 3 → 12,300 ${copy().bytes}`;
      }
    }
    if (current === 'sha') renderHash(p);
    if (current === 'plaintext') {
      const bytes = new TextEncoder().encode(message().text);
      el('[data-utf]').textContent = grouped(hex(bytes.slice(0, 32)), 2);
      el('[data-utf]').parentElement.style.opacity = String(reduced.matches ? 1 : smooth((p - 0.35) * 2));
    }
    if (current === 'encrypting') renderEncryption(p);
    el('[data-key]').textContent = grouped(digest);
  }
  async function enter() {
    if (!loaded || failed || disposed) return;
    const ownVersion = version, current = phase();
    busy = true;
    host.dataset.phase = current; host.dataset.message = message().id; host.dataset.stone = stone().id;
    const sceneName = ['mesh', 'unwrap', 'heightmap', 'sampling'].includes(current) ? 'geometry' : current;
    scenes.forEach(scene => { scene.hidden = scene.dataset.scene !== sceneName; });
    el('[data-samples]').hidden = current !== 'sampling';
    el('[data-key-slot]').hidden = !['plaintext', 'encrypting', 'ciphertext'].includes(current);
    el('[data-step]').textContent = `${String(phaseIndex + 1).padStart(2, '0')} / 09`;
    el('[data-stone-name]').textContent = current === 'selection' ? '' : stone().name;
    el('[data-position]').textContent = `${String(index + 1).padStart(2, '0')} / 03`;
    el('[data-detail]').textContent = current === 'sampling' ? 'uint8 mask + uint16 LE height' : '';
    el('[data-message-title]').textContent = message().locales[locale].title;
    el('[data-plaintext]').textContent = message().text;
    view.setField(field());
    chrome(); render();
    try {
      if (current === 'sha') await computeKey();
      if (current === 'encrypting' || current === 'ciphertext') await encrypt();
      if (disposed || ownVersion !== version) return;
      if (encrypted) {
        el('[data-cipher-title]').textContent = `${message().locales[locale].title} · ${encrypted.payload.length} ${copy().bytes}`;
        el('[data-ciphertext]').textContent = grouped(hex(encrypted.payload), 4);
        el('[data-nonce]').textContent = hex(encrypted.iv);
        el('[data-tag]').textContent = hex(encrypted.tag);
      }
      busy = false; render();
    } catch (error) { if (ownVersion === version) fail(error); }
  }
  const clock = createExhibitClock(host, delta => {
    if (!loaded || busy || failed || disposed) return;
    elapsed += delta; frameElapsed += delta;
    if (elapsed >= SECONDS[phaseIndex]) {
      elapsed = 0; phaseIndex = (phaseIndex + 1) % PHASES.length;
      if (!phaseIndex) {
        index = (index + 1) % messages.length; version++;
        digest = ''; encrypted = null; keyTask = null; cipherTask = null;
        delete host.dataset.key; delete host.dataset.encrypted;
      }
      void enter();
    } else if (frameElapsed >= 1 / 30) { frameElapsed %= 1 / 30; render(); }
  });
  pause.addEventListener('click', () => { clock.paused = !clock.paused; chrome(); });
  host.addEventListener('keydown', event => event.stopPropagation());
  const unsubscribe = onLocaleChange(() => {
    locale = getLocale(); chrome();
    if (failed) el('[data-label]').textContent = copy().error;
    else {
      if (loaded) el('[data-message-title]').textContent = message().locales[locale].title;
      render();
    }
  });
  const motionChanged = () => render();
  reduced.addEventListener('change', motionChanged);
  chrome(); el('[data-label]').textContent = copy().loading;
  scenes.forEach(scene => { scene.hidden = true; });
  el('[data-key-slot]').hidden = true;
  try { view = createMeshView(el('[data-mesh]')); } catch (error) { fail(error); }
  if (!failed) {
    Promise.all([getJSON('./content/vault-messages.json'), getJSON('./assets/vault/stones.json')])
      .then(async ([source, manifest]) => {
        if (!crypto.subtle) throw new Error('Web Crypto requires HTTPS or localhost');
        if (manifest.schemaVersion !== 3 || manifest.stones?.length !== 3 || source.version !== 1 || source.messages?.length !== 3) throw new Error('Invalid vault sources');
        stones = manifest.stones; messages = source.messages;
        await Promise.all(stones.map(async selected => {
          const mesh = await getJSON(selected.heightmap), data = sampleHeightmap(mesh);
          validateMesh(mesh);
          const trace = traceSha256(data.bytes);
          const authority = hex(await crypto.subtle.digest('SHA-256', data.bytes));
          if (authority !== selected.expectedSha256 || authority !== mesh.expectedSha256 || authority !== trace.hex) throw new Error('Invalid mesh digest');
          fields.set(selected.id, mesh); samples.set(selected.id, data); traces.set(selected.id, trace);
          const image = new Image(); image.src = selected.thumb; image.alt = selected.name;
          await image.decode();
          return image;
        })).then(images => {
          stoneCards = images.map((image, i) => {
            const card = document.createElement('figure'), caption = document.createElement('figcaption');
            caption.textContent = stones[i].name; caption.dir = 'ltr'; caption.lang = 'en';
            card.append(image, caption); el('[data-stones]').append(card); return card;
          });
        });
        if (new Set(stones.map(s => s.id)).size !== 3 || messages.some(m => !fields.has(m.stoneId) || typeof m.text !== 'string'
          || !m.locales?.en?.title || !m.locales?.he?.title)) throw new Error('Invalid message');
        if (disposed) return;
        loaded = true; await enter();
      }).catch(fail);
  }
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposed = true; version++; clock.dispose(); view?.dispose(); unsubscribe();
    reduced.removeEventListener('change', motionChanged);
  });
}
