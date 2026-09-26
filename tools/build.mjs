#!/usr/bin/env node
// Генератор каталога PORTAL SYSTEMS. Единственный источник данных — data/products.json.
//
//   node tools/build.mjs          собрать всё
//   node tools/build.mjs --check  ничего не писать; код 1, если файлы на диске устарели
//
// Что собирает:
//   catalog/<cat>/<slug>/index.html   страницы всех вариантов (модель × цвет × схема), всё в HTML
//   блоки между <!-- build:имя --> и <!-- /build:имя --> в catalog/index.html, systems/hs/index.html, index.html
//   sitemap.xml
// Папки catalog/hs-portaly и catalog/fs-portaly принадлежат генератору: лишние варианты удаляются.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = f => fs.existsSync(path.join(ROOT, f));

const data = JSON.parse(read('data/products.json'));
const config = JSON.parse(read('data/site-config.json'));
const SITE = (config.site_url || 'https://www.portal-systems.ru').replace(/\/$/, '') + '/';
const BRAND = config.brand || 'PORTAL SYSTEMS';

// ---------- утилиты ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nbsp = '\u00a0';
const money = n => new Intl.NumberFormat('ru-RU').format(n).replace(/\s/g, nbsp) + nbsp + '₽';
const sizeText = m => `${m.width} × ${m.height} мм`;
const profileSlug = m => m.profile.toLowerCase().replace(/[^a-z0-9]+/g, '-');           // ALUMARK S158 → alumark-s158
const profileCode = m => m.profile.split(' ').pop();                                    // S158
const schemeText = s => s.label.replace(/^Схема\s+[A-Z0-9-]+\s*·\s*/i, '');             // без «Схема A1 · »
const mirrored = s => /(^B\d|-R)$/.test(s.code);
// HS/36 (D1) рисуем зеркально: подвижная пара справа, движение влево — так попросила владелец
const flipModel = m => m.model === 'HS3';
const isMirror = (m, s) => mirrored(s) !== flipModel(m);                                        // зеркальные схемы
const systemName = m => (m.system === 'HS' ? 'HS-порталы' : 'FS-порталы');

// ---------- варианты ----------
const missingPhotos = [];
const variants = [];
// Фото варианта: assets/images/products/<model>/<цвет>-<схема>.webp (+ -open.webp — открытый вид),
// их делает tools/recolor-photos.mjs из студийного рендера. Нет фото — общее фото модели.
for (const m of data.models) {
  for (const c of m.colors) {
    for (const s of m.schemes) {
      const slug = `${profileSlug(m)}-${m.width}x${m.height}-${c.slug}-${s.slug}`;
      const photo = `assets/images/products/${m.model.toLowerCase()}/${c.slug}-${s.slug}.webp`;
      const photoOpen = photo.replace(/\.webp$/, '-open.webp');
      const hasPhoto = exists(photo);
      if (!hasPhoto) missingPhotos.push(`${photo}  — ${m.code} ${m.name}, ${c.name} RAL ${c.ral}, ${s.code}`);
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
const byModel = model => variants.filter(v => v.m.model === model);
const find = (model, colorSlug, schemeSlug) => variants.find(v => v.m.model === model && v.c.slug === colorSlug && v.s.slug === schemeSlug);
// Схема по умолчанию: default_scheme в products.json, иначе первая
const defScheme = m => m.schemes.find(s => s.code === m.default_scheme) || m.schemes[0];
const firstOf = m => find(m.model, m.colors[0].slug, defScheme(m).slug);

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
const sectionsText = n => `${n} ${n >= 2 && n <= 4 ? 'секции' : 'секций'}`;
function marketCard(m, rel) {
  const first = firstOf(m);
  const href = v => rel + v.path;
  const soon = m.status !== 'available';
  const s0 = defScheme(m), c0 = m.colors[0];
  const data = byModel(m.model).map(v => ({ sku: v.sku, c: v.c.slug, s: v.s.slug, href: href(v), img: rel + v.image, open: v.imageOpen ? rel + v.imageOpen : '' }));
  const swatches = m.colors.map((c, i) => {
    const v = find(m.model, c.slug, s0.slug);
    return `<a class="m-card__swatch${i ? '' : ' is-active'}" href="${href(v)}" data-color="${c.slug}" data-name="${esc(c.name)} RAL ${c.ral}" style="--sw:${c.hex}" title="${esc(c.name)} RAL ${c.ral}" aria-label="Цвет ${esc(c.name)} RAL ${c.ral}"${i ? '' : ' aria-current="true"'}></a>`;
  }).join('');
  const chips = m.schemes.length > 1
    ? `<div class="m-card__chips">${m.schemes.map((s, i) => {
        const v = find(m.model, c0.slug, s.slug);
        const on = s === s0;
        return `<a class="m-card__chip${on ? ' is-active' : ''}" href="${href(v)}" data-scheme="${s.slug}" data-name="${esc(s.short)}"${on ? ' aria-current="true"' : ''}>${esc(s.short)}</a>`;
      }).join('')}</div>`
    : '';
  const schemesSvg = m.schemes.map(s => `<span data-scheme-svg="${s.slug}"${s === s0 ? '' : ' hidden'}>${smallSvg(m, s)}</span>`).join('');
  const price = soon
    ? '<strong>Скоро</strong><small>цена — к старту продаж</small>'
    : `<strong>${money(m.price)}</strong><small>от, за конструкцию</small>`;
  const action = soon
    ? `<a class="ui-btn m-card__cart" href="${href(first)}#product-contact" data-card-link data-card-hash="#product-contact">Сообщить о старте</a>`
    : `<button class="ui-btn ui-btn--dark m-card__cart" type="button" data-add-to-cart data-sku="${first.sku}" data-cart-href="${rel}cart/">В корзину</button>`;
  return `<article class="m-card${soon ? ' m-card--soon' : ''}" data-card data-variants="${esc(JSON.stringify(data))}">
        <a class="m-card__media" href="${href(first)}" data-card-link>
          <img src="${rel}${first.image}" alt="${esc(`${m.code} ${m.name}, ${sizeText(m)}`)}" loading="lazy" decoding="async" data-card-img>${first.imageOpen ? `
          <img class="m-card__open" src="${rel}${first.imageOpen}" alt="" loading="lazy" decoding="async" data-card-img-open>` : ''}
          ${soon ? '<span class="m-card__badge">Скоро в продаже</span>' : ''}
          <span class="m-card__scheme" aria-hidden="true">${schemesSvg}</span>
        </a>
        <div class="m-card__body">
          <div class="m-card__price">${price}</div>
          <a class="m-card__title" href="${href(first)}" data-card-link>${esc(m.code)} · ${esc(m.name)}</a>
          <p class="m-card__meta">${esc(sizeText(m))} · ${sectionsText(m.sections)}</p>
          <div class="m-card__opt"><span class="m-card__label">Цвет: <b data-card-color>${esc(c0.name)} RAL ${c0.ral}</b></span><div class="m-card__swatches">${swatches}</div></div>
          <div class="m-card__opt"><span class="m-card__label">${esc(m.scheme_title)}: <b data-card-scheme>${esc(s0.short)}</b></span>${chips}</div>
          ${action}
        </div>
      </article>`;
}

// Калькулятор HS (assets/js/quick-calc.js) живёт на отдельной странице /raschet/.
// Цены моделей по числу секций — из products.json; фото — рендеры моделей (светлая рама — если есть белый цвет).
const hsAvail = () => data.models.filter(m => m.system === 'HS' && m.status === 'available');
const calcRefs = () => JSON.stringify(Object.fromEntries(hsAvail().map(m => [m.sections, { price: m.price, w: m.width, h: m.height }])));
const calcRenders = rel => JSON.stringify(Object.fromEntries(hsAvail().map(m => {
  const pick = pred => {
    const col = m.colors.find(pred);
    const v = col && find(m.model, col.slug, defScheme(m).slug);
    return v ? { closed: rel + v.image, open: rel + (v.imageOpen || v.image) } : null;
  };
  return [m.sections, { light: pick(c => c.slug === 'belyi'), dark: pick(c => c.slug !== 'belyi') }];
})));
const calcBox = (rel, attrs = {}) => {
  const all = { refs: calcRefs(), renders: calcRenders(rel), endpoint: `${rel}forms/send.php`, img: `${rel}assets/images/systems/hs-overview.jpg`, ...attrs };
  return `<div class="qc-root" data-quick-calc ${Object.entries(all).map(([k, v]) => `data-${k}="${esc(String(v))}"`).join(' ')}></div>`;
};
const colorKeyOf = c => ({ belyi: 'white', antratsit: 'anthracite' }[c.slug] || 'ral');
// Ссылка на калькулятор с параметрами товара (размер, створки, цвет, стекло как в каталоге)
const raschetHref = (rel, m, c) => `${rel}raschet/?w=${m.width}&amp;h=${m.height}&amp;n=${m.sections}&amp;glass=standard&amp;color=${colorKeyOf(c)}&amp;from=${encodeURIComponent(`${m.code} · ${c.name} RAL ${c.ral}`)}`;

const ICO = {
  price: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h7"/><circle cx="18" cy="16" r="3.2"/></svg>',
  clip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5 12.3 19.2a5 5 0 0 1-7.1-7.1l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 15 12-12 6 6-12 12z"/><path d="m7 11 2 2M10 8l2 2M13 5l2 2"/></svg>',
  palette: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.2-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/></svg>',
  glass: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M11 4v16M17 4v16"/><path d="M5 4h12M5 20h12" opacity=".5"/></svg>',
  sill: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18M5 18V6h14v12"/><path d="M8 18l3-3h7" opacity=".6"/></svg>',
};

// Блок «Калькулятор» на главной и странице HS: фото, короткий расчёт (ширина × высота) → страница /raschet/
function calcTeaser(rel, eyebrow) {
  const m = hsAvail().find(x => x.sections === 3) || hsAvail()[0];
  const v = firstOf(m);
  return `<div class="qc-teaser">
      <a class="qc-teaser__media" href="${rel}raschet/" tabindex="-1" aria-hidden="true">
        <img src="${rel}${v.image}" alt="" loading="lazy" decoding="async">
        ${v.imageOpen ? `<img class="qc-teaser__open" src="${rel}${v.imageOpen}" alt="" loading="lazy" decoding="async">` : ''}
        <span class="qc-teaser__tag">Цена сразу · без телефона</span>
      </a>
      <div class="qc-teaser__body">
        <p class="qc-teaser__eyebrow">${esc(eyebrow)}</p>
        <h2 class="qc-teaser__title">Сколько стоит раздвижная дверь под ваш размер</h2>
        <p class="qc-teaser__lead">Укажите примерный размер проёма — калькулятор предложит число створок, покажет вид и ориентировочную цену.</p>
        <form class="qc-teaser__form" action="${rel}raschet/" method="get">
          <label><span>Ширина, мм</span><input name="w" inputmode="numeric" maxlength="4" value="3600" autocomplete="off"></label>
          <label><span>Высота, мм</span><input name="h" inputmode="numeric" maxlength="4" value="2300" autocomplete="off"></label>
          <button type="submit">Рассчитать <i aria-hidden="true">→</i></button>
        </form>
        <ul class="qc-teaser__points">
          <li>${ICO.price}<span>Цена сразу, <br>без регистрации</span></li>
          <li>${ICO.clip}<span>Можно приложить <br>готовый проект</span></li>
          <li>${ICO.ruler}<span>Замер — <br>бесплатно</span></li>
        </ul>
      </div>
    </div>`;
}

// Карточка «Индивидуальный расчёт» — вся карточка ведёт на страницу калькулятора
function projectCard(calcHref, id) {
  return `<a class="m-card m-card--project" href="${calcHref}"${id ? ` id="${id}"` : ''}>
        <span class="m-card__media">
          <svg viewBox="0 0 340 220" aria-hidden="true"><rect x="26" y="24" width="288" height="170"/><path d="M92 24v170M157 24v170M239 24v170M45 174 126 93M117 174l82-82M190 174l82-82"/></svg>
        </span>
        <span class="m-card__body">
          <span class="m-card__price"><strong>По расчёту</strong><small>любой размер и комплектация</small></span>
          <span class="m-card__title">Индивидуальный расчёт</span>
          <span class="m-card__meta">Другой размер, RAL, стекло или порог — посчитаем в калькуляторе за пару минут.</span>
          <span class="ui-btn ui-btn--light m-card__cart">Рассчитать под свой размер <span>→</span></span>
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
  const colorOptions = m.colors.map(col => family.find(x => x.c.slug === col.slug && x.s.slug === s.slug));
  const schemeOptions = m.schemes.map(sch => family.find(x => x.c.slug === c.slug && x.s.slug === sch.slug));
  const colorName = `${c.name} RAL ${c.ral}`;
  const title = `${m.code} ${m.name} — ${size}, ${colorName} | ${BRAND}`;
  const description = `${m.title} ${size}, ${colorName}, ${s.label[0].toLowerCase() + s.label.slice(1)}. ${soon ? 'Скоро в продаже.' : `Стоимость от ${money(m.price)}.`} Изготовление и монтаж в Москве и МО.`;
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
      ['Стеклопакет', m.glass], ['Количество секций', String(m.sections)],
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
  const schemes = schemeOptions.map(x => `<a class="product-scheme${x === v ? ' is-active' : ''}" href="${base + x.path}"${x === v ? ' aria-current="page"' : ''}>${esc(schemeText(x.s))}<span>→</span></a>`).join('');
  const tech = [
    ['Профильная база', m.profile], ['Механизм', m.hardware], ['Направляющая', m.track], ['Глубина рамы', m.frame_depth],
    ['Глубина створки', m.sash_depth], ['Заполнение', m.filling], ['Стеклопакет', m.glass], ['Секции', String(m.sections)],
  ].map(([a, b]) => `<div><small>${esc(a)}</small><strong>${esc(b)}</strong></div>`).join('');
  const limits = m.limits.map(l => `<li>${esc(l)}</li>`).join('');

  const priceBlock = soon
    ? `<div class="product-price"><div class="product-price__value"><small>Статус</small><strong>Скоро в продаже</strong></div><div class="product-price__term">цену и старт продаж сообщим по запросу</div></div>`
    : `<div class="product-price"><div class="product-price__value"><small>Стоимость конструкции от</small><strong>${money(m.price)}</strong></div><div class="product-price__term">срок — после подтверждения комплектации</div></div>
      <p class="product-price-note"><b>Цена без доставки и монтажа.</b> Их посчитаем после бесплатного замера.</p>`;
  const mainCta = soon ? 'Узнать о старте продаж' : 'Получить точную смету';
  const hasCalc = m.system === 'HS' && !soon;
  const customLink = hasCalc ? raschetHref(base, m, c) : '#product-contact';

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
<nav class="p-wrap p-crumbs" aria-label="Хлебные крошки"><a href="${base}">Главная</a><span>/</span><a href="${base}catalog/">Каталог</a><span>/</span><a href="${systemHref(m, base)}">${m.system}</a><span>/</span>${esc(m.code)}</nav>
<section class="product-hero">
  <div class="product-hero__grid">
    <div class="product-media"${v.imageOpen ? ' data-media-toggle' : ''} data-reveal>
      <img src="${base + v.image}" alt="${esc(`${m.code} — ${size}, ${c.name}, закрыто`)}" fetchpriority="high">${v.imageOpen ? `
      <img class="product-media__open" src="${base + v.imageOpen}" alt="${esc(`${m.code} — ${size}, ${c.name}, открыто`)}" loading="lazy">
      <div class="product-media__states" role="group" aria-label="Вид конструкции"><button type="button" class="is-active" aria-pressed="true" data-media-state="closed">Закрыто</button><button type="button" aria-pressed="false" data-media-state="open">Открыто</button></div>` : ''}
      <span class="product-media__label">${esc(s.code)} · ${esc(colorName)}</span>
      <span class="product-media__scheme" aria-hidden="true">${smallSvg(m, s)}</span>
    </div>
    <aside class="product-buy">
      <div class="product-buy__top"><span class="product-buy__code">${esc(m.code)}</span><span class="product-buy__status">${soon ? 'скоро в продаже' : 'готовая конфигурация'}</span></div>
      <h1>${esc(m.name)}<small>${esc(size)} · ${esc(colorName)}</small></h1>
      <p class="product-buy__lead">${esc(m.lead)}</p>
      ${priceBlock}
      <div class="product-quick">
        <div><small>Схема</small><strong>${esc(s.code)}</strong></div><div><small>Открывание</small><strong>${esc(m.opening)}</strong></div>
        <div><small>Секции</small><strong>${m.sections}</strong></div><div><small>Сценарий</small><strong>${esc(m.use)}</strong></div>
      </div>
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
    <div class="product-config" data-reveal><div class="product-config__drawing">${largeSvg(m, s)}</div><div class="product-config__facts"><div><small>Размер</small><strong>${esc(size)}</strong></div><div><small>Конфигурация</small><strong>${esc(m.subtitle)}</strong></div><div><small>Схема</small><strong>${esc(s.label)}</strong></div><div><small>Цвет</small><strong>${esc(c.name)} · RAL ${c.ral}</strong></div></div></div>
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

<div class="mobile-buy"><div class="mobile-buy__price">${soon ? '<small>статус</small><strong>Скоро</strong>' : `<small>от</small><strong>${money(m.price)}</strong>`}</div>${soon ? '<a class="ui-btn ui-btn--dark" href="#product-contact">Узнать о старте <span>→</span></a>' : `<button class="ui-btn ui-btn--dark" type="button" data-add-to-cart data-sku="${v.sku}" data-cart-href="${base}cart/">В корзину <span>+</span></button>`}</div>
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

// ---------- блоки в страницах с ручной вёрсткой ----------
const models = data.models;
const hs = models.filter(m => m.system === 'HS');
const fsModels = models.filter(m => m.system === 'FS');
const featured = hs.filter(m => m.status === 'available').slice(0, 2);   // HS / 30 и HS / 36 на главной и первом экране HS

const blocks = {
  'raschet/index.html': {
    'raschet-calc': calcBox('../', { h1: 1, url: 1, eyebrow: 'Калькулятор · HS-порталы', context: 'страница калькулятора' }),
    'raschet-models': hsAvail().map(m => {
      const v = firstOf(m);
      return `<a class="rs-model" href="../${v.path}">
          <span class="rs-model__img"><img src="../${v.image}" alt="" loading="lazy" decoding="async"></span>
          <span class="rs-model__body"><small>${esc(m.code)} · ${m.width} × ${m.height} мм</small><strong>${esc(m.name)}</strong><em>от ${money(m.price)}</em></span>
          <i aria-hidden="true">→</i>
        </a>`;
    }).join('\n        '),
  },
  'catalog/index.html': {
    'hs-cards': [...hs.map(m => marketCard(m, '../')), projectCard('../raschet/', 'project')].join('\n\n      '),
    'fs-cards': fsModels.map(m => marketCard(m, '../')).join('\n\n      '),
  },
  'systems/hs/index.html': {
    'hs-cards': [...hs.map(m => marketCard(m, '../../')), projectCard('../../raschet/', 'project')].join('\n\n      '),
    'hs-calc': calcTeaser('../../', '03 · Калькулятор'),
    'hs-hero-products': featured.map(m => `<a class="hs-hero-product" href="../../${firstOf(m).path}">
        <span><small>${esc(m.code)}</small><strong>${esc(sizeText(m))}</strong></span>
        <span><small>от</small><b>${money(m.price)}</b></span>
        <i>→</i>
      </a>`).join('\n      '),
  },
  'index.html': {
    'home-calc': calcTeaser('', 'Калькулятор'),
    'hs-mini-cards': featured.map(m => `<a class="sx-strip" href="${firstOf(m).path}"><small>${esc(m.code)}</small><strong>${(m.width / 1000).toFixed(1).replace('.', ',')} × ${(m.height / 1000).toFixed(1).replace('.', ',')} м</strong><em>от ${money(m.price)}</em><i aria-hidden="true">→</i></a>`).join('\n          '),
  },
};

// ---------- sitemap ----------
const sitemapUrls = [
  ['', 'weekly', '1.0'], ['systems/hs/', 'monthly', '0.9'], ['catalog/', 'weekly', '0.8'], ['systems/fs/', 'monthly', '0.7'],
  ['raschet/', 'monthly', '0.8'], ['about/', 'monthly', '0.6'], ['contacts/', 'monthly', '0.6'],
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
    sku: v.sku, model: v.m.model, code: v.m.code, name: v.m.name, size: sizeText(v.m),
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
  for (const m of hs) {
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
