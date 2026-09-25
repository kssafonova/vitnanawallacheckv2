#!/usr/bin/env node
// Фото вариантов из студийных рендеров: перекраска рамы в RAL каждого цвета модели,
// закрытый и открытый вид с одной точки съёмки, зеркальные схемы — отражением кадра.
//
//   node tools/recolor-photos.mjs           — все модели с полем render в data/products.json
//   node tools/recolor-photos.mjs HS2       — одна модель
//   node tools/recolor-photos.mjs --preview .check/recolor.png — плюс сводный лист для просмотра
//
// Результат: assets/images/products/<model>/<color.slug>-<scheme.slug>.webp и …-open.webp.
// После запуска — node tools/build.mjs, генератор подхватит фото сам.
//
// Как работает: рама на рендере тёмная и почти без цвета — её пиксели находятся по яркости и насыщенности,
// тон заменяется на цвет RAL, а светотень (блики, тени профиля) сохраняется. Стекло и фон не трогаются.
// Ограничение: из тёмного рендера светлые цвета (белый) выходят чуть «металлическими» — лучше светлый исходник.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const pi = args.indexOf('--preview');
const preview = pi >= 0 ? path.resolve(args.splice(pi, 2)[1]) : null;
const only = args[0];

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return import(pathToFileURL(path.join(globalRoot, 'playwright', 'index.mjs')).href);
}

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/products.json'), 'utf8'));
const mirrored = code => /(^B\d|-R)$/.test(code);
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

const jobs = [];
for (const m of data.models) {
  if (!m.render || (only && m.model !== only)) continue;
  const base = m.schemes.find(s => s.code === m.render.scheme);
  if (!base) throw new Error(`${m.model}: схема ${m.render.scheme} из render не найдена`);
  for (const s of m.schemes) {
    // Та же схема — как есть; зеркальная пара — отражение; другая раскладка створок из этого рендера не получится
    // render.flip — рендер снят зеркально относительно схемы render.scheme (например, активные створки не с той стороны)
    const flip = (s.code !== base.code && mirrored(s.code) !== mirrored(base.code)) !== !!m.render.flip;
    if (s.code !== base.code && mirrored(s.code) === mirrored(base.code)) { console.log(`пропуск ${m.model} ${s.code}: на рендере другая раскладка`); continue; }
    for (const c of m.colors) {
      // open можно не указывать: если открытый кадр не соответствует схеме, лучше без него, чем с неверным
      for (const state of ['closed', 'open'].filter(st => m.render[st])) {
        jobs.push({
          src: m.render[state], flip, rgb: hexRgb(c.hex),
          // render.align — открытый кадр снят с другой точки: выравниваем его по раме закрытого
          ref: state === 'open' && m.render.align ? m.render.closed : null,
          out: `assets/images/products/${m.model.toLowerCase()}/${c.slug}-${s.slug}${state === 'open' ? '-open' : ''}.webp`,
          label: `${m.code} ${c.name} ${s.code} ${state === 'open' ? 'открыто' : 'закрыто'}`,
        });
      }
    }
  }
}
if (!jobs.length) { console.log('Нет моделей с полем render.'); process.exit(0); }

// Выполняется в браузере: [выравнивание по раме] → [отражение] → перекраска → формат 4:5. Результат — webp.
async function recolor({ src, ref, rgb, flip }) {
  const load = u => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = u; });
  const pixels = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
  // Углы рамы: крайние тёмные малонасыщенные пиксели по диагоналям (рама — плоский прямоугольник в перспективе)
  const corners = d => {
    const { width: W, height: H, data: a } = d;
    let tl = [0, 0, 1e9], tr = [0, 0, -1e9], br = [0, 0, -1e9], bl = [0, 0, 1e9];
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4, r = a[i], g = a[i + 1], b = a[i + 2];
      if ((r * .299 + g * .587 + b * .114) / 255 > .33 || Math.max(r, g, b) - Math.min(r, g, b) > 45) continue;
      if (x + y < tl[2]) tl = [x, y, x + y];
      if (x - y > tr[2]) tr = [x, y, x - y];
      if (x + y > br[2]) br = [x, y, x + y];
      if (x - y < bl[2]) bl = [x, y, x - y];
    }
    return [tl, tr, br, bl].map(p => [p[0], p[1]]);
  };
  // Гомография по 4 парам точек (решение 8×8 методом Гаусса): from → to
  const homography = (from, to) => {
    const A = [], B = [];
    from.forEach(([x, y], k) => {
      const [u, v] = to[k];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
    });
    for (let i = 0; i < 8; i++) {
      let mx = i; for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r;
      [A[i], A[mx]] = [A[mx], A[i]]; [B[i], B[mx]] = [B[mx], B[i]];
      for (let r = 0; r < 8; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c]; B[r] -= f * B[i]; }
    }
    return B.map((b, i) => b / A[i][i]).concat(1);
  };

  const img = await load(src);
  let base = pixels(img);
  let info = null;
  if (ref) {
    const target = pixels(await load(ref));
    const cDst = corners(target), cSrc = corners(base);
    const h = homography(cDst, cSrc);            // для каждого пикселя результата — где он в исходном кадре
    const W = target.width, H = target.height, out = new ImageData(W, H), s = base.data, SW = base.width, SH = base.height;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const w = h[6] * x + h[7] * y + 1;
      let u = (h[0] * x + h[1] * y + h[2]) / w, v = (h[3] * x + h[4] * y + h[5]) / w;
      u = Math.min(SW - 1.001, Math.max(0, u)); v = Math.min(SH - 1.001, Math.max(0, v));
      const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0, o = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const p = (yy, xx) => s[(yy * SW + xx) * 4 + ch];
        out.data[o + ch] = (p(y0, x0) * (1 - fx) + p(y0, x0 + 1) * fx) * (1 - fy) + (p(y0 + 1, x0) * (1 - fx) + p(y0 + 1, x0 + 1) * fx) * fy;
      }
      out.data[o + 3] = 255;
    }
    base = out;
    info = { dst: cDst, src: cSrc };
  }

  const c = document.createElement('canvas');
  c.width = base.width; c.height = base.height;
  const x = c.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = base.width; tmp.height = base.height; tmp.getContext('2d').putImageData(base, 0, 0);
  if (flip) { x.translate(c.width, 0); x.scale(-1, 1); }
  x.drawImage(tmp, 0, 0);
  x.setTransform(1, 0, 0, 1, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
  const [r0, g0, b0] = rgb;
  const light = (r0 * .299 + g0 * .587 + b0 * .114) / 255 > .5;
  // Светлым — меньше контраст светотени и шире маска (захватывает тёмную кайму на краю профиля), иначе «металл»
  const lo = light ? .74 : .55, span = light ? .28 : .9, top = light ? .6 : .42, soft = light ? .26 : .18;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i], g = a[i + 1], b = a[i + 2];
    const l = (r * .299 + g * .587 + b * .114) / 255;
    if (Math.max(r, g, b) - Math.min(r, g, b) >= 40) continue;   // цветные пиксели — не рама
    const m = Math.max(0, Math.min(1, (top - l) / soft));        // мягкая маска по яркости: край рамы сглажен
    if (!m) continue;
    const k = lo + span * Math.min(1, l / .42);                   // светотень профиля
    a[i] = r + (Math.min(255, r0 * k) - r) * m;
    a[i + 1] = g + (Math.min(255, g0 * k) - g) * m;
    a[i + 2] = b + (Math.min(255, b0 * k) - b) * m;
  }
  x.putImageData(d, 0, 0);

  // Горизонтальный кадр → 4:5, как у остальных фото, чтобы в квадратной карточке рама не обрезалась по бокам.
  // Поле сверху и снизу: крайняя строка кадра плавно переходит в её средний цвет — без полос и швов
  let result = c;
  if (c.width > c.height) {
    const W = c.width, H = c.height, H2 = Math.round(W * 1.25), pad = Math.round((H2 - H) / 2);
    const out = document.createElement('canvas'); out.width = W; out.height = H2;
    const o = out.getContext('2d');
    o.drawImage(c, 0, pad);
    const src = x.getImageData(0, 0, W, H).data;
    const fill = (row, y0, rows, towardEdge) => {
      const line = [], avg = [0, 0, 0];
      for (let i = 0; i < W; i++) for (let ch = 0; ch < 3; ch++) { const v = src[(row * W + i) * 4 + ch]; line.push(v); avg[ch] += v / W; }
      const img = o.createImageData(W, rows);
      for (let yy = 0; yy < rows; yy++) {
        const dist = towardEdge ? rows - yy : yy + 1;                 // расстояние от кадра в строках
        const t = Math.min(1, dist / (pad * .35));                    // полосы гаснут на первой трети поля
        for (let i = 0; i < W; i++) for (let ch = 0; ch < 3; ch++) img.data[(yy * W + i) * 4 + ch] = line[i * 3 + ch] * (1 - t) + avg[ch] * t;
        for (let i = 0; i < W; i++) img.data[(yy * W + i) * 4 + 3] = 255;
      }
      o.putImageData(img, 0, y0);
    };
    fill(0, 0, pad, true);
    fill(H - 1, pad + H, H2 - pad - H, false);
    result = out;
  }
  return { url: result.toDataURL('image/webp', .86), info };
}

const { chromium } = await loadPlaywright();
const launch = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
const browser = await chromium.launch(launch);
const page = await browser.newPage();
const cache = new Map();
const dataUrl = f => {
  if (!cache.has(f)) cache.set(f, 'data:image/webp;base64,' + fs.readFileSync(path.join(ROOT, f)).toString('base64'));
  return cache.get(f);
};
const done = [];
for (const j of jobs) {
  const { url, info } = await page.evaluate(recolor, { src: dataUrl(j.src), ref: j.ref ? dataUrl(j.ref) : null, rgb: j.rgb, flip: j.flip });
  if (info && !done.some(d => d.src === j.src)) console.log(`  выравнивание по раме: углы ${JSON.stringify(info.src)} → ${JSON.stringify(info.dst)}`);
  const file = path.join(ROOT, j.out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  done.push({ ...j, url });
  console.log(`✓ ${j.out}  (${j.label})`);
}
// Удаляем старые файлы в папках обработанных моделей, которых нет в этом запуске (например, снятый открытый вид)
const produced = new Set(done.map(j => path.join(ROOT, j.out)));
for (const dir of new Set([...produced].map(f => path.dirname(f)))) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (f.endsWith('.webp') && !produced.has(full)) { fs.rmSync(full); console.log(`удалён ${path.relative(ROOT, full)}`); }
  }
}
if (preview) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.setContent('<body style="margin:0;display:grid;grid-template-columns:repeat(8,1fr);gap:4px;font:11px sans-serif;background:#fff">' +
    done.map(j => `<figure style="margin:0"><img src="${j.url}" style="width:100%"><figcaption>${j.label}</figcaption></figure>`).join('') + '</body>');
  await page.waitForTimeout(300);
  fs.mkdirSync(path.dirname(preview), { recursive: true });
  await page.screenshot({ path: preview, fullPage: true });
  console.log('Сводный лист: ' + path.relative(ROOT, preview));
}
await browser.close();
console.log(`\nГотово: ${done.length} файлов. Дальше: node tools/build.mjs`);
