// Station 4 — Possible Stones inline 3D gallery.
//
// Ported from milestone_7/index.html. Lazy-loaded behind an IntersectionObserver
// so Three.js + GLB models only download when the visitor reaches Station 4.
//
// DOM contract (see index.html):
//   <div class="ps-viewer" id="ps-viewer">
//     <div class="ps-viewer__canvas" id="ps-canvas"></div>
//     <div class="ps-viewer__loading" id="ps-loading">
//       <p id="ps-loading-text">Loading stones…</p>
//       <div class="ps-progress"><div id="ps-progress-bar"></div></div>
//     </div>
//     <aside class="ps-viewer__info" id="ps-info"></aside>
//     <nav class="ps-viewer__nav" id="ps-nav" aria-label="Possible Stones"></nav>
//   </div>

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const STONES = [
  { id: 'ps_01', folder: 'ps_01_scoria_x_calcite',     name: 'Scoria × Calcite',
    body: 'Scoria (Golan Heights)', skin: 'Calcite (Jerusalem)',
    bodyOrigin: 'Volcanic basalt fields, Golan Heights', skinOrigin: 'Limestone caves, Jerusalem hills',
    desc: 'A volcanic body cloaked in crystalline cave-skin. The porous, aggressive geometry of scoria now carries the pale, luminous texture of calcite — as if lava cooled inside a geode.' },
  { id: 'ps_02', folder: 'ps_02_calcite_x_scoria',     name: 'Calcite × Scoria',
    body: 'Calcite (Jerusalem)', skin: 'Scoria (Golan Heights)',
    bodyOrigin: 'Limestone caves, Jerusalem hills', skinOrigin: 'Volcanic basalt fields, Golan Heights',
    desc: 'The smooth, rounded body of cave calcite draped in the dark, vesicular skin of volcanic scoria — a stone that looks like it erupted from underground and cooled mid-flight.' },
  { id: 'ps_03', folder: 'ps_03_kurkar_x_flint',       name: 'Kurkar × Flint',
    body: 'Kurkar (Tel Aviv)', skin: 'Flint (City of David)',
    bodyOrigin: 'Coastal sandstone ridges, Tel Aviv', skinOrigin: 'Archaeological layers, City of David',
    desc: 'Coastal sandstone takes on the glassy, ancient surface of flint from the oldest layers of Jerusalem. A beach stone pretending to be a tool-making material.' },
  { id: 'ps_04', folder: 'ps_04_limestone_x_patflint', name: 'Limestone × Patinated Flint',
    body: 'Galilee Limestone', skin: 'Patinated Flint (Arava)',
    bodyOrigin: 'Rolling hills, Upper Galilee', skinOrigin: 'Desert patina, Arava Valley',
    desc: 'Galilee limestone wearing the desert varnish of Arava flint — millennia of wind-polished patina stretched over gentle northern forms. Two climates in one object.' },
  { id: 'ps_05', folder: 'ps_05_patflint_x_kurkar',    name: 'Patinated Flint × Kurkar',
    body: 'Patinated Flint (Arava)', skin: 'Kurkar (Tel Aviv)',
    bodyOrigin: 'Desert patina, Arava Valley', skinOrigin: 'Coastal sandstone ridges, Tel Aviv',
    desc: 'A desert flint\'s sharp, wind-carved body now wrapped in sandy coastal kurkar texture — as if the Negev and the Mediterranean shoreline merged into one geological memory.' },
  { id: 'ps_06', folder: 'ps_06_flintjlm_x_scoria',    name: 'Flint (Jerusalem) × Scoria',
    body: 'Flint (Jerusalem)', skin: 'Scoria (Golan Heights)',
    bodyOrigin: 'Chalky layers, Jerusalem', skinOrigin: 'Volcanic basalt fields, Golan Heights',
    desc: 'Jerusalem flint — a stone of tools and fire — now wears the skin of Golan volcanic scoria. Archaeological precision meets geological violence.' },
  { id: 'ps_07', folder: 'ps_07_flintgolan_x_calcite', name: 'Flint (Golan) × Calcite',
    body: 'Flint (Golan Heights)', skin: 'Calcite (Jerusalem)',
    bodyOrigin: 'Volcanic flint, Golan Heights', skinOrigin: 'Limestone caves, Jerusalem hills',
    desc: 'Northern flint in calcite clothing. The hard, dark geometry of Golan flint carries the soft white glow of Jerusalem cave crystals — a contradiction held in mineral form.' },
  { id: 'ps_08', folder: 'ps_08_talahmar_x_kurkar',    name: 'Tal Ahmar × Kurkar',
    body: 'Tal al-Ahmar stone', skin: 'Kurkar (Tel Aviv)',
    bodyOrigin: 'Tal al-Ahmar archaeological site', skinOrigin: 'Coastal sandstone ridges, Tel Aviv',
    desc: 'An archaeological site stone dressed in coastal sandstone. Ancient human-touched form meets the slow, wave-built texture of the Mediterranean shoreline.' },
  { id: 'ps_09', folder: 'ps_09_scoria_x_talahmar',    name: 'Scoria × Tal Ahmar',
    body: 'Scoria (Golan Heights)', skin: 'Tal al-Ahmar stone',
    bodyOrigin: 'Volcanic basalt fields, Golan Heights', skinOrigin: 'Tal al-Ahmar archaeological site',
    desc: 'Volcanic scoria wearing the weathered skin of an archaeological specimen. Fire-born geometry with the surface memory of human habitation.' },
  { id: 'ps_10', folder: 'ps_10_calcite_x_flintjlm',   name: 'Calcite × Flint (Jerusalem)',
    body: 'Calcite (Jerusalem)', skin: 'Flint (Jerusalem)',
    bodyOrigin: 'Limestone caves, Jerusalem hills', skinOrigin: 'Chalky layers, Jerusalem',
    desc: 'Both from Jerusalem, yet foreign to each other — cave calcite in flint\'s sharp-edged skin. Two formations from the same hills that never coexist in nature, fused by algorithm.' },
  { id: 'ps_11', folder: 'ps_11_kurkar_x_flintgolan',  name: 'Kurkar × Flint (Golan)',
    body: 'Kurkar (Tel Aviv)', skin: 'Flint (Golan Heights)',
    bodyOrigin: 'Coastal sandstone ridges, Tel Aviv', skinOrigin: 'Volcanic flint, Golan Heights',
    desc: 'Tel Aviv sandstone in Golan flint armor — the soft, coastal body encased in the hardest northern stone. A geological impossibility: the beach inside the volcano.' },
];

const STONE_BASE = './assets/stones/';

let initialized = false;
let scene, camera, renderer, controls, loader, container;
let canvasEl, infoEl, navEl, loadingEl, loadingText, progressBar;
let currentModel = null;
let currentIdx = 0;
const modelCache = {};

function buildInfo(stone) {
  return `
    <h3>${stone.name}</h3>
    <p class="ps-id">${stone.id.toUpperCase()} · POSSIBLE STONE</p>
    <p class="ps-desc">${stone.desc}</p>
    <dl class="ps-meta">
      <div><dt>Body geometry</dt><dd>${stone.body}</dd></div>
      <div><dt>Skin texture</dt><dd>${stone.skin}</dd></div>
      <div><dt>Body origin</dt><dd>${stone.bodyOrigin}</dd></div>
      <div><dt>Skin origin</dt><dd>${stone.skinOrigin}</dd></div>
    </dl>
  `;
}

function updateNav(idx) {
  navEl.querySelectorAll('button').forEach((btn, i) => {
    btn.classList.toggle('is-active', i === idx);
    btn.setAttribute('aria-current', i === idx ? 'true' : 'false');
  });
}

async function loadStone(idx) {
  currentIdx = idx;
  const stone = STONES[idx];
  updateNav(idx);
  infoEl.innerHTML = buildInfo(stone);
  loadingEl.classList.remove('is-hidden');
  loadingText.textContent = 'Loading stone…';
  progressBar.style.width = '0%';

  if (currentModel) {
    scene.remove(currentModel);
    currentModel = null;
  }

  const glbPath = `${STONE_BASE}${stone.folder}/possible_stone.glb`;
  try {
    let gltf = modelCache[idx];
    if (!gltf) {
      gltf = await new Promise((resolve, reject) => {
        loader.load(
          glbPath,
          resolve,
          (progress) => {
            if (progress.total > 0) {
              const pct = Math.round((progress.loaded / progress.total) * 100);
              loadingText.textContent = `Loading stone… ${pct}%`;
              progressBar.style.width = pct + '%';
            } else {
              const mb = (progress.loaded / 1048576).toFixed(1);
              loadingText.textContent = `Loading stone… ${mb} MB`;
            }
          },
          (err) => reject(err),
        );
      });
      modelCache[idx] = gltf;
    }

    const model = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 0.35 / maxDim;
    model.position.sub(center.multiplyScalar(scale));
    model.scale.setScalar(scale);
    const box2 = new THREE.Box3().setFromObject(model);
    const center2 = box2.getCenter(new THREE.Vector3());
    model.position.sub(center2);
    model.position.y -= size.y * scale * 0.1;

    scene.add(model);
    currentModel = model;

    controls.reset();
    camera.position.set(0, 0.05, 0.55);
    controls.target.set(0, 0, 0);
  } catch (err) {
    console.error('[station-4] failed to load stone:', err);
    infoEl.innerHTML += `<p class="ps-error">Failed to load model. ${err.message || ''}</p>`;
  } finally {
    loadingEl.classList.add('is-hidden');
  }
}

function buildScene() {
  const w = canvasEl.clientWidth || 800;
  const h = canvasEl.clientHeight || 500;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 100);
  camera.position.set(0, 0, 0.6);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  canvasEl.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.2;
  controls.minDistance = 0.15;
  controls.maxDistance = 2;

  scene.add(new THREE.AmbientLight(0xfff5e6, 0.4));
  const key = new THREE.DirectionalLight(0xfff0dd, 1.8);
  key.position.set(2, 3, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd4e5ff, 0.6);
  fill.position.set(-2, 1, -1);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffeedd, 0.8);
  rim.position.set(0, -1, -2);
  scene.add(rim);

  const groundGeo = new THREE.PlaneGeometry(5, 5);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.2;
  scene.add(ground);

  loader = new GLTFLoader();

  // Build nav buttons
  STONES.forEach((stone, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = String(idx + 1).padStart(2, '0');
    btn.title = stone.name;
    btn.setAttribute('aria-label', stone.name);
    btn.addEventListener('click', () => loadStone(idx));
    navEl.appendChild(btn);
  });

  // Resize handling
  const ro = new ResizeObserver(() => {
    const newW = canvasEl.clientWidth || 800;
    const newH = canvasEl.clientHeight || 500;
    camera.aspect = newW / newH;
    camera.updateProjectionMatrix();
    renderer.setSize(newW, newH);
  });
  ro.observe(canvasEl);

  // Keyboard nav (only when viewer is visible / focused area)
  container.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      loadStone((currentIdx + 1) % STONES.length);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      loadStone((currentIdx - 1 + STONES.length) % STONES.length);
    }
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

function bootViewer() {
  if (initialized) return;
  container = document.getElementById('ps-viewer');
  if (!container) return;
  canvasEl   = document.getElementById('ps-canvas');
  infoEl     = document.getElementById('ps-info');
  navEl      = document.getElementById('ps-nav');
  loadingEl  = document.getElementById('ps-loading');
  loadingText = document.getElementById('ps-loading-text');
  progressBar = document.getElementById('ps-progress-bar');
  if (!canvasEl || !infoEl || !navEl || !loadingEl) return;

  buildScene();
  loadStone(0);
  initialized = true;
}

export function initStation4() {
  const target = document.getElementById('ps-viewer');
  if (!target) return;

  // Lazy-init when the viewer enters the viewport (or close to it).
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          io.disconnect();
          bootViewer();
          break;
        }
      }
    }, { rootMargin: '300px 0px' });
    io.observe(target);
  } else {
    bootViewer();
  }
}
