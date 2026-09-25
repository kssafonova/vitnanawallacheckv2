#!/usr/bin/env node
// Проверка сайта в Chromium через Playwright.
// Страницы берутся из sitemap.xml (+ пути из аргументов), ширины — 360/390/768/1280/1920.
// Проверяем: ошибки в консоли и 404 локальных файлов, горизонтальная прокрутка, текст мельче 11 px.
//
//   node tools/check-site.mjs                  — все страницы из sitemap.xml
//   node tools/check-site.mjs /cart/ /about/   — только эти страницы
//   node tools/check-site.mjs --shots .check   — плюс скриншоты во всю страницу в папку .check
//
// Выход с кодом 1, если есть нарушения.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTHS = [360, 390, 768, 1280, 1920];
const MIN_FONT = 11;

const args = process.argv.slice(2);
let shotsDir = null;
const paths = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--shots') shotsDir = path.resolve(args[++i]);
  else paths.push(args[i]);
}

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return import(pathToFileURL(path.join(globalRoot, 'playwright', 'index.mjs')).href);
}

function sitemapPaths() {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.yml': 'text/yaml' };

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

// Выполняется в браузере: мелкий текст (с учётом масштаба SVG) и горизонтальная прокрутка
function inspect(minFont) {
  const small = [];
  const visible = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!hasText || !visible(el)) continue;
    let size = parseFloat(getComputedStyle(el).fontSize);
    if (!size) continue; // font-size:0 — приём скрытия, не текст
    if (el instanceof SVGElement && el.ownerSVGElement) {
      const m = el.getScreenCTM();
      if (m) size *= Math.hypot(m.a, m.b);
    }
    if (size < minFont - 0.05) {
      const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
      small.push(`${size.toFixed(1)}px <${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}> «${text}»`);
    }
  }
  const doc = document.documentElement;
  return { small: [...new Set(small)], hscroll: doc.scrollWidth > doc.clientWidth + 1 ? doc.scrollWidth - doc.clientWidth : 0 };
}

const { chromium } = await loadPlaywright();
const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const list = paths.length ? paths : sitemapPaths();
const launch = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
const browser = await chromium.launch(launch);
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

let failures = 0;
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  let errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('js: ' + e.message));
  page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) errors.push(`${r.status()}: ${r.url().slice(origin.length)}`); });
  for (const p of list) {
    errors = [];
    await page.goto(origin + p, { waitUntil: 'networkidle' });
    // Прокрутка до конца: запускает появление блоков [data-reveal] и ленивые картинки
    await page.evaluate(async () => {
      document.documentElement.style.scrollBehavior = 'auto';
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); }
      scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const res = await page.evaluate(inspect, MIN_FONT);
    const problems = [...errors];
    if (res.hscroll) problems.push(`горизонтальная прокрутка: +${res.hscroll}px`);
    for (const s of res.small) problems.push('мелкий текст ' + s);
    if (shotsDir) {
      const name = (p.replace(/^\/|\/$/g, '').replace(/\//g, '__') || 'home') + `-${width}.png`;
      await page.screenshot({ path: path.join(shotsDir, name), fullPage: true });
    }
    console.log(`${problems.length ? '✗' : '✓'} ${width}px ${p}`);
    for (const pr of problems) console.log('    ' + pr);
    if (problems.length) failures++;
  }
  await page.close();
}
await browser.close();
server.close();
console.log(failures ? `\nНарушений: ${failures} (страница × ширина)` : '\nВсё чисто.');
process.exit(failures ? 1 : 0);
