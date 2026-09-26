/* Калькулятор HS — страница /raschet/ ([data-quick-calc]). Один экран без шагов (решение владельца):
   слева чертёж проёма (assets/js/opening-draw.js, размеры вводятся на размерных линиях), справа параметры
   плоскими кнопками и цена, ниже — общая минимальная форма <lead-form>, в письмо уходят параметры расчёта.
   Адрес принимает ?w=3600&h=2300&n=3&glass=standard&color=anthracite&from=… (так ведут товар и блок «Сколько стоит»).
   Цены — из data-refs (генератор берёт их из data/products.json): цена модели × площадь / площадь модели ×
   стеклопакет × цвет, вверх до 1000 ₽. */
(() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GLASS = [
    { k: 'standard', t: 'Стандарт 44', f: 1 },
    { k: 'safe', t: 'Безопасность', f: 1.14 },
    { k: 'climate', t: 'Климат', f: 1.26 },
  ];
  // Цвета каталога (белый, антрацит) в одной цене — как в data/products.json; другой RAL дороже
  const COLORS = [
    { k: 'white', t: 'Белый', f: 1 },
    { k: 'anthracite', t: 'Антрацит', f: 1 },
    { k: 'ral', t: 'Другой RAL', f: 1.09 },
  ];
  const EXTRAS = [
    { k: 'threshold', t: 'Безбарьерный порог' },
    { k: 'net', t: 'Москитная система' },
  ];

  function init(root) {
    const P = window.PSOpening;
    if (root.dataset.ready || !P) return;
    root.dataset.ready = '1';
    const d = root.dataset;
    let refs = {};
    try { refs = JSON.parse(d.refs || '{}'); } catch (_) { refs = {}; }
    const q = d.url ? new URLSearchParams(location.search) : new URLSearchParams();
    const qn = k => { const v = parseInt(q.get(k), 10); return Number.isFinite(v) && v > 0 ? v : 0; };
    const oneOf = (v, list, def) => (list.some(x => x.k === v) ? v : def);
    const from = (q.get('from') || '').slice(0, 160);
    const st = {
      w: qn('w') || 3600, h: qn('h') || 2300, n: [2, 3, 4].includes(qn('n')) ? qn('n') : 0,
      glass: oneOf(q.get('glass'), GLASS, 'standard'), color: oneOf(q.get('color'), COLORS, 'white'), extras: new Set(),
    };
    if (!st.n) st.n = P.recommend(st.w);

    const seg = (group, items, cur) => `<div class="qcx__seg" role="group">${items.map(x =>
      `<button type="button" data-${group}="${x.k}" aria-pressed="${x.k === cur}">${esc(x.t)}</button>`).join('')}</div>`;
    root.innerHTML = `
<div class="qcx">
  <header class="qcx__head">
    ${d.eyebrow ? `<p class="ui-eyebrow">${esc(d.eyebrow)}</p>` : ''}
    ${d.h1 ? '<h1>Калькулятор раздвижной двери</h1>' : '<h2>Калькулятор раздвижной двери</h2>'}
    ${from ? `<p class="qcx__from">По товару: ${esc(from)}</p>` : ''}
  </header>
  <div class="qcx__grid">
    <div class="qcx__draw" data-qcx-draw></div>
    <div class="qcx__side">
      <div class="qcx__row"><span class="qcx__lbl">Створки</span><div class="qcx__seg" role="group">${[2, 3, 4].map(n =>
        `<button type="button" data-leaves="${n}" aria-pressed="${n === st.n}">${n}</button>`).join('')}</div></div>
      <div class="qcx__row"><span class="qcx__lbl">Стеклопакет</span>${seg('glass', GLASS, st.glass)}</div>
      <div class="qcx__row"><span class="qcx__lbl">Цвет рамы</span>${seg('color', COLORS, st.color)}</div>
      <div class="qcx__row"><span class="qcx__lbl">Опции</span><div class="qcx__seg qcx__seg--multi" role="group">${EXTRAS.map(x =>
        `<button type="button" data-extra="${x.k}" aria-pressed="false"><i aria-hidden="true"></i>${esc(x.t)}</button>`).join('')}</div></div>
      <div class="qcx__price"><small>Ориентировочно</small><strong data-qcx-price></strong><span>без доставки и монтажа · замер бесплатно</span></div>
      <p class="qcx__note" data-qcx-note></p>
    </div>
  </div>
  <div class="qcx__send">
    <p class="qcx__send-title">Точный расчёт и бесплатный замер</p>
    <lead-form data-base="${esc(d.base || '../')}" data-source="calculator" data-cta="Получить точный расчёт"${d.context ? ` data-context="${esc(d.context)}"` : ''}></lead-form>
  </div>
</div>`;

    const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
    const draw = P.mount($('[data-qcx-draw]'), { w: st.w, h: st.h, n: st.n, onChange: v => { st.w = v.w; st.h = v.h; st.n = v.n; update(); } });
    const form = $('lead-form');

    function summary(price) {
      const g = GLASS.find(x => x.k === st.glass), c = COLORS.find(x => x.k === st.color);
      const ex = EXTRAS.filter(x => st.extras.has(x.k)).map(x => x.t);
      return [
        `Проём: ${st.w} × ${st.h} мм`, `Створки: ${st.n}`, `Стеклопакет: ${g.t}`, `Цвет: ${c.t}`,
        `Дополнительно: ${ex.length ? ex.join(', ') : 'нет'}`,
        `Ориентировочно: ${price ? P.fmt(price) + ' ₽ (без доставки и монтажа)' : 'по расчёту'}`,
        from ? `Со страницы: ${from}` : '',
      ].filter(Boolean).join('\n');
    }

    function update() {
      const rec = P.recommend(st.w);
      $$('[data-leaves]').forEach(b => {
        const n = +b.dataset.leaves, leaf = st.w / n, ok = leaf >= P.LEAF_MIN && leaf <= P.LEAF_MAX;
        b.disabled = !ok;
        b.setAttribute('aria-pressed', String(n === st.n));
        b.classList.toggle('is-rec', n === rec);
      });
      $$('[data-glass]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.glass === st.glass)));
      $$('[data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === st.color)));
      $$('[data-extra]').forEach(b => b.setAttribute('aria-pressed', String(st.extras.has(b.dataset.extra))));
      const g = GLASS.find(x => x.k === st.glass), c = COLORS.find(x => x.k === st.color);
      const price = P.price(refs, st, g.f, c.f);
      $('[data-qcx-price]').textContent = price ? `≈ ${P.fmt(price)} ₽` : 'По расчёту';
      const leaf = st.w / st.n;
      $('[data-qcx-note]').textContent = price ? ''
        : st.w < P.W_MIN || st.h < P.H_MIN || st.h > P.H_MAX ? `Готовые конфигурации — от ${P.fmt(P.W_MIN)} мм в ширину и от ${P.fmt(P.H_MIN)} до ${P.fmt(P.H_MAX)} мм в высоту. Другой размер посчитаем индивидуально.`
        : leaf > P.LEAF_MAX ? 'Створка шире 3 м — выберите больше створок или оставьте заявку.' : 'Створка уже 720 мм — выберите меньше створок.';
      if (form && form.setProject) form.setProject(summary(price));
    }

    root.addEventListener('click', e => {
      const b = e.target.closest('button[data-leaves],button[data-glass],button[data-color],button[data-extra]');
      if (!b || b.disabled) return;
      if (b.dataset.leaves) { st.n = +b.dataset.leaves; draw.set({ n: st.n }); }
      else if (b.dataset.glass) st.glass = b.dataset.glass;
      else if (b.dataset.color) st.color = b.dataset.color;
      else st.extras.has(b.dataset.extra) ? st.extras.delete(b.dataset.extra) : st.extras.add(b.dataset.extra);
      update();
    });
    // lead-form может подключиться позже — дописываем параметры, когда форма готова
    customElements.whenDefined('lead-form').then(() => requestAnimationFrame(update));
    update();
  }

  const start = () => document.querySelectorAll('[data-quick-calc]').forEach(init);
  if (window.PSOpening) start(); else addEventListener('DOMContentLoaded', start);
})();
