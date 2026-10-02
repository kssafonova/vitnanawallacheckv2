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
// В карточке — только основная высота (правка владельца в каталоге): «3600 × 2300 мм»
const cardSizeText = m => `${m.width} × ${m.height} мм`;
const profileSlug = m => m.profile.toLowerCase().replace(/[^a-z0-9]+/g, '-');           // ALUMARK S158 → alumark-s158
const profileCode = m => m.profile.split(' ').pop();                                    // S158
const mirrored = s => /(^B\d|-R)$/.test(s.code);
// HS/3 секции (D-L) рисуем зеркально: подвижная пара справа, движение влево — так попросила владелец
const flipModel = m => m.model === 'HS3';
const isMirror = (m, s) => mirrored(s) !== flipModel(m);                                        // зеркальные схемы
const systemName = m => (m.system === 'HS' ? 'HS-порталы' : 'FS-порталы');

// ---------- варианты ----------
// Размер модели (sizes в products.json) → «модель этого размера»: ширина, код HS2/36, название «… 3,6 м»;
// цена и чистый проход — по единым формулам (assets/js/portal-calc.js): базовое стекло HS 35 000 ₽/м², FS 55 000 ₽/м²,
// (или триплекс, если створка больше 5 м²), однотонный RAL, стандартная ручка. Остальной код работает с ней как с обычной моделью.
const portalOf = (m, z) => {
  const scheme = (m.schemes.find(s => s.code === m.default_scheme) || m.schemes[0]).code;
  const o = { type: m.system, w: z.width, h: m.height, n: m.sections, scheme, glass: 'base', color: 'mono', handle: 'standard', extraSections: [m.sections] };
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
          hasPhoto,
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

// ---------- общие куски HTML ----------
const fontPreload = base =>
  `<link rel="preload" href="${base}assets/fonts/manrope-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossorigin>\n` +
  `<link rel="preload" href="${base}assets/fonts/manrope-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>`;
const GENERATED = '<!-- Сгенерировано tools/build.mjs из data/products.json. Не редактировать вручную: правьте данные и пересобирайте. -->';
const jsonLd = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// Карточка модели «как на маркетплейсе»: фото, цена, цвет и схема переключаются прямо в карточке
// (assets/js/shop.js), кнопка «В корзину». Без JS цвета и схемы — обычные ссылки на страницы вариантов.
// rel — путь от страницы до корня сайта.
// Параметры 3D-превью карточки (assets/js/card3d.js): размер, створки, куда едут, ручки, цвета RAL, зеркальность схем.
// Раскладка в незеркальном виде, isMirror отражает её для схемы.
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
// Любую конфигурацию со сроком до 45 дней можно заказать; более долгие решения становятся проектом.
const READY_HS_TERM = 'до 30 дней';
const sectionsText = n => `${n} ${n >= 2 && n <= 4 ? 'секции' : 'секций'}`;
// Карточка модели (как на макете владельца): 3D-превью → «размер · секции» → название → «Проём:» (ширины из таблицы размеров) →
// «Схема:» → «Цвет:» (квадраты + «любой RAL») → линия → цена «за конструкцию» → кнопка «В корзину» во всю ширину.
// Проём, схема и цвет переключаются на месте (assets/js/shop.js); без JS это обычные ссылки на страницы вариантов.
// rel — путь от страницы до корня сайта; base — модель из products.json (все размеры).
function marketCard(base, rel) {
  const first = firstOf(base), m = first.m;
  // Готовые варианты всегда ссылаются на собственный индексируемый SKU-URL.
  // Состояние конфигуратора не должно создавать внутренние ссылки с GET-параметрами.
  const href = v => rel + v.path;
  const soon = m.status !== 'available';
  const s0 = first.s, c0 = first.c;
  const defaultGlass = m.triplex ? 'triplex' : 'base';
  const defaultGlassLabel = m.triplex ? 'Триплекс' : 'Базовый';
  const defaultDays = PORTAL.days(m.system, defaultGlass, false, false);
  const defaultTerm = `до ${defaultDays} дней`;
  const data = byModel(m.model).map(v => ({
    sku: v.sku, w: v.m.width, h: v.m.height, n: v.m.sections, type: v.m.system,
    code: v.m.code, name: v.m.name, price: v.m.price, passage: v.m.passage,
    passageRatio: Math.round(v.m.passage / v.m.width * 100), triplex: v.m.triplex,
    c: v.c.slug, color: `${v.c.name} RAL ${v.c.ral}`,
    s: v.s.slug, scheme: v.s.code, schemeName: v.s.short,
    href: href(v), img: rel + v.image, open: v.imageOpen ? rel + v.imageOpen : '',
  }));
  const sizes = Object.fromEntries(sizesOf(base).map(z => [z.width, {
    t: z.name, m: `${cardSizeText(z)} · ${sectionsText(z.sections)}`, p: soon ? '' : money(z.price),
    a: `${z.code} ${z.name}, ${cardSizeText(z)}`, passage: `Открытый проход ≈ ${Math.round(z.passage / z.width * 100)}%`
  }]));
  const cardConfig = {
    type: m.system, model: m.model, n: m.sections, h: m.height,
    readyWidths: sizesOf(base).map(z => z.width),
    cartHref: `${rel}cart/`, calculatorHref: `${rel}raschet/`,
  };
  const opt = (label, body) => `<div class="m-card__opt"><span class="m-card__label">${label}:</span>${body}</div>`;
  const sizeChips = `<div class="m-card__chips">${sizesOf(base).map(z => {
    const on = z.width === m.width;
    return `<a class="m-card__chip m-card__chip--num${on ? ' is-active' : ''}" href="${href(find(m.model, c0.slug, s0.slug, z.width))}" data-size="${z.width}" data-name="${metres(z.width)} м"${on ? ' aria-current="true"' : ''}>${metres(z.width)}</a>`;
  }).join('')}</div>`;
  const heightChip = `<div class="m-card__chips"><span class="m-card__chip m-card__chip--num is-active" aria-label="Высота проёма 2,3 метра">2,3 <small>м</small></span></div>`;
  const schemeChips = `<div class="m-card__chips">${m.schemes.map(s => {
    const on = s === s0;
    return `<a class="m-card__chip${on ? ' is-active' : ''}" href="${href(find(m.model, c0.slug, s.slug, m.width))}" data-scheme="${s.slug}" data-name="${esc(s.short)}"${on ? ' aria-current="true"' : ''}>${esc(s.short)}</a>`;
  }).join('')}</div>`;
  const swatches = `<div class="m-card__swatches">${m.colors.map(c => {
    const on = c === c0;
    return `<a class="m-card__swatch${on ? ' is-active' : ''}" href="${href(find(m.model, c.slug, s0.slug, m.width))}" data-color="${c.slug}" data-name="${esc(c.name)} RAL ${c.ral}" style="--sw:${c.hex}" title="${esc(c.name)} RAL ${c.ral}" aria-label="Цвет ${esc(c.name)} RAL ${c.ral}"${on ? ' aria-current="true"' : ''}></a>`;
  }).join('')}<button class="m-card__ral" type="button" data-custom-ral aria-pressed="false" title="Любой однотонный цвет RAL входит в стоимость" aria-label="Выбрать любой однотонный цвет RAL">любой RAL</button></div>`;
  const price = soon
    ? '<strong>Скоро</strong><small>цена — к старту продаж</small>'
    : `<strong data-card-price>${money(m.price)}</strong><small data-card-price-note>${defaultGlassLabel} · ${defaultTerm}</small>`;
  const action = soon
    ? `<a class="ui-btn m-card__cart" href="${href(first)}#product-contact" data-card-link data-card-hash="#product-contact">Сообщить о старте</a>`
    : defaultDays <= 45
      ? `<button class="ui-btn ui-btn--dark m-card__cart" type="button" data-card-action data-card-action-price="${m.price}" data-add-to-cart data-sku="${first.sku}" data-cart-glass="${defaultGlass}" data-cart-glass-label="${defaultGlassLabel}" data-cart-price="${m.price}" data-cart-term="${defaultTerm}" data-cart-href="${rel}cart/">В корзину <strong>${money(m.price)}</strong></button>`
      : `<button class="ui-btn ui-btn--dark m-card__cart" type="button" data-card-action data-card-action-price="${m.price}" data-card-project="${href(first)}">Обсудить проект <strong>${money(m.price)}</strong></button>`;
  const configure = soon ? '' : `<a class="m-card__configure" href="${href(first)}" data-card-link>Другой размер <span>Настроить&nbsp;→</span></a>`;
  const architecture = rel + (m.architecture || 'assets/images/projects/interior.webp');
  const photoSlides = [
    `<a class="m-card__slide" href="${href(first)}" data-card-link aria-label="Открыть карточку конструкции"><img src="${rel}${first.image}" alt="${esc(sizes[m.width].a)}" loading="lazy" decoding="async" data-card-img><span class="m-card__state-label">Закрыто</span></a>`,
    first.imageOpen ? `<a class="m-card__slide" href="${href(first)}" data-card-link aria-label="Открытый вид конструкции"><img src="${rel}${first.imageOpen}" alt="${esc(m.name)} в открытом виде" loading="lazy" decoding="async" data-card-img-open><span class="m-card__state-label">Открыто</span></a>` : '',
    `<a class="m-card__slide" href="${href(first)}" data-card-link aria-label="Смотреть конструкцию в архитектуре"><img src="${architecture}" alt="${esc(m.name)} в архитектуре дома" loading="lazy" decoding="async"></a>`,
  ].filter(Boolean);
  const slideCount = photoSlides.length + 1;
  return `<article class="m-card${soon ? ' m-card--soon' : ''}" data-card data-card-config="${esc(JSON.stringify(cardConfig))}" data-variants="${esc(JSON.stringify(data))}" data-sizes="${esc(JSON.stringify(sizes))}" data-3d="${esc(JSON.stringify(model3d(m)))}">
        <div class="m-card__media" data-card-gallery>
          <div class="m-card__media-track" data-card-gallery-track>
            <div class="m-card__slide m-card__slide--3d" data-card-3d-stage>
              <img src="${rel}${first.image}" alt="" loading="lazy" decoding="async" data-card-3d-fallback>
            </div>
            ${photoSlides.join('\n            ')}
          </div>
          <div class="m-card__media-price">${price}</div>
          <div class="m-card__gallery-nav" data-card-gallery-nav>
            <button type="button" data-card-gallery-prev aria-label="Предыдущий кадр">←</button>
            <span class="m-card__gallery-count" aria-live="polite"><b data-card-gallery-current>1</b> / ${slideCount}</span>
            <button type="button" data-card-gallery-next aria-label="Следующий кадр">→</button>
          </div>
          ${soon ? '<span class="m-card__badge">Скоро в продаже</span>' : ''}
        </div>
        <div class="m-card__body">
          <p class="m-card__meta" data-card-meta>${esc(sizes[m.width].m)}</p>
          <a class="m-card__title" href="${href(first)}" data-card-link data-card-title>${esc(m.name)}</a>
          <p class="m-card__facts"><span>Алюминий</span><span data-card-passage>${esc(sizes[m.width].passage)}</span></p>
          ${opt('Высота проёма (м)', heightChip)}
          ${opt('Ширина проёма (м)', sizeChips)}
          ${opt(esc(m.scheme_title), schemeChips)}
          ${opt('Цвет', swatches)}
          <div class="m-card__buy">${configure}${action}</div>
        </div>
      </article>`;
}

// Калькулятор HS (assets/js/quick-calc.js) живёт на отдельной странице /raschet/.
// Цены моделей по числу секций — из products.json; фото — рендеры моделей (светлая рама — если есть белый цвет).
const hsAvail = () => data.models.filter(m => m.system === 'HS' && m.status === 'available');
// Готовые двери для калькулятора (data-doors) — все размеры из таблицы. Совпали тип HS, ширина, створки, одна из стандартных
// высот (hs), схема есть у модели, стандартная комплектация (стекло по умолчанию, однотонный RAL, стандартная ручка) —
// это товар из каталога (цена и срок зависят от стеклопакета, «В корзину»), иначе — индивидуальный проект.
const calcReady = rel => JSON.stringify(hsAvail().flatMap(sizesOf).sort((a, b) => a.width - b.width || a.sections - b.sections).map(m => ({
  n: m.sections, w: m.width, h: m.height, hs: m.heights, price: m.price, code: m.code, name: m.name, passage: m.passage,
  schemes: Object.fromEntries(m.schemes.map(s => { const v = find(m.model, m.colors[0].slug, s.slug, m.width); return [s.code, { sku: v.sku, url: rel + v.path, img: rel + v.image }]; })),
  def: defScheme(m).code,
})));
const calcBox = (rel, attrs = {}) => {
  const all = { doors: calcReady(rel), term: READY_HS_TERM, base: rel, ...attrs };
  return `<div class="qc-root" data-quick-calc ${Object.entries(all).map(([k, v]) => `data-${k}="${esc(String(v))}"`).join(' ')}></div>`;
};
// Блок «Цена по размерам проёма» на главной и странице HS — инженерный чертёж проёма (assets/js/opening-draw.js):
// ширина и высота вводятся на размерных линиях, число створок подбирается само, цена — сразу; дальше /raschet/?w=&h=&n=.
function calcTeaser(rel, eyebrow, title = 'Цена раздвижной двери по размерам проёма', copy = 'Введите ширину и высоту проёма — сразу покажем цену. Если размер совпадёт с готовой дверью из каталога, предложим её.') {
  return `<div class="qc-draw" data-open-teaser data-doors="${esc(calcReady(rel))}" data-term="${esc(READY_HS_TERM)}" data-href="${rel}raschet/">
      <header class="qc-draw__head"><p class="ui-eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2><p>${esc(copy)}</p></header>
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
      return [L.key, { label: s.short[0].toUpperCase() + s.short.slice(1), code: s.code, sections: m.sections, moving: L.moving, targets: L.targets,
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
          <span class="m-card__note">Другой размер, стекло или порог — посчитаем в калькуляторе за пару минут.</span>
          <span class="m-card__buy"><span class="ui-btn ui-btn--light m-card__cart">Рассчитать <span>→</span></span><span class="m-card__price"><strong>По расчёту</strong><small>под ваш проём</small></span></span>
        </span>
      </a>`;
}

// ---------- семейная карточка системы ----------
// Две пользовательские PDP собирают все размеры, секции, схемы, цвета и стеклопакеты
// в одном конфигураторе. Статические страницы вариантов сохраняются для SEO и фида.
function familyPage(type, preset = null) {
  const familyModels = data.models.filter(m => m.system === type && m.status === 'available');
  const base = preset ? '../../../' : '../../';
  const cat = type === 'HS' ? 'hs-portaly' : 'fs-portaly';
  const pathName = preset ? preset.path : `catalog/${cat}/`;
  const url = SITE + pathName;
  const defaultBase = preset?.m.base || (type === 'HS' ? familyModels.find(m => m.model === 'HS2') : familyModels.find(m => m.model === 'FS4'));
  const defaultModel = preset?.m || defSize(defaultBase || familyModels[0]);
  const initialImage = preset?.image || defaultBase.render?.closed || defaultBase.image;
  const initialOpen = preset?.imageOpen || defaultBase.render?.open || '';
  const normalizeScheme = code => type === 'FS' ? (/-R$/.test(code) ? 'FS-R' : 'FS-L') : code;
  const colors = [...new Map(familyModels.flatMap(m => m.colors).map(c => [c.slug, c])).values()];
  const ready = variants.filter(v => v.m.system === type && v.available).map(v => ({
    sku: v.sku, model: v.m.model, code: v.m.code, name: v.m.name,
    w: v.m.width, h: v.m.height, n: v.m.sections,
    scheme: normalizeScheme(v.s.code), sourceScheme: v.s.code, schemeName: v.s.short,
    color: v.c.slug, colorName: `${v.c.name} RAL ${v.c.ral}`, hex: v.c.hex,
    price: v.m.price, passage: v.m.passage, triplex: v.m.triplex,
    image: base + v.image, open: v.imageOpen ? base + v.imageOpen : '', hasPhoto: v.hasPhoto,
    photos: v.hasPhoto ? [
      { src: base + v.image, alt: `${v.m.name}, ${v.m.sections} ${v.m.sections >= 2 && v.m.sections <= 4 ? 'секции' : 'секций'}, закрыто`, label: 'Закрыто' },
      ...(v.imageOpen ? [{ src: base + v.imageOpen, alt: `${v.m.name}, ${v.m.sections} ${v.m.sections >= 2 && v.m.sections <= 4 ? 'секции' : 'секций'}, открыто`, label: 'Открыто' }] : []),
      ...((v.m.gallery || []).map((src, i) => ({ src: base + src, alt: `${v.m.name} в интерьере`, label: `В интерьере ${i + 1}` }))),
    ] : [],
    url: base + v.path,
  }));
  const modelsBySections = Object.fromEntries(familyModels.map(m => [m.sections, {
    model: m.model, n: m.sections, profile: m.profile, hardware: m.hardware, track: m.track,
    frameDepth: m.frame_depth, sashDepth: m.sash_depth, filling: m.filling,
    image: base + (m.render?.closed || m.image), open: m.render?.open ? base + m.render.open : '',
    architecture: base + m.architecture,
  }]));
  const family3d = {
    dynamic: true, sys: type, w: defaultModel.width, h: defaultModel.height, n: defaultModel.sections,
    scheme: normalizeScheme(preset?.s.code || defScheme(defaultBase).code),
    colors: Object.fromEntries(colors.map(c => [c.slug, c.hex])),
  };
  const familyConfig = {
    type, cat, cartHref: `${base}cart/`, familyHref: `${base}catalog/${cat}/`,
    default: { w: defaultModel.width, h: defaultModel.height, n: defaultModel.sections, scheme: normalizeScheme(preset?.s.code || defScheme(defaultBase).code), color: preset?.c.slug || defaultBase.colors[0].slug, glass: defaultModel.triplex ? 'triplex' : 'base' },
    limits: PORTAL.LIMITS[type], colors, ready, models: modelsBySections,
  };
  const low = Math.min(...ready.map(x => x.price)), high = Math.max(...ready.map(x => x.price));
  const familyTitle = type === 'HS'
    ? `HS-порталы — конфигуратор подъёмно-сдвижных дверей | ${BRAND}`
    : `Складные двери-гармошки FS — конфигуратор | ${BRAND}`;
  const familyDescription = type === 'HS'
    ? 'Подберите алюминиевый HS-портал по размеру проёма: 2–6 секций, схемы открывания, любой цвет RAL и стеклопакет. Цена и срок онлайн.'
    : 'Подберите алюминиевую складную дверь-гармошку FS по размеру проёма: 2–8 секций, схема складывания, любой цвет RAL и стеклопакет.';
  const title = preset ? `${preset.m.code} ${preset.m.name} — ${preset.m.width} × ${preset.m.height} мм, ${preset.c.name} RAL ${preset.c.ral} | ${BRAND}` : familyTitle;
  const description = preset ? `${preset.m.title} ${preset.m.width} × ${preset.m.height} мм, ${preset.c.name} RAL ${preset.c.ral}, ${preset.s.label}. Настройте размер, секции, стеклопакет и цвет на одной странице.` : familyDescription;
  const heading = type === 'HS' ? 'Подъёмно-сдвижной HS-портал' : 'Складная дверь-гармошка FS';
  const eyebrow = type === 'HS' ? 'HS · Lift & Slide' : 'FS · Fold & Slide';
  const lead = type === 'HS'
    ? 'Одна система вместо десятков карточек. Задайте проём — покажем допустимые секции, схемы, чистый проход, срок и стоимость.'
    : 'Настройте складную панорамную дверь под свой проём. Алгоритм проверит габариты, предложит число секций и рассчитает проект.';
  const product = preset ? {
    '@context': 'https://schema.org', '@type': 'Product', name: `${preset.m.name} ${preset.m.code}`, sku: preset.sku, url,
    image: [SITE + preset.image], description, brand: { '@type': 'Brand', name: BRAND }, category: type === 'HS' ? 'Подъёмно-сдвижные двери' : 'Складные двери-гармошки',
    color: `${preset.c.name} RAL ${preset.c.ral}`, inProductGroupWithID: preset.m.model,
    offers: { '@type': 'Offer', url, priceCurrency: 'RUB', price: String(preset.m.price), availability: 'https://schema.org/MadeToOrder', itemCondition: 'https://schema.org/NewCondition' },
  } : {
    '@context': 'https://schema.org', '@type': 'Product', name: heading, url,
    image: [SITE + initialImage], description,
    brand: { '@type': 'Brand', name: BRAND }, category: type === 'HS' ? 'Подъёмно-сдвижные двери' : 'Складные двери-гармошки',
    offers: { '@type': 'AggregateOffer', priceCurrency: 'RUB', lowPrice: String(low), highPrice: String(high), offerCount: String(ready.length), availability: 'https://schema.org/MadeToOrder' },
  };
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [['Главная', SITE], ['Каталог', SITE + 'catalog/'], [type === 'HS' ? 'HS-порталы' : 'FS-порталы', SITE + `catalog/${cat}/`], ...(preset ? [[preset.m.code, url]] : [])].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
  };
  const specs = type === 'HS'
    ? [['Система', 'Подъёмно-сдвижная'], ['Профиль', 'Алюминий · тёплый контур'], ['Секции', '2, 3, 4 или 6'], ['Высота', 'до 3 700 мм']]
    : [['Система', 'Складная панорамная'], ['Профиль', 'ALUMARK S70'], ['Фурнитура', 'Patio Fold'], ['Высота', 'до 2 800 мм']];
  const interiorPhotos = type === 'HS'
    ? [
        ['assets/images/family/interiors/hs-winter-interior.webp', 'HS-портал в интерьере загородного дома', 'Тёплый выход на террасу'],
        ['assets/images/family/interiors/hs-installation.jpg', 'Монтаж подъёмно-сдвижного HS-портала', 'Портал на этапе монтажа'],
      ]
    : [
        ['assets/images/family/interiors/fs-black-open.jpg', 'Чёрная складная дверь-гармошка в открытом положении', 'Открытый фасад без лишних стоек'],
        ['assets/images/family/interiors/fs-white-open.jpg', 'Белая складная система FS на объекте', 'Складная система на этапе отделки'],
        ['assets/images/family/interiors/fs-before-after.jpg', 'Остекление проёма складной системой до и после', 'До и после остекления'],
      ];

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
<meta property="og:title" content="${esc(heading)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE + initialImage}">
<link rel="stylesheet" href="${base}assets/css/quick-calc.css?v=3">
<link rel="stylesheet" href="${base}assets/css/family-product.css?v=3">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
${jsonLd(product)}
${jsonLd(crumbs)}
</head>
<body class="family-page" data-family-product>
<site-menu data-base="${base}"></site-menu>
<main>
  <nav class="crumbs" aria-label="Хлебные крошки"><div class="ui-wrap crumbs__in"><a href="${base}">Главная</a><span aria-hidden="true">—</span><a href="${base}catalog/">Каталог</a><span aria-hidden="true">—</span><span aria-current="page">${type}-порталы${preset ? ` · ${esc(preset.m.code)}` : ''}</span></div></nav>
  <section class="family-hero">
    <div class="family-hero__grid">
      <div class="family-gallery" data-family-gallery>
        <figure class="family-gallery__slide family-render" data-family-render-slide data-family-3d data-3d="${esc(JSON.stringify(family3d))}">
          <div class="family-render__stage" data-family-render-stage><img data-family-render src="${base + initialImage}" alt="${esc(heading)}, закрыто" fetchpriority="high"><img class="family-render__open" data-family-render-open src="${initialOpen ? base + initialOpen : ''}" alt="${esc(heading)}, открыто"></div>
          <div class="family-render__states" role="group" aria-label="Вид конструкции"><button class="is-active" type="button" data-family-state="closed" aria-pressed="true">Закрыто</button><button type="button" data-family-state="open" aria-pressed="false">Открыто</button></div>
          <div class="family-render__caption"><span>Конфигурация обновляется</span><strong data-family-visual-name>${defaultModel.sections} секции · ${defaultModel.width} × ${defaultModel.height} мм</strong></div>
          <figcaption>01 · Конструкция</figcaption>
        </figure>
        <a class="family-gallery__interior-link" href="#family-interiors" data-family-interior-link>Смотреть в интерьере <span aria-hidden="true">↓</span></a>
      </div>
      <aside class="family-buy">
        <p class="ui-eyebrow">${eyebrow}</p>
        <h1 data-family-main-title>${preset ? esc(preset.m.name) : heading}</h1>
        <p class="family-buy__lead" data-family-subtitle>${preset ? `${metres(preset.m.width)} м · ${sectionsText(preset.m.sections)} · ${esc(preset.s.short)}` : lead}</p>
        <div class="family-price"><div><small>Ориентировочная стоимость</small><strong data-family-price></strong><span>за выбранную конструкцию</span></div><p><b data-family-term></b><em data-family-mode></em></p></div>
        <div class="family-facts"><div><small>Материал</small><strong>Алюминий</strong></div><div><small>Открытый проход</small><strong data-family-passage></strong></div><div><small>Секции</small><strong data-family-sections-summary></strong></div></div>
        <section class="family-config" aria-labelledby="family-config-title">
          <header><span id="family-config-title">Настройте конструкцию</span><small>цена и срок пересчитываются сразу</small></header>
          <div class="family-step family-step--size">
            <div class="family-step__head"><span>01</span><div><b>Размер проёма</b><small>готовая ширина или точный размер в миллиметрах</small></div></div>
            <div class="family-widths" data-family-widths></div>
            <div class="family-size"><label><span>Ширина, мм</span><input type="number" inputmode="numeric" min="${PORTAL.LIMITS[type].wMin}" max="${PORTAL.LIMITS[type].wMax}" step="10" data-family-width value="${defaultModel.width}"></label><label><span>Высота, мм</span><input type="number" inputmode="numeric" min="${PORTAL.LIMITS[type].hMin}" max="${PORTAL.LIMITS[type].hMax}" step="10" data-family-height value="${defaultModel.height}"></label><button type="button" data-family-apply-size>Применить</button></div>
            <p class="family-status" data-family-status aria-live="polite"></p>
          </div>
          <div class="family-step family-step--sections"><div class="family-step__head"><span>02</span><div><b>Количество секций</b><small>доступно для выбранной ширины</small></div></div><div class="family-options" data-family-sections></div></div>
          <div class="family-step family-step--schemes"><div class="family-step__head"><span>03</span><div><b>Схема открывания</b><small data-family-scheme-copy></small></div></div><div class="family-options family-options--schemes" data-family-schemes></div></div>
          <div class="family-step family-step--colors"><div class="family-step__head"><span>04</span><div><b>Цвет профиля</b><small>любой однотонный RAL — без доплаты</small></div></div><div class="family-colors" data-family-colors></div></div>
          <details class="family-glass"><summary><span><i>05</i><b>Стеклопакет</b></span><strong data-family-glass-label>Базовый</strong></summary><div class="family-glass__body" data-family-glasses></div></details>
        </section>
        <details class="family-included" open><summary><b>Что входит в цену</b><span aria-hidden="true"></span></summary><div>Алюминиевый профиль, выбранный стеклопакет, фурнитура ${type === 'HS' ? 'Patio Lift' : 'Patio Fold'} и любой цвет RAL. <em>Доставка и монтаж рассчитываются после подтверждения заказа.</em></div></details>
        <div class="family-actions"><div class="family-actions__price"><div><small>Итоговая стоимость</small><em data-family-term-copy></em></div><strong data-family-price-copy></strong></div><button class="ui-btn ui-btn--dark" type="button" data-family-buy></button></div>
      </aside>
    </div>
  </section>

  <section class="family-configuration" id="family-configuration">
    <div class="p-wrap">
      <div class="family-configuration__intro"><p class="ui-eyebrow">01 · Конфигурация и спецификация</p><div><h2 data-family-config-heading></h2><p data-family-config-copy></p></div></div>
      <div class="family-configuration__grid">
        <div class="family-configuration__drawing" data-family-scheme-drawing aria-label="Схема выбранного открывания"></div>
        <dl class="family-configuration__facts">
          <div><dt>Размер</dt><dd data-family-config-size></dd></div>
          <div><dt>Конфигурация</dt><dd data-family-config-layout></dd></div>
          <div><dt>Схема</dt><dd data-family-config-scheme></dd></div>
          <div><dt>Как работает</dt><dd data-family-config-how></dd></div>
          <div><dt>Цвет</dt><dd data-family-config-color></dd></div>
        </dl>
      </div>
      <div class="family-configuration__spec family-tech">
        <header><h2>Инженерная спецификация</h2><p>Параметры меняются вместе с выбранным числом секций и схемой открывания.</p></header>
        <div class="family-tech__grid"><div><small>Ширина проёма</small><strong data-family-result-size></strong></div><div><small>Секции</small><strong data-family-sections-summary-spec></strong></div><div><small>Схема</small><strong data-family-result-scheme></strong></div><div><small>Чистый проход</small><strong data-family-result-passage></strong></div>${specs.map(([a,b]) => `<div><small>${a}</small><strong>${b}</strong></div>`).join('')}<div><small>Глубина рамы</small><strong data-family-frame></strong></div><div><small>Стеклопакет</small><strong data-family-tech-glass></strong></div><div><small>Ширина створки</small><strong data-family-leaf></strong></div><div><small>Статус</small><strong data-family-tech-status></strong></div></div>
      </div>
    </div>
  </section>

  <section class="family-interiors" id="family-interiors">
    <div class="p-wrap family-interiors__layout">
      <header><div><p class="ui-eyebrow">На объектах</p><h2>Смотреть в интерьере</h2></div><p>${type === 'HS' ? 'Как подъёмно-сдвижной портал работает в тёплом контуре и выглядит на этапе установки.' : 'Как складная система освобождает проём и объединяет интерьер с террасой.'}</p></header>
      <div class="family-interiors__list">${interiorPhotos.map(([src, alt, caption], i) => `<figure><img src="${base + src}" alt="${esc(alt)}" loading="lazy" decoding="async"><figcaption><span>${String(i + 1).padStart(2, '0')}</span><strong>${esc(caption)}</strong></figcaption></figure>`).join('')}</div>
    </div>
  </section>

  <section class="family-seo"><div class="p-wrap family-seo__grid"><div><p class="ui-eyebrow">Как выбрать</p><h2>${type === 'HS' ? 'Панорама, тепло и лёгкое открывание' : 'Почти полностью открытый проём'}</h2></div><div><p>${type === 'HS' ? 'HS-портал подходит для тёплого выхода из гостиной на террасу, панорамного фасада и широких проёмов. Створка приподнимается и плавно сдвигается вдоль направляющей.' : 'Складная система FS собирает створки в компактную пачку у края проёма. Это решение для террас, веранд, ресторанов и пространств, где важно максимально объединить интерьер с улицей.'}</p><p>Введите фактический размер проёма: система сама оставит только допустимое число секций и схемы, рассчитает ориентировочный проход, стоимость и срок изготовления.</p><a href="${base}${type === 'HS' ? 'systems/hs/' : 'systems/fs/'}">Подробнее о системе <span>→</span></a></div></div></section>

  <section class="product-contact" id="product-contact"><div class="p-wrap product-contact__grid"><div class="product-contact__intro"><p class="ui-eyebrow">Проверка инженером</p><h2>Нужен сложный проём или монтажный узел?</h2><p class="product-contact__copy">Пришлите размеры или проект. Проверим вес створок, стеклопакет, порог, водоотвод и подготовим точную смету.</p></div><lead-form data-base="${base}" data-source="FAMILY-${type}" data-context="Конфигуратор ${type}-портала" data-cta="Отправить проект инженеру"></lead-form></div></section>
</main>
<div class="family-mobile-buy"><div><small data-family-mobile-label>Стоимость</small><strong data-family-mobile-price></strong></div><button class="ui-btn ui-btn--dark" type="button" data-family-buy-mobile></button></div>
<script type="application/json" id="family-config">${JSON.stringify(familyConfig).replace(/</g, '\\u003c')}</script>
<site-footer data-base="${base}"></site-footer>
<script src="${base}assets/js/components/site-menu.js"></script>
<script src="${base}assets/js/components/site-footer.js"></script>
<script src="${base}assets/js/portal-calc.js?v=3"></script>
<script src="${base}assets/js/opening-draw.js?v=3"></script>
<script src="${base}assets/js/shop.js?v=3"></script>
<script src="${base}assets/js/family-product.js?v=3"></script>
<script type="module" src="${base}assets/js/card3d.js?v=3"></script>
<script src="${base}assets/js/components/lead-form.js"></script>
</body>
</html>`;
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
  // «Системы» (блок «Открыть пространство») — отдельная страница /systems/, плашки готовых HS
  'systems/index.html': {
    'hs-mini-cards': featured.map(m => {
      const v = firstOf(m.base);
      return `<a class="sx-strip" href="../${v.path}"><small>${esc(m.code)}</small><strong>${(m.width / 1000).toFixed(1).replace('.', ',')} × ${(m.height / 1000).toFixed(1).replace('.', ',')} м</strong><em>${money(m.price)}</em><i aria-hidden="true">→</i></a>`;
    }).join('\n          '),
  },
  'index.html': {
    'home-cards': [...hs.map(m => marketCard(m, '')), projectCard('raschet/')].join('\n\n      '),
    'home-calc': calcTeaser('', 'Калькулятор'),
  },
};

// ---------- sitemap ----------
const sitemapUrls = [
  ['', 'weekly', '1.0'], ['systems/', 'monthly', '0.8'], ['systems/hs/', 'monthly', '0.9'], ['catalog/', 'weekly', '0.8'], ['catalog/hs-portaly/', 'weekly', '0.9'], ['catalog/fs-portaly/', 'weekly', '0.9'], ['systems/fs/', 'monthly', '0.7'],
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
outputs.set('catalog/hs-portaly/index.html', familyPage('HS'));
outputs.set('catalog/fs-portaly/index.html', familyPage('FS'));
for (const v of variants) outputs.set(v.path + 'index.html', familyPage(v.m.system, v));
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
  // Для корзины: предварительная оценка доставки + монтажа (самовывоза нет)
  services: (({ _comment, ...s }) => s)(config.services || {}),
  variants: variants.map(v => ({
    sku: v.sku, system: v.m.system, model: v.m.model, code: v.m.code, name: v.m.name, size: sizeText(v.m), width: v.m.width, height: v.m.height, sections: v.m.sections, size_short: `${metres(v.m.width)} м`,
    color: `${v.c.name} RAL ${v.c.ral}`, color_slug: v.c.slug, hex: v.c.hex,
    scheme: v.s.label, scheme_code: v.s.code, scheme_slug: v.s.slug, scheme_short: v.s.short, scheme_title: v.m.scheme_title,
    price: v.m.price, available: v.available, triplex: v.m.triplex, default_glass: v.m.triplex ? 'triplex' : 'base',
    default_glass_label: v.m.triplex ? 'Триплекс' : 'Базовый', default_term: `до ${PORTAL.days(v.m.system, v.m.triplex ? 'triplex' : 'base', false, false)} дней`,
    image: v.image, image_open: v.imageOpen, url: v.path,
  })),
}, null, 2) + '\n');

// Лишние папки вариантов (переименованные или удалённые из данных)
const stale = [];
for (const cat of ['catalog/hs-portaly', 'catalog/fs-portaly']) {
  if (!exists(cat)) continue;
  for (const dir of fs.readdirSync(path.join(ROOT, cat))) {
    const entry = path.join(ROOT, cat, dir);
    if (fs.statSync(entry).isDirectory() && !variants.some(v => v.path === `${cat}/${dir}/`)) stale.push(`${cat}/${dir}`);
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
