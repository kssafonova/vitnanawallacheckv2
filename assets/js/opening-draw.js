/* Чертёж проёма — инженерная схема тонкими линиями: рама, створки, стрелки движения, размерные линии.
   Раскладка створок и правила — assets/js/portal-calc.js (window.PSPortal, по ТЗ калькулятора): HS — FIX / ACTIVE и стрелки,
   FS — складные створки (зигзаг сложения) и рабочая дверь. Чертёж только показывает: размеры подписаны на размерных линиях;
   вводят их в полях «Ширина» / «Высота» (sizeControl).
   window.PSOpening.mount(el, { type, w, h, n, scheme, door }) → { set(), get() }; sizeControl(el, { type, w, h, n, onChange }).
   Используют блок «Цена по размерам проёма» (главная, HS) и калькулятор /raschet/. */
(() => {
  const P = window.PSPortal;
  const VB_W = 1000, VB_H = 620;
  const PAD = { l: 40, r: 150, t: 110, b: 40 };           // место под размерные линии: сверху ширина, справа высота
  const word = n => (n % 10 === 1 && n !== 11 ? 'створка' : n < 5 ? 'створки' : 'створок');
  const fmt = n => new Intl.NumberFormat('ru-RU').format(n);
  const r1 = v => Math.round(v * 10) / 10;
  // Рекомендуемое число секций для HS по ТЗ (1.3)
  const recommend = (w, type = 'HS') => P.sectionsFor(type, w).rec;
  const defScheme = (type, n) => (P.schemesFor(type, n)[0] || {}).code;

  function svg(st) {
    // прямоугольник проёма в пропорции w × h, вписанный в рабочее поле
    const aw = VB_W - PAD.l - PAD.r, ah = VB_H - PAD.t - PAD.b;
    const k = Math.min(aw / st.w, ah / st.h);
    const W = st.w * k, H = st.h * k, x0 = PAD.l + (aw - W) / 2, y0 = PAD.t + (ah - H) / 2, x1 = x0 + W, y1 = y0 + H;
    const L = P.layout(st.type, st.n, st.scheme || defScheme(st.type, st.n), st.door), n = L.length, pw = W / n, f = 7;
    let g = `<rect class="od-frame" x="${r1(x0)}" y="${r1(y0)}" width="${r1(W)}" height="${r1(H)}"/>`;
    g += `<rect class="od-frame od-frame--in" x="${r1(x0 + f)}" y="${r1(y0 + f)}" width="${r1(W - 2 * f)}" height="${r1(H - 2 * f)}"/>`;
    for (let i = 1; i < n; i++) g += `<line class="od-mull" x1="${r1(x0 + pw * i)}" y1="${r1(y0 + f)}" x2="${r1(x0 + pw * i)}" y2="${r1(y1 - f)}"/>`;
    const midY = y0 + H * .58, tags = pw > 70;            // подписи — только если створка на чертеже достаточно широкая
    L.forEach((lf, i) => {
      const cx = x0 + pw * (i + .5), xa = x0 + pw * i, xb = xa + pw;
      if (tags) g += `<text class="od-tag" x="${r1(cx)}" y="${r1(y0 + H * .3)}">${{ fix: 'FIX', move: 'ACTIVE', fold: 'FOLD', door: 'DOOR' }[lf.kind]}</text>`;
      if (lf.kind === 'fix') return;
      if (lf.kind === 'fold') {
        // складная: линии сложения от углов к середине противоположной стойки
        const tip = lf.dir < 0 ? xa + f : xb - f, base = lf.dir < 0 ? xb - 2 : xa + 2;
        g += `<path class="od-fold" d="M${r1(base)} ${r1(y0 + f)}L${r1(tip)} ${r1(y0 + H / 2)}L${r1(base)} ${r1(y1 - f)}"/>`;
      }
      if (lf.kind === 'door') {
        // рабочая дверь: распашная, линии открывания к петлям
        const hinge = lf.handle === 'r' ? xa + f : xb - f, lock = lf.handle === 'r' ? xb - 4 : xa + 4;
        g += `<path class="od-fold od-fold--door" d="M${r1(lock)} ${r1(y0 + f)}L${r1(hinge)} ${r1(y0 + H / 2)}L${r1(lock)} ${r1(y1 - f)}"/>`;
      }
      if (lf.kind === 'move' || lf.kind === 'fold') {
        const dir = lf.dir || 1, len = Math.min(pw * .55, 120), a = cx - dir * len / 2, b = cx + dir * len / 2;
        g += `<path class="od-arrow" d="M${r1(a)} ${r1(midY)}H${r1(b)}M${r1(b - dir * 12)} ${r1(midY - 8)}L${r1(b)} ${r1(midY)}L${r1(b - dir * 12)} ${r1(midY + 8)}"/>`;
      }
      if (lf.handle) {
        const hx = lf.handle === 'l' ? xa + Math.min(16, pw * .15) : xb - Math.min(16, pw * .15);
        g += `<line class="od-handle" x1="${r1(hx)}" y1="${r1(midY - 26)}" x2="${r1(hx)}" y2="${r1(midY + 26)}"/>`;
      }
    });
    // размерные линии
    const dy = y0 - 44, dx = x1 + 60;
    g += `<path class="od-dim" d="M${r1(x0)} ${r1(dy)}H${r1(x1)}M${r1(x0)} ${r1(dy - 10)}v20M${r1(x1)} ${r1(dy - 10)}v20M${r1(x0)} ${r1(y0 - 6)}V${r1(dy - 10)}M${r1(x1)} ${r1(y0 - 6)}V${r1(dy - 10)}"/>`;
    g += `<path class="od-dim" d="M${r1(dx)} ${r1(y0)}V${r1(y1)}M${r1(dx - 10)} ${r1(y0)}h20M${r1(dx - 10)} ${r1(y1)}h20M${r1(x1 + 6)} ${r1(y0)}H${r1(dx + 10)}M${r1(x1 + 6)} ${r1(y1)}H${r1(dx + 10)}"/>`;
    g += `<line class="od-floor" x1="${r1(x0 - 30)}" y1="${r1(y1)}" x2="${r1(x1 + 30)}" y2="${r1(y1)}"/>`;
    return { g, pos: { wx: (x0 + x1) / 2 / VB_W * 100, wy: dy / VB_H * 100, hx: dx / VB_W * 100, hy: (y0 + y1) / 2 / VB_H * 100 } };
  }

  function mount(el, opts = {}) {
    const st = { type: opts.type || 'HS', w: opts.w || 3600, h: opts.h || 2300, n: opts.n || 0, scheme: opts.scheme || '', door: !!opts.door };
    if (!st.n) st.n = recommend(st.w, st.type);
    el.classList.add('od');
    el.innerHTML = `
      <svg class="od__svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="Чертёж проёма"></svg>
      <span class="od__in od__in--w" aria-hidden="true"><span class="od__cap">Ширина</span><b></b><span>мм</span></span>
      <span class="od__in od__in--h" aria-hidden="true"><span class="od__cap">Высота</span><b></b><span>мм</span></span>`;
    const svgEl = el.querySelector('svg'), inW = el.querySelector('.od__in--w b'), inH = el.querySelector('.od__in--h b');
    const boxW = el.querySelector('.od__in--w'), boxH = el.querySelector('.od__in--h');

    const draw = () => {
      // пропорции чертежа — в пределах лимитов типа, чтобы рисунок не схлопывался при опечатке
      const Lm = P.LIMITS[st.type];
      const s = { ...st, w: Math.min(Math.max(st.w, Lm.wMin), Lm.wMax), h: Math.min(Math.max(st.h, Lm.hMin), Lm.hMax) };
      const { g, pos } = svg(s);
      svgEl.innerHTML = g;
      boxW.style.left = pos.wx + '%'; boxW.style.top = pos.wy + '%';
      boxH.style.left = pos.hx + '%'; boxH.style.top = pos.hy + '%';
      // поле высоты не должно вылезать за правый край чертежа (узкий экран)
      requestAnimationFrame(() => {
        const cw = el.clientWidth, bw = boxH.offsetWidth;
        if (!cw || !bw) return;
        const maxLeft = (cw - bw / 2 - 4) / cw * 100;
        if (pos.hx > maxLeft) boxH.style.left = maxLeft + '%';
      });
    };
    const sync = () => { inW.textContent = fmt(st.w); inH.textContent = fmt(st.h); };
    sync(); draw();
    return { set(next) { Object.assign(st, next); sync(); draw(); }, get: () => ({ ...st }) };
  }

  // Готовая дверь из каталога: HS, ширина и число створок как у размера из таблицы, высота — одна из стандартных (hs: 2300 / 2400);
  // data-doors из build.mjs. Иначе — индивидуальный заказ
  const fits = (d, st) => (st.type || 'HS') === 'HS' && d.w === st.w && d.n === st.n && (d.hs || [d.h]).includes(st.h);
  const matchReady = (ready, st) => (ready || []).find(r => fits(r, st)) || null;

  // Размер проёма — только поля «Ширина, мм» / «Высота, мм» (решение владельца: без кнопок готовых размеров).
  // Готовую дверь калькулятор рекомендует сам, если размер и конфигурация совпали с товаром каталога.
  // Проверка — при выходе из поля (ТЗ 1.2): ошибки и предупреждения под полями.
  function sizeControl(el, { type = 'HS', w, h, n, onChange }) {
    const cur = { type, w, h, n };
    el.classList.add('sz');
    const render = () => {
      const Lm = P.LIMITS[cur.type];
      el.innerHTML = `
      <p class="sz__lbl">Размер проёма</p>
      <div class="sz__fields">
        <label class="sz__f"><span>Ширина, мм</span><input inputmode="numeric" maxlength="5" autocomplete="off" placeholder="например, 3600" data-sz-w value="${cur.w}"></label>
        <span class="sz__x" aria-hidden="true">×</span>
        <label class="sz__f"><span>Высота, мм</span><input inputmode="numeric" maxlength="4" autocomplete="off" placeholder="например, 2300" data-sz-h value="${cur.h}"></label>
        <p class="sz__hint">Ширина ${fmt(Lm.wMin)}–${fmt(Lm.wMax)} мм, высота ${fmt(Lm.hMin)}–${fmt(Lm.hMax)} мм.</p>
      </div>
      <div class="sz__msg" data-sz-msg></div>`;
    };
    render();
    const $ = q => el.querySelector(q);
    // сообщения проверки: ошибки — красным, предупреждения — плашкой
    const showMsg = () => {
      const v = P.validate(cur.type, cur.w, cur.h);
      $('[data-sz-msg]').innerHTML = v.errors.map(t => `<p class="sz__err">${t}</p>`).join('') + v.warnings.map(t => `<p class="sz__warn">${t}</p>`).join('');
      return v;
    };
    const emit = () => onChange && onChange({ ...cur });
    const read = () => {
      const vw = parseInt(($('[data-sz-w]').value || '').replace(/\D+/g, ''), 10), vh = parseInt(($('[data-sz-h]').value || '').replace(/\D+/g, ''), 10);
      if (Number.isFinite(vw)) cur.w = vw;
      if (Number.isFinite(vh)) cur.h = vh;
      const S = P.sectionsFor(cur.type, cur.w);
      if (!S.list.includes(cur.n)) cur.n = S.rec;
    };
    el.addEventListener('input', e => { if (e.target.matches('[data-sz-w],[data-sz-h]')) { read(); $('[data-sz-msg]').innerHTML = ''; emit(); } });
    el.addEventListener('focusout', e => { if (e.target.matches('[data-sz-w],[data-sz-h]')) { read(); showMsg(); emit(); } });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); e.target.blur(); } });
    showMsg();
    return {
      set(next) {
        const retype = next.type && next.type !== cur.type;
        Object.assign(cur, next);
        if (retype) render();
        showMsg();
      },
      validate: () => P.validate(cur.type, cur.w, cur.h),
    };
  }

  // Цена по ТЗ (portal-calc.js) с параметрами по умолчанию: стекло стандарт (или обязательный триплекс), однотонный RAL, стандартная ручка
  const price = st => P.price({ type: st.type || 'HS', w: st.w, h: st.h, n: st.n, scheme: st.scheme || defScheme(st.type || 'HS', st.n), glass: st.glass, color: st.color, handle: st.handle, door: st.door, extraSections: st.extraSections });

  window.PSOpening = { mount, sizeControl, price, recommend, fmt, matchReady, word };

  // Блок «Цена по размерам проёма» ([data-open-teaser], главная и HS): HS, чертёж; размер готовой двери — цена каталога и ссылка на товар,
  // другой — индивидуальный заказ: цена по формуле ТЗ, срок дольше, ссылка в калькулятор с этими размерами
  document.querySelectorAll('[data-open-teaser]').forEach(box => {
    let ready = [];
    try { ready = JSON.parse(box.dataset.doors || '[]'); } catch (_) { /* пусто */ }
    const term = box.dataset.term || '30–60 дней';
    const out = box.querySelector('[data-od-price]'), leaves = box.querySelector('[data-od-leaves]'), link = box.querySelector('[data-od-link]'), note = box.querySelector('[data-od-note]');
    const show = st => {
      const r = matchReady(ready, st), size = `${fmt(st.w)} × ${fmt(st.h)} мм · ${st.n} ${word(st.n)}`;
      if (r) {
        const v = r.schemes[r.def];
        out.textContent = `${fmt(r.price)} ₽`;
        leaves.textContent = `Готовая дверь ${r.code} · ${size} · проход ≈ ${fmt(r.passage)} мм`;
        note.textContent = `срок — ${term} · без доставки и монтажа`;
        link.href = v.url; link.firstChild.textContent = 'Открыть дверь ';
      } else {
        const sc = defScheme('HS', st.n), p = price({ ...st, scheme: sc }), v = P.validate('HS', st.w, st.h);
        out.textContent = p ? `≈ ${fmt(p)} ₽` : 'по расчёту';
        leaves.textContent = v.ok ? `Индивидуальный заказ · ${size} · проход ≈ ${fmt(P.passage('HS', st.w, st.n, sc))} мм` : v.errors[0];
        note.textContent = `нестандартный размер — срок дольше ${term}, точный назовём после замера`;
        link.href = `${box.dataset.href}?type=HS&w=${st.w}&h=${st.h}&n=${st.n}`; link.firstChild.textContent = 'Индивидуальный расчёт ';
      }
    };
    const start = ready.find(r => r.w === 3600) || ready[0] || { w: 3600, h: 2300, n: 2 };
    const api = mount(box.querySelector('[data-open-draw]'), { type: 'HS', w: start.w, h: start.h, n: start.n, scheme: start.def });
    sizeControl(box.querySelector('[data-open-size]'), { w: start.w, h: start.h, n: start.n, onChange: st => {
      const r = matchReady(ready, st);
      api.set({ ...st, scheme: r ? r.def : defScheme('HS', st.n) }); show(st);
    } });
    show(api.get());
  });
})();
