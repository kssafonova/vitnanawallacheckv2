/* HS, «Как открывается дверь» → вкладка «В интерьере»: гостиная в 3D (three.js, локально из assets/vendor/three).
   Портал собирается из параметров выбранной конфигурации (ширина, створки, какие двигаются), ползунок открывает его,
   солнце светит сквозь стекло — тени от профилей ложатся на пол и двигаются вместе со створками.
   Перетаскивание по сцене — немного осмотреться. Рендер только по изменению (без постоянного цикла). */
import * as THREE from '../vendor/three/three.module.min.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function plankTexture(base, line, size = 1024, planks = 8) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const w = size / planks;
  for (let i = 0; i < planks; i++) {
    const shade = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    g.fillStyle = `rgba(${shade > 0 ? '255,255,255' : '0,0,0'},${Math.abs(shade) * .06})`;
    g.fillRect(i * w, 0, w, size);
    for (let k = 0; k < 40; k++) { // волокна
      g.strokeStyle = `rgba(0,0,0,${.02 + Math.random() * .03})`; g.lineWidth = 1;
      const x = i * w + Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, size * .3, x - 6, size * .6, x + 3, size); g.stroke();
    }
    g.fillStyle = line; g.fillRect(i * w, 0, 2, size);
    const cut = ((i * 0.37) % 1) * size; g.fillRect(i * w, cut, w, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function createInterior(host, { viewSrc, onReady } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  const canvas = renderer.domElement;
  canvas.className = 'hsx-3d';
  canvas.setAttribute('aria-label', 'Раздвижная дверь в интерьере гостиной: потяните, чтобы осмотреться');
  host.appendChild(canvas);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dfe6ea');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .38;

  const camera = new THREE.PerspectiveCamera(40, 1.5, .05, 120);
  const target = new THREE.Vector3(0, .98, 0);

  // материалы
  const M = {
    wall: new THREE.MeshStandardMaterial({ color: '#e9e9e7', roughness: .95 }),
    side: new THREE.MeshStandardMaterial({ color: '#dededc', roughness: .95 }),
    ceil: new THREE.MeshStandardMaterial({ color: '#f6f6f5', roughness: 1 }),
    floor: new THREE.MeshStandardMaterial({ map: plankTexture('#b2afaa', 'rgba(60,58,55,.22)'), roughness: .5, metalness: 0 }),
    deck: new THREE.MeshStandardMaterial({ map: plankTexture('#8e8b86', 'rgba(30,30,28,.35)', 512, 6), roughness: .8 }),
    alu: new THREE.MeshStandardMaterial({ color: '#2a2c2e', roughness: .38, metalness: .6 }),
    handle: new THREE.MeshStandardMaterial({ color: '#d7d5d0', roughness: .25, metalness: .9 }),
    glass: new THREE.MeshStandardMaterial({ color: '#dcebf0', roughness: .02, metalness: .1, transparent: true, opacity: .16, envMapIntensity: 3, depthWrite: false }),
    fabric: new THREE.MeshStandardMaterial({ color: '#cfccc7', roughness: .97 }),
    fabricDark: new THREE.MeshStandardMaterial({ color: '#3b3b39', roughness: .9 }),
    wood: new THREE.MeshStandardMaterial({ color: '#2a2927', roughness: .55 }),
    rug: new THREE.MeshStandardMaterial({ color: '#d2d0cc', roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#56675b', roughness: .8 }),
    light: new THREE.MeshBasicMaterial({ color: '#ffffff' })
  };
  const box = (w, h, d, mat, cast = true, recv = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = cast; m.receiveShadow = recv; return m;
  };

  // вид за окном: фото, зеркально повторённое по ширине
  const view = new THREE.TextureLoader().load(viewSrc, () => render());
  view.colorSpace = THREE.SRGBColorSpace; view.wrapS = THREE.MirroredRepeatWrapping; view.repeat.set(3, 1);
  const unitW = 34, unitH = unitW * 575 / 754;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(unitW * 3, unitH), new THREE.MeshBasicMaterial({ map: view, toneMapped: false }));
  backdrop.position.set(0, 1.25 + unitH * (.64 - .5), -30);
  scene.add(backdrop);

  // свет: небо + солнце снаружи, светит в комнату сквозь проём
  scene.add(new THREE.HemisphereLight('#e3ecf2', '#9d9a95', .42));
  const sun = new THREE.DirectionalLight('#fff3e4', 5.2);
  sun.position.set(-6, 5.2, -8); sun.target.position.set(1.5, 0, 3.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .02; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fill = new THREE.PointLight('#fff8f0', 4, 10, 2); fill.position.set(0, 2.6, 5); scene.add(fill);

  let room = null, parts = null, state = null, yaw = 0, pitch = 0, yawT = 0, pitchT = 0, dist = 6;

  function build(width, height) {
    if (room) { scene.remove(room); room.traverse(o => o.geometry && o.geometry.dispose()); }
    room = new THREE.Group(); scene.add(room);
    const W = width / 1000, H = height / 1000, RW = W + 3.6, D = 8, RH = 2.95, T = .3;
    // задняя стена с проёмом
    const sideW = (RW - W) / 2;
    const wl = box(sideW, RH, T, M.wall); wl.position.set(-W / 2 - sideW / 2, RH / 2, -T / 2);
    const wr = box(sideW, RH, T, M.wall); wr.position.set(W / 2 + sideW / 2, RH / 2, -T / 2);
    const wt = box(W, RH - H, T, M.wall); wt.position.set(0, H + (RH - H) / 2, -T / 2);
    room.add(wl, wr, wt);
    // стены, пол, потолок
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, D), M.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, D / 2); floor.receiveShadow = true;
    M.floor.map.repeat.set(RW / 1.6, D / 1.6); room.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, D), M.ceil); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, RH, D / 2); room.add(ceil);
    [-1, 1].forEach(s => { const w = box(T, RH, D, M.side, true, true); w.position.set(s * (RW / 2 + T / 2), RH / 2, D / 2); room.add(w); });
    for (let k = -1; k <= 1; k++) for (let z = 1.4; z < D - .5; z += 2.2) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(.06, 20), M.light); l.rotation.x = Math.PI / 2; l.position.set(k * RW / 3.4, RH - .005, z); room.add(l);
    }
    // терраса снаружи
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(RW + 6, 5), M.deck);
    deck.rotation.x = -Math.PI / 2; deck.position.set(0, -.03, -T - 2.5); deck.receiveShadow = true; M.deck.map.repeat.set((RW + 6) / 1.4, 5 / 1.4); room.add(deck);

    // рама портала
    const P = .07, TH = .025, fz = -T * .45;
    const ft = box(W, P, .2, M.alu); ft.position.set(0, H - P / 2, fz);
    const fl = box(P, H, .2, M.alu); fl.position.set(-W / 2 + P / 2, H / 2, fz);
    const fr = box(P, H, .2, M.alu); fr.position.set(W / 2 - P / 2, H / 2, fz);
    const fb = box(W, TH, .22, M.alu); fb.position.set(0, TH / 2, fz);
    room.add(ft, fl, fr, fb);

    // мебель по краям, чтобы не закрывать портал
    // мебели минимум: ковёр, растение, торшер — главное здесь дверь, вид и свет
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), M.rug); rug.rotation.x = -Math.PI / 2; rug.position.set(-.3, .004, 3.4); rug.receiveShadow = true; room.add(rug);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.22, .17, .5, 24), M.wood); pot.position.set(RW / 2 - .5, .25, 1.1); pot.castShadow = true; room.add(pot);
    for (let k = 0; k < 26; k++) { // вытянутые листья вверх-наружу
      const a = k * 2.4, r = .05 + (k % 4) * .03, hgt = .55 + (k % 6) * .1;
      const l = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), M.leaf);
      l.scale.set(1, 5 + (k % 3), .35);
      l.position.set(RW / 2 - .5 + Math.cos(a) * r * 2.2, hgt + .25, 1.1 + Math.sin(a) * r * 2.2);
      l.rotation.set(Math.sin(a) * .5, a, Math.cos(a) * .5); l.castShadow = true; room.add(l);
    }
    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 1.6, 8), M.wood); lampPole.position.set(-W / 2 - 1.5, .8, 2.2);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(.12, .22, .26, 24, 1, true), M.fabricDark); shade.position.set(-W / 2 - 1.5, 1.65, 2.2);
    room.add(lampPole, shade);

    // створки
    const leaves = [];
    parts = { W, H, D, RW, P, TH, fz, leaves };
    dist = D - .35;
    frame();
  }

  function makeLeaf(w, h, lead, leadRight) {
    const g = new THREE.Group(), p = .075, d = .06;
    const t = box(w, p, d, M.alu), b = box(w, p, d, M.alu), l = box(p, h, d, M.alu), r = box(p, h, d, M.alu);
    t.position.y = h / 2 - p / 2; b.position.y = -h / 2 + p / 2; l.position.x = -w / 2 + p / 2; r.position.x = w / 2 - p / 2;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w - p * 2, h - p * 2, .02), M.glass); glass.castShadow = false; glass.receiveShadow = false;
    g.add(t, b, l, r, glass);
    if (lead) {
      const hd = box(.024, .38, .035, M.handle); hd.position.set(leadRight ? w / 2 - p - .06 : -w / 2 + p + .06, 0, .05); g.add(hd);
    }
    return g;
  }

  function place() {
    if (!parts || !state) return;
    const { W, H, P, TH, fz, leaves } = parts, v = state.variant, n = v.sections;
    if (leaves.length !== n || leaves.key !== state.key) {
      leaves.forEach(l => room.remove(l)); leaves.length = 0; leaves.key = state.key;
      const iw = W - P * 2, lw = iw / n + .04, lh = H - P - TH;
      const leadIdx = state.key === 'center' ? [1, 2] : [state.key === 'left' ? Math.max(...v.moving) : Math.min(...v.moving)];
      for (let i = 0; i < n; i++) {
        const lead = leadIdx.includes(i);
        const leadRight = state.key === 'left' || (state.key === 'center' && i === Math.min(...v.moving));
        const l = makeLeaf(lw, lh, lead, leadRight); l.userData.i = i; leaves.push(l); room.add(l);
      }
    }
    const iw = W - P * 2, step = iw / n, p = state.progress, lift = Math.min(1, p / .08) * .008;
    leaves.forEach(l => {
      const i = l.userData.i, mi = v.moving.indexOf(i), base = -W / 2 + P + step * i + step / 2;
      let x = base, z = fz - .07, y = TH + (H - P - TH) / 2;
      if (mi >= 0) { x = lerp(base, -W / 2 + P + step * v.targets[mi] + step / 2, p); z = fz + .02 + mi * .065; y += lift; }
      l.position.set(x, y, z);
    });
  }

  function frame() {
    const r = canvas.getBoundingClientRect(); if (!r.width || !parts) return;
    const aspect = r.width / r.height;
    const needW = parts.W + 3.4, needH = 3.1;
    const vW = 2 * Math.atan(Math.tan(Math.atan(needW / 2 / dist)) / aspect);
    const vH = 2 * Math.atan(needH / 2 / dist);
    camera.fov = THREE.MathUtils.radToDeg(Math.max(vW, vH)); camera.aspect = aspect; camera.updateProjectionMatrix();
  }

  function render() {
    if (!parts) return;
    const cz = dist, x = Math.sin(yaw) * cz, z = Math.cos(yaw) * cz;
    camera.position.set(x, 1.32 + pitch * 3, z);
    camera.lookAt(target);
    renderer.render(scene, camera);
  }

  function resize() {
    const r = host.getBoundingClientRect(); if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    frame(); render();
  }

  // осмотреться: перетаскивание поворачивает камеру вокруг центра проёма, мягко
  let drag = null, raf = 0;
  const tick = () => {
    yaw = lerp(yaw, yawT, .18); pitch = lerp(pitch, pitchT, .18); render();
    raf = Math.abs(yaw - yawT) > .0005 || Math.abs(pitch - pitchT) > .0005 ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: yawT, pitch: pitchT }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    yawT = clamp(drag.yaw - (e.clientX - drag.x) / r.width * .9, -.38, .38);
    pitchT = clamp(drag.pitch + (e.clientY - drag.y) / r.height * .15, -.06, .08);
    kick();
  });
  ['pointerup', 'pointercancel'].forEach(t => canvas.addEventListener(t, () => { drag = null; }));

  const api = {
    canvas,
    set(next) {
      const rebuild = !state || state.width !== next.width;
      state = next;
      if (rebuild) build(next.width, next.height);
      place(); render();
    },
    resize,
    reset() { yawT = 0; pitchT = 0; kick(); }
  };
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host); else addEventListener('resize', resize);
  requestAnimationFrame(() => { resize(); onReady && onReady(); });
  return api;
}
