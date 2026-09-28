#!/usr/bin/env node
// Статичная схема «Персональной карты остекления»: рендер общего вида 3D-дома (assets/js/glazing-map/scene3d.js)
// в assets/images/glazing-map-house-fallback.webp и координаты меток и контуров зон в assets/js/glazing-map/fallback-geometry.js.
// Схема — постер до загрузки 3D и запасной режим (нет WebGL, prefers-reduced-motion, медленная сеть).
// Запускать после любой правки дома или камеры общего вида в scene3d.js:
//
//   node tools/glazing-fallback.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 1600, H = 1200; // кадр 4:3 — как у сцены на странице
const OUT_IMG = 'assets/images/glazing-map-house-fallback.webp';
const OUT_JS = 'assets/js/glazing-map/fallback-geometry.js';

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return import(pathToFileURL(path.join(globalRoot, 'playwright', 'index.mjs')).href);
}

const HARNESS = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}#h{width:${W}px;height:${H}px}</style><div id="h"></div>
<script type="module">
import { createScene } from '/assets/js/glazing-map/scene3d.js';
const s = createScene(document.getElementById('h'), { reducedMotion: true, poster: true });
s.setSelectedZones([]);
requestAnimationFrame(() => requestAnimationFrame(() => {
  window.RESULT = { img: s.snapshot('image/webp', 0.86), anchors: s.anchors(), outlines: s.outlines() };
}));
</script>`;

const TYPES = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/__fallback__') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(HARNESS); return; }
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const { chromium } = await loadPlaywright();
const exe = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error(e.message); process.exitCode = 1; });
await page.goto(`http://127.0.0.1:${server.address().port}/__fallback__`);
await page.waitForFunction(() => window.RESULT, null, { timeout: 60000 });
const r = await page.evaluate(() => window.RESULT);
await browser.close(); server.close();

fs.writeFileSync(path.join(ROOT, OUT_IMG), Buffer.from(r.img.split(',')[1], 'base64'));
const round = v => Math.round(v * 10000) / 10000;
const anchors = Object.fromEntries(Object.entries(r.anchors).map(([k, a]) => [k, { x: round(a.x), y: round(a.y) }]));
const outlines = Object.fromEntries(Object.entries(r.outlines).map(([k, pts]) => [k, pts.map(([x, y]) => [round(x), round(y)])]));
fs.writeFileSync(path.join(ROOT, OUT_JS), `/* Собрано tools/glazing-fallback.mjs — руками не править. Метки и контуры зон на статичной схеме
   (${OUT_IMG}, кадр ${W} × ${H}), доли ширины и высоты. */
export const FALLBACK = ${JSON.stringify({ width: W, height: H, anchors, outlines })};
`);
console.log(`${OUT_IMG} — ${Math.round(fs.statSync(path.join(ROOT, OUT_IMG)).size / 1024)} КБ\n${OUT_JS}`);
