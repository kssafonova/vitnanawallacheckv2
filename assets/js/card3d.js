/* 3D-превью в карточках товаров (.m-card[data-3d]): портал собирается из параметров модели (tools/build.mjs → model3d),
   его можно крутить мышью или пальцем, при наведении (или по кнопке на телефоне) створки открываются по схеме.
   Цвет и схема переключаются свотчами карточки (событие ps-card-variant из shop.js).
   Один WebGL-рендерер на все карточки: кадр рисуется в него и копируется в canvas карточки, рендер только по изменению.
   Нет WebGL — остаётся фото. three.js — локально из assets/vendor/three. */
import * as THREE from '../vendor/three/three.module.min.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = matchMedia('(hover: hover)').matches;

const YAW0 = -0.5, PITCH0 = 0.1;

// ---------- общий рендерер и сцена ----------
let R = null;
function renderer() {
  if (R !== null) return R;
  try {
    const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.85;
    scene.add(new THREE.HemisphereLight('#ffffff', '#b9b7b2', 0.6));
    const sun = new THREE.DirectionalLight('#fffaf2', 2.2);
    sun.position.set(-2, 9, 3.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
    sun.shadow.radius = 4; sun.shadow.bias = -0.0005;
    scene.add(sun, sun.target);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    R = { gl, scene, camera };
  } catch (e) { R = false; }
  return R;
}

// ---------- модель портала ----------
const M_GLASS = new THREE.MeshStandardMaterial({
  color: '#d4e3e8', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.2,
  envMapIntensity: 2.4, depthWrite: false, side: THREE.DoubleSide
});
const M_HANDLE = new THREE.MeshStandardMaterial({ color: '#cfcdc8', roughness: 0.25, metalness: 0.9 });

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Створка: рамка из профиля + стекло; ручка на замковой стороне ('l' / 'r')
function leaf(w, h, mat, handle) {
  const g = new THREE.Group(), p = 0.075, d = 0.06;
  const t = box(w, p, d, mat), b = box(w, p, d, mat), l = box(p, h, d, mat), r = box(p, h, d, mat);
  t.position.y = h / 2 - p / 2; b.position.y = -h / 2 + p / 2;
  l.position.x = -w / 2 + p / 2; r.position.x = w / 2 - p / 2;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - p * 2, h - p * 2, 0.024), M_GLASS);
  g.add(t, b, l, r, glass);
  if (handle) {
    const x = (handle === 'l' ? -1 : 1) * (w / 2 - p - 0.05);
    [1, -1].forEach(side => {
      const hd = box(0.022, 0.34, 0.03, M_HANDLE);
      hd.position.set(x, -h * 0.04, side * (d / 2 + 0.03));
      g.add(hd);
    });
  }
  return g;
}

function buildPortal(cfg, hex) {
  const W = cfg.w / 1000, H = cfg.h / 1000, P = 0.07, TH = 0.03, D = 0.17;
  const mat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.42, metalness: 0.35 });
  const portal = new THREE.Group();
  const ft = box(W, P, D, mat); ft.position.set(0, H - P / 2, 0);
  const fl = box(P, H, D, mat); fl.position.set(-W / 2 + P / 2, H / 2, 0);
  const fr = box(P, H, D, mat); fr.position.set(W / 2 - P / 2, H / 2, 0);
  const fb = box(W, TH, D + 0.02, mat); fb.position.set(0, TH / 2, 0);
  portal.add(ft, fl, fr, fb);

  const iw = W - P * 2, ih = H - P - TH, n = cfg.kinds.length, step = iw / n, cy = TH + ih / 2;
  const handleOf = i => (cfg.handles.find(h => h[0] === i) || [])[1];
  const leaves = cfg.kinds.map((kind, i) => {
    const lw = cfg.sys === 'HS' ? step + 0.04 : step - 0.006;
    const l = leaf(lw, ih, mat, handleOf(i));
    l.userData = { i, kind, lw };
    portal.add(l);
    return l;
  });
  const movers = cfg.kinds.map((k, i) => (k === 'move' ? i : -1)).filter(i => i >= 0);

  // p: 0 — закрыто, 1 — открыто
  function place(p) {
    const lift = Math.min(1, p / 0.08) * 0.008;
    const theta = p * 1.38;
    let foldIdx = 0;
    leaves.forEach(l => {
      const { i, kind, lw } = l.userData;
      const base = -iw / 2 + step * (i + 0.5);
      l.rotation.y = 0;
      if (kind === 'fix') { l.position.set(base, cy, -0.035); return; }
      if (kind === 'move') {
        const mi = movers.indexOf(i), to = cfg.to[i];
        const stacked = movers.filter(j => cfg.to[j] === to).length > 1; // HS/36: две створки едут на одну позицию
        const target = -iw / 2 + step * (to + 0.5) + (stacked && !mi ? 0.03 : 0);
        l.position.set(lerp(base, target, p), cy + lift, 0.03 + (stacked ? mi * 0.05 : 0));
        return;
      }
      // складные: гармошка от левого косяка, панели ломаются к комнате; распашная — от правого
      const w = lw + 0.006;
      let hx, dx, dz;
      if (kind === 'fold') {
        const k = foldIdx++;
        dx = Math.cos(theta); dz = (k % 2 ? -1 : 1) * Math.sin(theta);
        hx = -iw / 2 + k * w * dx;
        const hz = k % 2 ? w * Math.sin(theta) : 0;
        l.position.set(hx + dx * w / 2, cy, hz + dz * w / 2);
      } else {
        dx = -Math.cos(theta); dz = Math.sin(theta);
        hx = iw / 2;
        l.position.set(hx + dx * w / 2, cy, dz * w / 2);
      }
      l.rotation.y = Math.atan2(-dz, dx) + (kind === 'swing' ? Math.PI : 0);
    });
  }
  place(0);
  return { portal, mat, place, W, H };
}

// ---------- карточка ----------
function initCard(card, R) {
  let cfg;
  try { cfg = JSON.parse(card.dataset['3d']); } catch (e) { return; }
  const media = card.querySelector('.m-card__media');
  if (!media) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'm-card__3d';
  canvas.setAttribute('aria-hidden', 'true');
  media.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'm-card__3d-toggle';
  btn.innerHTML = '<span>Открыть</span>';
  btn.setAttribute('aria-label', 'Показать открытым');
  card.appendChild(btn);
  const hint = document.createElement('span');
  hint.className = 'm-card__3d-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = '3D · потяните';
  card.appendChild(hint);

  const state = {
    c: card.querySelector('[data-color].is-active')?.dataset.color || Object.keys(cfg.colors)[0],
    s: card.querySelector('[data-scheme].is-active')?.dataset.scheme || Object.keys(cfg.mirror)[0]
  };
  const model = buildPortal(cfg, cfg.colors[state.c]);
  const setScheme = () => { model.portal.scale.x = cfg.mirror[state.s] ? -1 : 1; };
  setScheme();

  let yaw = reduced ? YAW0 : YAW0 - 0.55, yawT = YAW0, pitch = PITCH0, pitchT = PITCH0, prog = 0, progT = 0;
  let raf = 0, shown = false;

  function draw() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.round(r.width * dpr), ch = Math.round(r.height * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const { gl, scene, camera } = R;
    gl.setPixelRatio(1);
    gl.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    // вписываем по описанной сфере — размер не прыгает при вращении
    const rad = Math.hypot(model.W / 2, model.H / 2) * 1.02;
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    const fit = Math.min(Math.tan(half), Math.tan(half) * camera.aspect);
    const dist = rad / Math.sin(Math.atan(fit));
    const tgt = new THREE.Vector3(0, model.H * 0.47, 0);
    camera.position.set(
      tgt.x + dist * Math.sin(yaw) * Math.cos(pitch),
      tgt.y + dist * Math.sin(pitch),
      tgt.z + dist * Math.cos(yaw) * Math.cos(pitch)
    );
    camera.lookAt(tgt);
    camera.updateProjectionMatrix();
    model.place(prog);
    scene.add(model.portal);
    gl.render(scene, camera);
    scene.remove(model.portal);
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(gl.domElement, 0, 0, cw, ch);
    if (!shown) { shown = true; media.classList.add('is-3d'); }
  }

  const tick = () => {
    const k = reduced ? 1 : 0.14;
    yaw = lerp(yaw, yawT, k); pitch = lerp(pitch, pitchT, k);
    prog = lerp(prog, progT, reduced ? 1 : 0.1);
    const done = Math.abs(yaw - yawT) < 0.0008 && Math.abs(pitch - pitchT) < 0.0008 && Math.abs(prog - progT) < 0.002;
    if (done) { yaw = yawT; pitch = pitchT; prog = progT; }
    draw();
    raf = done ? 0 : requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  const setOpen = open => {
    progT = open ? 1 : 0;
    btn.classList.toggle('is-open', open);
    btn.innerHTML = `<span>${open ? 'Закрыть' : 'Открыть'}</span>`;
    btn.setAttribute('aria-label', open ? 'Показать закрытым' : 'Показать открытым');
    kick();
  };

  // вращение: по горизонтали — вокруг портала, по вертикали — немного; вертикальная прокрутка страницы не мешает
  let drag = null, moved = false;
  canvas.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, yaw: yawT, pitch: pitchT, id: e.pointerId };
    moved = false;
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) > 6) { moved = true; canvas.setPointerCapture(e.pointerId); card.classList.add('is-rotating'); }
    if (!moved) return;
    const w = canvas.clientWidth || 1;
    yawT = clamp(drag.yaw - dx / w * 2.6, -1.35, 1.35);
    pitchT = clamp(drag.pitch + dy / w * 0.8, -0.02, 0.5);
    kick();
  });
  const end = () => { drag = null; card.classList.remove('is-rotating'); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  // после поворота клик не должен уводить на страницу товара
  media.addEventListener('click', e => { if (moved) { e.preventDefault(); moved = false; } }, true);
  canvas.addEventListener('dblclick', e => { e.preventDefault(); yawT = YAW0; pitchT = PITCH0; kick(); });

  if (canHover) {
    media.addEventListener('pointerenter', () => setOpen(true));
    card.addEventListener('pointerleave', () => setOpen(false));
  }
  btn.addEventListener('click', () => setOpen(progT < 0.5));

  card.addEventListener('ps-card-variant', e => {
    const { c, s } = e.detail;
    if (c !== state.c) { state.c = c; model.mat.color.set(cfg.colors[c]); }
    if (s !== state.s) { state.s = s; setScheme(); }
    kick();
  });

  if ('ResizeObserver' in window) new ResizeObserver(() => { if (shown) kick(); }).observe(media);
  kick();
}

// Инициализация, когда карточка подъезжает к экрану
const cards = [...document.querySelectorAll('.m-card[data-3d]')];
if (cards.length) {
  const start = card => {
    const r = renderer();
    if (!r) return;
    initCard(card, r);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      start(en.target);
    }), { rootMargin: '200px 0px' });
    cards.forEach(c => io.observe(c));
  } else cards.forEach(start);
}
