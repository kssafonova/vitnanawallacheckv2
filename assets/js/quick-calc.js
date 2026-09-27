/* Онлайн-калькулятор порталов — страница /raschet/ ([data-quick-calc]), по ТЗ владельца. Один экран без шагов (решение владельца),
   блоки идут в порядке шагов ТЗ: тип портала и размер → секции (доступные по ширине, «Рекомендуем», проход) → схема открывания
   (эскизы со стрелками; у FS — «Активная рабочая дверь» для 3, 5, 7 секций) → стеклопакет, цвет профиля, ручка → итог:
   чертёж, техническое резюме, цена крупно, дисклеймер и форма «Получить точную смету проекта в PDF».
   Правила и цена — assets/js/portal-calc.js (PSPortal), чертёж и выбор размера — assets/js/opening-draw.js (PSOpening).
   Готовая дверь каталога (data-doors: HS, размер из таблицы, схема модели, стандартная комплектация) — цена каталога, срок data-term,
   «В корзину»; всё остальное — индивидуальный заказ, цена ориентировочная.
   Адрес принимает ?type=HS&w=3600&h=2300&n=2&scheme=A-R&glass=standard&color=mono&handle=standard&door=1&from=… */
(() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TYPES = [
    { k: 'HS', t: 'Раздвижная', d: 'HS · подъёмно-раздвижная дверь, усиленный термопрофиль' },
    { k: 'FS', t: 'Складная', d: 'FS · дверь-гармошка, стандартный термопрофиль' },
  ];

  // Эскиз схемы для кнопки: рама, створки, стрелки движения (раскладка — PSPortal.layout)
  function icon(P, type, n, code, door) {
    const L = P.layout(type, n, code, door), W = 64, H = 34, pw = (W - 4) / L.length;
    let g = `<rect x="1" y="1" width="${W - 2}" height="${H - 2}"/>`;
    L.forEach((lf, i) => {
      const x = 2 + pw * i, cx = x + pw / 2;
      if (i) g += `<path d="M${x.toFixed(1)} 2V${H - 2}"/>`;
      if (lf.kind === 'fold' || lf.kind === 'door') g += `<path class="i-fold" d="M${(lf.dir < 0 ? x + pw - 1 : x + 1).toFixed(1)} 3L${(lf.dir < 0 ? x + 1 : x + pw - 1).toFixed(1)} ${H / 2}L${(lf.dir < 0 ? x + pw - 1 : x + 1).toFixed(1)} ${H - 3}"/>`;
      if (lf.kind === 'move' || (lf.kind === 'fold' && i === (lf.dir < 0 ? 0 : L.length - 1))) {
        const d = lf.dir || 1, a = cx - d * Math.min(pw * .32, 8), b = cx + d * Math.min(pw * .32, 8);
        g += `<path class="i-arrow" d="M${a.toFixed(1)} ${H / 2}H${b.toFixed(1)}M${(b - d * 3).toFixed(1)} ${H / 2 - 3}L${b.toFixed(1)} ${H / 2}L${(b - d * 3).toFixed(1)} ${H / 2 + 3}"/>`;
      }
    });
    return `<svg class="qcx__ico" viewBox="0 0 ${W} ${H}" aria-hidden="true">${g}</svg>`;
  }

  function init(root) {
    const P = window.PSPortal, O = window.PSOpening;
    if (root.dataset.ready || !P || !O) return;
    root.dataset.ready = '1';
    const d = root.dataset;
    let ready = [];
    try { ready = JSON.parse(d.doors || '[]'); } catch (_) { ready = []; }
    const term = d.term || '30–60 дней';
    const q = d.url ? new URLSearchParams(location.search) : new URLSearchParams();
    const qn = k => { const v = parseInt(q.get(k), 10); return Number.isFinite(v) && v > 0 ? v : 0; };
    const oneOf = (v, list, def) => (list.some(x => x.k === v) ? v : def);
    const from = (q.get('from') || '').slice(0, 160);
    const st = {
      type: q.get('type') === 'FS' ? 'FS' : 'HS', w: qn('w') || 3600, h: qn('h') || 2300, n: qn('n'), scheme: q.get('scheme') || '',
      glass: oneOf(q.get('glass'), P.GLASS, 'standard'), color: oneOf(q.get('color'), P.COLORS, 'mono'),
      handle: oneOf(q.get('handle'), P.HANDLES, 'standard'), door: q.get('door') === '1',
    };

    // Секции: по ТЗ 1.3 + число створок готовой двери этой ширины (например, HS4/48 из таблицы размеров)
    const sections = () => {
      const S = P.sectionsFor(st.type, st.w);
      const extra = st.type === 'HS' ? ready.filter(r => r.w === st.w && (r.hs || [r.h]).includes(st.h)).map(r => r.n) : [];
      return { list: [...new Set([...S.list, ...extra])].sort((a, b) => a - b), rec: S.rec, extra };
    };
    const fixState = () => {
      const S = sections();
      if (!S.list.includes(st.n)) st.n = S.rec;
      if (!P.schemesFor(st.type, st.n).some(s => s.code === st.scheme)) {
        const r = O.matchReady(ready, st);
        st.scheme = r && r.schemes[r.def] ? r.def : P.schemesFor(st.type, st.n)[0].code;
      }
      if (!P.doorAllowed(st.type, st.n)) st.door = false;
    };
    fixState();

    const seg = (group, items, cur, cls = '') => `<div class="qcx__seg${cls}" role="group">${items.map(x =>
      `<button type="button" data-${group}="${x.k}" aria-pressed="${x.k === cur}"><b>${esc(x.t)}</b>${x.d ? `<small>${esc(x.d)}</small>` : ''}</button>`).join('')}</div>`;
    root.innerHTML = `
<div class="qcx">
  <header class="qcx__head">
    ${d.eyebrow ? `<p class="ui-eyebrow">${esc(d.eyebrow)}</p>` : ''}
    ${d.h1 ? '<h1>Калькулятор стоимости портальной системы</h1>' : '<h2>Калькулятор стоимости портальной системы</h2>'}
    ${from ? `<p class="qcx__from">По товару: ${esc(from)}</p>` : ''}
  </header>
  <div class="qcx__grid">
    <div class="qcx__left">
      <div class="qcx__draw" data-qcx-draw></div>
      <ul class="qcx__sum" data-qcx-sum></ul>
    </div>
    <div class="qcx__side">
      <div class="qcx__row"><span class="qcx__lbl">Тип портала</span>${seg('type', TYPES, st.type, ' qcx__seg--wide')}</div>
      <div class="qcx__row qcx__row--size" data-qcx-size></div>
      <div class="qcx__row"><span class="qcx__lbl">Количество секций</span><div data-qcx-sections></div></div>
      <div class="qcx__row"><span class="qcx__lbl">Схема открывания</span><div data-qcx-schemes></div><p class="qcx__desc" data-qcx-scheme-desc></p></div>
      <div class="qcx__row" data-qcx-door-row hidden><div class="qcx__seg qcx__seg--multi" role="group"><button type="button" data-door aria-pressed="false"><i aria-hidden="true"></i><b>Активная рабочая дверь</b><small>крайняя створка открывается как распашная — без складывания всей «гармошки»</small></button></div></div>
      <div class="qcx__row"><span class="qcx__lbl">Стеклопакет · закалённое стекло 6 мм</span>${seg('glass', P.GLASS, st.glass, ' qcx__seg--stack')}<p class="qcx__desc" data-qcx-glass-note></p></div>
      <div class="qcx__row"><span class="qcx__lbl">Цвет профиля</span>${seg('color', P.COLORS, st.color, ' qcx__seg--stack')}</div>
      <div class="qcx__row"><span class="qcx__lbl">Ручка</span>${seg('handle', P.HANDLES, st.handle, ' qcx__seg--stack')}</div>
      <div class="qcx__price"><small data-qcx-kind></small><strong data-qcx-price></strong><span data-qcx-sub></span></div>
      <div class="qcx__res" data-qcx-res></div>
      <p class="qcx__note" data-qcx-note></p>
      <p class="qcx__disc">Внимание! Стоимость является предварительной за базовое изделие. Доставка спецтехникой, монтажные работы и интеграция скрытого плоского порога с дренажной системой рассчитываются индивидуально инженером после точного замера на объекте.</p>
    </div>
  </div>
  <div class="qcx__send">
    <p class="qcx__send-title" data-qcx-send-title>Точная смета и бесплатный замер</p>
    <lead-form data-base="${esc(d.base || '../')}" data-source="calculator" data-cta="Получить точную смету проекта в PDF"${d.context ? ` data-context="${esc(d.context)}"` : ''}></lead-form>
  </div>
</div>`;

    const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
    const draw = O.mount($('[data-qcx-draw]'), st);
    const size = O.sizeControl($('[data-qcx-size]'), { doors: ready, type: st.type, w: st.w, h: st.h, n: st.n, onChange: v => { Object.assign(st, { w: v.w, h: v.h, n: v.n }); fixState(); update(); } });
    const form = $('lead-form');

    // Готовая дверь каталога: HS, размер из таблицы, схема есть у модели, стандартная комплектация
    function readyDoor() {
      const r = O.matchReady(ready, st);
      if (!r) return { r: null, why: '' };
      const v = r.schemes[st.scheme];
      const std = st.glass === P.glassFor(st.w, st.h, st.n, 'standard') && st.color === 'mono' && st.handle === 'standard';
      if (!v || !std) return { r: null, why: `Размер как у готовой двери ${r.code}, но ${!v ? 'с этой схемой' : 'с такой комплектацией'} это индивидуальный заказ.` };
      return { r, v };
    }

    function summary(price, kind, pass, vErr) {
      const sc = P.schemeOf(st.type, st.n, st.scheme);
      return [
        kind, `Тип: ${st.type === 'HS' ? 'HS — раздвижная портальная дверь' : 'FS — складная дверь-гармошка'}`,
        `Проём: ${st.w} × ${st.h} мм`, `Секции: ${st.n}`, `Схема: ${sc.code} — ${sc.d}${st.door ? ' + активная рабочая дверь' : ''}`,
        `Рама: ${P.frameDepth(st.type, st.n, st.scheme)} мм`, `Чистый проход: ≈ ${pass} мм`,
        `Стеклопакет: ${P.GLASS.find(g => g.k === P.glassFor(st.w, st.h, st.n, st.glass)).code}`,
        `Цвет: ${P.COLORS.find(c => c.k === st.color).code}`, `Ручка: ${P.HANDLES.find(x => x.k === st.handle).code}`,
        `Цена: ${price ? P.fmt(price) + ' ₽ (предварительно, без доставки, монтажа и порога)' : vErr || 'по расчёту'}`,
        from ? `Со страницы: ${from}` : '',
      ].filter(Boolean).join('\n');
    }

    function update() {
      const S = sections(), v = P.validate(st.type, st.w, st.h);
      // секции — доступные по ширине, у каждой проход; «Рекомендуем» по ТЗ
      $('[data-qcx-sections]').innerHTML = `<div class="qcx__seg qcx__seg--cols" role="group">${S.list.map(n => {
        const sc = P.schemesFor(st.type, n)[0].code;
        return `<button type="button" data-n="${n}" aria-pressed="${n === st.n}"><b>${n}${n === S.rec ? ' <em>Рекомендуем</em>' : ''}</b><small>проход ≈ ${P.fmt(P.passage(st.type, st.w, n, sc))} мм</small></button>`;
      }).join('')}</div>`;
      const list = P.schemesFor(st.type, st.n);
      $('[data-qcx-schemes]').innerHTML = `<div class="qcx__seg qcx__seg--cols" role="group">${list.map(s =>
        `<button type="button" data-scheme="${s.code}" aria-pressed="${s.code === st.scheme}">${icon(P, st.type, st.n, s.code, st.door)}<b>${esc(s.t)}</b><small>${esc(s.code)}</small></button>`).join('')}</div>`;
      const sc = P.schemeOf(st.type, st.n, st.scheme);
      $('[data-qcx-scheme-desc]').textContent = `${sc.d}. Рама ${P.frameDepth(st.type, st.n, st.scheme)} мм${sc.cascade ? ' — 3 трека' : ''}.`;
      $('[data-qcx-door-row]').hidden = !P.doorAllowed(st.type, st.n);
      $('[data-door]').setAttribute('aria-pressed', String(st.door));
      // стекло: триплекс обязателен, если створка больше 5 м² — остальные варианты недоступны
      const forced = P.triplexForced(st.w, st.h, st.n), glass = P.glassFor(st.w, st.h, st.n, st.glass);
      $$('[data-glass]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.glass === glass)); b.disabled = forced && b.dataset.glass !== 'triplex'; });
      $('[data-qcx-glass-note]').textContent = forced ? 'Створка больше 5 м² — триплекс включён обязательно.' : '';
      $$('[data-type]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === st.type)));
      $$('[data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === st.color)));
      $$('[data-handle]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.handle === st.handle)));
      draw.set({ ...st });

      const pass = P.passage(st.type, st.w, st.n, st.scheme);
      const { r, v: rv, why } = readyDoor();
      const price = r ? r.price : P.price({ ...st, extraSections: S.extra });
      $('[data-qcx-sum]').innerHTML = [
        ['Материал', 'Премиальный тёплый алюминиевый термопрофиль'],
        ['Механизм', 'Надёжная немецкая механическая фурнитура'],
        ['Безопасность', 'Все стёкла проходят обязательную промышленную закалку'],
        ['Ширина чистого светового прохода для человека', v.ok ? `${P.fmt(pass)} мм` : '—'],
      ].map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('');
      const res = $('[data-qcx-res]');
      root.classList.toggle('is-ready', !!r);
      if (r) {
        const inCart = window.PSCart && window.PSCart.has(rv.sku);
        $('[data-qcx-kind]').textContent = `Готовая дверь из каталога · ${r.code}`;
        $('[data-qcx-price]').textContent = `${P.fmt(price)} ₽`;
        $('[data-qcx-sub]').textContent = `срок — ${term} · без доставки и монтажа`;
        res.innerHTML = `<button class="qcx__buy" type="button" data-add-to-cart data-sku="${esc(rv.sku)}" data-cart-href="${esc((d.base || '../') + 'cart/')}">${inCart ? 'В корзине <span>→</span>' : 'В корзину <span>+</span>'}</button><a class="qcx__link" href="${esc(rv.url)}">Страница товара <span aria-hidden="true">→</span></a>`;
        $('[data-qcx-send-title]').textContent = 'Нужна консультация или замер?';
      } else {
        $('[data-qcx-kind]').textContent = 'Ориентировочная стоимость';
        $('[data-qcx-price]').textContent = price ? `${P.fmt(price)} ₽` : 'По расчёту';
        $('[data-qcx-sub]').textContent = `индивидуальный заказ — срок дольше ${term}, точный назовём после замера`;
        res.innerHTML = '';
        $('[data-qcx-send-title]').textContent = 'Точная смета и бесплатный замер';
      }
      $('[data-qcx-note]').textContent = v.ok ? why : v.errors.join('. ');
      if (form && form.setProject) form.setProject(summary(price, r ? `Готовая дверь из каталога: ${r.code} (${rv.sku})` : 'ИНДИВИДУАЛЬНЫЙ ЗАКАЗ — расчёт по калькулятору', P.fmt(pass), v.errors[0]));
    }

    root.addEventListener('click', e => {
      const b = e.target.closest('button[data-type],button[data-n],button[data-scheme],button[data-door],button[data-glass],button[data-color],button[data-handle]');
      if (!b || b.disabled) return;
      if (b.dataset.type) { if (st.type === b.dataset.type) return; st.type = b.dataset.type; st.n = 0; fixState(); size.set({ type: st.type, n: st.n }); }
      else if (b.dataset.n) { st.n = +b.dataset.n; fixState(); size.set({ n: st.n }); }
      else if (b.dataset.scheme) st.scheme = b.dataset.scheme;
      else if (b.hasAttribute('data-door')) st.door = !st.door;
      else if (b.dataset.glass) st.glass = b.dataset.glass;
      else if (b.dataset.color) st.color = b.dataset.color;
      else st.handle = b.dataset.handle;
      update();
    });
    // lead-form может подключиться позже — дописываем параметры, когда форма готова
    customElements.whenDefined('lead-form').then(() => requestAnimationFrame(update));
    update();
  }

  const start = () => document.querySelectorAll('[data-quick-calc]').forEach(init);
  if (window.PSOpening) start(); else addEventListener('DOMContentLoaded', start);
})();
