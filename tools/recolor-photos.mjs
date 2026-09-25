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
    const flip = s.code !== base.code && mirrored(s.code) !== mirrored(base.code);
    if (s.code !== base.code && !flip) { console.log(`пропуск ${m.model} ${s.code}: на рендере другая раскладка`); continue; }
    for (const c of m.colors) {
      for (const state of ['closed', 'open']) {
        jobs.push({
          src: m.render[state], flip, rgb: hexRgb(c.hex),
          out: `assets/images/products/${m.model.toLowerCase()}/${c.slug}-${s.slug}${state === 'open' ? '-open' : ''}.webp`,
          label: `${m.code} ${c.name} ${s.code} ${state === 'open' ? 'открыто' : 'закрыто'}`,
        });
      }
    }
  }
}
if (!jobs.length) { console.log('Нет моделей с полем render.'); process.exit(0); }

// Выполняется в браузере: перекраска на canvas, результат — webp
async function recolor({ src, rgb, flip }) {
  const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  if (flip) { x.translate(c.width, 0); x.scale(-1, 1); }
  x.drawImage(img, 0, 0);
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
  return c.toDataURL('image/webp', .86);
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
  const url = await page.evaluate(recolor, { src: dataUrl(j.src), rgb: j.rgb, flip: j.flip });
  const file = path.join(ROOT, j.out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  done.push({ ...j, url });
  console.log(`✓ ${j.out}  (${j.label})`);
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
