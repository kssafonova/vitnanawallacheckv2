#!/usr/bin/env node
// Полноэкранные постеры «Персональной карты остекления»: рендер общего вида 3D-дома (assets/js/glazing-map/scene3d.js) —
// горизонтальный 1920 × 1080 (assets/images/glazing-map-house.webp) и вертикальный 900 × 1600 (…-m.webp) — и координаты
// меток и контуров зон для каждого в assets/js/glazing-map/fallback-geometry.js.
// Постер стоит до загрузки 3D и остаётся в запасном режиме (нет WebGL, prefers-reduced-motion, медленная сеть).
// Запускать после любой правки дома или камеры общего вида в scene3d.js:
//
//   node tools/glazing-fallback.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = { land: { w: 1920, h: 1080, out: 'assets/images/glazing-map-house.webp' }, port: { w: 900, h: 1600, out: 'assets/images/glazing-map-house-m.webp' } };
const OUT_JS = 'assets/js/glazing-map/fallback-geometry.js';

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return import(pathToFileURL(path.join(globalRoot, 'playwright', 'index.mjs')).href);
}

const HARNESS = (mode, W, H) => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}#h{width:${W}px;height:${H}px}</style><div id="h"></div>
<script type="module">
import { createScene } from '/assets/js/glazing-map/scene3d.js';
const s = createScene(document.getElementById('h'), { reducedMotion: true, poster: '${mode}' });
s.setSelectedZones([]);
requestAnimationFrame(() => requestAnimationFrame(() => {
  window.RESULT = { img: s.snapshot('image/webp', 0.82), anchors: s.anchors(), outlines: s.outlines() };
}));
</script>`;

const TYPES = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const m = p.match(/^\/__fallback__\/(land|port)$/);
  if (m) { const c = SHOTS[m[1]]; res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(HARNESS(m[1], c.w, c.h)); return; }
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const { chromium } = await loadPlaywright();
const exe = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const round = v => Math.round(v * 10000) / 10000;
const geo = {};
for (const [mode, c] of Object.entries(SHOTS)) {
  const page = await browser.newPage({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error(e.message); process.exitCode = 1; });
  await page.goto(`http://127.0.0.1:${server.address().port}/__fallback__/${mode}`);
  await page.waitForFunction(() => window.RESULT, null, { timeout: 90000 });
  const r = await page.evaluate(() => window.RESULT);
  await page.close();
  fs.writeFileSync(path.join(ROOT, c.out), Buffer.from(r.img.split(',')[1], 'base64'));
  geo[mode] = { width: c.w, height: c.h,
    anchors: Object.fromEntries(Object.entries(r.anchors).map(([k, a]) => [k, { x: round(a.x), y: round(a.y) }])),
    outlines: Object.fromEntries(Object.entries(r.outlines).map(([k, pts]) => [k, pts.map(([x, y]) => [round(x), round(y)])])) };
  console.log(`${c.out} — ${Math.round(fs.statSync(path.join(ROOT, c.out)).size / 1024)} КБ`);
}
await browser.close(); server.close();
fs.writeFileSync(path.join(ROOT, OUT_JS), `/* Собрано tools/glazing-fallback.mjs — руками не править. Метки и контуры зон на постерах
   (land — ${SHOTS.land.out}, port — ${SHOTS.port.out}), доли ширины и высоты кадра. */
export const FALLBACK = ${JSON.stringify(geo)};
`);
console.log(OUT_JS);
