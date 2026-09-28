/* 3D-вид в калькуляторе /raschet/ (вкладка «3D»): портал из параметров расчёта — ширина, высота, раскладка створок
   по схеме (PSPortal.layout: FIX / ACTIVE со стороной движения, складные FOLD, рабочая дверь DOOR). Крутить — мышью или пальцем,
   «Открыть / Закрыть» и ползунок открывают створки по схеме: HS — сдвиг к ближайшей глухой створке (каскад — на разные треки),
   FS — пакет складывается к стене, рабочая дверь распахивается. Свет, материалы и створка — как в карточках (card3d.js),
   но модуль самостоятельный: не зависит от card3d.js (иначе старая версия card3d.js из кэша браузера ломала загрузку).
   Грузится только при первом открытии вкладки (quick-calc.js). Нет WebGL — createCalc3d вернёт null, остаётся чертёж. */
import * as THREE from '../vendor/three/three.module.min.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const YAW0 = -0.5, PITCH0 = 0.1;

// Проверка WebGL до создания рендерера — чтобы отличать «нет WebGL» от ошибки загрузки
export const hasWebGL = () => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
};

let R = null;
function renderer() {
  if (R !== null) return R;
  if (!hasWebGL()) return (R = false);
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
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 6, bottom: -6, near: 1, far: 30 });
    sun.shadow.radius = 4; sun.shadow.bias = -0.0005;
    scene.add(sun, sun.target);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor);
    R = { gl, scene, camera: new THREE.PerspectiveCamera(28, 1, 0.1, 120) };
  } catch (e) { R = false; }
  return R;
}

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
  g.add(t, b, l, r, new THREE.Mesh(new THREE.BoxGeometry(w - p * 2, h - p * 2, 0.024), M_GLASS));
  if (handle) {
    const x = (handle === 'l' ? -1 : 1) * (w / 2 - p - 0.05);
    [1, -1].forEach(side => { const hd = box(0.022, 0.34, 0.03, M_HANDLE); hd.position.set(x, -h * 0.04, side * (d / 2 + 0.03)); g.add(hd); });
  }
  return g;
}

const FRAME = '#383b3a';            // антрацит RAL 7016 — цвет по умолчанию

function buildPortal(st, L) {
  const W = st.w / 1000, H = st.h / 1000, P = 0.07, TH = 0.03, D = 0.17;
  const mat = new THREE.MeshStandardMaterial({ color: FRAME, roughness: 0.42, metalness: 0.35 });
  const portal = new THREE.Group();
  const ft = box(W, P, D, mat); ft.position.set(0, H - P / 2, 0);
  const fl = box(P, H, D, mat); fl.position.set(-W / 2 + P / 2, H / 2, 0);
  const fr = box(P, H, D, mat); fr.position.set(W / 2 - P / 2, H / 2, 0);
  const fb = box(W, TH, D + 0.02, mat); fb.position.set(0, TH / 2, 0);
  portal.add(ft, fl, fr, fb);

  const n = L.length, iw = W - P * 2, ih = H - P - TH, step = iw / n, cy = TH + ih / 2, hs = st.type === 'HS';
  const leaves = L.map((lf, i) => {
    const lw = hs ? step + 0.04 : step - 0.006;
    const g = leaf(lw, ih, mat, lf.handle);
    g.userData = { i, lf, lw };
    portal.add(g);
    return g;
  });
  // HS: подвижная створка едет к ближайшей глухой в сторону движения (или к краю); несколько к одной цели — каскад на разных треках
  const target = i => { const d = L[i].dir || 1; let j = i + d; while (j >= 0 && j < n && L[j].kind !== 'fix') j += d; return clamp(j, 0, n - 1); };
  const track = {};
  L.forEach((lf, i) => {
    if (lf.kind !== 'move') return;
    const t = target(i), same = L.map((x, j) => (x.kind === 'move' && target(j) === t ? j : -1)).filter(j => j >= 0)
      .sort((a, b) => Math.abs(a - t) - Math.abs(b - t));
    track[i] = { t, k: same.indexOf(i), stacked: same.length > 1 };
  });

  // p: 0 — закрыто, 1 — открыто
  function place(p) {
    const lift = Math.min(1, p / 0.08) * 0.008, theta = p * 1.38;
    leaves.forEach(g => {
      const { i, lf, lw } = g.userData;
      const base = -iw / 2 + step * (i + 0.5);
      g.rotation.y = 0;
      if (lf.kind === 'fix') { g.position.set(base, cy, -0.035); return; }
      if (lf.kind === 'move') {
        const { t, k, stacked } = track[i];
        const to = -iw / 2 + step * (t + 0.5) + (stacked ? -(lf.dir || 1) * k * 0.03 : 0);
        g.position.set(lerp(base, to, p), cy + lift, 0.03 + k * 0.05);
        return;
      }
      // складная и рабочая дверь: считаем как пакет у левой стены (k — номер створки от стены), для правой — зеркально.
      // Закрыто (θ = 0) — створка на своём месте; открыто — гармошка у стены, дверь распахнута на петлях у стены.
      const right = lf.dir > 0, k = right ? n - 1 - i : i, w = lw + 0.006;
      let x, z, ry;
      if (lf.kind === 'door') {
        const a = theta * 1.05, dx = Math.cos(a), dz = Math.sin(a);
        x = -iw / 2 + k * w + dx * w / 2; z = dz * w / 2; ry = Math.atan2(-dz, dx);
      } else {
        const dx = Math.cos(theta), dz = (k % 2 ? -1 : 1) * Math.sin(theta);
        const hx = -iw / 2 + k * w * dx, hz = k % 2 ? w * Math.sin(theta) : 0;
        x = hx + dx * w / 2; z = hz + dz * w / 2; ry = Math.atan2(-dz, dx);
      }
      g.position.set(right ? -x : x, cy, z);
      g.rotation.y = right ? -ry : ry;
    });
  }
  place(0);
  return { portal, place, W, H };
}

export function createCalc3d(el) {
  const R = renderer();
  if (!R) return null;
  el.innerHTML = `<canvas class="qc3d__canvas" aria-label="3D-модель портала: потяните, чтобы повернуть"></canvas>
    <div class="qc3d__bar"><button type="button" class="qc3d__btn" data-qc3d-open aria-pressed="false">Открыть</button>
    <input class="qc3d__range" type="range" min="0" max="100" value="0" aria-label="Степень открытия" data-qc3d-range>
    <span class="qc3d__hint">Потяните, чтобы повернуть</span></div>`;
  const canvas = el.querySelector('canvas'), ctx = canvas.getContext('2d');
  const btn = el.querySelector('[data-qc3d-open]'), range = el.querySelector('[data-qc3d-range]');
  let model = null, yaw = YAW0 - 0.3, yawT = YAW0, pitch = PITCH0, pitchT = PITCH0, prog = 0, progT = 0, raf = 0, key = '';

  function draw() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !model) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), cw = Math.round(r.width * dpr), ch = Math.round(r.height * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const { gl, scene, camera } = R;
    gl.setPixelRatio(1); gl.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    const rad = Math.hypot(model.W / 2, model.H / 2) * 0.94, half = THREE.MathUtils.degToRad(camera.fov / 2);
    const fit = Math.min(Math.tan(half), Math.tan(half) * camera.aspect), dist = rad / Math.sin(Math.atan(fit));
    const tgt = new THREE.Vector3(0, model.H * 0.47, 0);
    camera.position.set(tgt.x + dist * Math.sin(yaw) * Math.cos(pitch), tgt.y + dist * Math.sin(pitch), tgt.z + dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(tgt); camera.updateProjectionMatrix();
    model.place(prog);
    scene.add(model.portal); gl.render(scene, camera); scene.remove(model.portal);
    ctx.clearRect(0, 0, cw, ch); ctx.drawImage(gl.domElement, 0, 0, cw, ch);
  }
  const tick = () => {
    const k = reduced ? 1 : 0.14;
    yaw = lerp(yaw, yawT, k); pitch = lerp(pitch, pitchT, k); prog = lerp(prog, progT, reduced ? 1 : 0.1);
    const done = Math.abs(yaw - yawT) < 0.0008 && Math.abs(pitch - pitchT) < 0.0008 && Math.abs(prog - progT) < 0.002;
    if (done) { yaw = yawT; pitch = pitchT; prog = progT; }
    draw();
    raf = done ? 0 : requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const setProg = v => {
    progT = clamp(v, 0, 1); range.value = Math.round(progT * 100);
    const open = progT > 0.5;
    btn.textContent = open ? 'Закрыть' : 'Открыть'; btn.setAttribute('aria-pressed', String(open));
    kick();
  };
  btn.addEventListener('click', () => setProg(progT > 0.5 ? 0 : 1));
  range.addEventListener('input', () => setProg(range.value / 100));

  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: yawT, pitch: pitchT }; canvas.setPointerCapture(e.pointerId); el.classList.add('is-rotating'); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const w = canvas.clientWidth || 1;
    yawT = clamp(drag.yaw - (e.clientX - drag.x) / w * 2.6, -1.35, 1.35);
    pitchT = clamp(drag.pitch + (e.clientY - drag.y) / w * 0.8, -0.02, 0.5);
    kick();
  });
  const end = () => { drag = null; el.classList.remove('is-rotating'); };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('dblclick', () => { yawT = YAW0; pitchT = PITCH0; kick(); });
  if ('ResizeObserver' in window) new ResizeObserver(kick).observe(el);

  return {
    // st: { type, w, h, n, scheme, door } — пересобираем модель, только если изменилась геометрия
    set(st) {
      const P = window.PSPortal;
      const Lm = P.LIMITS[st.type];
      const s = { ...st, w: clamp(st.w, Lm.wMin, Lm.wMax), h: clamp(st.h, Lm.hMin, Lm.hMax) };
      const L = P.layout(s.type, s.n, s.scheme, s.door), k = JSON.stringify([s.type, s.w, s.h, L]);
      if (k !== key) { key = k; model = buildPortal(s, L); }
      kick();
    },
  };
}
