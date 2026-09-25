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
const mirrored = s => /(^B\d|-R)$/.test(s.code);                                        // зеркальные схемы
const systemName = m => (m.system === 'HS' ? 'HS-порталы' : 'FS-порталы');

// ---------- варианты ----------
const missingPhotos = [];
const variants = [];
for (const m of data.models) {
  for (const c of m.colors) {
    const colorPhoto = `assets/images/products/${m.model.toLowerCase()}/${c.slug}.webp`;
    const hasPhoto = exists(colorPhoto);
    if (!hasPhoto) missingPhotos.push(`${colorPhoto}  — ${m.code} ${m.name}, ${c.name} RAL ${c.ral}`);
    for (const s of m.schemes) {
      const slug = `${profileSlug(m)}-${m.width}x${m.height}-${c.slug}-${s.slug}`;
      variants.push({
        m, c, s,
        sku: `STD-${m.model}-${profileCode(m)}-${m.width}X${m.height}-${c.ral}-${s.code}`,
        path: `catalog/${m.cat}/${slug}/`,
        image: hasPhoto ? colorPhoto : m.image,
        available: m.status === 'available',
      });
    }
  }
}
const byModel = model => variants.filter(v => v.m.model === model);
const find = (model, colorSlug, schemeSlug) => variants.find(v => v.m.model === model && v.c.slug === colorSlug && v.s.slug === schemeSlug);
const firstOf = m => find(m.model, m.colors[0].slug, m.schemes[0].slug);

// ---------- схемы (SVG) ----------
// Мелкая схема в углу фото: без текста
function smallSvg(m, s) {
  const W = 100;
  const frame = '<rect x="2" y="2" width="96" height="48"/>';
  let body = '';
  if (m.model === 'HS2') body = '<line x1="50" y1="2" x2="50" y2="50"/><path d="M13 38h30m-7-6 7 6-7 6"/>';
  else if (m.model === 'HS3') body = '<line x1="34" y1="2" x2="34" y2="50"/><line x1="66" y1="2" x2="66" y2="50"/><path d="M11 38h47m-7-6 7 6-7 6"/>';
  else if (m.model === 'HS4') body = '<line x1="26" y1="2" x2="26" y2="50"/><line x1="50" y1="2" x2="50" y2="50"/><line x1="74" y1="2" x2="74" y2="50"/><path d="M46 38H31m6-6-6 6 6 6M54 38h15m-6-6 6 6-6 6"/>';
  else if (m.model === 'FS3') body = '<path d="M18 10l16 16-16 16M34 10l16 16-16 16M50 10l16 16-16 16"/>';
  else body = '<path d="M14 9l14 17-14 17M28 9l14 17-14 17M42 9l14 17-14 17"/><line x1="75" y1="4" x2="75" y2="48"/>';
  if (mirrored(s)) body = `<g transform="translate(${W} 0) scale(-1 1)">${body}</g>`;
  return `<svg viewBox="0 0 100 52">${frame}${body}</svg>`;
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
  if (mirrored(s)) {
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
const customHref = (m, base) => (m.system === 'HS' ? `${base}systems/hs/#hs-calculator` : `${base}index.html#calculator`);

// Карточка модели «как на маркетплейсе»: фото, цена, цвет и схема переключаются прямо в карточке
// (assets/js/shop.js), кнопка «В корзину». Без JS цвета и схемы — обычные ссылки на страницы вариантов.
// rel — путь от страницы до корня сайта.
const sectionsText = n => `${n} ${n >= 2 && n <= 4 ? 'секции' : 'секций'}`;
function marketCard(m, rel) {
  const first = firstOf(m);
  const href = v => rel + v.path;
  const soon = m.status !== 'available';
  const s0 = m.schemes[0], c0 = m.colors[0];
  const data = byModel(m.model).map(v => ({ sku: v.sku, c: v.c.slug, s: v.s.slug, href: href(v), img: rel + v.image }));
  const swatches = m.colors.map((c, i) => {
    const v = find(m.model, c.slug, s0.slug);
    return `<a class="m-card__swatch${i ? '' : ' is-active'}" href="${href(v)}" data-color="${c.slug}" data-name="${esc(c.name)} RAL ${c.ral}" style="--sw:${c.hex}" title="${esc(c.name)} RAL ${c.ral}" aria-label="Цвет ${esc(c.name)} RAL ${c.ral}"${i ? '' : ' aria-current="true"'}></a>`;
  }).join('');
  const chips = m.schemes.length > 1
    ? `<div class="m-card__chips">${m.schemes.map((s, i) => {
        const v = find(m.model, c0.slug, s.slug);
        return `<a class="m-card__chip${i ? '' : ' is-active'}" href="${href(v)}" data-scheme="${s.slug}" data-name="${esc(s.short)}"${i ? '' : ' aria-current="true"'}>${esc(s.short)}</a>`;
      }).join('')}</div>`
    : '';
  const schemesSvg = m.schemes.map((s, i) => `<span data-scheme-svg="${s.slug}"${i ? ' hidden' : ''}>${smallSvg(m, s)}</span>`).join('');
  const price = soon
    ? '<strong>Скоро</strong><small>цена — к старту продаж</small>'
    : `<strong>${money(m.price)}</strong><small>от, за конструкцию</small>`;
  const action = soon
    ? `<a class="ui-btn m-card__cart" href="${href(first)}#product-contact" data-card-link data-card-hash="#product-contact">Сообщить о старте</a>`
    : `<button class="ui-btn ui-btn--dark m-card__cart" type="button" data-add-to-cart data-sku="${first.sku}" data-cart-href="${rel}cart/">В корзину</button>`;
  return `<article class="m-card${soon ? ' m-card--soon' : ''}" data-card data-variants="${esc(JSON.stringify(data))}">
        <a class="m-card__media" href="${href(first)}" data-card-link>
          <img src="${rel}${first.image}" alt="${esc(`${m.code} ${m.name}, ${sizeText(m)}`)}" loading="lazy" decoding="async" data-card-img>
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

// Карточка «Индивидуальный расчёт» — вся карточка ведёт в калькулятор
function projectCard(calcHref, id) {
  return `<a class="m-card m-card--project" href="${calcHref}"${id ? ` id="${id}"` : ''}>
        <span class="m-card__media">
          <svg viewBox="0 0 340 220" aria-hidden="true"><rect x="26" y="24" width="288" height="170"/><path d="M92 24v170M157 24v170M239 24v170M45 174 126 93M117 174l82-82M190 174l82-82"/></svg>
        </span>
        <span class="m-card__body">
          <span class="m-card__price"><strong>По расчёту</strong><small>любой размер и комплектация</small></span>
          <span class="m-card__title">Индивидуальный расчёт</span>
          <span class="m-card__meta">Другой размер, RAL, стекло или порог — посчитаем в калькуляторе за пару минут.</span>
          <span class="ui-btn ui-btn--light m-card__cart">Открыть калькулятор <span>→</span></span>
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
    name: `${m.title} ${m.code} «${m.name}» ${size}, ${colorName}, ${s.label}`,
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
    : `<div class="product-price"><div class="product-price__value"><small>Стоимость конструкции от</small><strong>${money(m.price)}</strong></div><div class="product-price__term">срок — после подтверждения комплектации</div></div>`;
  const mainCta = soon ? 'Узнать о старте продаж' : 'Получить точную смету';

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
    <div class="product-media" data-reveal>
      <img src="${base + v.image}" alt="${esc(`${m.code} — ${size}, ${c.name}`)}" fetchpriority="high">
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
        : `<button class="ui-btn ui-btn--dark" type="button" data-add-to-cart data-sku="${v.sku}" data-cart-href="${base}cart/">В корзину <span>+</span></button>`}<a class="ui-btn" href="${customHref(m, base)}">Индивидуальный расчёт <span>↗</span></a></div>
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

<section class="product-lifestyle" data-reveal>
  <img src="${base + m.architecture}" alt="${esc(m.code)} в архитектуре загородного дома" loading="lazy" decoding="async">
  <div class="product-lifestyle__copy"><small>${esc(m.code)} · ${esc(size)}</small><h2>Система внутри архитектуры</h2><p>${esc(m.use)}. Портал подбираем по проёму, планировке и маршруту движения, а не только по размеру из каталога.</p></div>
</section>

<section class="product-tech">
  <div class="p-wrap">
    <header class="product-tech__head"><h2>Инженерная спецификация</h2><p>Поставщиков и комплектующие показываем на техническом уровне. Итоговые характеристики конкретной конструкции подтверждаются после расчёта размера и стеклопакета.</p></header>
    <div class="product-tech__grid">${tech}</div>
    <ul class="product-limits">${limits}</ul>
    <div class="product-docs"><a class="product-doc" href="${systemHref(m, base)}"><div><strong>Описание системы и механики</strong><small>Схемы открывания, стеклопакеты и инженерные ориентиры</small></div><span>↗</span></a><a class="product-doc" href="${customHref(m, base)}"><div><strong>Индивидуальная конфигурация</strong><small>Другой размер, стекло, цвет или монтажный узел</small></div><span>→</span></a></div>
  </div>
</section>

<section class="product-custom">
  <div class="p-wrap product-custom__grid"><div><p class="ui-eyebrow">02 · Под проект</p><h2>Не нашли точный вариант?</h2></div><div>
    <div class="product-custom__rows">
      <div><span>01</span><div><b>Другой размер</b><p>Проверим геометрию створок и допустимый вес стекла.</p></div></div>
      <div><span>02</span><div><b>Другой RAL</b><p>Подберём цвет под фасад, кровлю и другие алюминиевые элементы.</p></div></div>
      <div><span>03</span><div><b>Стекло под задачу</b><p>Безопасность, акустика, солнцезащита и теплотехника — в одной формуле.</p></div></div>
      <div><span>04</span><div><b>Монтажный узел</b><p>Согласуем порог, чистовой пол, гидроизоляцию и наружный водоотвод.</p></div></div>
    </div>
    <a class="ui-btn ui-btn--dark" href="${customHref(m, base)}">Рассчитать индивидуально <span>→</span></a>
  </div></div>
</section>

<section class="product-contact" id="product-contact">
  <div class="p-wrap product-contact__grid"><div><p class="ui-eyebrow">03 · ${soon ? 'Старт продаж' : 'Точная смета'}</p><h2>${soon ? 'Сообщим о старте продаж' : 'Начнём с вашего проёма'}</h2><p class="product-contact__copy">${soon ? 'Оставьте телефон — позвоним, когда конфигурация станет доступна к заказу, и назовём цену. Если проект срочный, рассчитаем индивидуальную складную систему.' : 'Оставьте телефон и примерные размеры. Зафиксируем нужную конфигурацию, проверим ограничения и уточним стоимость изготовления и монтажа.'}</p></div>
    <form class="product-form" data-product-form data-endpoint="${base}forms/send.php"><input type="hidden" name="source" value="${v.sku}"><label class="product-field"><span>Имя</span><input name="name" autocomplete="name" required placeholder="Ваше имя"></label><label class="product-field"><span>Телефон</span><input name="phone" type="tel" autocomplete="tel" required placeholder="+7 999 000-00-00"></label><label class="product-field"><span>Комментарий</span><textarea name="comment" placeholder="Размер проёма, стадия строительства, пожелания"></textarea></label><button class="ui-btn ui-btn--dark" type="submit">${soon ? 'Сообщить о старте' : 'Получить расчёт'} <span>→</span></button><p class="product-form__status" data-form-status></p></form>
  </div>
</section>

<div class="mobile-buy"><div class="mobile-buy__price">${soon ? '<small>статус</small><strong>Скоро</strong>' : `<small>от</small><strong>${money(m.price)}</strong>`}</div>${soon ? '<a class="ui-btn ui-btn--dark" href="#product-contact">Узнать о старте <span>→</span></a>' : `<button class="ui-btn ui-btn--dark" type="button" data-add-to-cart data-sku="${v.sku}" data-cart-href="${base}cart/">В корзину <span>+</span></button>`}</div>
</main>
<site-footer data-base="${base}"></site-footer>
<script src="${base}assets/js/components/site-menu.js"></script>
<script src="${base}assets/js/components/site-footer.js"></script>
<script src="${base}assets/js/shop.js"></script>
<script src="${base}assets/js/product.js"></script>
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
  'catalog/index.html': {
    'hs-cards': [...hs.map(m => marketCard(m, '../')), projectCard('../systems/hs/#hs-calculator', 'project')].join('\n\n      '),
    'fs-cards': fsModels.map(m => marketCard(m, '../')).join('\n\n      '),
  },
  'systems/hs/index.html': {
    'hs-cards': [...hs.map(m => marketCard(m, '../../')), projectCard('#hs-calculator')].join('\n\n      '),
    'hs-hero-products': featured.map(m => `<a class="hs-hero-product" href="../../${firstOf(m).path}">
        <span><small>${esc(m.code)}</small><strong>${esc(sizeText(m))}</strong></span>
        <span><small>от</small><b>${money(m.price)}</b></span>
        <i>→</i>
      </a>`).join('\n      '),
  },
  'index.html': {
    'hs-mini-cards': featured.map(m => `<a class="sysx-mini-card" href="${firstOf(m).path}">
            <span class="sysx-mini-thumb"><img src="${m.image}" alt="" loading="lazy"></span>
            <span class="sysx-mini-copy"><small>${esc(m.code)} · ${m.width} × ${m.height}</small><strong>${esc(m.name)}</strong><em>от ${money(m.price)}</em></span>
            <span class="sysx-mini-arrow">→</span>
          </a>`).join('\n          '),
  },
};

// ---------- sitemap ----------
const sitemapUrls = [
  ['', 'weekly', '1.0'], ['systems/hs/', 'monthly', '0.9'], ['catalog/', 'weekly', '0.8'], ['systems/fs/', 'monthly', '0.7'],
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
  _comment: 'Сгенерировано tools/build.mjs из data/products.json — не редактировать вручную.',
  variants: variants.map(v => ({
    sku: v.sku, model: v.m.model, code: v.m.code, name: v.m.name, size: sizeText(v.m),
    color: `${v.c.name} RAL ${v.c.ral}`, scheme: v.s.label, price: v.m.price, available: v.available,
    image: v.image, url: v.path,
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
if (missingPhotos.length) console.log(`\nНе хватает фото по цветам (${missingPhotos.length}), пока стоит общее фото модели:\n  ` + missingPhotos.join('\n  '));
if (warnings.length) { console.log('\nВнимание:\n  ' + warnings.join('\n  ')); if (CHECK) process.exitCode = 1; }
