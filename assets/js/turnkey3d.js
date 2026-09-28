/* 3D-макет дома для «Остекление под ключ» (turnkey.js): белый архитектурный макет без окон — стены, перекрытия, кровля
   (двускатная — конёк вдоль длинной стороны, или плоская с парапетом). Проёмы из конструктора — алюминиевые рамы
   антрацит со стеклом: панорамные окна, HS (2 створки), FS (гармошка, 4 створки); новые проёмы «вырастают» с анимацией.
   Пристройка со стороны двора: веранда (стеклянные стены, кровля-плита) или зимний сад (стеклянная кровля).
   Крутить — мышью или пальцем; при выборе фасада камера поворачивается к нему. «Вечер» — свет в доме, тёмный фон.
   Рендер только по изменению. three.js — локально из assets/vendor/three. Нет WebGL — createHouse вернёт null. */
import * as THREE from '../vendor/three/three.module.min.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Камера к фасаду: угол обзора (0 — со стороны фасада, π — со двора) + небольшой поворот, чтобы видеть угол дома
const YAW = { front: 0.55, back: Math.PI + 0.55, left: -Math.PI / 2 + 0.55, right: Math.PI / 2 + 0.55 };

const hasWebGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };

export function createHouse(el) {
  if (!hasWebGL()) return null;
  let gl;
  try { gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { return null; }
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.setClearColor(0x000000, 0);
  el.innerHTML = '';
  const canvas = gl.domElement; canvas.className = 'tk3d__canvas'; canvas.setAttribute('aria-label', '3D-макет дома: потяните, чтобы повернуть');
  el.appendChild(canvas);
  const hint = document.createElement('span'); hint.className = 'tk3d__hint'; hint.textContent = 'Потяните, чтобы повернуть'; el.appendChild(hint);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(gl);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const hemi = new THREE.HemisphereLight('#ffffff', '#b9b7b2', 0.7);
  const sun = new THREE.DirectionalLight('#fffaf2', 2.4);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.radius = 3;
  scene.add(hemi, sun, sun.target);
  // Земля — только тень (фон — цвет сцены), под домом — подложка, как у архитектурного макета
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.14 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 1), new THREE.MeshStandardMaterial({ color: '#ebeae7', roughness: 1 }));
  board.position.y = -0.03; board.receiveShadow = true; scene.add(board);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);

  const M = {
    wall: new THREE.MeshStandardMaterial({ color: '#f3f2ef', roughness: 0.92 }),
    slab: new THREE.MeshStandardMaterial({ color: '#d9d8d4', roughness: 0.9 }),
    roof: new THREE.MeshStandardMaterial({ color: '#cfcecb', roughness: 0.85 }),
    frame: new THREE.MeshStandardMaterial({ color: '#383b3a', roughness: 0.4, metalness: 0.35 }),
    glass: new THREE.MeshStandardMaterial({ color: '#7d8f95', roughness: 0.06, metalness: 0.4, transparent: true, opacity: 0.82, emissive: '#ffc983', emissiveIntensity: 0 }),
    glassExt: new THREE.MeshStandardMaterial({ color: '#cfdde2', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, emissive: '#ffc983', emissiveIntensity: 0 }),
    deck: new THREE.MeshStandardMaterial({ color: '#c9c6bf', roughness: 0.95 }),
    edge: new THREE.LineBasicMaterial({ color: '#b1a27a' }),
  };
  const mesh = (geo, mat, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; return m; };
  const box = (w, h, d, mat) => mesh(new THREE.BoxGeometry(w, h, d), mat);

  let house = null, model = null, known = new Set(), anim = [];
  let yaw = YAW.back - 0.8, yawT = YAW.back, pitch = 0.32, pitchT = 0.32, raf = 0, rad = 10, cy = 3;

  // Проём: рама из профиля, стекло, импосты по числу створок; HS — ручка, FS — тонкие линии сложения не рисуем (видны импосты)
  function opening(o) {
    const g = new THREE.Group(), w = o.w / 1000, h = o.h / 1000, p = 0.07, d = 0.12;
    const t = box(w, p, d, M.frame), b = box(w, p, d, M.frame), l = box(p, h, d, M.frame), r = box(p, h, d, M.frame);
    t.position.y = h / 2 - p / 2; b.position.y = -h / 2 + p / 2; l.position.x = -w / 2 + p / 2; r.position.x = w / 2 - p / 2;
    g.add(t, b, l, r, mesh(new THREE.BoxGeometry(w - p, h - p, 0.03), M.glass, false));
    for (let j = 1; j < o.n; j++) { const m = box(0.05, h - p, d * 0.9, M.frame); m.position.x = -w / 2 + w * j / o.n; g.add(m); }
    return g;
  }

  function build(s) {
    if (house) { scene.remove(house); house.traverse(x => { if (x.geometry) x.geometry.dispose(); }); }
    house = new THREE.Group();
    const W = s.W / 1000, D = s.D / 1000, fh = s.fh / 1000, H = s.floors * fh;
    const walls = box(W, H, D, M.wall); walls.position.y = H / 2; house.add(walls);
    for (let i = 1; i <= s.floors; i++) { const sl = box(W + 0.08, 0.08, D + 0.08, M.slab); sl.position.y = i * fh - (i === s.floors ? 0 : 0.04); house.add(sl); }
    const plinth = box(W + 0.12, 0.12, D + 0.12, M.slab); plinth.position.y = 0.06; house.add(plinth);
    let top = H;
    if (s.roof === 'gable') {
      const rh = D * 0.35, ov = 0.35, sh = new THREE.Shape();
      sh.moveTo(-D / 2 - ov, 0); sh.lineTo(0, rh + ov * 0.7); sh.lineTo(D / 2 + ov, 0); sh.lineTo(-D / 2 - ov, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: W + ov * 2, bevelEnabled: false });
      const roof = mesh(geo, M.roof); roof.rotation.y = Math.PI / 2; roof.position.set(-W / 2 - ov, H, 0); house.add(roof);
      top = H + rh;
    } else {
      const pr = box(W + 0.2, 0.35, D + 0.2, M.roof); pr.position.y = H + 0.17; house.add(pr); top = H + 0.35;
    }
    // проёмы по фасадам: локальная ось x — вдоль фасада слева направо, если смотреть снаружи
    const face = { front: [0, D / 2, 0], back: [0, -D / 2, Math.PI], left: [-W / 2, 0, -Math.PI / 2], right: [W / 2, 0, Math.PI / 2] };
    const now = performance.now(), keys = new Set();
    s.openings.forEach(o => {
      const [fx, fz, ry] = face[o.facade], g = opening(o), y = o.floor * fh + 0.12 + o.h / 2000, x = o.x / 1000, out = 0.05;
      const holder = new THREE.Group();
      holder.position.set(fx + Math.cos(ry) * x + Math.sin(ry) * out, y, fz - Math.sin(ry) * x + Math.cos(ry) * out);
      holder.rotation.y = ry; holder.add(g); house.add(holder);
      keys.add(o.key);
      if (!known.has(o.key) && !reduced && known.size) { g.scale.set(1, 0.001, 1); anim.push({ g, t0: now }); }
    });
    known = keys;
    // выделенный фасад — тонкая рамка акцентным цветом
    const fw = s.facade === 'front' || s.facade === 'back' ? W : D, [fx, fz, ry] = face[s.facade];
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(fw + 0.1, H + 0.1)), M.edge);
    edge.position.set(fx + Math.sin(ry) * 0.12, H / 2, fz + Math.cos(ry) * 0.12); edge.rotation.y = ry; house.add(edge);
    // пристройка со стороны двора
    let extD = 0;
    if (s.ext !== 'none') {
      const d = s.extDepth / 1000, eh = s.extH / 1000, z0 = -D / 2 - d / 2; extD = d;
      const deck = box(W, 0.12, d, M.deck); deck.position.set(0, 0.06, z0); house.add(deck);
      const pane = (w, x, z, r) => { const m = mesh(new THREE.BoxGeometry(w, eh - 0.12, 0.02), M.glassExt, false); m.position.set(x, 0.12 + (eh - 0.12) / 2, z); m.rotation.y = r; house.add(m); };
      pane(W, 0, -D / 2 - d, 0); pane(d, -W / 2, z0, Math.PI / 2); pane(d, W / 2, z0, Math.PI / 2);
      // стойки: HS / панорамы — через ~1,8 м, FS — чаще (узкие створки), зимний сад — через 1,5 м
      const stepM = s.ext === 'garden' ? 1.5 : s.extWall === 'fs' ? 0.9 : 1.8;
      const post = (x, z) => { const m = box(0.08, eh, 0.08, M.frame); m.position.set(x, eh / 2, z); house.add(m); };
      const nx = Math.max(1, Math.round(W / stepM)); for (let i = 0; i <= nx; i++) post(-W / 2 + W * i / nx, -D / 2 - d);
      const nz = Math.max(1, Math.round(d / stepM)); for (let i = 1; i < nz; i++) { post(-W / 2, -D / 2 - d * i / nz); post(W / 2, -D / 2 - d * i / nz); }
      const beam = box(W + 0.1, 0.1, 0.1, M.frame); beam.position.set(0, eh, -D / 2 - d); house.add(beam);
      if (s.ext === 'garden') {
        // стеклянная кровля с уклоном к дому и рёбра
        const len = Math.hypot(d, 0.6), a = Math.atan2(0.6, d);
        const rf = mesh(new THREE.BoxGeometry(W, 0.03, len), M.glassExt, false); rf.position.set(0, eh + 0.3, z0); rf.rotation.x = -a; house.add(rf);
        for (let i = 0; i <= nx; i++) { const rib = box(0.06, 0.06, len, M.frame); rib.position.set(-W / 2 + W * i / nx, eh + 0.33, z0); rib.rotation.x = -a; house.add(rib); }
      } else {
        const rf = box(W + 0.2, 0.18, d + 0.1, M.roof); rf.position.set(0, eh + 0.09, z0); house.add(rf);
      }
    }
    scene.add(house);
    // свет и тень — по размеру дома
    const span = Math.max(W, D + extD);
    sun.position.set(-span * 0.9, span * 1.6 + 8, span * 0.7 + 4);
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: span * 6 + 30 });
    sun.shadow.camera.updateProjectionMatrix();
    house.position.z = extD / 2;
    board.scale.set(W + 4, 1, D + extD + 4);
    rad = Math.hypot(W, D + extD, top) / 2 * 1.08; cy = top * 0.42;
  }

  function draw() {
    const r = el.getBoundingClientRect();
    if (!r.width || !house) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    gl.setPixelRatio(dpr); gl.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    const half = THREE.MathUtils.degToRad(camera.fov / 2), fit = Math.min(Math.tan(half), Math.tan(half) * camera.aspect);
    const dist = rad / Math.sin(Math.atan(fit)), tgt = new THREE.Vector3(0, cy, 0);
    camera.position.set(dist * Math.sin(yaw) * Math.cos(pitch), cy + dist * Math.sin(pitch), dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(tgt); camera.updateProjectionMatrix();
    gl.render(scene, camera);
  }
  const tick = () => {
    const k = reduced ? 1 : 0.1, now = performance.now();
    yaw = lerp(yaw, yawT, k); pitch = lerp(pitch, pitchT, k);
    anim = anim.filter(a => { const t = clamp((now - a.t0) / 450, 0, 1); a.g.scale.y = Math.max(0.001, 1 - Math.pow(1 - t, 3)); return t < 1; });
    const done = Math.abs(yaw - yawT) < 0.0008 && Math.abs(pitch - pitchT) < 0.0008 && !anim.length;
    if (done) { yaw = yawT; pitch = pitchT; }
    draw();
    raf = done ? 0 : requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: yawT, pitch: pitchT }; canvas.setPointerCapture(e.pointerId); el.classList.add('is-rotating'); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const w = canvas.clientWidth || 1;
    yawT = drag.yaw - (e.clientX - drag.x) / w * 3.2;
    pitchT = clamp(drag.pitch + (e.clientY - drag.y) / w * 1.2, 0.05, 0.95);
    kick();
  });
  const end = () => { drag = null; el.classList.remove('is-rotating'); };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  if ('ResizeObserver' in window) new ResizeObserver(kick).observe(el);

  // ближайший к текущему угол для фасада — чтобы камера не делала лишний оборот
  const nearest = a => { const tw = Math.PI * 2; return a + Math.round((yawT - a) / tw) * tw; };

  return {
    set(s) {
      const geo = JSON.stringify([s.W, s.D, s.floors, s.roof, s.openings.map(o => o.key), s.ext, s.extDepth, s.extWall, s.facade]);
      if (!model || geo !== model.geo) { build(s); }
      if (!model || s.facade !== model.facade) yawT = nearest(YAW[s.facade]);
      // вечер: тёмная сцена, тёплый свет в стекле
      const ev = !!s.evening;
      M.glass.emissiveIntensity = ev ? 0.95 : 0; M.glassExt.emissiveIntensity = ev ? 0.35 : 0;
      hemi.intensity = ev ? 0.18 : 0.7; sun.intensity = ev ? 0.25 : 2.4; scene.environmentIntensity = ev ? 0.25 : 1;
      M.wall.color.set(ev ? '#9c9b98' : '#f3f2ef'); board.material.color.set(ev ? '#3a3a3c' : '#ebeae7'); ground.material.opacity = ev ? 0.3 : 0.14;
      model = { geo, facade: s.facade };
      kick();
    },
  };
}
