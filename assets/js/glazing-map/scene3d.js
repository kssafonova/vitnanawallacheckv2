/* 3D-дом «Персональной карты остекления» на three.js (локально из assets/vendor/three — без CDN).
   Условный архитектурный макет: двухэтажный дом, терраса-веранда слева, объём со вторым светом, зимний сад справа.
   Контроллер — тот же интерфейс, что у адаптера Spline (spline.js): focusZone, reset, setSelectedZones, setReducedMotion.
   Реакции: камера подъезжает к зоне, зона обводится песочной линией, HS-портал приоткрывается, FS-створки веранды
   складываются, зимний сад проявляется, входная дверь приоткрывается, во втором свете загорается тёплый свет.
   Кадр рисуется только во время анимации. Нет WebGL — createScene бросает ошибку, страница остаётся на статичной схеме. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { RoomEnvironment } from '../../vendor/three/RoomEnvironment.js';

const ACCENT = '#b1a27a';
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;

// Материалы
const M = {
  plaster: new THREE.MeshStandardMaterial({ color: '#eceae5', roughness: 0.92 }),
  stone: new THREE.MeshStandardMaterial({ color: '#c9c7c1', roughness: 0.85 }),
  roof: new THREE.MeshStandardMaterial({ color: '#3b3c3d', roughness: 0.75, metalness: 0.1 }),
  frame: new THREE.MeshStandardMaterial({ color: '#2a2b2d', roughness: 0.45, metalness: 0.35 }),
  glass: new THREE.MeshStandardMaterial({ color: '#a9bcc4', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.42, envMapIntensity: 1.6 }),
  interior: new THREE.MeshStandardMaterial({ color: '#3d4144', roughness: 0.9 }),
  deck: new THREE.MeshStandardMaterial({ color: '#b3b1ac', roughness: 0.9 }),
  ground: new THREE.MeshStandardMaterial({ color: '#dcddd8', roughness: 1 }),
  grass: new THREE.MeshStandardMaterial({ color: '#b3bba6', roughness: 1 }),
  tree: new THREE.MeshStandardMaterial({ color: '#9aa58f', roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#6d6a64', roughness: 1 }),
};

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Стеклянная панель с рамой: левый нижний угол (0,0), плоскость XY, толщина по Z
function pane(w, h, frameMat = M.frame, glassMat = M.glass, p = 0.07) {
  const g = new THREE.Group(), d = 0.07;
  g.add(box(w, p, d, frameMat, w / 2, p / 2, 0), box(w, p, d, frameMat, w / 2, h - p / 2, 0),
    box(p, h, d, frameMat, p / 2, h / 2, 0), box(p, h, d, frameMat, w - p / 2, h / 2, 0));
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * p, h - 2 * p), glassMat);
  gl.position.set(w / 2, h / 2, 0.005);
  g.add(gl);
  return g;
}

// Песочная обводка: тонкие брусья по контуру (линии WebGL всегда 1 px — брусья видно на любом экране)
function outline(points, closed = true) {
  const mat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthTest: false });
  const g = new THREE.Group(); g.renderOrder = 10;
  const pts = points.map(p => new THREE.Vector3(...p));
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len + 0.06), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); m.renderOrder = 10;
    g.add(m);
  }
  g.userData.mat = mat;
  return g;
}

// Двускатная кровля из двух тонких скатов с выносом; alongX — конёк вдоль X. Фронтоны открыты (под ними — стена или витраж)
function gable(span, rise, length, alongX) {
  const g = new THREE.Group(), half = span / 2, slope = Math.hypot(half, rise), a = Math.atan2(rise, half), t = 0.16;
  [-1, 1].forEach(side => {
    const m = box(slope + 0.35, t, length, M.roof);
    m.position.set(side * (half / 2 + 0.05), rise / 2 + t / 2, 0);
    m.rotation.z = -side * a;
    g.add(m);
  });
  if (alongX) g.rotation.y = Math.PI / 2;
  return g;
}
function gableWall(span, rise, mat = M.plaster) {
  const s = new THREE.Shape(); s.moveTo(-span / 2, 0); s.lineTo(span / 2, 0); s.lineTo(0, rise); s.closePath();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }), mat); m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Точки-якоря зон (метки) и контуры обводки — общие для 3D и статичной схемы (tools/glazing-fallback.mjs). */
export const ZONE_GEOMETRY = {
  portal: { anchor: [-1.9, 1.5, 3.1], outline: [[-3.95, 0.12, 3.12], [0.15, 0.12, 3.12], [0.15, 2.8, 3.12], [-3.95, 2.8, 3.12]] },
  window: { anchor: [-2.8, 4.6, 3.1], outline: [[-5.05, 3.35, 3.12], [-0.55, 3.35, 3.12], [-0.55, 5.85, 3.12], [-5.05, 5.85, 3.12]] },
  terrace: { anchor: [-7.5, 1.4, 3.2], outline: [[-9.05, 0.2, 3.1], [-5.95, 0.2, 3.1], [-5.95, 2.75, 3.1], [-9.05, 2.75, 3.1]] },
  garden: { anchor: [6.0, 1.6, 2.3], outline: [[4.6, 0.3, 2.3], [7.6, 0.3, 2.3], [7.6, 2.6, 2.3], [4.6, 3.55, 2.3]] },
  entry: { anchor: [-5.05, 1.3, 3.1], outline: [[-5.85, 0.12, 3.12], [-4.25, 0.12, 3.12], [-4.25, 2.85, 3.12], [-5.85, 2.85, 3.12]] },
  second: { anchor: [2.5, 5.0, 2.5], outline: [[0.95, 0.12, 2.52], [4.05, 0.12, 2.52], [4.05, 6.25, 2.52], [2.5, 8.15, 2.52], [0.95, 6.25, 2.52]] },
};

// Камеры: общий вид и подъезд к зонам (позиция, цель)
const CAM = {
  overview: { pos: [12.5, 7.2, 25], tgt: [-0.4, 3.0, 0] },
  portal: { pos: [1.5, 2.8, 12.5], tgt: [-2.2, 1.9, 3] },
  window: { pos: [1.2, 5.4, 13], tgt: [-2.6, 4.4, 3] },
  terrace: { pos: [-2.5, 3.2, 12.5], tgt: [-7.2, 1.6, 2] },
  garden: { pos: [12.5, 3.6, 12], tgt: [5.8, 1.9, 0.5] },
  entry: { pos: [-1.8, 2.6, 10.5], tgt: [-5.0, 1.6, 3] },
  second: { pos: [6.5, 5.6, 14], tgt: [2.4, 4.8, 2] },
};

function buildHouse() {
  const root = new THREE.Group(); root.name = 'HOUSE_ROOT';
  const zones = {};

  // Участок
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 64), M.ground);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  const grass = new THREE.Mesh(new THREE.CircleGeometry(15, 64), M.grass);
  grass.rotation.x = -Math.PI / 2; grass.position.set(-0.5, 0.005, 4); grass.receiveShadow = true; root.add(grass);
  [[-13, -13, 1.3], [12, -11, 1.1], [-16, 1, 0.9]].forEach(([x, z, s]) => {
    const t = new THREE.Group();
    t.add(box(0.25 * s, 2 * s, 0.25 * s, M.trunk, 0, s, 0));
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7 * s, 1), M.tree);
    c.position.y = 3.2 * s; c.castShadow = true; t.add(c);
    t.position.set(x, 0, z); root.add(t);
  });

  // Основной объём A: два этажа, конёк вдоль фасада
  root.add(box(6.6, 0.15, 6.2, M.stone, -2.75, 0.075, 0));
  root.add(box(6.5, 6.2, 6, M.plaster, -2.75, 3.1, 0));
  root.add(box(6.6, 0.12, 6.1, M.plaster, -2.75, 3.06, 0.05)); // межэтажный пояс
  const roofA = gable(6.4, 1.9, 7.3, true); roofA.position.set(-2.75, 6.2, 0); root.add(roofA);
  [-5.99, 0.29].forEach(x => { const w = gableWall(6, 1.9); w.rotation.y = Math.PI / 2; w.position.set(x, 6.2, 0); root.add(w); });
  // Объём B: второй свет, фронтон к зрителю
  root.add(box(4.2, 0.15, 5.6, M.stone, 2.5, 0.075, -0.3));
  root.add(box(4, 6.4, 5.4, M.plaster, 2.5, 3.2, -0.3));
  const roofB = gable(4.0, 2.4, 6.2, false); roofB.position.set(2.5, 6.4, -0.1); root.add(roofB);
  const gwBack = gableWall(4, 2.4); gwBack.position.set(2.5, 6.4, -3.0); root.add(gwBack);
  const gw = gableWall(4, 2.4); gw.position.set(2.5, 6.4, 2.2); root.add(gw);
  // Терраса перед гостиной
  root.add(box(5.4, 0.16, 2.8, M.deck, -1.9, 0.08, 4.4));

  const dark = (w, h, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.interior); m.position.set(x, y, z); return m; };

  // PORTAL_LIVING_ROOM — HS-портал, 3 створки: левая глухая, две активные сдвигаются каскадом
  {
    const g = new THREE.Group(); g.name = 'PORTAL_LIVING_ROOM';
    const x0 = -3.9, w = 4.0, h = 2.6, y0 = 0.15, lw = w / 3;
    g.add(dark(w, h, x0 + w / 2, y0 + h / 2, 3.01));
    g.add(box(w + 0.1, 0.1, 0.12, M.frame, x0 + w / 2, y0 + h + 0.05, 3.06), box(w + 0.1, 0.06, 0.12, M.frame, x0 + w / 2, y0 + 0.03, 3.06));
    const leaves = [0, 1, 2].map(i => { const p = pane(lw + 0.04, h); p.position.set(x0 + i * lw - 0.02, y0, 3.04 + (i === 0 ? 0 : i === 1 ? 0.03 : 0.06)); g.add(p); return p; });
    g.userData.anim = t => { leaves[2].position.x = x0 + 2 * lw - 0.02 - t * lw * 1.4; leaves[1].position.x = x0 + lw - 0.02 - t * lw * 0.7; };
    root.add(g); zones.portal = g;
  }
  // PANORAMIC_WINDOWS_UPPER — два панорамных окна в пол второго этажа
  {
    const g = new THREE.Group(); g.name = 'PANORAMIC_WINDOWS_UPPER';
    [[-5, 1.9], [-2.45, 1.9]].forEach(([x, w]) => {
      g.add(dark(w, 2.4, x + w / 2, 3.4 + 1.2, 3.01));
      const p = pane(w, 2.4); p.position.set(x, 3.4, 3.05); g.add(p);
      g.add(box(0.05, 2.3, 0.08, M.frame, x + w / 2, 4.6, 3.06));
    });
    root.add(g); zones.window = g;
  }
  // ENTRANCE_GROUP — дверь, боковой витраж и фрамуга
  {
    const g = new THREE.Group(); g.name = 'ENTRANCE_GROUP';
    g.add(dark(1.5, 2.65, -5.05, 1.47, 3.01));
    const side = pane(0.5, 2.1); side.position.set(-5.8, 0.15, 3.05); g.add(side);
    const top = pane(1.5, 0.5); top.position.set(-5.8, 2.25, 3.05); g.add(top);
    const pivot = new THREE.Group(); pivot.position.set(-5.3, 0.15, 3.05);
    const door = new THREE.Group();
    door.add(box(1.0, 2.1, 0.08, M.frame, 0.5, 1.05, 0));
    door.add(box(0.14, 1.7, 0.02, M.glass, 0.25, 1.05, 0.05));
    door.add(box(0.04, 0.9, 0.05, new THREE.MeshStandardMaterial({ color: '#c9c6bf', metalness: 0.9, roughness: 0.3 }), 0.86, 1.05, 0.08));
    pivot.add(door); g.add(pivot);
    const canopy = box(2.0, 0.1, 1.2, M.frame, -5.05, 3.0, 3.6); g.add(canopy);
    g.userData.anim = t => { pivot.rotation.y = -t * 0.85; };
    root.add(g); zones.entry = g;
  }
  // DOUBLE_HEIGHT_GLAZING — витраж на два этажа и треугольник фронтона; тёплый свет внутри
  {
    const g = new THREE.Group(); g.name = 'DOUBLE_HEIGHT_GLAZING';
    const glow = new THREE.MeshStandardMaterial({ color: '#3d4144', roughness: 0.9, emissive: '#ffcf8a', emissiveIntensity: 0 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 6.1), glow); back.position.set(2.5, 3.2, 2.42); g.add(back);
    const tri = new THREE.Shape(); tri.moveTo(-1.55, 0); tri.lineTo(1.55, 0); tri.lineTo(0, 1.9); tri.closePath();
    const triBack = new THREE.Mesh(new THREE.ShapeGeometry(tri), glow); triBack.position.set(2.5, 6.25, 2.42); g.add(triBack);
    const triGlass = new THREE.Mesh(new THREE.ShapeGeometry(tri), M.glass); triGlass.position.set(2.5, 6.25, 2.47); g.add(triGlass);
    [0, 1, 2].forEach(i => { const p = pane(1.04, 3.05); p.position.set(0.95 + i * 1.03, 0.15, 2.46); g.add(p); const q = pane(1.04, 3.05); q.position.set(0.95 + i * 1.03, 3.2, 2.46); g.add(q); });
    // рама треугольника
    [[[0.95, 6.25], [2.5, 8.15]], [[4.05, 6.25], [2.5, 8.15]]].forEach(([a, b]) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); const m = box(0.08, len, 0.08, M.frame, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 2.47);
      m.rotation.z = Math.atan2(b[0] - a[0], b[1] - a[1]) * -1; g.add(m);
    });
    g.userData.anim = t => { glow.emissiveIntensity = t * 0.5; };
    root.add(g); zones.second = g;
  }
  // TERRACE_GLAZING — веранда с кровлей, по фасаду — складные FS-створки
  {
    const g = new THREE.Group(); g.name = 'TERRACE_GLAZING';
    g.add(box(3.2, 0.2, 4.2, M.stone, -7.5, 0.1, 1));
    g.add(box(3.4, 0.22, 4.4, M.roof, -7.5, 2.95, 1));
    [[-9.03, 2.95], [-5.97, 2.95], [-9.03, -0.95]].forEach(([x, z]) => g.add(box(0.1, 2.65, 0.1, M.frame, x, 1.52, z)));
    const side = pane(3.9, 2.55); side.rotation.y = Math.PI / 2; side.position.set(-9.03, 0.2, 2.9); g.add(side);
    const x0 = -8.98, w = 2.96 / 4, panels = [0, 1, 2, 3].map(() => { const p = pane(w, 2.55); p.position.y = 0.2; g.add(p); return p; });
    g.userData.anim = t => {
      const th = t * 1.35, cx = Math.cos(th), sz = Math.sin(th);
      panels.forEach((p, i) => {
        const px = x0 + i * w * cx, pz = 2.95 + (i % 2 ? w * sz : 0);
        const nx = x0 + (i + 1) * w * cx, nz = 2.95 + ((i + 1) % 2 ? w * sz : 0);
        p.position.x = px; p.position.z = pz; p.rotation.y = -Math.atan2(nz - pz, nx - px);
      });
    };
    root.add(g); zones.terrace = g;
  }
  // WINTER_GARDEN — стеклянная пристройка справа; в общем виде — полупрозрачная, при выборе проявляется
  {
    const g = new THREE.Group(); g.name = 'WINTER_GARDEN';
    const fm = M.frame.clone(); fm.transparent = true;
    const gm = M.glass.clone();
    const base = box(3.1, 0.3, 3.8, M.stone.clone(), 6.05, 0.15, 0.35); base.material.transparent = true; g.add(base);
    const hi = 3.55, lo = 2.6, x0 = 4.55, x1 = 7.55, z0 = -1.55, z1 = 2.25;
    const post = (x, z, h) => g.add(box(0.08, h, 0.08, fm, x, 0.3 + h / 2, z));
    [[x1, z1, lo - 0.3], [x1, z0, lo - 0.3], [x0 + 1, z1, hi - 0.3 - (hi - lo) / 3], [x0 + 2, z1, hi - 0.3 - 2 * (hi - lo) / 3]].forEach(p => post(...p));
    // фасад (трапеция) и бок — стекло
    const front = new THREE.Shape(); front.moveTo(0, 0); front.lineTo(3, 0); front.lineTo(3, lo - 0.3); front.lineTo(0, hi - 0.3); front.closePath();
    const fg = new THREE.Mesh(new THREE.ShapeGeometry(front), gm); fg.position.set(x0, 0.3, z1); g.add(fg);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.8, lo - 0.3), gm); sg.rotation.y = Math.PI / 2; sg.position.set(x1, 0.3 + (lo - 0.3) / 2, 0.35); g.add(sg);
    const rl = Math.hypot(3, hi - lo);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(rl, 3.8), gm);
    roof.rotateX(-Math.PI / 2); roof.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -Math.atan2(hi - lo, 3));
    roof.position.set((x0 + x1) / 2, (hi + lo) / 2 + 0.02, 0.35); g.add(roof);
    const eave = box(0.1, 0.1, 3.9, fm, x1, lo, 0.35); g.add(eave);
    const topL = box(rl, 0.08, 0.08, fm, (x0 + x1) / 2, (hi + lo) / 2, z1); topL.rotation.z = -Math.atan2(hi - lo, 3); g.add(topL);
    const botL = box(3, 0.08, 0.08, fm, (x0 + x1) / 2, 0.34, z1); g.add(botL);
    g.userData.anim = t => {
      fm.opacity = lerp(0.28, 1, t); gm.opacity = lerp(0.12, 0.42, t); base.material.opacity = lerp(0.3, 1, t);
      fm.depthWrite = t > 0.5;
    };
    root.add(g); zones.garden = g;
  }

  // Обводки зон
  const outlines = {};
  for (const [id, z] of Object.entries(ZONE_GEOMETRY)) { outlines[id] = outline(z.outline); root.add(outlines[id]); }
  return { root, zones, outlines };
}

/**
 * Создать сцену в контейнере. Бросает ошибку, если нет WebGL.
 * @param {HTMLElement} host
 * @param {{reducedMotion?:boolean, onFrame?:Function, poster?:boolean}} opts
 */
export function createScene(host, opts = {}) {
  const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.poster });
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.02;
  gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.setClearColor(0x000000, 0);
  gl.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  gl.domElement.className = 'gm-canvas';
  gl.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(gl);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9c7c0', 0.9));
  const sun = new THREE.DirectionalLight('#fff4e4', 2.3);
  sun.position.set(12, 16, 14); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 14, bottom: -10, near: 1, far: 60 });
  sun.shadow.bias = -0.0004; sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const { root, zones, outlines } = buildHouse();
  scene.add(root);
  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.5, 200);
  host.appendChild(gl.domElement);

  let reduced = !!opts.reducedMotion, focus = null, selected = new Set(), raf = 0;
  const camPos = new THREE.Vector3(...CAM.overview.pos), camTgt = new THREE.Vector3(...CAM.overview.tgt);
  const camFrom = { p: camPos.clone(), t: camTgt.clone() }, camTo = { p: camPos.clone(), t: camTgt.clone() };
  let camT = 1, camStart = 0;
  const DUR = 950;
  // текущие и целевые значения анимаций зон и обводок
  const state = {};
  for (const id of Object.keys(zones)) state[id] = { anim: id === 'garden' ? 0 : 0, animTo: 0, line: 0, lineTo: 0 };

  function size() {
    const w = host.clientWidth || 800, h = host.clientHeight || 600;
    gl.setSize(w, h, false);
    camera.aspect = w / h;
    // на узком кадре отодвигаем камеру, чтобы дом помещался целиком
    camera.fov = camera.aspect < 1.2 ? 30 * (1.2 / camera.aspect) ** 0.55 : 30;
    camera.updateProjectionMatrix();
    draw();
  }

  function applyTargets() {
    for (const id of Object.keys(zones)) {
      const s = state[id];
      s.animTo = focus === id ? 1 : (id === 'garden' && selected.has(id)) ? 1 : 0;
      s.lineTo = focus === id ? 1 : selected.has(id) ? 0.55 : 0;
    }
    const c = CAM[focus] || CAM.overview;
    camFrom.p.copy(camPos); camFrom.t.copy(camTgt);
    camTo.p.set(...c.pos); camTo.t.set(...c.tgt);
    camT = 0; camStart = performance.now();
    kick();
  }

  function step(nowT) {
    let busy = false;
    if (camT < 1) {
      camT = reduced ? 1 : Math.min(1, (nowT - camStart) / DUR);
      const k = ease(camT);
      camPos.lerpVectors(camFrom.p, camTo.p, k); camTgt.lerpVectors(camFrom.t, camTo.t, k);
      busy = camT < 1;
    }
    for (const [id, s] of Object.entries(state)) {
      const sp = reduced ? 1 : 0.06;
      for (const [a, b] of [['anim', 'animTo'], ['line', 'lineTo']]) {
        const d = s[b] - s[a];
        if (Math.abs(d) > 0.002) { s[a] += d * (reduced ? 1 : sp * 1.6); busy = true; } else s[a] = s[b];
      }
      zones[id].userData.anim?.(ease(Math.max(0, Math.min(1, s.anim))));
      outlines[id].userData.mat.opacity = s.line;
      outlines[id].visible = s.line > 0.01;
    }
    return busy;
  }

  function draw() {
    camera.position.copy(camPos); camera.lookAt(camTgt);
    gl.render(scene, camera);
    opts.onFrame?.(api);
  }
  function loop(t) {
    const busy = step(t);
    draw();
    raf = busy ? requestAnimationFrame(loop) : 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  const v = new THREE.Vector3();
  const api = {
    kind: 'three',
    canvas: gl.domElement,
    focusZone(id) { focus = id; applyTargets(); },
    reset() { focus = null; applyTargets(); },
    setSelectedZones(ids) { selected = new Set(ids); applyTargets(); },
    setReducedMotion(on) { reduced = !!on; },
    /** Экранные координаты якорей зон, доли 0..1 от кадра; visible — перед камерой. */
    anchors() {
      camera.updateMatrixWorld();
      const out = {};
      for (const [id, z] of Object.entries(ZONE_GEOMETRY)) {
        v.set(...z.anchor).project(camera);
        const x = (v.x + 1) / 2, y = (1 - v.y) / 2;
        out[id] = { x, y, visible: v.z < 1 && x > 0.04 && x < 0.96 && y > 0.06 && y < 0.94 };
      }
      return out;
    },
    /** Контуры зон в долях кадра — для статичной схемы. */
    outlines() {
      camera.updateMatrixWorld();
      const out = {};
      for (const [id, z] of Object.entries(ZONE_GEOMETRY)) out[id] = z.outline.map(p => { v.set(...p).project(camera); return [(v.x + 1) / 2, (1 - v.y) / 2]; });
      return out;
    },
    snapshot(type = 'image/webp', q = 0.9) { step(performance.now() + 1e6); draw(); return gl.domElement.toDataURL(type, q); },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); gl.dispose(); gl.domElement.remove(); },
  };

  const ro = new ResizeObserver(size); ro.observe(host);
  size(); step(performance.now()); draw();
  return api;
}
