/* 3D-сцена «Персональной карты остекления»: светлый архитектурный чертёж (three.js локально, без CDN).
   Редакционная инженерия, а не рендер коттеджа: тёплый молочно-серый фон, дом графитовыми линиями, дымчатые плоскости стекла.
   Песочный — сдержанно: активная и выбранная зона — тонкий песочный контур и лёгкая полупрозрачная подложка. Без деревьев, неба и теней.
   Контроллер — тот же интерфейс, что у адаптера Spline (spline.js): focusZone, reset, setSelectedZones, setReducedMotion,
   setHover, setAnswers(zoneId, answers, commit) — ответы меняют саму сцену:
     гостиная → сад: ежедневно — три стеклянные плоскости HS, створка идёт по песочной направляющей, проход светится;
       летом — FS-панели складываются к краю, остаётся линия свободного проёма; больше света — неподвижный витраж без порога;
     панорамные окна: рамка и дымчатое стекло; «тепло» — второй слой стекла; «солнце» — ламели; «проветривание» — створка;
     терраса: проявляются стеклянные стены; раскрытие — панели складываются; «круглый год» — замкнутый световой контур;
       «верхнее остекление» — стеклянная кровля;
     зимний сад: из тонкой сетки каркаса вырастают стеклянные панели, затем кровля; «круглый год» — объём теплее и плотнее;
     второй свет: высокий контур витража, внутри поднимается тёплый вертикальный свет; «солнце» — ламели;
     вход: контур двери, бокового витража и фрамуги, дверь открывается на 12°; «приватность» — матовое стекло.
   Кадр рисуется только во время анимации. Нет WebGL — createScene бросает ошибку, страница остаётся на постере. */
import * as THREE from '../../vendor/three/three.module.min.js';

const C = { bg: '#f3f1ea', line: '#242421', line2: '#4a4944', glass: '#8fa3a8', accent: '#b7a276', warm: '#d9b98a' };
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.max(0, Math.min(1, v));
const LIFT = 0.3;                                   // дом на цоколе: пол первого этажа — на уровне террасы
const POSTER_ASPECT = { land: 16 / 9, port: 9 / 16 };

// ---------- материалы ----------
const lineMat = (opacity, color = C.line) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, fog: true, depthWrite: false });
const L = { main: lineMat(0.8), second: lineMat(0.42, C.line2), faint: lineMat(0.1, C.line2) };
const WALL = new THREE.MeshBasicMaterial({ color: '#f1efe8', transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const glassMat = (op = 0.16) => new THREE.MeshBasicMaterial({ color: C.glass, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, fog: true });
function gradTex(stops) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 256, 0, 0);
  stops.forEach(([s, col]) => gr.addColorStop(s, col)); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const warmTex = gradTex([[0, 'rgba(217,185,138,.75)'], [0.55, 'rgba(217,185,138,.3)'], [1, 'rgba(217,185,138,0)']]);
const glowMat = () => new THREE.MeshBasicMaterial({ map: warmTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });

// ---------- геометрия из линий ----------
function segs(points, mat) {
  const g = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
  return new THREE.LineSegments(g, mat);
}
// Прямоугольник в плоскости XY (левый нижний угол — 0,0)
const rectPts = (w, h, i = 0) => [[i, i, 0], [w - i, i, 0], [w - i, i, 0], [w - i, h - i, 0], [w - i, h - i, 0], [i, h - i, 0], [i, h - i, 0], [i, i, 0]];
function rect(w, h, mat, inset = 0) { return segs(rectPts(w, h, inset), mat); }
// Тёмный объём с контуром рёбер
function solid(w, h, d, x, y, z, mat = L.main, fill = WALL) {
  const g = new THREE.Group(), geo = new THREE.BoxGeometry(w, h, d);
  if (fill) g.add(new THREE.Mesh(geo, fill));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), mat));
  g.position.set(x, y, z);
  return g;
}
// Стеклянная створка: дымчатая плоскость + наружный и внутренний контур профиля
function pane(w, h, mat, gm, profile = 0.07) {
  const g = new THREE.Group();
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), gm); gl.position.set(w / 2, h / 2, 0); g.add(gl);
  g.add(rect(w, h, mat), rect(w, h, mat, profile));
  return g;
}
function glow(w, h, x, y, z) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glowMat()); m.geometry.translate(0, h / 2, 0); m.position.set(x, y, z); return m; }
function accordion(panels, x0, z0, w, t) {
  const th = t * 1.38, cx = Math.cos(th), sz = Math.sin(th);
  panels.forEach((p, i) => {
    const px = x0 + i * w * cx, pz = z0 + (i % 2 ? w * sz : 0), nx = x0 + (i + 1) * w * cx, nz = z0 + ((i + 1) % 2 ? w * sz : 0);
    p.position.x = px; p.position.z = pz; p.rotation.y = -Math.atan2(nz - pz, nx - px);
  });
}
// Материалы зоны: линии остаются графитовыми (активная — чуть плотнее), стекло получает лёгкую песочную подложку
function zoneMats() {
  const line = lineMat(0.8), dim = lineMat(0.42, C.line2), gm = glassMat(0.16);
  const cGlass = new THREE.Color(C.glass), cAcc = new THREE.Color(C.accent);
  let tint = 0;
  return {
    line, dim, gm,
    paint(s, k) {
      const want = s.focus ? 1 : s.selected || s.hover ? 0.6 : 0;
      tint = lerp(tint, want, k);
      line.opacity = 0.8 + 0.2 * tint;
      gm.color.copy(cGlass).lerp(cAcc, 0.35 * tint);
      return Math.abs(tint - want) > 0.005;
    },
  };
}

// ---------- зоны: якоря меток и контуры (координаты дома, до подъёма на цоколь) ----------
const RAW = {
  portal: { anchor: [-1.9, 1.6, 3.1], outline: [[-3.95, 0.12, 3.12], [0.15, 0.12, 3.12], [0.15, 2.8, 3.12], [-3.95, 2.8, 3.12]] },
  window: { anchor: [-2.8, 4.6, 3.1], outline: [[-5.05, 3.35, 3.12], [-0.55, 3.35, 3.12], [-0.55, 5.85, 3.12], [-5.05, 5.85, 3.12]] },
  terrace: { anchor: [-7.5, 1.5, 3.2], outline: [[-9.05, 0.2, 3.1], [-5.95, 0.2, 3.1], [-5.95, 2.75, 3.1], [-9.05, 2.75, 3.1]] },
  garden: { anchor: [6.05, 1.7, 2.3], outline: [[4.6, 0.15, 2.3], [7.6, 0.15, 2.3], [7.6, 2.6, 2.3], [4.6, 3.55, 2.3]] },
  entry: { anchor: [-5.05, 1.4, 3.1], outline: [[-5.85, 0.12, 3.12], [-4.25, 0.12, 3.12], [-4.25, 2.85, 3.12], [-5.85, 2.85, 3.12]] },
  second: { anchor: [2.5, 5.0, 2.5], outline: [[0.95, 0.12, 2.52], [4.05, 0.12, 2.52], [4.05, 6.25, 2.52], [2.5, 8.15, 2.52], [0.95, 6.25, 2.52]] },
};
const up = p => [p[0], p[1] + LIFT, p[2]];
export const ZONE_GEOMETRY = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, { anchor: up(v.anchor), outline: v.outline.map(up) }]));

// Камеры: горизонтальный кадр (land) и телефон (port); fov — вертикальный при эталонном соотношении сторон
const CAM = {
  land: {
    overview: { pos: [12.54, 1.7, 25.94], tgt: [-2.75, 3.95, 0.5], fov: 30 },
    portal: { pos: [1.2, 1.7, 10.8], tgt: [-2.1, 1.9, 3], fov: 34 },
    window: { pos: [2.4, 2.4, 12.2], tgt: [-2.7, 4.3, 3], fov: 34 },
    terrace: { pos: [-1.8, 1.7, 11.4], tgt: [-7.3, 1.8, 2], fov: 34 },
    garden: { pos: [13.6, 1.8, 11.6], tgt: [6.3, 2.0, 0.6], fov: 34 },
    entry: { pos: [-1.6, 1.7, 9.6], tgt: [-5.0, 1.8, 3], fov: 34 },
    second: { pos: [7.4, 1.8, 13.5], tgt: [2.4, 4.7, 2], fov: 36 },
  },
  port: {
    overview: { pos: [38.6, 1.7, 44.7], tgt: [-0.5, 1.2, 0.5], fov: 30 },
    portal: { pos: [1.4, 1.7, 13.5], tgt: [-1.9, 1.9, 3], fov: 44 },
    window: { pos: [2.2, 2.3, 15], tgt: [-2.8, 4.4, 3], fov: 44 },
    terrace: { pos: [-2.2, 1.7, 14.5], tgt: [-7.4, 1.8, 2], fov: 44 },
    garden: { pos: [13, 1.8, 14], tgt: [6, 2.1, 0.6], fov: 44 },
    entry: { pos: [-2.2, 1.7, 12.5], tgt: [-5.0, 1.9, 3], fov: 44 },
    second: { pos: [8, 1.8, 17], tgt: [2.5, 4.9, 2], fov: 46 },
  },
};

function buildGround(scene) {
  // едва заметная сетка вместо участка: шаг 1 м, к горизонту растворяется в тумане
  const pts = [], N = 70;
  for (let i = -N; i <= N; i += 1) pts.push([i, 0, -N], [i, 0, N], [-N, 0, i], [N, 0, i]);
  scene.add(segs(pts, L.faint));
}

function buildHouse() {
  const root = new THREE.Group(); root.name = 'HOUSE_ROOT';
  const house = new THREE.Group(); house.position.y = LIFT; root.add(house);
  const zones = {};

  // цоколь, терраса с настилом из параллельных линий, ступени, дорожка
  root.add(solid(11.2, LIFT + 0.15, 6.4, -0.75, (LIFT + 0.15) / 2, -0.1, L.second));
  root.add(solid(9.4, LIFT + 0.15, 3.4, -0.05, (LIFT + 0.15) / 2, 4.8, L.second));
  { const pts = []; for (let z = 3.26; z < 6.5; z += 0.16) pts.push([-4.75, LIFT + 0.152, z], [4.65, LIFT + 0.152, z]); root.add(segs(pts, lineMat(0.2, C.line2))); }
  [0, 1, 2].forEach(i => root.add(solid(3.2, (LIFT + 0.15) * (3 - i) / 3, 0.36, -1.9, (LIFT + 0.15) * (3 - i) / 6, 6.68 + i * 0.36, L.second)));
  { const pts = []; for (let i = 0; i < 7; i++) { const x = -1.9 + Math.sin(i * 0.5) * 0.25, z = 7.9 + i * 1.05; pts.push(...rectPts(1.3, 0.8).map(([a, b]) => [x - 0.65 + a, 0.01, z - 0.4 + b])); } root.add(segs(pts, L.faint)); }

  // объём A: два этажа, двускатная кровля контуром (конёк вдоль X)
  house.add(solid(6.5, 6.2, 6, -2.75, 3.1, 0));
  house.add(segs([[-6.0, 3.05, 3.002], [0.5, 3.05, 3.002]], L.second));
  {
    const x0 = -6.2, x1 = 0.7, y0 = 6.2, rise = 1.9, zh = 3.35;
    const p = [[x0, y0, zh], [x0, y0 + rise, 0], [x0, y0 + rise, 0], [x0, y0, -zh], [x1, y0, zh], [x1, y0 + rise, 0], [x1, y0 + rise, 0], [x1, y0, -zh],
      [x0, y0 + rise, 0], [x1, y0 + rise, 0], [x0, y0, zh], [x1, y0, zh], [x0, y0, -zh], [x1, y0, -zh]];
    house.add(segs(p, L.main));
    const r = []; for (let x = x0 + 0.45; x < x1; x += 0.45) r.push([x, y0, zh], [x, y0 + rise, 0], [x, y0 + rise, 0], [x, y0, -zh]);
    house.add(segs(r, L.faint));
    const s = new THREE.Shape(); s.moveTo(-3, 0); s.lineTo(3, 0); s.lineTo(0, rise); s.closePath();
    [-6.0, 0.5].forEach(x => { const m = new THREE.Mesh(new THREE.ShapeGeometry(s), WALL); m.material.side = THREE.DoubleSide; m.rotation.y = Math.PI / 2; m.position.set(x, y0, 0); house.add(m); });
  }
  // объём B: второй свет, фронтон к саду
  house.add(solid(4, 6.4, 5.4, 2.5, 3.2, -0.3));
  {
    const x0 = 0.3, x1 = 4.7, y0 = 6.4, rise = 2.4, z0 = -3.25, z1 = 2.8, xm = 2.5;
    const p = [[x0, y0, z1], [xm, y0 + rise, z1], [xm, y0 + rise, z1], [x1, y0, z1], [x0, y0, z0], [xm, y0 + rise, z0], [xm, y0 + rise, z0], [x1, y0, z0],
      [xm, y0 + rise, z0], [xm, y0 + rise, z1], [x0, y0, z0], [x0, y0, z1], [x1, y0, z0], [x1, y0, z1]];
    house.add(segs(p, L.main));
    const r = []; for (let z = z0 + 0.45; z < z1; z += 0.45) r.push([x0, y0, z], [xm, y0 + rise, z], [xm, y0 + rise, z], [x1, y0, z]);
    house.add(segs(r, L.faint));
    const s = new THREE.Shape(); s.moveTo(-2, 0); s.lineTo(2, 0); s.lineTo(0, 2.4); s.closePath();
    [-3.0, 2.4].forEach(z => { const m = new THREE.Mesh(new THREE.ShapeGeometry(s), WALL); m.position.set(2.5, 6.4, z); house.add(m); });
  }

  // ---- PORTAL_LIVING_ROOM: HS / FS / витраж в одном проёме ----
  {
    const g = new THREE.Group(); g.name = 'PORTAL_LIVING_ROOM';
    const zm = zoneMats(), x0 = -3.9, W = 4.0, H = 2.6, y0 = 0.15, Z = 3.03;
    const opening = rect(W, H, zm.line); opening.position.set(x0, y0, Z); g.add(opening);
    const variant = () => { const v = new THREE.Group(); v.userData = { line: lineMat(0), gm: glassMat(0) }; g.add(v); return v; };
    // HS: три плоскости, направляющая песочной линией, створка уходит за глухую, проход светится
    const hs = variant(), lw = W / 3;
    const hsL = [0, 1, 2].map(i => { const p = pane(lw + 0.03, H, hs.userData.line, hs.userData.gm); p.position.set(x0 + i * lw - 0.015, y0, Z + 0.02 + i * 0.05); hs.add(p); return p; });
    const railMat = lineMat(0, C.accent);
    hs.add(segs([[x0 - 0.6, y0 + 0.01, Z + 0.12], [x0 + W + 0.1, y0 + 0.01, Z + 0.12], [x0 - 0.6, y0 + H + 0.02, Z + 0.12], [x0 + W + 0.1, y0 + H + 0.02, Z + 0.12]], railMat));
    const pass = glow(lw * 1.5, H * 0.95, x0 + W - lw * 0.8, y0, Z - 0.05); hs.add(pass);
    // FS: пять панелей гармошкой к левому краю + линия свободного проёма
    const fs = variant(), fw = W / 5;
    const fsL = [0, 1, 2, 3, 4].map(() => { const p = pane(fw, H, fs.userData.line, fs.userData.gm, 0.05); p.position.y = y0; fs.add(p); return p; });
    const freeMat = lineMat(0, C.accent);
    fs.add(segs([[x0 + 0.9, y0 + 0.01, Z + 0.3], [x0 + W, y0 + 0.01, Z + 0.3]], freeMat));
    // Витраж: три неподвижных полотна, импост, без порога
    const fx = variant();
    [0, 1, 2].forEach(i => { const p = pane(W / 3, H, fx.userData.line, fx.userData.gm, 0.045); p.position.set(x0 + i * W / 3, y0, Z + 0.02); fx.add(p); });
    fx.add(segs([[x0, y0 + H * 0.78, Z + 0.03], [x0 + W, y0 + H * 0.78, Z + 0.03]], fx.userData.line));
    const vars = { hs, fs, fixed: fx }, op = { hs: 0, fs: 0, fixed: 0 };
    g.userData.update = (s, k) => {
      const busy = zm.paint(s, k);
      const want = s.answers.usage === 'open' ? 'fs' : s.answers.usage === 'light' ? 'fixed' : 'hs';
      const show = s.focus || s.selected || s.hover ? 1 : 0.55;
      for (const [key, v] of Object.entries(vars)) {
        op[key] = lerp(op[key], key === want ? show : 0, k);
        v.visible = op[key] > 0.01; v.userData.line.opacity = 0.85 * op[key]; v.userData.gm.opacity = 0.22 * op[key];
        v.userData.line.color.copy(zm.line.color);
      }
      const t = s.open;
      hsL[2].position.x = x0 + 2 * lw - 0.015 - t * lw * 1.4;
      railMat.opacity = want === 'hs' ? Math.max(t, s.hover ? 0.6 : 0) * op.hs : 0;
      pass.material.opacity = want === 'hs' ? t * 0.55 * op.hs : 0; pass.scale.x = 0.2 + t * 0.8;
      accordion(fsL, x0, Z + 0.02, fw, t * 0.92);
      freeMat.opacity = want === 'fs' ? t * op.fs : 0;
      return busy || Math.abs(op[want] - show) > 0.005;
    };
    house.add(g); zones.portal = g;
  }
  // ---- PANORAMIC_WINDOWS_UPPER: рамка, дымчатое стекло, второй слой стекла, ламели, створка ----
  {
    const g = new THREE.Group(); g.name = 'PANORAMIC_WINDOWS_UPPER';
    const zm = zoneMats(), sashes = [], innerLine = lineMat(0), innerGm = glassMat(0), louvMat = lineMat(0);
    [[-5, 1.9], [-2.45, 1.9]].forEach(([x, w]) => {
      const fixedP = pane(w / 2, 2.4, zm.line, zm.gm); fixedP.position.set(x + w / 2, 3.4, 3.03); g.add(fixedP);
      const hinge = new THREE.Group(); hinge.position.set(x, 5.8, 3.03);
      const sash = pane(w / 2, 2.4, zm.line, zm.gm); sash.position.set(0, -2.4, 0); hinge.add(sash); g.add(hinge); sashes.push(hinge);
      const ip = pane(w, 2.4, innerLine, innerGm, 0.04); ip.position.set(x, 3.4, 3.12); g.add(ip);
      const lp = []; for (let i = 0; i < 9; i++) lp.push([x - 0.05, 3.5 + i * 0.27, 3.3], [x + w + 0.05, 3.5 + i * 0.27, 3.3]);
      g.add(segs(lp, louvMat));
    });
    let warm = 0, sun = 0;
    g.userData.update = (s, k) => {
      const busy = zm.paint(s, k);
      sashes.forEach(h => { h.rotation.x = s.answers.opening === 'yes' ? s.open * 0.22 : 0; });
      const w1 = s.answers.priority === 'warm' ? 1 : 0, s1 = s.answers.priority === 'sun' ? 1 : 0;
      warm = lerp(warm, w1, k); innerLine.opacity = 0.6 * warm; innerGm.opacity = 0.14 * warm; innerLine.color.copy(zm.line.color);
      sun = lerp(sun, s1, k); louvMat.opacity = 0.7 * sun; louvMat.color.copy(zm.line.color);
      return busy || Math.abs(warm - w1) > 0.005 || Math.abs(sun - s1) > 0.005;
    };
    house.add(g); zones.window = g;
  }
  // ---- ENTRANCE_GROUP ----
  {
    const g = new THREE.Group(); g.name = 'ENTRANCE_GROUP';
    const zm = zoneMats();
    const side = pane(0.5, 2.1, zm.line, zm.gm); side.position.set(-5.8, 0.15, 3.03); g.add(side);
    const top = pane(1.5, 0.5, zm.line, zm.gm); top.position.set(-5.8, 2.25, 3.03); g.add(top);
    const pivot = new THREE.Group(); pivot.position.set(-5.3, 0.15, 3.03);
    const doorFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.1), WALL); doorFill.position.set(0.5, 1.05, 0.005);
    pivot.add(doorFill, rect(1, 2.1, zm.line), rect(1, 2.1, zm.line, 0.07), segs([[0.86, 0.75, 0.02], [0.86, 1.35, 0.02]], zm.line));
    g.add(pivot);
    g.add(solid(2.1, 0.08, 1.3, -5.05, 3.0, 3.65, zm.dim, WALL));
    const light = glow(1.4, 2.6, -5.05, 0.15, 2.98); g.add(light);
    const cG = new THREE.Color(C.glass), frost = new THREE.Color('#e9ecea');
    g.userData.update = (s, k) => {
      const busy = zm.paint(s, k);
      pivot.rotation.y = -s.open * 0.21;                                    // 12°
      const f = s.answers.priority === 'privacy' ? 1 : 0;
      zm.gm.color.lerp(frost, f * 0.5); zm.gm.opacity = lerp(0.2, 0.34, f);
      if (!f) zm.gm.color.copy(cG).lerp(new THREE.Color(C.accent), s.focus ? 0.18 : 0);
      light.material.opacity = s.open * 0.35;
      return busy;
    };
    house.add(g); zones.entry = g;
  }
  // ---- DOUBLE_HEIGHT_GLAZING: высокий витраж, фронтон, вертикальный тёплый свет, ламели ----
  {
    const g = new THREE.Group(); g.name = 'DOUBLE_HEIGHT_GLAZING';
    const zm = zoneMats(), Z = 2.46, vent = [];
    [0, 1, 2].forEach(i => {
      const p = pane(1.03, 3.05, zm.line, zm.gm, 0.05); p.position.set(0.95 + i * 1.03, 0.15, Z); g.add(p);
      const h = new THREE.Group(); h.position.set(0.95 + i * 1.03, 6.25, Z);
      const q = pane(1.03, 3.05, zm.line, zm.gm, 0.05); q.position.set(0, -3.05, 0); h.add(q); g.add(h); if (i === 1) vent.push(h);
    });
    const tri = new THREE.Shape(); tri.moveTo(-1.55, 0); tri.lineTo(1.55, 0); tri.lineTo(0, 1.9); tri.closePath();
    const tg = new THREE.Mesh(new THREE.ShapeGeometry(tri), zm.gm); tg.position.set(2.5, 6.25, Z); g.add(tg);
    g.add(segs([[0.95, 6.25, Z], [2.5, 8.15, Z], [2.5, 8.15, Z], [4.05, 6.25, Z], [2.5, 6.25, Z], [2.5, 8.15, Z]], zm.line));
    const light = glow(3.0, 7.9, 2.5, 0.15, Z - 0.08); light.scale.y = 0.001; g.add(light);
    const louvMat = lineMat(0), lp = [];
    for (let i = 0; i < 16; i++) lp.push([0.8, 0.5 + i * 0.36, Z + 0.3], [4.2, 0.5 + i * 0.36, Z + 0.3]);
    g.add(segs(lp, louvMat));
    let sun = 0;
    g.userData.update = (s, k) => {
      const busy = zm.paint(s, k);
      const lit = Math.max(s.open, s.selected ? 0.45 : 0);
      light.scale.y = Math.max(0.001, lit); light.material.opacity = lit;
      vent[0].rotation.x = s.answers.opening === 'yes' ? s.open * 0.18 : 0;
      const s1 = s.answers.priority === 'sun' ? 1 : 0;
      sun = lerp(sun, s1, k); louvMat.opacity = 0.65 * sun; louvMat.color.copy(zm.line.color);
      return busy || Math.abs(sun - s1) > 0.005;
    };
    house.add(g); zones.second = g;
  }
  // ---- TERRACE_GLAZING: контур веранды всегда, стеклянные стены проявляются ----
  {
    const g = new THREE.Group(); g.name = 'TERRACE_GLAZING';
    const zm = zoneMats();
    g.add(solid(3.2, LIFT + 0.2, 4.2, -7.5, 0.2 - (LIFT + 0.2) / 2, 1, zm.dim));
    const roofSolid = solid(3.4, 0.2, 4.4, -7.5, 2.95, 1, zm.line); g.add(roofSolid);
    g.add(segs([[-9.03, 0.2, 2.95], [-9.03, 2.85, 2.95], [-5.97, 0.2, 2.95], [-5.97, 2.85, 2.95], [-9.03, 0.2, -0.95], [-9.03, 2.85, -0.95]], zm.line));
    const pl = lineMat(0), pg = glassMat(0);
    const side = pane(3.9, 2.55, pl, pg); side.rotation.y = Math.PI / 2; side.position.set(-9.03, 0.2, 2.9); g.add(side);
    const x0 = -8.98, w = 2.96 / 4, panels = [0, 1, 2, 3].map(() => { const p = pane(w, 2.55, pl, pg, 0.05); p.position.y = 0.2; g.add(p); return p; });
    accordion(panels, x0, 2.95, w, 0);
    const roofGlassL = lineMat(0), roofGlassG = glassMat(0), roofGlass = new THREE.Group();
    const rg = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.4), roofGlassG); rg.rotation.x = -Math.PI / 2; rg.position.set(-7.5, 3.06, 1); roofGlass.add(rg);
    { const p = []; for (let i = 0; i <= 5; i++) { const x = -9.2 + i * 0.68; p.push([x, 3.07, -1.2], [x, 3.07, 3.2]); } roofGlass.add(segs(p, roofGlassL)); }
    g.add(roofGlass);
    const loopMat = lineMat(0, C.accent), loop = [];
    [0.21, 2.84].forEach(y => loop.push([-9.0, y, 2.97], [-6.0, y, 2.97], [-6.0, y, 2.97], [-6.0, y, -0.93], [-6.0, y, -0.93], [-9.0, y, -0.93], [-9.0, y, -0.93], [-9.0, y, 2.97]));
    g.add(segs(loop, loopMat));
    const glowIn = glow(2.9, 2.5, -7.5, 0.2, 1); g.add(glowIn);
    let vis = 0, rv = 0;
    g.userData.update = (s, k) => {
      const busy = zm.paint(s, k);
      const want = s.focus || s.selected ? 1 : s.hover ? 0.5 : 0;
      vis = lerp(vis, want, k); pl.opacity = 0.85 * vis; pg.opacity = 0.2 * vis; pl.color.copy(zm.line.color);
      const fold = s.answers.open === 'all' ? 1 : s.answers.open === 'side' ? 0.55 : 0;
      accordion(panels, x0, 2.95, w, fold * s.open);
      const gr = s.answers.roof === 'glass' ? 1 : 0;
      rv = lerp(rv, gr, k); roofGlassL.opacity = 0.8 * rv; roofGlassG.opacity = 0.18 * rv; roofSolid.visible = rv < 0.5; roofGlassL.color.copy(zm.line.color);
      const year = s.answers.usage === 'year' ? 1 : 0;
      loopMat.opacity = year * Math.max(s.open, s.selected ? 0.7 : 0); glowIn.material.opacity = year * s.open * 0.25;
      return busy || Math.abs(vis - want) > 0.005 || Math.abs(rv - gr) > 0.005;
    };
    house.add(g); zones.terrace = g;
  }
  // ---- WINTER_GARDEN: сетка каркаса → вырастают стеклянные панели → стеклянная кровля ----
  {
    const g = new THREE.Group(); g.name = 'WINTER_GARDEN';
    const zm = zoneMats();
    const hi = 3.55, lo = 2.6, x0 = 4.55, x1 = 7.55, z0 = -1.55, z1 = 2.25, H0 = 0.15;
    g.add(solid(3.1, LIFT + H0, 3.9, 6.05, H0 - (LIFT + H0) / 2, 0.35, zm.dim));
    const yAt = x => hi - (hi - lo) * (x - x0) / (x1 - x0);
    const frame = [];
    [x0, x0 + 1, x0 + 2, x1].forEach(x => frame.push([x, H0, z1], [x, yAt(x), z1]));
    [z0, (z0 + z1) / 2, z1].forEach(z => frame.push([x1, H0, z], [x1, lo, z], [x0, hi, z], [x1, lo, z]));
    frame.push([x0, H0, z1], [x1, H0, z1], [x1, H0, z1], [x1, H0, z0], [x1, lo, z0], [x1, lo, z1], [x0, hi, z0], [x0, hi, z1]);
    g.add(segs(frame, zm.line));
    const gm = glassMat(0), grow = [];
    [0, 1, 2].forEach(i => {
      const xa = x0 + i, xb = xa + 1, s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(1, 0); s.lineTo(1, yAt(xb) - H0); s.lineTo(0, yAt(xa) - H0); s.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(s), gm); m.position.set(xa, H0, z1); m.scale.y = 0.001; g.add(m); grow.push(m);
    });
    [0, 1].forEach(i => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, lo - H0), gm); m.geometry.translate(0, (lo - H0) / 2, 0); m.rotation.y = Math.PI / 2; m.position.set(x1, H0, z0 + 0.95 + i * 1.9); m.scale.y = 0.001; g.add(m); grow.push(m); });
    const rl = Math.hypot(3, hi - lo), roofG = glassMat(0);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(rl, 3.8), roofG);
    roof.rotateX(-Math.PI / 2); roof.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -Math.atan2(hi - lo, 3)); roof.position.set((x0 + x1) / 2, (hi + lo) / 2 + 0.01, 0.35); g.add(roof);
    const slide = pane(0.98, 2.1, zm.line, gm, 0.05); slide.position.set(x0 + 1.02, H0, z1 + 0.05); slide.visible = false; g.add(slide);
    const warmGlow = glow(2.8, 2.4, 6.05, H0, 0.35); g.add(warmGlow);
    const cG = new THREE.Color(C.glass), cW = new THREE.Color(C.warm);
    let build = 0;
    g.userData.update = (s, k) => {
      const busy = zm.paint(s, k);
      const want = s.focus || s.selected ? 1 : s.hover ? 0.35 : 0;
      build = lerp(build, want, k * 0.7);
      grow.forEach((m, i) => { m.scale.y = Math.max(0.001, clamp01(build * 1.6 - i * 0.12)); });
      const year = s.answers.usage === 'year' ? 1 : 0;
      gm.opacity = lerp(0, year ? 0.3 : 0.2, clamp01(build * 1.4)); gm.color.copy(cG).lerp(cW, year * 0.25);
      roofG.opacity = lerp(0, year ? 0.26 : 0.18, clamp01(build * 2 - 1)); roofG.color.copy(gm.color);
      slide.visible = build > 0.6; slide.position.x = x0 + 1.02 + (s.answers.priority === 'open' ? s.open * 0.95 : 0);
      warmGlow.material.opacity = (year ? 0.3 : 0.12) * build * Math.max(s.open, 0.4);
      return busy || Math.abs(build - want) > 0.004;
    };
    house.add(g); zones.garden = g;
  }
  // песочный контур и лёгкая подложка зоны (активная / выбранная / наведение)
  const marks = {};
  for (const [id, z] of Object.entries(RAW)) {
    const pts = z.outline.map(p => [p[0], p[1], p[2] + 0.03]);
    const loop = []; pts.forEach((p, i) => loop.push(p, pts[(i + 1) % pts.length]));
    const line = segs(loop, lineMat(0, C.accent));
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
    const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    fill.position.z = pts[0][2] - 0.005;
    house.add(line, fill);
    marks[id] = { line: line.material, fill: fill.material, v: 0 };
  }
  return { root, zones, marks };
}

/**
 * Полноэкранная сцена в контейнере. Бросает ошибку, если нет WebGL.
 * @param {HTMLElement} host
 * @param {{reducedMotion?:boolean, onFrame?:Function, poster?:'land'|'port'}} opts
 */
export function createScene(host, opts = {}) {
  const gl = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: !!opts.poster });
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.setClearColor(C.bg, 1);
  gl.setPixelRatio(opts.poster ? 1 : Math.min(devicePixelRatio || 1, 2));
  gl.domElement.className = 'gm-canvas';
  gl.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  scene.fog = new THREE.Fog(C.bg, 30, 80);
  buildGround(scene);
  const { root, zones, marks } = buildHouse();
  scene.add(root);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.3, 400);
  host.appendChild(gl.domElement);

  let reduced = !!opts.reducedMotion, focus = null, hover = null, raf = 0, W = 1, H = 1, inset = { right: 0, bottom: 0 }, scroll = 0;
  const selected = new Set(), state = {};
  for (const id of Object.keys(zones)) state[id] = { answers: {}, committed: {}, open: 0, openTo: 0, focus: false, selected: false, hover: false };
  const mode = () => opts.poster || (W / H < 1.15 ? 'port' : 'land');
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  let fov = 30;
  const from = { p: new THREE.Vector3(), t: new THREE.Vector3(), f: 30 }, to = { p: new THREE.Vector3(), t: new THREE.Vector3(), f: 30 };
  let camT = 1, camStart = 0;
  const DUR = 1400;
  const preset = () => CAM[mode()][focus] || CAM[mode()].overview;
  { const c = preset(); camPos.set(...c.pos); camTgt.set(...c.tgt); fov = c.fov; }

  // Вертикальный fov под фактическое соотношение сторон: шире эталона — обрезаем по высоте (как object-fit: cover у постера),
  // уже эталона — сохраняем ширину дома; панель справа / шторка снизу сдвигают кадр в свободную часть экрана
  function applyFov() {
    const ref = POSTER_ASPECT[mode()], a = W / H, tan = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    let v = fov;
    if (a > ref) v = THREE.MathUtils.radToDeg(2 * Math.atan(tan * ref / a));
    else if (mode() === 'land' && a < ref) v = THREE.MathUtils.radToDeg(2 * Math.atan(tan * Math.min(ref / a, 1.45)));
    camera.fov = v; camera.aspect = a;
    if (inset.right || inset.bottom) camera.setViewOffset(W, H, inset.right / 2, inset.bottom / 2, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const d = camPos.distanceTo(camTgt); scene.fog.near = d + 4; scene.fog.far = d + 55;   // сетка растворяется за домом
  }
  function size() { W = host.clientWidth || 1280; H = host.clientHeight || 720; gl.setSize(W, H, false); retarget(true); }
  function retarget(instant) {
    const c = preset();
    from.p.copy(camPos); from.t.copy(camTgt); from.f = fov;
    to.p.set(...c.pos); to.t.set(...c.tgt); to.f = c.fov;
    camT = instant || reduced ? 1 : 0; camStart = performance.now();
    if (camT === 1) { camPos.copy(to.p); camTgt.copy(to.t); fov = to.f; }
    kick();
  }
  function targets() {
    for (const [id, s] of Object.entries(state)) {
      s.focus = focus === id; s.selected = selected.has(id); s.hover = hover === id && !focus;
      s.openTo = s.focus ? 1 : 0;
      if (!s.focus) s.answers = { ...s.committed };
    }
  }
  let last = performance.now();
  function step(now) {
    const k = reduced ? 1 : Math.min(1, (now - last) / 1000 * 3.6); last = now;
    let busy = false;
    if (camT < 1) {
      camT = Math.min(1, (now - camStart) / DUR);
      const e = ease(camT);
      camPos.lerpVectors(from.p, to.p, e); camTgt.lerpVectors(from.t, to.t, e); fov = lerp(from.f, to.f, e);
      busy = camT < 1;
    }
    for (const [id, s] of Object.entries(state)) {
      const d = s.openTo - s.open;
      if (Math.abs(d) > 0.002) { s.open += d * Math.min(1, k * 0.8); busy = true; } else s.open = s.openTo;
      if (zones[id].userData.update?.({ ...s, open: ease(clamp01(s.open)) }, k)) busy = true;
      const m = marks[id], want = s.focus ? 1 : s.selected ? 0.75 : s.hover ? 0.55 : 0;
      m.v = lerp(m.v, want, k); m.line.opacity = m.v; m.fill.opacity = 0.1 * m.v;
      if (Math.abs(m.v - want) > 0.005) busy = true;
    }
    return busy;
  }
  function draw() {
    applyFov();
    const back = focus ? 0 : scroll;
    camera.position.copy(camPos).addScaledVector(camPos.clone().sub(camTgt).normalize(), back * 5).add(new THREE.Vector3(0, back * 2, 0));
    camera.lookAt(camTgt);
    gl.render(scene, camera);
    opts.onFrame?.(api);
  }
  function loop(t) { const busy = step(t); draw(); raf = busy ? requestAnimationFrame(loop) : 0; }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }

  const v3 = new THREE.Vector3();
  const api = {
    kind: 'three',
    canvas: gl.domElement,
    focusZone(id) { focus = id; targets(); retarget(false); },
    reset() { focus = null; targets(); retarget(false); },
    setSelectedZones(ids) { selected.clear(); ids.forEach(i => selected.add(i)); targets(); kick(); },
    setHover(id) { if (hover === (id || null)) return; hover = id || null; targets(); kick(); },
    setReducedMotion(on) { reduced = !!on; },
    setAnswers(id, answers, commit) { const s = state[id]; if (!s) return; s.answers = { ...answers }; if (commit) s.committed = { ...answers }; kick(); },
    setInset(r = 0, b = 0) { inset = { right: r, bottom: b }; kick(); },
    setScroll(p) { const n = clamp01(p); if (Math.abs(n - scroll) > 0.002 && !reduced) { scroll = n; kick(); } },
    anchors() {
      const out = {};
      for (const [id, z] of Object.entries(ZONE_GEOMETRY)) {
        v3.set(...z.anchor).project(camera);
        const x = (v3.x + 1) / 2, y = (1 - v3.y) / 2;
        out[id] = { x, y, visible: v3.z < 1 && x > 0.03 && x < 0.97 && y > 0.08 && y < 0.95 };
      }
      return out;
    },
    outlines() {
      const out = {};
      for (const [id, z] of Object.entries(ZONE_GEOMETRY)) out[id] = z.outline.map(p => { v3.set(...p).project(camera); return [(v3.x + 1) / 2, (1 - v3.y) / 2]; });
      return out;
    },
    debug() {
      return { renderer: 'three.js · чертёж', mode: mode(), focus, hover, camera: { pos: camPos.toArray().map(n => +n.toFixed(2)), tgt: camTgt.toArray().map(n => +n.toFixed(2)), fov: +camera.fov.toFixed(1) },
        objects: Object.values(zones).map(z => z.name), answers: Object.fromEntries(Object.entries(state).map(([key, s]) => [key, s.answers])) };
    },
    snapshot(type = 'image/webp', q = 0.9) { for (let i = 0; i < 90; i++) step(performance.now() + i * 100); draw(); return gl.domElement.toDataURL(type, q); },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); gl.dispose(); gl.domElement.remove(); },
  };
  const ro = new ResizeObserver(size); ro.observe(host);
  size(); step(performance.now()); draw();
  return api;
}
