/* Чертёж проёма HS — инженерная схема тонкими линиями: рама, створки, стрелки движения, размерные линии.
   Чертёж только показывает: размеры подписаны на размерных линиях; вводят их в блоке выбора размера (sizeControl):
   кнопки готовых дверей из каталога и «Свой размер» с полями «Ширина, мм» / «Высота, мм». Используют блок «Цена по размерам проёма» (главная, HS) и калькулятор /raschet/.
   window.PSOpening.mount(el, { w, h, n }) → { set({w,h,n}), get() }; sizeControl(el, { doors, w, h, n, onChange }).
   Раскладка створок — как на мини-схемах каталога: 2 — подвижная + глухая, 3 — две подвижные + глухая, 4 — от центра. */
(() => {
  const VB_W = 1000, VB_H = 620;
  const PAD = { l: 40, r: 150, t: 110, b: 40 };           // место под размерные линии: сверху ширина, справа высота
  const KINDS = { 2: ['move', 'fix'], 3: ['move', 'move', 'fix'], 4: ['fix', 'move', 'move', 'fix'] };
  const W_MIN = 1400, W_MAX = 12000, H_MIN = 1800, H_MAX = 3100;
  const recommend = w => (w <= 3300 ? 2 : w <= 4300 ? 3 : 4);
  const fmt = n => new Intl.NumberFormat('ru-RU').format(n);
  const r1 = v => Math.round(v * 10) / 10;

  function svg(st) {
    // прямоугольник проёма в пропорции w × h, вписанный в рабочее поле
    const aw = VB_W - PAD.l - PAD.r, ah = VB_H - PAD.t - PAD.b;
    const k = Math.min(aw / st.w, ah / st.h);
    const W = st.w * k, H = st.h * k, x0 = PAD.l + (aw - W) / 2, y0 = PAD.t + (ah - H) / 2, x1 = x0 + W, y1 = y0 + H;
    const n = st.n, kinds = KINDS[n] || KINDS[3], pw = W / n, f = 7;     // f — толщина рамы на чертеже
    let g = `<rect class="od-frame" x="${r1(x0)}" y="${r1(y0)}" width="${r1(W)}" height="${r1(H)}"/>`;
    g += `<rect class="od-frame od-frame--in" x="${r1(x0 + f)}" y="${r1(y0 + f)}" width="${r1(W - 2 * f)}" height="${r1(H - 2 * f)}"/>`;
    for (let i = 1; i < n; i++) g += `<line class="od-mull" x1="${r1(x0 + pw * i)}" y1="${r1(y0 + f)}" x2="${r1(x0 + pw * i)}" y2="${r1(y1 - f)}"/>`;
    const midY = y0 + H * .58;
    kinds.forEach((kind, i) => {
      const cx = x0 + pw * (i + .5);
      g += `<text class="od-tag" x="${r1(cx)}" y="${r1(y0 + H * .3)}">${kind === 'fix' ? 'FIX' : 'ACTIVE'}</text>`;
      if (kind === 'fix') return;
      // стрелка: HS2/HS3 — к глухой створке справа, HS4 — от центра к краям
      const dir = n === 4 ? (i === 1 ? -1 : 1) : 1, len = Math.min(pw * .55, 120);
      const a = cx - dir * len / 2, b = cx + dir * len / 2;
      g += `<path class="od-arrow" d="M${r1(a)} ${r1(midY)}H${r1(b)}M${r1(b - dir * 12)} ${r1(midY - 8)}L${r1(b)} ${r1(midY)}L${r1(b - dir * 12)} ${r1(midY + 8)}"/>`;
      // ручка — на замковой стойке
      const hx = n === 4 ? (i === 1 ? x0 + pw * (i + 1) - 14 : x0 + pw * i + 14) : x0 + pw * i + 16;
      g += `<line class="od-handle" x1="${r1(hx)}" y1="${r1(midY - 26)}" x2="${r1(hx)}" y2="${r1(midY + 26)}"/>`;
    });
    // размерные линии
    const dy = y0 - 44, dx = x1 + 60;
    g += `<path class="od-dim" d="M${r1(x0)} ${r1(dy)}H${r1(x1)}M${r1(x0)} ${r1(dy - 10)}v20M${r1(x1)} ${r1(dy - 10)}v20M${r1(x0)} ${r1(y0 - 6)}V${r1(dy - 10)}M${r1(x1)} ${r1(y0 - 6)}V${r1(dy - 10)}"/>`;
    g += `<path class="od-dim" d="M${r1(dx)} ${r1(y0)}V${r1(y1)}M${r1(dx - 10)} ${r1(y0)}h20M${r1(dx - 10)} ${r1(y1)}h20M${r1(x1 + 6)} ${r1(y0)}H${r1(dx + 10)}M${r1(x1 + 6)} ${r1(y1)}H${r1(dx + 10)}"/>`;
    g += `<line class="od-floor" x1="${r1(x0 - 30)}" y1="${r1(y1)}" x2="${r1(x1 + 30)}" y2="${r1(y1)}"/>`;
    return { g, pos: { wx: (x0 + x1) / 2 / VB_W * 100, wy: dy / VB_H * 100, hx: dx / VB_W * 100, hy: (y0 + y1) / 2 / VB_H * 100 } };
  }

  function mount(el, opts = {}) {
    const st = { w: opts.w || 3600, h: opts.h || 2300, n: opts.n || 0 };
    if (![2, 3, 4].includes(st.n)) st.n = recommend(st.w);
    el.classList.add('od');
    el.innerHTML = `
      <svg class="od__svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="Чертёж проёма"></svg>
      <span class="od__in od__in--w" aria-hidden="true"><span class="od__cap">Ширина</span><b></b><span>мм</span></span>
      <span class="od__in od__in--h" aria-hidden="true"><span class="od__cap">Высота</span><b></b><span>мм</span></span>`;
    const svgEl = el.querySelector('svg'), inW = el.querySelector('.od__in--w b'), inH = el.querySelector('.od__in--h b');
    const boxW = el.querySelector('.od__in--w'), boxH = el.querySelector('.od__in--h');

    const draw = () => {
      const s = { w: Math.min(Math.max(st.w, W_MIN), W_MAX), h: Math.min(Math.max(st.h, H_MIN), H_MAX), n: st.n };
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
    // Чертёж — только показ: размеры подписаны на размерных линиях, вводят их в блоке выбора размера (sizeControl)
    const sync = () => { inW.textContent = fmt(st.w); inH.textContent = fmt(st.h); };
    sync(); draw();
    return {
      set(next) { Object.assign(st, next); sync(); draw(); },
      get: () => ({ ...st }),
      recommend,
      limits: { W_MIN, H_MIN, H_MAX },
    };
  }

  // Цена — как в каталоге: цена модели × площадь / площадь модели × стеклопакет × цвет, вверх до 1000 ₽
  const LEAF_MIN = 720, LEAF_MAX = 3000;
  function price(refs, st, glassF = 1, colorF = 1) {
    const ref = refs[st.n], leaf = st.w / st.n;
    if (!ref || st.w < W_MIN || st.h < H_MIN || st.h > H_MAX || leaf < LEAF_MIN || leaf > LEAF_MAX) return null;
    return Math.ceil(ref.price * (st.w * st.h) / (ref.w * ref.h) * glassF * colorF / 1000) * 1000;
  }

  // Готовая дверь из каталога: ширина, высота и число створок совпадают с моделью (data-doors из build.mjs); иначе — индивидуальный заказ
  const matchReady = (ready, st) => (ready || []).find(r => r.w === st.w && r.h === st.h && r.n === st.n) || null;

  // Выбор размера: кнопки готовых дверей (ширина, «HS/30 · готовая») + «Свой размер» с явными полями ввода
  function sizeControl(el, { doors = [], w, h, n, onChange }) {
    const cur = { w, h, n };
    const isDoor = d => d.w === cur.w && d.h === cur.h && d.n === cur.n;
    const m = v => (v / 1000).toFixed(1).replace('.', ',');
    el.classList.add('sz');
    el.innerHTML = `
      <p class="sz__lbl">Ширина проёма</p>
      <div class="sz__seg" role="group" aria-label="Размер проёма">${doors.map((d, i) =>
        `<button type="button" data-sz="${i}"><b>${m(d.w)} м</b><small>${d.code} · готовая</small></button>`).join('')}<button type="button" data-sz="custom"><b>Свой размер</b><small>ширина и высота</small></button></div>
      <div class="sz__fields" hidden>
        <label class="sz__f"><span>Ширина, мм</span><input inputmode="numeric" maxlength="5" autocomplete="off" placeholder="например, 3900" data-sz-w></label>
        <span class="sz__x" aria-hidden="true">×</span>
        <label class="sz__f"><span>Высота, мм</span><input inputmode="numeric" maxlength="4" autocomplete="off" placeholder="например, 2400" data-sz-h></label>
        <p class="sz__hint">Ширина от ${fmt(W_MIN)} мм, высота ${fmt(H_MIN)}–${fmt(H_MAX)} мм. Размер не как у готовой двери — индивидуальный заказ.</p>
      </div>`;
    const fields = el.querySelector('.sz__fields'), inW = el.querySelector('[data-sz-w]'), inH = el.querySelector('[data-sz-h]');
    const btns = [...el.querySelectorAll('[data-sz]')];
    let custom = !doors.some(isDoor);
    const paint = () => {
      btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sz === 'custom' ? custom : !custom && isDoor(doors[+b.dataset.sz]))));
      fields.hidden = !custom;
    };
    const emit = () => onChange && onChange({ ...cur });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-sz]');
      if (!b) return;
      if (b.dataset.sz === 'custom') {
        custom = true; inW.value = cur.w; inH.value = cur.h; paint();
        inW.focus(); inW.select();
      } else {
        const d = doors[+b.dataset.sz];
        custom = false; Object.assign(cur, { w: d.w, h: d.h, n: d.n }); paint(); emit();
      }
    });
    const read = () => {
      const vw = parseInt(inW.value.replace(/\D+/g, ''), 10), vh = parseInt(inH.value.replace(/\D+/g, ''), 10);
      if (Number.isFinite(vw)) { cur.w = vw; cur.n = recommend(vw); }
      if (Number.isFinite(vh)) cur.h = vh;
      emit();
    };
    [inW, inH].forEach(i => {
      i.addEventListener('input', read);
      i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } });
    });
    if (custom) { inW.value = cur.w; inH.value = cur.h; }
    paint();
    return { set(next) { Object.assign(cur, next); if (custom) { inW.value = cur.w; inH.value = cur.h; } paint(); } };
  }

  window.PSOpening = { mount, sizeControl, price, recommend, fmt, matchReady, LEAF_MIN, LEAF_MAX, W_MIN, H_MIN, H_MAX };

  // Блок «Цена по размерам проёма» ([data-open-teaser], главная и HS): чертёж; размер готовой двери — цена каталога и ссылка на товар,
  // нестандартный — индивидуальный заказ: цена ориентировочная, срок дольше, ссылка в калькулятор с этими размерами
  const word = n => (n < 5 ? 'створки' : 'створок');
  document.querySelectorAll('[data-open-teaser]').forEach(box => {
    let refs = {}, ready = [];
    try { refs = JSON.parse(box.dataset.refs || '{}'); ready = JSON.parse(box.dataset.doors || '[]'); } catch (_) { /* пусто */ }
    const term = box.dataset.term || '30–60 дней';
    const out = box.querySelector('[data-od-price]'), leaves = box.querySelector('[data-od-leaves]'), link = box.querySelector('[data-od-link]'), note = box.querySelector('[data-od-note]');
    const show = st => {
      const r = matchReady(ready, st), size = `${fmt(st.w)} × ${fmt(st.h)} мм · ${st.n} ${word(st.n)}`;
      if (r) {
        const v = r.colors.anthracite || Object.values(r.colors)[0];
        out.textContent = `${fmt(r.price)} ₽`;
        leaves.textContent = `Готовая дверь ${r.code} · ${size}`;
        note.textContent = `срок — ${term} · без доставки и монтажа`;
        link.href = v.url; link.firstChild.textContent = 'Открыть дверь ';
      } else {
        const p = price(refs, st);
        out.textContent = p ? `≈ ${fmt(p)} ₽` : 'по расчёту';
        leaves.textContent = `Индивидуальный заказ · ${size}`;
        note.textContent = `нестандартный размер — срок дольше ${term}, точный назовём после замера`;
        link.href = `${box.dataset.href}?w=${st.w}&h=${st.h}&n=${st.n}`; link.firstChild.textContent = 'Индивидуальный расчёт ';
      }
    };
    const start = ready.find(r => r.w === 3600) || ready[0] || { w: 3600, h: 2300, n: 3 };
    const api = mount(box.querySelector('[data-open-draw]'), { w: start.w, h: start.h, n: start.n });
    sizeControl(box.querySelector('[data-open-size]'), { doors: ready, w: start.w, h: start.h, n: start.n, onChange: st => { api.set(st); show(st); } });
    show(api.get());
  });
})();
