#!/usr/bin/env node
// Генератор каталога PORTAL SYSTEMS. Единственный источник данных — data/products.json.
//
//   node tools/build.mjs          собрать всё
//   node tools/build.mjs --check  ничего не писать; код 1, если файлы на диске устарели
//
// Что собирает:
//   catalog/<cat>/<slug>/index.html   страницы всех вариантов (модель × размер × цвет × схема), всё в HTML
//   блоки между <!-- build:имя --> и <!-- /build:имя --> в catalog/index.html, systems/hs/index.html, index.html
//   sitemap.xml
// Папки catalog/hs-portaly и catalog/fs-portaly принадлежат генератору: лишние варианты удаляются.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = f => fs.existsSync(path.join(ROOT, f));

const data = JSON.parse(read('data/products.json'));
// Правила калькулятора по ТЗ (цена за м², коэффициенты, чистый проход, стекло) — тот же файл, что в браузере
const PORTAL = (() => { const ctx = { Intl }; vm.runInNewContext(read('assets/js/portal-calc.js'), ctx); return ctx.PSPortal; })();
const config = JSON.parse(read('data/site-config.json'));
const SITE = (config.site_url || 'https://www.portal-systems.ru').replace(/\/$/, '') + '/';
const BRAND = config.brand || 'PORTAL SYSTEMS';

// ---------- утилиты ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nbsp = '\u00a0';
const money = n => new Intl.NumberFormat('ru-RU').format(n).replace(/\s/g, nbsp) + nbsp + '₽';
const fmtN = n => new Intl.NumberFormat('ru-RU').format(n).replace(/\s/g, nbsp);
const metres = w => (w / 1000).toFixed(1).replace('.', ',');                          // 3600 → 3,6
// Высоты стандартной двери (heights) — одна цена, точную уточняем на замере: «3600 × 2300/2400 мм»
const sizeText = m => `${m.width} × ${(m.heights || [m.height]).join('/')} мм`;
const profileSlug = m => m.profile.toLowerCase().replace(/[^a-z0-9]+/g, '-');           // ALUMARK S158 → alumark-s158
const profileCode = m => m.profile.split(' ').pop();                                    // S158
const schemeText = s => s.label.replace(/^Схема\s+[A-Z0-9-]+\s*·\s*/i, '');             // без «Схема A1 · »
const mirrored = s => /(^B\d|-R)$/.test(s.code);
// HS/3 секции (D-L) рисуем зеркально: подвижная пара справа, движение влево — так попросила владелец
const flipModel = m => m.model === 'HS3';
const isMirror = (m, s) => mirrored(s) !== flipModel(m);                                        // зеркальные схемы
const systemName = m => (m.system === 'HS' ? 'HS-порталы' : 'FS-порталы');

// ---------- варианты ----------
// Размер модели (sizes в products.json) → «модель этого размера»: ширина, код HS2/36, название «… 3,6 м»;
// цена и чистый проход — по ТЗ калькулятора (assets/js/portal-calc.js) для стандартной комплектации: стеклопакет 40 мм
// (или триплекс, если створка больше 5 м²), однотонный RAL, стандартная ручка. Остальной код работает с ней как с обычной моделью.
const portalOf = (m, z) => {
  const scheme = (m.schemes.find(s => s.code === m.default_scheme) || m.schemes[0]).code;
  const o = { type: m.system, w: z.width, h: m.height, n: m.sections, scheme, glass: 'standard', color: 'mono', handle: 'standard', extraSections: [m.sections] };
  const price = PORTAL.price(o);
  if (!price) throw new Error(`${m.model} ${z.width} мм: калькулятор не считает этот размер (portal-calc.js)`);
  return { price, passage: PORTAL.passage(m.system, z.width, m.sections, scheme), triplex: PORTAL.triplexForced(z.width, m.height, m.sections) };
};
const sized = (m, z) => ({
  ...m, ...z, ...portalOf(m, z), base: m,
  code: `${m.code_prefix}/${z.width / 100}`,
  name: `${m.name_base} ${metres(z.width)} м`,
  leaf: Math.round(z.width / m.sections),
  glass: PORTAL.triplexForced(z.width, m.height, m.sections) ? 'Триплекс закалённый — обязателен: створка больше 5 м²' : m.glass,
  frame_depth: `${PORTAL.frameDepth(m.system, m.sections, (m.schemes.find(s => s.code === m.default_scheme) || m.schemes[0]).code)} мм`,
  opening: (p => `≈ ${fmtN(p)} мм · ${Math.round(p / z.width * 100)}% проёма`)(portalOf(m, z).passage),
});
const sizesOf = m => m.sizes.map(z => sized(m, z));
const defSize = m => sizesOf(m).find(x => x.width === m.default_width) || sizesOf(m)[0];
const missingPhotos = [];
const variants = [];
// Фото варианта: assets/images/products/<model>/<цвет>-<схема>.webp (+ -open.webp — открытый вид), одни на все размеры модели;
// их делает tools/recolor-photos.mjs из студийного рендера. Нет фото — общее фото модели.
for (const base of data.models) {
  for (const m of sizesOf(base)) {
    for (const c of m.colors) {
      for (const s of m.schemes) {
        const slug = `${profileSlug(m)}-${m.width}x${m.height}-${c.slug}-${s.slug}`;
        const photo = `assets/images/products/${m.model.toLowerCase()}/${c.slug}-${s.slug}.webp`;
        const photoOpen = photo.replace(/\.webp$/, '-open.webp');
        const hasPhoto = exists(photo);
        if (!hasPhoto && !missingPhotos.some(x => x.startsWith(photo))) missingPhotos.push(`${photo}  — ${m.model}, ${c.name} RAL ${c.ral}, ${s.code}`);
        variants.push({
          m, c, s,
          sku: `STD-${m.model}-${profileCode(m)}-${m.width}X${m.height}-${c.ral}-${s.code}`,
          path: `catalog/${m.cat}/${slug}/`,
          image: hasPhoto ? photo : m.image,
          imageOpen: hasPhoto && exists(photoOpen) ? photoOpen : null,
          available: m.status === 'available',
        });
      }
    }
  }
}
const byModel = model => variants.filter(v => v.m.model === model);
const find = (model, colorSlug, schemeSlug, width) => variants.find(v => v.m.model === model && v.c.slug === colorSlug && v.s.slug === schemeSlug && (!width || v.m.width === width));
// Схема по умолчанию: default_scheme в products.json, иначе первая; размер — default_width
const defScheme = m => m.schemes.find(s => s.code === m.default_scheme) || m.schemes[0];
const firstOf = m => find(m.model, m.colors[0].slug, defScheme(m).slug, defSize(m).width);

// ---------- схемы (SVG) ----------
// Мелкая схема в углу фото: без текста. Рисуем створки прямоугольниками:
// подвижные светлее, стрелка движения — акцентным цветом. Стили — .scheme-mini в components.css.
function smallSvg(m, s) {
  const W = 100, X0 = 5, X1 = 95, Y0 = 5, Y1 = 51, GAP = 1.6;
  const kinds = { HS2: ['move', 'fix'], HS3: ['move', 'move', 'fix'], HS4: ['fix', 'move', 'move', 'fix'],
                  FS3: ['fold', 'fold', 'fold'], FS4: ['fold', 'fold', 'fold', 'move'] }[m.model];
  const n = kinds.length, pw = (X1 - X0 - GAP * (n - 1)) / n;
  const px = i => X0 + i * (pw + GAP);
  const r = v => Math.round(v * 10) / 10;
  let panes = kinds.map((k, i) => `<rect class="sm-pane${k === 'fix' ? '' : ' is-move'}" x="${r(px(i))}" y="${Y0}" width="${r(pw)}" height="${Y1 - Y0}"/>`).join('');
  // ручки — на замковой стойке: у внешнего края ведущей створки или в центре при открывании от центра
  const handles = { HS2: [[0, 'l']], HS3: [[0, 'l']], HS4: [[1, 'r'], [2, 'l']], FS3: [], FS4: [[3, 'l']] }[m.model];
  panes += handles.map(([i, side]) => { const x = r(side === 'l' ? px(i) + 4 : px(i) + pw - 4); return `<line class="sm-handle" x1="${x}" y1="24" x2="${x}" y2="32"/>`; }).join('');
  const arrow = (x1, x2, y = 42) => {
    const d = x2 > x1 ? -4 : 4;
    return `<path class="sm-arrow" d="M${r(x1)} ${y}H${r(x2)}M${r(x2 + d)} ${y - 3.5}L${r(x2)} ${y}L${r(x2 + d)} ${y + 3.5}"/>`;
  };
  let marks = '';
  if (m.model === 'HS2') marks = arrow(px(0) + 8, px(1) + pw * 0.55);
  else if (m.model === 'HS3') marks = arrow(px(0) + 8, px(2) + pw * 0.55);
  else if (m.model === 'HS4') marks = arrow(px(1) + pw * 0.8, px(0) + pw * 0.35) + arrow(px(2) + pw * 0.2, px(3) + pw * 0.65);
  else {
    // складные: зигзаг сложения и стрелка к краю
    const z = [0, 1, 2].map(i => `${r(px(i))} ${i % 2 ? Y1 - 6 : Y0 + 6}L${r(px(i) + pw)} ${i % 2 ? Y0 + 6 : Y1 - 6}`).join('L');
    marks = `<path class="sm-fold" d="M${z}"/>` + arrow(px(2) + pw * 0.7, px(0) + pw * 0.3, Y1 - 4);
  }
  let body = panes + marks;
  if (isMirror(m, s)) body = `<g transform="translate(${W} 0) scale(-1 1)">${body}</g>`;
  return `<svg class="scheme-mini" viewBox="0 0 100 56"><rect class="sm-frame" x="2.5" y="2.5" width="95" height="51"/>${body}</svg>`;
}

// Большой чертёж. Подписи — font-size="24" в единицах viewBox:
// при самой узкой ширине чертежа (≈320 px из 680) это ≈11.3 px на экране.
function largeSvg(m, s) {
  const W = 680, L = 38, R = 642;
  const frame = `<rect x="${L}" y="44" width="${R - L}" height="232"/>`;
  const cols = n => Array.from({ length: n - 1 }, (_, i) => L + ((R - L) / n) * (i + 1));
  const mid = (n, i) => L + ((R - L) / n) * (i + 0.5);
  let body = '', labels = [];
  if (m.system === 'HS') {
    const n = m.sections;
    body = cols(n).map(x => `<line x1="${x}" y1="44" x2="${x}" y2="276"/>`).join('');
    const kinds = { HS2: ['ACTIVE', 'FIX'], HS3: ['ACTIVE', 'ACTIVE', 'FIX'], HS4: ['FIX', 'ACTIVE', 'ACTIVE', 'FIX'] }[m.model];
    labels = kinds.map((t, i) => ({ x: mid(n, i), t }));
    if (m.model === 'HS2') body += '<path d="M120 190H270m-22-18 22 18-22 18"/>';
    if (m.model === 'HS3') body += '<path d="M110 190H410m-22-18 22 18-22 18"/>';
    if (m.model === 'HS4') body += '<path d="M320 190H210m22-18-22 18 22 18M360 190h110m-22-18 22 18-22 18"/>';
  } else if (m.model === 'FS3') {
    body = '<path d="M130 72l95 88-95 88M225 72l95 88-95 88M320 72l95 88-95 88"/>';
  } else {
    body = '<path d="M105 72l85 88-85 88M190 72l85 88-85 88M275 72l85 88-85 88"/><line x1="500" y1="44" x2="500" y2="276"/>';
  }
  if (isMirror(m, s)) {
    body = `<g transform="translate(${W} 0) scale(-1 1)">${body}</g>`;
    labels = labels.map(l => ({ ...l, x: W - l.x })).reverse();
  }
  const text = labels.map(l => `<text x="${l.x}" y="132" font-size="24" text-anchor="middle">${l.t}</text>`).join('');
  const dim = `<path d="M${L} 298H${R}M${L} 290v16M${R} 290v16"/><text x="${W / 2}" y="332" font-size="24" text-anchor="middle">${m.width} мм</text>`;
  return `<svg viewBox="0 0 ${W} 340" role="img" aria-label="Схема: ${esc(s.label)}">${frame}${body}${text}${dim}</svg>`;
}

// ---------- общие куски HTML ----------
const fontPreload = base =>
  `<link rel="preload" href="${base}assets/fonts/manrope-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossorigin>\n` +
  `<link rel="preload" href="${base}assets/fonts/manrope-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>`;
const GENERATED = '<!-- Сгенерировано tools/build.mjs из data/products.json. Не редактировать вручную: правьте данные и пересобирайте. -->';
const jsonLd = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const systemHref = (m, base) => (m.system === 'HS' ? `${base}systems/hs/` : `${base}systems/fs/`);
const customHref = (m, base) => (m.system === 'HS' ? `${base}raschet/` : `${base}index.html#contact`);

// Карточка модели «как на маркетплейсе»: фото, цена, цвет и схема переключаются прямо в карточке
// (assets/js/shop.js), кнопка «В корзину». Без JS цвета и схемы — обычные ссылки на страницы вариантов.
// rel — путь от страницы до корня сайта.
// Параметры 3D-превью карточки (assets/js/card3d.js): размер, створки, куда едут, ручки, цвета RAL, зеркальность схем.
// Раскладка — как у мини-схемы smallSvg (незеркальный вид), isMirror отражает её для схемы.
const LAYOUT_3D = {
  HS2: { kinds: ['move', 'fix'], to: { 0: 1 }, handles: [[0, 'l']] },
  HS3: { kinds: ['move', 'move', 'fix'], to: { 0: 2, 1: 2 }, handles: [[0, 'l']] },
  HS4: { kinds: ['fix', 'move', 'move', 'fix'], to: { 1: 0, 2: 3 }, handles: [[1, 'r'], [2, 'l']] },
  FS3: { kinds: ['fold', 'fold', 'fold'], handles: [[2, 'r']] },
  FS4: { kinds: ['fold', 'fold', 'fold', 'swing'], handles: [[3, 'l']] },
};
const model3d = m => ({
  sys: m.system, w: m.width, h: m.height, ...LAYOUT_3D[m.model],
  colors: Object.fromEntries(m.colors.map(c => [c.slug, c.hex])),
  mirror: Object.fromEntries(m.schemes.map(s => [s.slug, isMirror(m, s)])),
});
// Срок изготовления — data/site-config.json → services.production_days_min / _max (они же в корзине через data/catalog.json)
const PROD_MIN = (config.services && config.services.production_days_min) || 30;
const PROD_MAX = (config.services && config.services.production_days_max) || 60;
const PROD_TEXT = `${PROD_MIN}–${PROD_MAX} дней`;
const sectionsText = n => `${n} ${n >= 2 && n <= 4 ? 'секции' : 'секций'}`;
// Карточка модели (как на макете владельца): 3D-превью → «размер · секции» → название → «Проём:» (ширины из таблицы размеров) →
// «Схема:» → «Цвет:» (квадраты + «любой RAL») → линия → цена «за конструкцию» → кнопка «В корзину» во всю ширину.
// Проём, схема и цвет переключаются на месте (assets/js/shop.js); без JS это обычные ссылки на страницы вариантов.
// rel — путь от страницы до корня сайта; base — модель из products.json (все размеры).
function marketCard(base, rel) {
  const first = firstOf(base), m = first.m;
  const href = v => rel + v.path;
  const soon = m.status !== 'available';
  const s0 = first.s, c0 = first.c;
  const data = byModel(m.model).map(v => ({ sku: v.sku, w: v.m.width, c: v.c.slug, s: v.s.slug, href: href(v), img: rel + v.image, open: v.imageOpen ? rel + v.imageOpen : '' }));
  const sizes = Object.fromEntries(sizesOf(base).map(z => [z.width, { t: z.name, m: `${sizeText(z)} · ${sectionsText(z.sections)}`, p: soon ? '' : money(z.price), a: `${z.code} ${z.name}, ${sizeText(z)}` }]));
  const opt = (label, body) => `<div class="m-card__opt"><span class="m-card__label">${label}:</span>${body}</div>`;
  const sizeChips = `<div class="m-card__chips">${sizesOf(base).map(z => {
    const on = z.width === m.width;
    return `<a class="m-card__chip m-card__chip--num${on ? ' is-active' : ''}" href="${href(find(m.model, c0.slug, s0.slug, z.width))}" data-size="${z.width}" data-name="${metres(z.width)} м"${on ? ' aria-current="true"' : ''}>${metres(z.width)}</a>`;
  }).join('')}</div>`;
  const schemeChips = `<div class="m-card__chips">${m.schemes.map(s => {
    const on = s === s0;
    return `<a class="m-card__chip${on ? ' is-active' : ''}" href="${href(find(m.model, c0.slug, s.slug, m.width))}" data-scheme="${s.slug}" data-name="${esc(s.short)}"${on ? ' aria-current="true"' : ''}>${esc(s.short)}</a>`;
  }).join('')}</div>`;
  const swatches = `<div class="m-card__swatches">${m.colors.map(c => {
    const on = c === c0;
    return `<a class="m-card__swatch${on ? ' is-active' : ''}" href="${href(find(m.model, c.slug, s0.slug, m.width))}" data-color="${c.slug}" data-name="${esc(c.name)} RAL ${c.ral}" style="--sw:${c.hex}" title="${esc(c.name)} RAL ${c.ral}" aria-label="Цвет ${esc(c.name)} RAL ${c.ral}"${on ? ' aria-current="true"' : ''}></a>`;
  }).join('')}<span class="m-card__ral" title="Любой цвет по каталогу RAL — посчитаем в калькуляторе">любой RAL</span></div>`;
  const price = soon
    ? '<strong>Скоро</strong><small>цена — к старту продаж</small>'
    : `<strong data-card-price>${money(m.price)}</strong><small>за конструкцию</small>`;
  const action = soon
    ? `<a class="ui-btn m-card__cart" href="${href(first)}#product-contact" data-card-link data-card-hash="#product-contact">Сообщить о старте</a>`
    : `<button class="ui-btn ui-btn--dark m-card__cart" type="button" data-add-to-cart data-sku="${first.sku}" data-cart-href="${rel}cart/">В корзину</button>`;
  return `<article class="m-card${soon ? ' m-card--soon' : ''}" data-card data-variants="${esc(JSON.stringify(data))}" data-sizes="${esc(JSON.stringify(sizes))}" data-3d="${esc(JSON.stringify(model3d(m)))}">
        <a class="m-card__media" href="${href(first)}" data-card-link>
          <img src="${rel}${first.image}" alt="${esc(sizes[m.width].a)}" loading="lazy" decoding="async" data-card-img>${first.imageOpen ? `
          <img class="m-card__open" src="${rel}${first.imageOpen}" alt="" loading="lazy" decoding="async" data-card-img-open>` : ''}
          ${soon ? '<span class="m-card__badge">Скоро в продаже</span>' : ''}
        </a>
        <div class="m-card__body">
          <p class="m-card__meta" data-card-meta>${esc(sizes[m.width].m)}</p>
          <a class="m-card__title" href="${href(first)}" data-card-link data-card-title>${esc(m.name)}</a>
          ${opt('Проём', sizeChips)}
          ${opt(esc(m.scheme_title), schemeChips)}
          ${opt('Цвет', swatches)}
          <div class="m-card__buy"><div class="m-card__price">${price}</div>${action}</div>
        </div>
      </article>`;
}

// Калькулятор HS (assets/js/quick-calc.js) живёт на отдельной странице /raschet/.
// Цены моделей по числу секций — из products.json; фото — рендеры моделей (светлая рама — если есть белый цвет).
const hsAvail = () => data.models.filter(m => m.system === 'HS' && m.status === 'available');
// Готовые двери для калькулятора (data-doors) — все размеры из таблицы. Совпали тип HS, ширина, створки, одна из стандартных
// высот (hs), схема есть у модели, стандартная комплектация (стекло по умолчанию, однотонный RAL, стандартная ручка) —
// это товар из каталога (цена каталога, срок PROD_TEXT, «В корзину»), иначе — индивидуальный заказ по формуле ТЗ.
const calcReady = rel => JSON.stringify(hsAvail().flatMap(sizesOf).sort((a, b) => a.width - b.width || a.sections - b.sections).map(m => ({
  n: m.sections, w: m.width, h: m.height, hs: m.heights, price: m.price, code: m.code, name: m.name, passage: m.passage,
  schemes: Object.fromEntries(m.schemes.map(s => { const v = find(m.model, m.colors[0].slug, s.slug, m.width); return [s.code, { sku: v.sku, url: rel + v.path, img: rel + v.image }]; })),
  def: defScheme(m).code,
})));
const calcBox = (rel, attrs = {}) => {
  const all = { doors: calcReady(rel), term: PROD_TEXT, base: rel, ...attrs };
  return `<div class="qc-root" data-quick-calc ${Object.entries(all).map(([k, v]) => `data-${k}="${esc(String(v))}"`).join(' ')}></div>`;
};
// Ссылка на калькулятор с параметрами товара (тип, размер, створки, схема)
const raschetHref = (rel, m, s) => `${rel}raschet/?type=${m.system}&amp;w=${m.width}&amp;h=${m.height}&amp;n=${m.sections}&amp;scheme=${encodeURIComponent(s.code)}&amp;from=${encodeURIComponent(`${m.code} · ${s.code}`)}`;

const ICO = {
  price: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h7"/><circle cx="18" cy="16" r="3.2"/></svg>',
  clip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5 12.3 19.2a5 5 0 0 1-7.1-7.1l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 15 12-12 6 6-12 12z"/><path d="m7 11 2 2M10 8l2 2M13 5l2 2"/></svg>',
  palette: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.2-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/></svg>',
  glass: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M11 4v16M17 4v16"/><path d="M5 4h12M5 20h12" opacity=".5"/></svg>',
  sill: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18M5 18V6h14v12"/><path d="M8 18l3-3h7" opacity=".6"/></svg>',
};

// Блок «Цена по размерам проёма» на главной и странице HS — инженерный чертёж проёма (assets/js/opening-draw.js):
// ширина и высота вводятся на размерных линиях, число створок подбирается само, цена — сразу; дальше /raschet/?w=&h=&n=.
function calcTeaser(rel, eyebrow) {
  return `<div class="qc-draw" data-open-teaser data-doors="${esc(calcReady(rel))}" data-term="${esc(PROD_TEXT)}" data-href="${rel}raschet/">
      <header class="qc-draw__head"><p class="ui-eyebrow">${esc(eyebrow)}</p><h2>Цена раздвижной двери по размерам проёма</h2><p>Введите ширину и высоту проёма — сразу покажем цену. Если размер совпадёт с готовой дверью из каталога, предложим её.</p></header>
      <div class="qc-draw__size" data-open-size></div>
      <div class="qc-draw__fig" data-open-draw></div>
      <div class="qc-draw__foot">
        <p class="qc-draw__res"><span data-od-leaves>3 створки</span><strong data-od-price>—</strong><small data-od-note>стеклопакет 40 мм, любой однотонный RAL · без доставки и монтажа</small></p>
        <a class="qc-draw__go" href="${rel}raschet/" data-od-link>Подробный расчёт <span aria-hidden="true">→</span></a>
      </div>
    </div>`;
}

// Данные конфигуратора «Как открывается дверь» на странице HS (assets/js/hs-opening.js): все размеры из таблицы
// (створки → ширина → схема), проход, как работает, ссылка и артикул варианта (цвет по умолчанию).
// key — сторона для рисунка: left — ведущая створка слева и едет вправо, right — наоборот, center — от центра.
const OPEN_LAYOUT = {
  'A-L': { key: 'left', moving: [0], targets: [1] }, 'A-R': { key: 'right', moving: [1], targets: [0] },
  'D-L': { key: 'right', moving: [1, 2], targets: [0, 0] }, 'D-R': { key: 'left', moving: [0, 1], targets: [2, 2] },
  'F-Center': { key: 'center', moving: [1, 2], targets: [0, 3] },
};
const hsxData = rel => JSON.stringify({
  start: `${hsAvail()[0].model}-${defSize(hsAvail()[0]).width}`,
  defaults: Object.fromEntries(hsAvail().map(b => [b.sections, `${b.model}-${defSize(b).width}`])),
  families: Object.fromEntries(hsAvail().flatMap(sizesOf).map(m => [`${m.model}-${m.width}`, {
    code: m.code, width: m.width, height: m.height, heights: m.heights, sections: m.sections,
    def: OPEN_LAYOUT[defScheme(m).code].key, use: m.use, note: m.note || '',
    variants: Object.fromEntries(m.schemes.map(s => {
      const L = OPEN_LAYOUT[s.code], v = find(m.model, m.colors[0].slug, s.slug, m.width);
      return [L.key, { label: s.short[0].toUpperCase() + s.short.slice(1), sections: m.sections, moving: L.moving, targets: L.targets,
        passage: m.passage, ratio: m.passage / m.width, dir: s.how, href: rel + v.path, sku: v.sku, w: m.width, s: s.slug }];
    })),
  }])),
}).replace(/</g, '\\u003c');

// Карточка «Индивидуальный расчёт» — вся карточка ведёт на страницу калькулятора
function projectCard(calcHref, id) {
  return `<a class="m-card m-card--project m-card--wide" href="${calcHref}"${id ? ` id="${id}"` : ''}>
        <span class="m-card__media">
          <svg viewBox="0 0 340 220" aria-hidden="true"><rect x="26" y="24" width="288" height="170"/><path d="M92 24v170M157 24v170M239 24v170M45 174 126 93M117 174l82-82M190 174l82-82"/></svg>
        </span>
        <span class="m-card__body">
          <span class="m-card__meta">Любой размер и комплектация</span>
          <span class="m-card__title">Индивидуальный расчёт</span>
          <span class="m-card__note">Другой размер, RAL, стекло или порог — посчитаем в калькуляторе за пару минут.</span>
          <span class="m-card__buy"><span class="ui-btn ui-btn--light m-card__cart">Рассчитать <span>→</span></span><span class="m-card__price"><strong>По расчёту</strong><small>под ваш проём</small></span></span>
        </span>
      </a>`;
}

// ---------- страница варианта ----------
function variantPage(v) {
  const { m, c, s } = v;
  const base = '../../../';
  const url = SITE + v.path;
  const size = sizeText(m);
  const soon = !v.available;
  const family = byModel(m.model);
  const colorOptions = m.colors.map(col => family.find(x => x.m.width === m.width && x.c.slug === col.slug && x.s.slug === s.slug));
  const schemeOptions = m.schemes.map(sch => family.find(x => x.m.width === m.width && x.c.slug === c.slug && x.s.slug === sch.slug));
  const sizeOptions = m.base.sizes.map(z => family.find(x => x.m.width === z.width && x.c.slug === c.slug && x.s.slug === s.slug));
  const how = [s.how, m.note].filter(Boolean).join(' ');
  const heightsText = `${(m.heights || [m.height]).join(' или ')} мм`;
  const colorName = `${c.name} RAL ${c.ral}`;
  const title = `${m.code} ${m.name} — ${size}, ${colorName} | ${BRAND}`;
  const description = `${m.title} ${size}, ${colorName}, ${s.label[0].toLowerCase() + s.label.slice(1)}. ${soon ? 'Скоро в продаже.' : `Стоимость ${money(m.price)}.`} Изготовление и монтаж в Москве и МО.`;
  const imageUrl = SITE + v.image;

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${m.name} ${m.code}, ${size}, ${colorName}, ${s.label}`,
    sku: v.sku,
    url,
    image: [imageUrl],
    description: m.lead,
    brand: { '@type': 'Brand', name: BRAND },
    category: systemName(m),
    color: colorName,
    inProductGroupWithID: m.model,
    width: { '@type': 'QuantitativeValue', value: m.width, unitCode: 'MMT' },
    height: { '@type': 'QuantitativeValue', value: m.height, unitCode: 'MMT' },
    additionalProperty: [
      ['Схема открывания', s.label], ['Конфигурация', m.subtitle], ['Профильная система', m.profile], ['Фурнитура', m.hardware],
      ['Стеклопакет', m.glass], ['Количество секций', String(m.sections)], ['Ширина створки', `${m.leaf} мм`],
      ...(m.passage ? [['Чистый проход', `≈ ${m.passage} мм`]] : []), ['Глубина рамы', m.frame_depth],
    ].map(([name, value]) => ({ '@type': 'PropertyValue', name, value })),
  };
  // «Скоро»: без Offer — цены на странице нет, заказать нельзя
  if (!soon) {
    product.offers = {
      '@type': 'Offer', url, priceCurrency: 'RUB', price: String(m.price),
      availability: 'https://schema.org/MadeToOrder', itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: BRAND },
    };
  }
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [['Главная', SITE], ['Каталог', SITE + 'catalog/'], [m.system, SITE + (m.system === 'HS' ? 'systems/hs/' : 'systems/fs/')], [m.code, url]]
      .map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
  };

  const swatches = colorOptions.map(x => `<a class="product-swatch${x === v ? ' is-active' : ''}" href="${base + x.path}"${x === v ? ' aria-current="page"' : ''}><span class="product-swatch__dot" style="--sw:${x.c.hex}"></span><span><strong>${esc(x.c.name)}</strong><small>RAL ${x.c.ral}</small></span></a>`).join('');
  const sizesHtml = sizeOptions.map(x => `<a class="product-size${x === v ? ' is-active' : ''}" href="${base + x.path}"${x === v ? ' aria-current="page"' : ''}>${metres(x.m.width)}<small>м</small></a>`).join('');
  const schemes = schemeOptions.map(x => `<a class="product-scheme${x === v ? ' is-active' : ''}" href="${base + x.path}"${x === v ? ' aria-current="page"' : ''}>${esc(schemeText(x.s))}<span>→</span></a>`).join('');
  const tech = [
    ['Ширина проёма', `${fmtN(m.width)} мм`], ['Высота', heightsText], ['Секции', String(m.sections)], ['Створки', m.subtitle],
    ['Ширина створки', `${fmtN(m.leaf)} мм`], ['Чистый проход', m.passage ? `≈ ${fmtN(m.passage)} мм` : m.opening],
    ['Глубина рамы', m.frame_depth], ['Глубина створки', m.sash_depth],
    ['Профильная база', m.profile], ['Механизм', m.hardware], ['Направляющая', m.track], ['Заполнение', m.filling], ['Стеклопакет', m.glass],
  ].map(([a, b]) => `<div><small>${esc(a)}</small><strong>${esc(b)}</strong></div>`).join('');
  const limits = m.limits.map(l => `<li>${esc(l)}</li>`).join('');

  const priceBlock = soon
    ? `<div class="product-price"><div class="product-price__value"><small>Статус</small><strong>Скоро в продаже</strong></div><div class="product-price__term">цену и старт продаж сообщим по запросу</div></div>`
    : `<div class="product-price"><div class="product-price__value"><small>Стоимость конструкции</small><strong>${money(m.price)}</strong></div><div class="product-price__term"><b>Срок — ${PROD_TEXT}</b>изготовление после подтверждения заказа</div></div>
      <p class="product-price-note"><b>Цена без доставки и монтажа.</b> Их посчитаем после бесплатного замера.</p>`;
  const mainCta = soon ? 'Узнать о старте продаж' : 'Получить точную смету';
  const hasCalc = m.system === 'HS' && !soon;
  const customLink = hasCalc ? raschetHref(base, m, s) : '#product-contact';

  return `<!doctype html>
<html lang="ru">
${GENERATED}
<head>
<meta charset="utf-8">
${fontPreload(base)}
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex,nofollow">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#050505">
<meta property="og:type" content="product">
<meta property="og:locale" content="ru_RU">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${esc(`${m.code} ${m.name} — ${size}, ${colorName}`)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${imageUrl}">
<link rel="stylesheet" href="${base}assets/css/product.css">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
${jsonLd(product)}
${jsonLd(crumbs)}
</head>
<body class="product-page${soon ? ' product-page--soon' : ''}" data-sku="${v.sku}">
<site-menu data-base="${base}"></site-menu>
<main>
<nav class="crumbs" aria-label="Хлебные крошки"><div class="ui-wrap crumbs__in"><a href="${base}">Главная</a><span aria-hidden="true">—</span><a href="${base}catalog/">Каталог</a><span aria-hidden="true">—</span><a href="${systemHref(m, base)}">${m.system}</a><span aria-hidden="true">—</span><span aria-current="page">${esc(m.code)}</span></div></nav>
<section class="product-hero">
  <div class="product-hero__grid">
    <div class="product-media"${v.imageOpen ? ' data-media-toggle' : ''} data-reveal>
      <img src="${base + v.image}" alt="${esc(`${m.code} — ${size}, ${c.name}, закрыто`)}" fetchpriority="high">${v.imageOpen ? `
      <img class="product-media__open" src="${base + v.imageOpen}" alt="${esc(`${m.code} — ${size}, ${c.name}, открыто`)}" loading="lazy">
      <div class="product-media__states" role="group" aria-label="Вид конструкции"><button type="button" class="is-active" aria-pressed="true" data-media-state="closed">Закрыто</button><button type="button" aria-pressed="false" data-media-state="open">Открыто</button></div>` : ''}
      <span class="product-media__label">${esc(s.code)} · ${esc(colorName)}</span>
    </div>
    <aside class="product-buy">
      <div class="product-buy__top"><span class="product-buy__code">${esc(m.code)}</span><span class="product-buy__status">${soon ? 'скоро в продаже' : 'готовая конфигурация'}</span></div>
      <h1>${esc(m.name)}<small>${esc(size)} · ${esc(colorName)}</small></h1>
      <p class="product-buy__lead">${esc(m.lead)}</p>
      ${priceBlock}
      <div class="product-quick">
        <div><small>Схема</small><strong>${esc(s.code)}</strong></div><div><small>Ширина прохода</small><strong>${esc(m.opening)}</strong></div>
        <div><small>Секции</small><strong>${m.sections}</strong></div><div><small>Сценарий</small><strong>${esc(m.use)}</strong></div>
      </div>
      <div class="product-variant"><div class="product-variant__head"><span>Проём</span><span>${fmtN(m.width)} мм · проход ≈ ${m.passage ? fmtN(m.passage) : '—'} мм</span></div><div class="product-sizes">${sizesHtml}</div></div>
      <div class="product-variant"><div class="product-variant__head"><span>Цвет</span><span>${esc(c.name)} · RAL ${c.ral}</span></div><div class="product-swatches">${swatches}</div></div>
      <div class="product-variant"><div class="product-variant__head"><span>Схема</span><span>${esc(s.code)}</span></div><div class="product-schemes">${schemes}</div></div>
      <div class="product-actions">${soon
        ? `<a class="ui-btn ui-btn--dark" href="#product-contact">${mainCta} <span>→</span></a>`
        : `<button class="ui-btn ui-btn--dark" type="button" data-add-to-cart data-sku="${v.sku}" data-cart-href="${base}cart/">В корзину <span>+</span></button>`}<a class="ui-btn" href="${customLink}">${hasCalc ? 'Рассчитать под свой размер' : 'Индивидуальный расчёт'} <span>→</span></a></div>
      <p class="product-sku">Артикул: ${v.sku}</p>
    </aside>
  </div>
</section>

<section class="product-story">
  <div class="p-wrap">
    <div class="product-story__grid"><p class="ui-eyebrow">01 · Конфигурация</p><div class="product-story__main"><h2>${esc(m.story)}</h2><p class="product-story__copy">${esc(m.lead)} Артикул фиксирует размер, цвет и схему; если архитектура требует другого решения, рассчитываем отдельную конфигурацию.</p></div></div>
    <div class="product-config" data-reveal><div class="product-config__drawing">${largeSvg(m, s)}</div><div class="product-config__facts"><div><small>Размер</small><strong>${esc(size)}</strong></div><div><small>Конфигурация</small><strong>${esc(m.subtitle)}</strong></div><div><small>Схема</small><strong>${esc(s.label)}</strong></div>${how ? `<div><small>Как работает</small><strong>${esc(how)}</strong></div>` : ''}<div><small>Цвет</small><strong>${esc(c.name)} · RAL ${c.ral}</strong></div></div></div>
  </div>
</section>

<section class="product-tech">
  <div class="p-wrap">
    <header class="product-tech__head"><h2>Инженерная спецификация</h2><p>Поставщиков и комплектующие показываем на техническом уровне. Итоговые характеристики конкретной конструкции подтверждаются после расчёта размера и стеклопакета.</p></header>
    <div class="product-tech__grid">${tech}</div>
    <ul class="product-limits">${limits}</ul>
    <div class="product-docs"><a class="product-doc" href="${systemHref(m, base)}"><div><strong>Описание системы и механики</strong><small>Схемы открывания, стеклопакеты и инженерные ориентиры</small></div><span>↗</span></a><a class="product-doc" href="${customLink}"><div><strong>Индивидуальная конфигурация</strong><small>Другой размер, стекло, цвет или монтажный узел</small></div><span>→</span></a></div>
  </div>
</section>

<section class="product-contact" id="product-contact">
  <div class="p-wrap product-contact__grid">
    <div class="product-contact__intro">
      <p class="ui-eyebrow">02 · ${soon ? 'Старт продаж' : 'Под ваш проём'}</p>
      <h2>${soon ? 'Сообщим о старте продаж' : 'Другой размер или комплектация?'}</h2>
      <p class="product-contact__copy">${soon ? 'Оставьте телефон — позвоним, когда конфигурация станет доступна к заказу, и назовём цену.' : 'Посчитаем под ваш проём: калькулятор сразу покажет ориентировочную цену, а инженер после бесплатного замера — точную.'}</p>
      <ul class="product-options">
        <li>${ICO.ruler}<span><b>Другой размер</b>проверим створки и вес стекла</span></li>
        <li>${ICO.palette}<span><b>Любой RAL</b>под фасад и кровлю</span></li>
        <li>${ICO.glass}<span><b>Стекло под задачу</b>безопасность, тепло, солнце</span></li>
        <li>${ICO.sill}<span><b>Монтажный узел</b>порог, пол, водоотвод</span></li>
      </ul>
      ${hasCalc ? `<a class="ui-btn ui-btn--dark product-contact__calc" href="${customLink}">Рассчитать под свой размер <span>→</span></a>` : ''}
    </div>
    <lead-form data-base="${base}" data-source="${v.sku}" data-context="${esc(`${m.code}, ${colorName}, ${s.code} (${v.sku})`)}" data-cta="${soon ? 'Сообщить о старте' : 'Получить точный расчёт'}"></lead-form>
  </div>
</section>

<section class="product-lifestyle" data-reveal>
  <img src="${base + m.architecture}" alt="${esc(m.code)} в архитектуре загородного дома" loading="lazy" decoding="async">
  <div class="product-lifestyle__copy"><small>${esc(m.code)} · ${esc(size)}</small><h2>Система внутри архитектуры</h2><p>${esc(m.use)}. Портал подбираем по проёму, планировке и маршруту движения, а не только по размеру из каталога.</p></div>
</section>

<div class="mobile-buy"><div class="mobile-buy__price">${soon ? '<small>статус</small><strong>Скоро</strong>' : `<small>цена</small><strong>${money(m.price)}</strong>`}</div>${soon ? '<a class="ui-btn ui-btn--dark" href="#product-contact">Узнать о старте <span>→</span></a>' : `<button class="ui-btn ui-btn--dark" type="button" data-add-to-cart data-sku="${v.sku}" data-cart-href="${base}cart/">В корзину <span>+</span></button>`}</div>
</main>
<site-footer data-base="${base}"></site-footer>
<script src="${base}assets/js/components/site-menu.js"></script>
<script src="${base}assets/js/components/site-footer.js"></script>
<script src="${base}assets/js/shop.js"></script>
<script src="${base}assets/js/product.js"></script>
<script src="${base}assets/js/components/lead-form.js"></script>
</body>
</html>
`;
}

// ---------- страница «Проекты» (/projects/) ----------
// Карточки из data/projects.json, как у vitrocsa.com/projects: под фото — название; система, объект, место и описание —
// тёмная плашка поверх фото при наведении (на телефоне — по нажатию, assets/js/projects.js).
// status: render — визуализация, на карточке пометка; реальные объекты — status: real.
function projectsGrid() {
  const pj = JSON.parse(read('data/projects.json'));
  return pj.projects.map((p, i) => {
    const sys = p.systems.map(k => pj.systems[k]).join(', ');
    const meta = [['Система', sys], ['Объект', pj.types[p.type]], p.place ? ['Место', p.place] : null].filter(Boolean);
    return `<article class="pj-card" data-system="${p.systems.join(' ')}" data-type="${p.type}" data-status="${p.status}">
        <div class="pj-card__media" tabindex="0" aria-label="${esc(p.title)}: подробнее о проекте">
          <img src="../${p.image}" alt="${esc(p.title)}" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async">
          ${p.status === 'render' ? '<span class="pj-card__badge">Визуализация</span>' : ''}
          <div class="pj-card__over">
            <p class="pj-card__name">${esc(p.title)}</p>
            <dl class="pj-card__meta">${meta.map(([a, b]) => `<div><dt>${a}:</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
            <p class="pj-card__text">${esc(p.text)}</p>
            <p class="pj-card__tag">${p.status === 'real' ? 'Реализованный проект' : 'Визуализация решения'}</p>
          </div>
        </div>
        <h2 class="pj-card__title">${esc(p.title)}</h2>
      </article>`;
  }).join('\n      ');
}

// ---------- блоки в страницах с ручной вёрсткой ----------
const models = data.models;
const hs = models.filter(m => m.system === 'HS');
const fsModels = models.filter(m => m.system === 'FS');
const featured = hs.filter(m => m.status === 'available').slice(0, 2).map(defSize);   // 2 и 3 секции (размер по умолчанию) — плашки в «Системах» на главной

const blocks = {
  'raschet/index.html': {
    'raschet-calc': calcBox('../', { h1: 1, url: 1, eyebrow: 'Калькулятор · HS и FS порталы', context: 'страница калькулятора' }),
  },
  'catalog/index.html': {
    'hs-cards': [...hs.map(m => marketCard(m, '../')), projectCard('../raschet/', 'project')].join('\n\n      '),
    'fs-cards': fsModels.map(m => marketCard(m, '../')).join('\n\n      '),
  },
  'systems/hs/index.html': {
    'hs-cards': [...hs.map(m => marketCard(m, '../../')), projectCard('../../raschet/', 'project')].join('\n\n      '),
    'hs-calc': calcTeaser('../../', '05 · Подбор по размеру'),
    'hsx-data': `<script type="application/json" data-hsx-json>${hsxData('../../')}</script>`,
  },
  'projects/index.html': {
    'projects-grid': projectsGrid(),
  },
  // Карта остекления: настройки из data/site-config.json → glazing_map (сцена Spline, runtime, счётчик Метрики)
  'osteklenie-pod-klyuch/index.html': {
    'glazing-config': `<script type="application/json" id="gm-config">${JSON.stringify({
      splineScene: config.glazing_map?.spline_scene || '', splineRuntime: '../' + (config.glazing_map?.spline_runtime || 'assets/vendor/spline/runtime.js'),
      metrika: config.glazing_map?.metrika_id || '',
    })}</script>`,
  },
  'cart/index.html': {
    'cart-recs': [...hs.map(m => marketCard(m, '../')), projectCard('../raschet/')].join('\n\n      '),
  },
  'index.html': {
    'home-cards': [...hs.map(m => marketCard(m, '')), projectCard('raschet/')].join('\n\n      '),
    'home-calc': calcTeaser('', 'Калькулятор'),
    'hs-mini-cards': featured.map(m => `<a class="sx-strip" href="${firstOf(m.base).path}"><small>${esc(m.code)}</small><strong>${(m.width / 1000).toFixed(1).replace('.', ',')} × ${(m.height / 1000).toFixed(1).replace('.', ',')} м</strong><em>${money(m.price)}</em><i aria-hidden="true">→</i></a>`).join('\n          '),
  },
};

// ---------- sitemap ----------
const sitemapUrls = [
  ['', 'weekly', '1.0'], ['systems/hs/', 'monthly', '0.9'], ['catalog/', 'weekly', '0.8'], ['systems/fs/', 'monthly', '0.7'],
  ['raschet/', 'monthly', '0.8'], ['projects/', 'monthly', '0.6'], ['about/', 'monthly', '0.6'], ['contacts/', 'monthly', '0.6'],
  ['osteklenie-pod-klyuch/', 'monthly', '0.7'],
  ...variants.map(v => [v.path, 'monthly', v.available ? '0.6' : '0.4']),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(([p, f, pr]) => `  <url>\n    <loc>${SITE}${p}</loc>\n    <changefreq>${f}</changefreq>\n    <priority>${pr}</priority>\n  </url>`).join('\n')}
</urlset>
`;

// ---------- запись ----------
const outputs = new Map();
for (const v of variants) outputs.set(v.path + 'index.html', variantPage(v));
for (const [file, map] of Object.entries(blocks)) {
  let html = read(file);
  for (const [name, content] of Object.entries(map)) {
    const re = new RegExp(`(<!-- build:${name} -->)[\\s\\S]*?(<!-- /build:${name} -->)`);
    if (!re.test(html)) throw new Error(`В ${file} нет маркеров <!-- build:${name} --> … <!-- /build:${name} -->`);
    html = html.replace(re, (_, a, b) => `${a}\n      ${content}\n      ${b}`);
  }
  outputs.set(file, html);
}
outputs.set('sitemap.xml', sitemap);
// Данные для корзины (assets/js/shop.js): актуальные цены и названия по артикулу
outputs.set('data/catalog.json', JSON.stringify({
  _comment: 'Сгенерировано tools/build.mjs из data/products.json и data/site-config.json — не редактировать вручную.',
  // Для корзины: самовывоз с производства и оценка доставки + монтажа
  factory: (({ _comment, ...f }) => f)(config.factory || {}),
  services: (({ _comment, ...s }) => s)(config.services || {}),
  variants: variants.map(v => ({
    sku: v.sku, model: v.m.model, code: v.m.code, name: v.m.name, size: sizeText(v.m), width: v.m.width, size_short: `${metres(v.m.width)} м`,
    color: `${v.c.name} RAL ${v.c.ral}`, color_slug: v.c.slug, hex: v.c.hex,
    scheme: v.s.label, scheme_slug: v.s.slug, scheme_short: v.s.short, scheme_title: v.m.scheme_title,
    price: v.m.price, available: v.available, image: v.image, image_open: v.imageOpen, url: v.path,
  })),
}, null, 2) + '\n');

// Лишние папки вариантов (переименованные или удалённые из данных)
const stale = [];
for (const cat of ['catalog/hs-portaly', 'catalog/fs-portaly']) {
  if (!exists(cat)) continue;
  for (const dir of fs.readdirSync(path.join(ROOT, cat))) {
    if (!variants.some(v => v.path === `${cat}/${dir}/`)) stale.push(`${cat}/${dir}`);
  }
}

let changed = [];
for (const [file, content] of outputs) {
  const full = path.join(ROOT, file);
  const old = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
  if (old === content) continue;
  changed.push(file);
  if (!CHECK) { fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, content); }
}
if (!CHECK) for (const dir of stale) fs.rmSync(path.join(ROOT, dir), { recursive: true });

// Справочные цены калькулятора HS (assets/js/hs-system.js) должны совпадать с каталогом
const warnings = [];
const calc = read('assets/js/hs-system.js').match(/refs=\{([^;]+)\};/);
if (calc) {
  for (const m of hs.map(b => sizesOf(b)[0])) {
    const hit = calc[1].match(new RegExp(`${m.sections}:\\{price:(\\d+)`));
    if (hit && +hit[1] !== m.price) warnings.push(`hs-system.js: цена ${m.sections} секций ${hit[1]} ≠ ${m.price} в products.json (${m.code})`);
  }
}

console.log(`Вариантов: ${variants.length} (в продаже: ${variants.filter(v => v.available).length}, скоро: ${variants.filter(v => !v.available).length})`);
if (CHECK) {
  const bad = [...changed, ...stale.map(s => s + ' (лишняя папка)')];
  if (bad.length) { console.log('Устарело — запустите node tools/build.mjs:\n  ' + bad.join('\n  ')); process.exitCode = 1; }
  else console.log('Файлы актуальны.');
} else {
  console.log(changed.length ? `Обновлено файлов: ${changed.length}` : 'Изменений нет.');
  if (stale.length) console.log('Удалены лишние папки:\n  ' + stale.join('\n  '));
}
if (missingPhotos.length) console.log(`\nНе хватает фото вариантов (${missingPhotos.length}), пока стоит общее фото модели:\n  ` + missingPhotos.join('\n  '));
if (warnings.length) { console.log('\nВнимание:\n  ' + warnings.join('\n  ')); if (CHECK) process.exitCode = 1; }
