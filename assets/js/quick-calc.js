/* Калькулятор HS «Сколько стоит раздвижная дверь под ваш размер» — страница /raschet/.
   Рисуется в [data-quick-calc]. Параметры можно передать адресом: ?w=3600&h=2300&n=3&glass=standard&color=anthracite&from=…
   (так на калькулятор ведут страница товара и быстрый расчёт на главной и HS).
   Фото — настоящие рендеры модели с таким числом створок (data-renders), ползунок «Закрыто — Открыто».
   Цены — из data-refs (генератор кладёт туда цены моделей HS из data/products.json):
   цена модели × (площадь / площадь модели) × стеклопакет × цвет, округление вверх до 1000 ₽.
   Без JS вместо калькулятора остаётся ссылка на полный калькулятор. */
(() => {
  const fmt = n => new Intl.NumberFormat('ru-RU').format(n);
  const ceil1000 = v => Math.ceil(v / 1000) * 1000;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const W_MIN = 1400, H_MIN = 1800, H_MAX = 3100, LEAF_MIN = 720, LEAF_MAX = 3000;
  const OPEN = { 2: 1 / 2, 3: 2 / 3, 4: 1 / 2 };
  const recommend = w => (w <= 3300 ? 2 : w <= 4300 ? 3 : 4);
  const FILE_MAX = 15 * 1024 * 1024;
  const FILE_EXT = /\.(pdf|dwg|dxf|jpe?g|png|webp|heic|zip)$/i;

  const ICON = {
    info: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5"/><path d="M10 9v5M10 6.2v.1"/></svg>',
    clip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5 12.3 19.2a5 5 0 0 1-7.1-7.1l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/></svg>',
    check: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10.5 4 4 8-9"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5.5c0 4.3 2.9 7.8 7 9.5 4.1-1.7 7-5.2 7-9.5V6z"/></svg>',
    snow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5M3.7 11.2l3.4 1-1 3.3M20.3 12.8l-3.4-1 1-3.3M5.1 8.4l3.4.9-.9 3.4M18.9 15.6l-3.4-.9.9-3.4"/></svg>',
    ramp: '<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M4 28h40L14 6H4zM10 28 30 10M18 28l16-12M26 28l12-9"/></svg>',
    net: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="26" height="26"/><path d="M8 3v26M13 3v26M18 3v26M23 3v26M3 8h26M3 13h26M3 18h26M3 23h26"/></svg>',
  };
  const GLASS = [
    { k: 'standard', t: 'Стандарт 44', f: 1, icon: '<b>44</b>' },
    { k: 'safe', t: 'Безопасность', f: 1.14, icon: ICON.shield },
    { k: 'climate', t: 'Климат', f: 1.26, icon: ICON.snow, rec: true },
  ];
  // Цвета каталога (белый, антрацит) в одной цене — как в data/products.json; другой RAL дороже
  const COLORS = [
    { k: 'white', t: 'Белый', f: 1, sw: 'linear-gradient(135deg,#f9f9f9,#d9d8d7)' },
    { k: 'anthracite', t: 'Антрацит', f: 1, sw: 'linear-gradient(135deg,#4a4f53,#25282b)' },
    { k: 'ral', t: 'Другой RAL', f: 1.09, sw: 'linear-gradient(135deg,#c9c3b6,#8d887d)' },
  ];
  const EXTRAS = [
    { k: 'threshold', t: 'Безбарьерный порог', icon: ICON.ramp },
    { k: 'net', t: 'Москитная система', icon: ICON.net },
  ];
  const leafWord = n => (n === 1 ? 'створка' : n < 5 ? 'створки' : 'створок');
  const leafIcon = n => `<svg class="qc__leaf-ico" viewBox="0 0 ${n * 14 + 2} 26" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<rect x="${1 + i * 14}" y="1" width="14" height="24"/>`).join('')}</svg>`;
  // мини-схема поверх фото: подвижные створки светлее (как бейджи на карточках)
  const MOVING = { 2: [1], 3: [1, 2], 4: [1, 2] };
  const photoScheme = n => {
    const w = 88 / n;
    const panes = Array.from({ length: n }, (_, i) => `<rect class="sm-pane${MOVING[n].includes(i) ? ' is-move' : ''}" x="${(6 + i * w).toFixed(1)}" y="8" width="${w.toFixed(1)}" height="40"/>`).join('');
    return `<svg class="scheme-mini" viewBox="0 0 100 56" aria-hidden="true"><rect class="sm-frame" x="6" y="8" width="88" height="40"/>${panes}</svg>`;
  };

  let uid = 0;

  function init(root) {
    if (root.dataset.ready) return;
    root.dataset.ready = '1';
    const d = root.dataset;
    let refs = {};
    try { refs = JSON.parse(d.refs || '{}'); } catch (_) { refs = {}; }
    const id = 'qc' + (++uid);
    let renders = {};
    try { renders = JSON.parse(d.renders || '{}'); } catch (_) { renders = {}; }
    const q = d.url ? new URLSearchParams(location.search) : new URLSearchParams();
    const qn = k => { const v = parseInt(q.get(k), 10); return Number.isFinite(v) && v > 0 ? v : 0; };
    const oneOf = (v, list) => (list.some(x => x.k === v) ? v : '');
    const st = {
      w: qn('w') || +d.width || 3600,
      h: qn('h') || +d.height || 2300,
      n: [2, 3, 4].includes(qn('n')) ? qn('n') : +d.leaves || 0,
      glass: oneOf(q.get('glass'), GLASS) || d.glass || 'climate',
      color: oneOf(q.get('color'), COLORS) || d.color || 'white',
      extras: new Set(),
      manualLeaves: !!(qn('n') || d.leaves),
      open: 0,
    };
    if (!st.n) st.n = recommend(st.w);
    const from = q.get('from') ? String(q.get('from')).slice(0, 160) : '';

    const opt = (group, k, inner, on, extra = '') =>
      `<button type="button" class="qc__opt" data-${group}="${k}" aria-pressed="${on}"${extra}>${inner}</button>`;

    const STEPS = [
      { n: 1, t: 'Проём', s: 'Проём' }, { n: 2, t: 'Створки', s: 'Створки' }, { n: 3, t: 'Стекло и цвет', s: 'Стекло' }, { n: 4, t: 'Опции', s: 'Опции' }, { n: 5, t: 'Итог', s: 'Итог', mobile: true },
    ];
    root.innerHTML = `
<form class="qc" novalidate>
  <header class="qc__head">
    ${d.eyebrow ? `<p class="qc__eyebrow">${esc(d.eyebrow)}</p>` : ''}
    <${d.h1 ? 'h1' : 'h2'} class="qc__title">${esc(d.title || 'Сколько стоит раздвижная дверь под ваш размер')}</${d.h1 ? 'h1' : 'h2'}>
    <p class="qc__lead">Четыре шага — и ориентировочная цена. Без регистрации и без телефона.</p>
  </header>

  <div class="qc__panel" data-step="1">
    <div class="qc__tabs" role="tablist" aria-label="Шаги расчёта">${STEPS.map(x => `
      <button type="button" class="qc__tab${x.mobile ? ' qc__tab--m' : ''}" role="tab" id="${id}-t${x.n}" aria-controls="${id}-p${x.n}" aria-selected="${x.n === 1}" data-go="${x.n}">
        <span class="qc__tab-n">${x.n}</span><span class="qc__tab-t"><span class="qc__tab-full">${x.t}</span><span class="qc__tab-short" aria-hidden="true">${x.s}</span></span><small class="qc__tab-v" data-tabval="${x.n}"></small>
      </button>`).join('')}
      <span class="qc__progress" aria-hidden="true"><i data-qc-progress></i></span>
    </div>

    <div class="qc__body">
      <div class="qc__stage">
        <section class="qc__pane" role="tabpanel" id="${id}-p1" aria-labelledby="${id}-t1" data-pane="1">
          <div class="qc__legend"><b>Размер проёма</b><em>ширина × высота, мм <span class="qc__info" title="Примерный размер проёма в свету. Точный снимем на бесплатном замере.">${ICON.info}</span></em></div>
          <div class="qc__size">
            <label class="qc__num"><span>Ширина</span><input name="width" inputmode="numeric" autocomplete="off" maxlength="4" value="${st.w}" data-qc-w aria-describedby="${id}-hint"><i>мм</i></label>
            <label class="qc__num"><span>Высота</span><input name="height" inputmode="numeric" autocomplete="off" maxlength="4" value="${st.h}" data-qc-h aria-describedby="${id}-hint"><i>мм</i></label>
          </div>
          <p class="qc__hint" id="${id}-hint" data-qc-hint></p>
          <p class="qc__tip" data-qc-tip></p>
          <button type="button" class="qc__project" data-qc-project>${ICON.clip}<span><b>Уже есть проект или план?</b> Прикрепите файл — посчитаем по нему</span><i aria-hidden="true">→</i></button>
        </section>

        <section class="qc__pane" role="tabpanel" id="${id}-p2" aria-labelledby="${id}-t2" data-pane="2">
          <div class="qc__legend"><b>Сколько створок</b><em data-qc-leafhint></em></div>
          <div class="qc__leaves">${[2, 3, 4].map(n => `
            <button type="button" class="qc__leaf" data-leaves="${n}" aria-pressed="${n === st.n}">
              <span class="qc__rec">Рекомендуем</span>
              <span class="qc__leaf-top"><strong>${n}</strong>${leafIcon(n)}</span>
              <span class="qc__leaf-name">${leafWord(n)}</span>
              <span class="qc__leaf-open">≈ ${Math.round(OPEN[n] * 100)}% открытия</span>
            </button>`).join('')}
          </div>
        </section>

        <section class="qc__pane" role="tabpanel" id="${id}-p3" aria-labelledby="${id}-t3" data-pane="3">
          <div class="qc__legend"><b>Стеклопакет</b></div>
          <div class="qc__opts">${GLASS.map(g => opt('glass', g.k,
            `<span class="qc__ico">${g.icon}</span><span class="qc__opt-t">${g.t}${g.rec ? '<small>рекомендуем</small>' : ''}</span>`, g.k === st.glass)).join('')}
          </div>
          <div class="qc__legend qc__legend--gap"><b>Цвет рамы</b></div>
          <div class="qc__opts">${COLORS.map(c => opt('color', c.k,
            `<span class="qc__sw" style="background:${c.sw}"></span><span class="qc__opt-t">${c.t}</span>`, c.k === st.color)).join('')}
          </div>
        </section>

        <section class="qc__pane" role="tabpanel" id="${id}-p4" aria-labelledby="${id}-t4" data-pane="4">
          <div class="qc__legend"><b>Дополнительно</b><em>можно несколько</em></div>
          <div class="qc__extras">${EXTRAS.map(x => `
            <label class="qc__extra"><input type="checkbox" name="extra_${x.k}" data-extra="${x.k}"><span class="qc__extra-ico">${x.icon}</span><span class="qc__extra-t"><b>${x.t}</b><small>по расчёту</small></span><i class="qc__add" aria-hidden="true"></i></label>`).join('')}
          </div>
          <p class="qc__tip">Опции посчитаем отдельно после замера — в ориентировочную цену они не входят.</p>
        </section>

        <div class="qc__nav">
          <button type="button" class="qc__back" data-qc-back>← Назад</button>
          <button type="button" class="qc__next" data-qc-next><span data-qc-nextlabel>Далее</span> <i aria-hidden="true">→</i></button>
        </div>
      </div>

      <aside class="qc__summary" role="tabpanel" id="${id}-p5" aria-labelledby="${id}-t5" data-pane="5">
        <figure class="qc__photo">
          <img class="qc__img" data-qc-img="closed" src="${esc(d.img || '')}" alt="Раздвижная дверь: вид в закрытом положении" decoding="async">
          <img class="qc__img is-open" data-qc-img="open" src="${esc(d.img || '')}" alt="" aria-hidden="true" decoding="async">
          <span class="qc__badge" data-qc-badge></span>
          <figcaption class="qc__view">
            <span>Закрыто</span>
            <input type="range" min="0" max="100" step="1" value="0" data-qc-open aria-label="Показать дверь открытой">
            <span>Открыто</span>
          </figcaption>
        </figure>
        <div class="qc__conf"><small>Предварительная конфигурация</small><strong data-qc-conf></strong><span data-qc-confsub></span></div>
        <div class="qc__total">
          <div class="qc__price"><small>Ориентировочная стоимость</small><strong data-qc-price></strong><span>без доставки и монтажа</span></div>
          <button type="button" class="qc__cta" data-qc-cta aria-expanded="false" aria-controls="${id}-send">Получить точный расчёт <i aria-hidden="true">→</i></button>
        </div>
        <p class="qc__free">${ICON.check}<span><b>Замер — бесплатно.</b> Инженер приедет, проверит проём, порог и примыкание — и назовёт точную цену.</span></p>
        <p class="qc__note" data-qc-note></p>

        <div class="qc__send" id="${id}-send" data-qc-send hidden>
          <p class="qc__send-title">Точный расчёт и бесплатный замер</p>
          <p class="qc__send-lead">Оставьте телефон — инженер перезвонит, уточнит детали и договорится о замере. Если есть проект, прикрепите его: посчитаем по чертежам.</p>
          <label class="qc__field"><span>Имя</span><input name="name" autocomplete="name" required placeholder="Как к вам обращаться"></label>
          <label class="qc__field"><span>Телефон</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="+7 999 000-00-00"></label>
          <label class="qc__file" data-qc-filebox>
            <input type="file" name="project_file" accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.webp,.heic,.zip" data-qc-file>
            ${ICON.clip}<span><b data-qc-filename>Прикрепить проект</b><small>PDF, DWG, JPG, PNG или ZIP · до 15 МБ</small></span>
          </label>
          <label class="qc__field"><span>Комментарий</span><textarea name="comment" rows="2" placeholder="Стадия стройки, сроки, пожелания"></textarea></label>
          <input type="hidden" name="source" value="calculator">
          <input type="hidden" name="project" data-qc-summary>
          <input class="qc__hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <button type="submit" class="qc__submit">Отправить заявку <i aria-hidden="true">→</i></button>
          <p class="qc__legal">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>
          <p class="qc__status" data-qc-status role="status" aria-live="polite"></p>
        </div>
      </aside>
    </div>

    <div class="qc__bar" data-qc-bar>
      <div><small>Ориентировочно</small><strong data-qc-barprice></strong></div>
      <button type="button" class="qc__bar-next" data-qc-next><span data-qc-nextlabel>Далее</span> <i aria-hidden="true">→</i></button>
    </div>
  </div>
</form>`;

    const $ = s => root.querySelector(s);
    const $$ = s => [...root.querySelectorAll(s)];
    const form = $('form');
    const inW = $('[data-qc-w]'), inH = $('[data-qc-h]');
    const send = $('[data-qc-send]'), cta = $('[data-qc-cta]'), status = $('[data-qc-status]');
    const fileIn = $('[data-qc-file]'), fileName = $('[data-qc-filename]');

    const leafW = n => st.w / n;
    const leafOk = n => leafW(n) >= LEAF_MIN && leafW(n) <= LEAF_MAX;

    function calc() {
      const ref = refs[st.n];
      const sizeOk = st.w >= W_MIN && st.h >= H_MIN && st.h <= H_MAX;
      if (!ref || !sizeOk || !leafOk(st.n)) return null;
      const g = GLASS.find(x => x.k === st.glass), c = COLORS.find(x => x.k === st.color);
      return ceil1000(ref.price * (st.w * st.h) / (ref.w * ref.h) * g.f * c.f);
    }

    function summary(price) {
      const g = GLASS.find(x => x.k === st.glass), c = COLORS.find(x => x.k === st.color);
      const ex = EXTRAS.filter(x => st.extras.has(x.k)).map(x => x.t);
      return [
        `Проём: ${st.w} × ${st.h} мм`,
        `Створки: ${st.n} (HS · ${st.n} секции)`,
        `Стеклопакет: ${g.t}`,
        `Цвет: ${c.t}`,
        `Дополнительно: ${ex.length ? ex.join(', ') : 'нет'}`,
        `Ориентировочно: ${price ? fmt(price) + ' ₽ (без доставки и монтажа)' : 'по расчёту'}`,
        d.context ? `Откуда: ${d.context}` : '',
        from ? `Со страницы: ${from}` : '',
      ].filter(Boolean).join('\n');
    }

    function update() {
      const rec = recommend(st.w);
      $$('[data-leaves]').forEach(b => {
        const n = +b.dataset.leaves;
        b.setAttribute('aria-pressed', String(n === st.n));
        b.classList.toggle('is-rec', n === rec);
        b.classList.toggle('is-off', !leafOk(n));
      });
      $$('[data-glass]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.glass === st.glass)));
      $$('[data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === st.color)));

      const price = calc();
      const g = GLASS.find(x => x.k === st.glass), c = COLORS.find(x => x.k === st.color);
      $('[data-qc-conf]').textContent = `HS · ${st.n} секции`;
      $('[data-qc-confsub]').textContent = `${fmt(st.w)} × ${fmt(st.h)} мм · ${g.t} · ${c.t}`;
      $('[data-qc-price]').textContent = price ? `≈ ${fmt(price)} ₽` : 'По расчёту';
      $('[data-qc-barprice]').textContent = price ? `≈ ${fmt(price)} ₽` : 'по расчёту';
      const ex = EXTRAS.filter(x => st.extras.has(x.k)).map(x => x.t.split(' ')[0].toLowerCase());
      const tv = { 1: `${fmt(st.w)} × ${fmt(st.h)}`, 2: `${st.n} ${leafWord(st.n)}`, 3: `${g.t} · ${c.t}`, 4: ex.length ? ex.join(', ') : 'без опций', 5: price ? `≈ ${fmt(price)} ₽` : 'по расчёту' };
      $$('[data-tabval]').forEach(el => { el.textContent = tv[el.dataset.tabval]; });
      $('[data-qc-tip]').textContent = rec === st.n ? `Для ширины ${fmt(st.w)} мм подойдёт ${rec} ${leafWord(rec)} — выберем на следующем шаге.` : '';
      $('[data-qc-leafhint]').textContent = `для ${fmt(st.w)} мм рекомендуем ${rec}`;
      const badge = $('[data-qc-badge]');
      if (badge) badge.innerHTML = photoScheme(st.n);
      // фото: рендер модели с таким числом створок; белый есть только у 2-створчатой, остальные — тёмная рама
      const set = renders[st.n];
      if (set) {
        const tone = st.color === 'white' && set.light ? set.light : set.dark || set.light;
        const imgC = $('[data-qc-img="closed"]'), imgO = $('[data-qc-img="open"]');
        if (tone && imgC.getAttribute('src') !== tone.closed) { imgC.src = tone.closed; imgO.src = tone.open || tone.closed; }
      }

      let hint = '';
      if (st.w < W_MIN || st.h < H_MIN || st.h > H_MAX) hint = `Готовые конфигурации — от ${fmt(W_MIN)} мм в ширину и от ${fmt(H_MIN)} до ${fmt(H_MAX)} мм в высоту. Другой размер посчитаем индивидуально.`;
      else if (!leafOk(st.n)) hint = `При ширине ${fmt(st.w)} мм створка выйдет ${fmt(Math.round(leafW(st.n)))} мм — ${leafW(st.n) > LEAF_MAX ? 'слишком широкая' : 'слишком узкая'}. Лучше ${rec} ${leafWord(rec)}.`;
      $('[data-qc-hint]').textContent = hint;

      const extras = st.extras.size;
      $('[data-qc-note]').textContent = !price
        ? 'Для этого размера нужна инженерная проверка: подтвердим число створок, массу стекла и монтажный узел.'
        : extras
          ? 'Выбранные дополнительные опции в цену не входят — посчитаем их после проверки размеров и узла.'
          : 'Предварительная оценка. Точную цену подтверждаем после замера и проверки стеклопакета и монтажного узла.';
      $('[data-qc-summary]').value = summary(price);
    }

    const num = el => { el.value = el.value.replace(/\D+/g, '').slice(0, 4); return +el.value || 0; };
    inW.addEventListener('input', () => { st.w = num(inW); if (!st.manualLeaves) st.n = recommend(st.w); update(); });
    inH.addEventListener('input', () => { st.h = num(inH); update(); });
    root.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      if (b.dataset.leaves) { st.n = +b.dataset.leaves; st.manualLeaves = true; update(); }
      else if (b.dataset.glass) { st.glass = b.dataset.glass; update(); }
      else if (b.dataset.color) { st.color = b.dataset.color; update(); }
      else if ('qcCta' in b.dataset) { if (!mq.matches) go(5); openSend(true); }
      else if ('qcProject' in b.dataset) { if (!mq.matches) go(5); openSend(false); fileIn.click(); }
    });
    // ---- шаги ----
    const panel = $('.qc__panel');
    const mq = matchMedia('(min-width: 1100px)');
    const last = () => (mq.matches ? 4 : 5);
    const NEXT = { 1: 'Далее: створки', 2: 'Далее: стекло и цвет', 3: 'Далее: опции', 4: 'Смотреть итог' };
    let step = 1;
    function go(n, scroll) {
      step = Math.max(1, Math.min(last(), n));
      panel.dataset.step = step;
      $$('[data-go]').forEach(t => {
        const k = +t.dataset.go;
        t.setAttribute('aria-selected', String(k === step));
        t.tabIndex = k === step ? 0 : -1;
        t.classList.toggle('is-done', k < step);
      });
      $$('[data-pane]').forEach(p => p.classList.toggle('is-active', +p.dataset.pane === step));
      const final = step === last();
      $$('[data-qc-nextlabel]').forEach(el => { el.textContent = final ? (mq.matches ? 'Получить точный расчёт' : 'Получить точный расчёт') : NEXT[step]; });
      $('[data-qc-back]').hidden = step === 1;
      root.querySelector('[data-qc-progress]').style.setProperty('--p', (step - 1) / (last() - 1));
      if (scroll) {
        const top = panel.getBoundingClientRect().top;
        if (top < 0 || top > innerHeight * .5) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-go],[data-qc-next],[data-qc-back]');
      if (!b || !root.contains(b)) return;
      if (b.dataset.go) go(+b.dataset.go, true);
      else if ('qcBack' in b.dataset) go(step - 1, true);
      else if (step < last()) go(step + 1, true);
      else { if (!mq.matches) go(5); openSend(true); }
    });
    $('.qc__tabs').addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); go(step + (e.key === 'ArrowRight' ? 1 : -1)); $(`[data-go="${step}"]`).focus();
    });
    (mq.addEventListener ? mq.addEventListener('change', () => go(step)) : mq.addListener(() => go(step)));
    // Enter в поле размера — к следующему шагу, а не отправка формы
    [inW, inH].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(2, true); } }));

    const openIn = $('[data-qc-open]');
    const setOpen = v => { st.open = v; root.style.setProperty('--qc-open', (v / 100).toFixed(2)); };
    if (openIn) openIn.addEventListener('input', () => setOpen(+openIn.value));
    $$('[data-extra]').forEach(i => i.addEventListener('change', () => { i.checked ? st.extras.add(i.dataset.extra) : st.extras.delete(i.dataset.extra); update(); }));

    function openSend(focus) {
      send.hidden = false;
      cta.setAttribute('aria-expanded', 'true');
      cta.classList.add('is-open');
      send.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (focus) setTimeout(() => $('[name=name]').focus({ preventScroll: true }), 350);
    }

    fileIn.addEventListener('change', () => {
      const f = fileIn.files[0];
      status.textContent = '';
      status.classList.remove('is-error');
      if (!f) { fileName.textContent = 'Прикрепить проект'; root.querySelector('[data-qc-filebox]').classList.remove('has-file'); return; }
      if (f.size > FILE_MAX || !FILE_EXT.test(f.name)) {
        fileIn.value = '';
        fileName.textContent = 'Прикрепить проект';
        status.textContent = f.size > FILE_MAX ? 'Файл больше 15 МБ — сожмите его или пришлите ссылку в комментарии.' : 'Этот формат не принимаем: подойдут PDF, DWG, JPG, PNG или ZIP.';
        status.classList.add('is-error');
        return;
      }
      fileName.textContent = f.name;
      root.querySelector('[data-qc-filebox]').classList.add('has-file');
      update();
      if (!mq.matches) go(5);
      openSend(false);
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const nameIn = form.querySelector('[name=name]'), phoneIn = form.querySelector('[name=phone]');
      const name = nameIn.value.trim(), phone = phoneIn.value.replace(/\D+/g, '');
      status.classList.remove('is-error', 'is-ok');
      if (!name || phone.length < 10) {
        status.textContent = 'Укажите имя и телефон — без них инженер не сможет связаться.';
        status.classList.add('is-error');
        (name ? phoneIn : nameIn).focus();
        return;
      }
      update();
      const btn = form.querySelector('.qc__submit');
      btn.disabled = true;
      status.textContent = 'Отправляем…';
      try {
        const res = await fetch(d.endpoint || 'forms/send.php', { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.message || 'send');
        form.classList.add('is-sent');
        status.classList.add('is-ok');
        status.textContent = 'Заявка отправлена. Инженер перезвонит в рабочее время и договорится о бесплатном замере.';
      } catch (err) {
        status.classList.add('is-error');
        status.innerHTML = `Не получилось отправить${err.message && err.message !== 'send' ? ': ' + esc(err.message) : ''}. Позвоните нам: <a href="tel:+79774102479">+7 977 410-24-79</a>`;
        btn.disabled = false;
      }
    });

    update();
    go(1);
  }

  document.querySelectorAll('[data-quick-calc]').forEach(init);
})();
