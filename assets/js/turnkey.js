/* «Остекление под ключ» (/osteklenie-pod-klyuch/, [data-turnkey]) — конструктор остекления дома.
   01 Дом: длина × ширина, 1–5 этажей со своей высотой, кровля (двускатная / односкатная / плоская) → «голый» 3D-макет.
   02 Сценарий: «Классика» / «Панорама» / «Максимум стекла» — стартовая расстановка реальных изделий по фасадам и этажам.
   03 Проёмы: фасад × этаж, список изделий; каждое — отдельное изделие со своими параметрами:
      • HS-портал — ширина × высота, секции и «Рекомендуем» по ТЗ, схема (A-L … C-Double), цена по формуле ТЗ;
      • FS-портал — ширина × высота, секции по ТЗ, в одну / две стороны, рабочая дверь, цена по ТЗ;
      • панорамное окно / витраж — ширина × высота, высота от пола, секции и сколько из них открывается.
      Проём выбирают нажатием в списке, на макете 3D или на чертеже фасада; проверяются ширина фасада и высота этажа.
   04 Пристройка со двора: веранда (стены — HS / FS / витражи, делятся на модули до 6 м) или зимний сад; ширина, глубина, высота.
   Итог: м² стекла, изделия с ценами, монтаж и доставка (services), «≈ итого», что входит, ссылка (#c=…), форма.
   Правила и цены HS / FS — assets/js/portal-calc.js; цены витражей, веранды, зимнего сада — data/turnkey.json (заглушки).
   3D — assets/js/turnkey3d.js (без WebGL остаётся чертёж фасада). */
(() => {
  const root = document.querySelector('[data-turnkey]');
  const P = window.PSPortal;
  let C;
  try { C = JSON.parse(document.querySelector('[data-tk-json]').textContent); } catch (e) { return; }
  if (!root || !P) return;
  const SELF = (document.currentScript && document.currentScript.src) || location.href;
  const fmt = n => new Intl.NumberFormat('ru-RU').format(Math.round(n));
  const mm2 = mm => (mm / 1000).toFixed(1).replace('.', ',');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
  const FACADES = [
    { k: 'front', t: 'Фасад', d: 'со стороны въезда' },
    { k: 'back', t: 'Двор', d: 'терраса и сад' },
    { k: 'left', t: 'Левый', d: 'торец' },
    { k: 'right', t: 'Правый', d: 'торец' },
  ];
  const SCEN = [
    { k: 'classic', t: 'Классика', d: 'Окна с подоконником и витражи в гостиной' },
    { k: 'panorama', t: 'Панорама', d: 'Окна в пол, HS-портал во двор' },
    { k: 'max', t: 'Максимум стекла', d: 'Стеклянный фасад во двор, порталы на первом этаже' },
  ];
  const ROOFS = [{ k: 'gable', t: 'Двускатная' }, { k: 'shed', t: 'Односкатная' }, { k: 'flat', t: 'Плоская' }];
  const EXT_WALLS = [{ k: 'hs', t: 'HS-порталы' }, { k: 'fs', t: 'FS-гармошки' }, { k: 'pano', t: 'Витражи' }];
  const H = C.house, T = { pano: C.pano, hs: C.hs, fs: C.fs };

  let uid = 1;
  const st = {
    L: H.L.def, B: H.B.def, fh: Array(H.floors.def).fill(H.floor_h.def), roof: 'gable', scenario: 'panorama',
    facade: 'back', floor: 0, sel: null, items: [],
    ext: 'none', extW: 0, extD: C.ext.d.def, extH: C.ext.h.def, extWall: 'hs', evening: false,
  };
  const floors = () => st.fh.length;
  const faceLen = f => (f === 'front' || f === 'back' ? st.L : st.B);
  const floorBase = i => st.fh.slice(0, i).reduce((a, b) => a + b, 0);
  const totalH = () => floorBase(floors());
  const at = (f, i) => st.items.filter(it => it.f === f && it.fl === i);
  const usable = f => faceLen(f) - 2 * C.margin;
  const usedW = list => list.reduce((a, it) => a + it.w, 0) + Math.max(0, list.length - 1) * C.gap;
  const maxH = (i, sill = 0) => st.fh[i] - C.slab - 150 - sill;

  // ---------- изделия ----------
  const isPortal = it => it.type === 'hs' || it.type === 'fs';
  const pType = it => (it.type === 'hs' ? 'HS' : 'FS');
  const recN = it => P.sectionsFor(pType(it), it.w);
  // привести секции / схему / дверь к правилам ТЗ после смены размера
  function normalize(it) {
    if (isPortal(it)) {
      const S = recN(it);
      if (!S.list.includes(it.n)) it.n = S.rec;
      if (!P.schemesFor(pType(it), it.n).some(s => s.code === it.scheme)) it.scheme = P.schemesFor(pType(it), it.n)[0].code;
      if (!P.doorAllowed(pType(it), it.n)) it.door = false;
    } else {
      const maxN = Math.max(1, Math.min(C.pano.max_sections, Math.floor(it.w / C.pano.sash_min_w)));
      it.n = Math.min(Math.max(1, it.n || 1), maxN);
      it.open = Math.min(it.open || 0, it.n);
    }
    return it;
  }
  function make(type, f, i, o = {}) {
    const hMax = maxH(i);
    const it = { id: uid++, type, f, fl: i, w: 3600, h: Math.min(2400, hMax), n: 0, scheme: '', door: false, sill: 0, open: 0, ...o };
    if (type === 'pano' && !o.w) { it.w = 1800; it.h = Math.min(hMax, 2600); it.n = 1; it.open = 0; }
    it.h = Math.min(it.h, maxH(i, it.sill));
    return normalize(it);
  }
  function itemPrice(it) {
    if (it.type === 'pano') return it.w * it.h / 1e6 * C.pano.rate_fix + (it.open || 0) * C.pano.sash_add;
    return P.price({ type: pType(it), w: it.w, h: it.h, n: it.n, scheme: it.scheme, door: it.door, glass: 'standard', color: 'mono', handle: 'standard' });
  }
  function itemIssues(it) {
    const out = [];
    if (isPortal(it)) out.push(...P.validate(pType(it), it.w, it.h).errors);
    else {
      if (it.w < C.pano.min_w || it.w > C.pano.max_w) out.push(`Ширина витража — от ${fmt(C.pano.min_w)} до ${fmt(C.pano.max_w)} мм`);
      if (it.h < C.pano.min_h) out.push(`Высота окна — от ${fmt(C.pano.min_h)} мм`);
    }
    if (it.h + (it.sill || 0) > st.fh[it.fl] - C.slab - 100) out.push(`Не помещается по высоте этажа (${fmt(st.fh[it.fl])} мм)`);
    return out;
  }
  const itemName = it => (it.type === 'pano' ? (it.n > 1 ? 'Витраж' : 'Панорамное окно') : T[it.type].t);
  const itemSpec = it => {
    const size = `${mm2(it.w)} × ${mm2(it.h)} м`;
    if (it.type === 'pano') return `${size} · ${it.n} ${plural(it.n, 'секция', 'секции', 'секций')}${it.open ? `, ${it.open} ${plural(it.open, 'открывается', 'открываются', 'открываются')}` : ', глухой'}${it.sill ? ` · от пола ${mm2(it.sill)} м` : ' · в пол'}`;
    return `${size} · ${it.n} ${plural(it.n, 'секция', 'секции', 'секций')} · ${it.scheme}${it.door ? ' + дверь' : ''}`;
  };

  // ---------- сценарии: стартовая расстановка реальных изделий ----------
  function presetFloor(f, i) {
    st.items = st.items.filter(it => !(it.f === f && it.fl === i));
    const len = usable(f), long = f === 'front' || f === 'back', hIn = maxH(i);
    const add = (type, o) => { const it = make(type, f, i, o); if (usedW([...at(f, i), it]) <= len) st.items.push(it); return it; };
    const fill = (w, o, k) => { for (let j = 0; j < k; j++) add('pano', { w, ...o }); };
    const count = (w, share) => Math.max(0, Math.floor((len * share + C.gap) / (w + C.gap)));
    if (st.scenario === 'classic') {
      if (i === 0 && f === 'back') { add('pano', { w: Math.min(3600, len), h: hIn, n: 3, open: 1 }); fill(1200, { h: 1500, sill: 850, n: 1, open: 1 }, count(1200, 0.35)); }
      else fill(1200, { h: 1500, sill: 850, n: 1, open: 1 }, Math.max(long ? 1 : 0, count(1200, long ? 0.35 : 0.25)));
    } else if (st.scenario === 'panorama') {
      if (i === 0 && f === 'back') { const w = Math.min(len * 0.55, 6000) | 0; add('hs', { w: Math.round(w / 100) * 100, h: Math.min(2400, hIn) }); fill(1800, { h: hIn, n: 1 }, count(1800, 0.35)); }
      else fill(long ? 2400 : 1800, { h: hIn, n: long ? 2 : 1, open: 1 }, Math.max(1, count(long ? 2400 : 1800, long ? 0.5 : 0.35)));
    } else {
      if (i === 0 && f === 'back') add('hs', { w: Math.min(len, 12000) - (Math.min(len, 12000) % 100), h: Math.min(2600, hIn) });
      else if (i === 0 && !long && len >= 3000) add('fs', { w: Math.min(len, 5000) - (Math.min(len, 5000) % 100), h: Math.min(2400, hIn), scheme: 'FS-L' });
      else if (i === 0) fill(3000, { h: hIn, n: 3, open: 1 }, Math.max(1, count(3000, 0.7)));
      else fill(long ? 3600 : 2400, { h: hIn, n: long ? 3 : 2, open: 1 }, Math.max(1, count(long ? 3600 : 2400, long ? 0.75 : 0.5)));
    }
  }
  function preset() { st.items = []; st.sel = null; FACADES.forEach(({ k }) => { for (let i = 0; i < floors(); i++) presetFloor(k, i); }); }

  // Раскладка на фасаде: изделия по порядку, по центру фасада, промежуток C.gap; x — центр, мм от центра фасада; y — низ проёма от земли
  function layout() {
    const out = [];
    FACADES.forEach(({ k: f }) => {
      for (let i = 0; i < floors(); i++) {
        const list = at(f, i);
        let x = -usedW(list) / 2;
        list.forEach(it => { out.push({ ...it, x: x + it.w / 2, y: floorBase(i) + C.slab + (it.sill || 0), facade: f, floor: i, key: `o${it.id}` }); x += it.w + C.gap; });
      }
    });
    return out;
  }

  // ---------- пристройка: стены делятся на модули до module_max, HS / FS — по ТЗ ----------
  const extWidth = () => Math.min(st.extW || st.L, st.L);
  function extModules(len) { const k = Math.max(1, Math.ceil(len / C.ext.module_max)); return Array(k).fill(Math.round(len / k)); }
  function extEstimate() {
    if (st.ext === 'none') return null;
    const W = extWidth(), D = st.extD, h = st.extH, walls = [W, D, D];
    const E = C.extensions[st.ext], wallType = st.ext === 'garden' ? 'pano' : st.extWall;
    let sum = 0, area = 0, bad = false;
    walls.forEach(len => extModules(len).forEach(w => {
      area += w * h / 1e6;
      if (wallType === 'pano') sum += w * h / 1e6 * C.pano.rate_fix + Math.floor(w / 1500) * C.pano.sash_add * 0.5;
      else {
        const type = wallType === 'hs' ? 'HS' : 'FS', n = P.sectionsFor(type, w).rec;
        const p = P.price({ type, w, h, n, scheme: P.schemesFor(type, n)[0].code, glass: 'standard', color: 'mono', handle: 'standard' });
        if (p) sum += p; else bad = true;
      }
    }));
    const roof = W * D / 1e6 * (st.ext === 'garden' ? 1.08 : 1);
    sum += roof * E.roof_rate;
    if (st.ext === 'garden') area += roof;
    return { t: `${E.t} ${mm2(W)} × ${mm2(D)} м`, sum, area, bad, mods: walls.map(extModules) };
  }

  function estimate() {
    const lines = st.items.map(it => ({ it, p: itemPrice(it), bad: itemIssues(it).length > 0 }));
    const ext = extEstimate();
    const goods = lines.reduce((a, l) => a + (l.p || 0), 0) + (ext ? ext.sum : 0);
    const S = C.services || {};
    const install = goods ? Math.max(Math.round(goods * (S.install_delivery_pct || 12) / 100 / 1000) * 1000, S.install_delivery_min || 0) : 0;
    const area = st.items.reduce((a, it) => a + it.w * it.h / 1e6, 0) + (ext ? ext.area : 0);
    const overflow = FACADES.flatMap(({ k }) => Array.from({ length: floors() }, (_, i) => (usedW(at(k, i)) > usable(k) ? `${FACADES.find(x => x.k === k).t}, ${i + 1}-й этаж` : ''))).filter(Boolean);
    return { lines, ext, goods, install, total: goods + install, area, overflow, bad: lines.filter(l => l.bad || !l.p).length };
  }

  // ---------- ссылка на проект ----------
  const save = () => {
    const c = { L: st.L, B: st.B, fh: st.fh, r: st.roof, s: st.scenario, e: [st.ext, st.extW, st.extD, st.extH, st.extWall],
      i: st.items.map(it => [it.type[0], it.f[0], it.fl, it.w, it.h, it.n, it.scheme, it.door ? 1 : 0, it.sill, it.open]) };
    try { history.replaceState(null, '', '#c=' + btoa(unescape(encodeURIComponent(JSON.stringify(c))))); } catch (e) { /* без ссылки */ }
  };
  const load = () => {
    const m = location.hash.match(/#c=([\w+/=]+)/);
    if (!m) return false;
    try {
      const c = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      const cl = (v, r) => Math.min(r.max, Math.max(r.min, +v || r.def));
      st.L = cl(c.L, H.L); st.B = cl(c.B, H.B);
      st.fh = (Array.isArray(c.fh) ? c.fh : [H.floor_h.def]).slice(0, H.floors.max).map(v => cl(v, H.floor_h));
      st.roof = ROOFS.some(r => r.k === c.r) ? c.r : 'gable'; st.scenario = SCEN.some(s => s.k === c.s) ? c.s : 'panorama';
      [st.ext, st.extW, st.extD, st.extH, st.extWall] = c.e || ['none', 0, C.ext.d.def, C.ext.h.def, 'hs'];
      const TY = { p: 'pano', h: 'hs', f: 'fs' }, FA = { f: 'front', b: 'back', l: 'left', r: 'right' };
      st.items = (c.i || []).filter(a => TY[a[0]] && FA[a[1]] && a[2] < floors()).map(a => normalize({ id: uid++, type: TY[a[0]], f: FA[a[1]], fl: a[2], w: a[3], h: a[4], n: a[5], scheme: a[6], door: !!a[7], sill: a[8] || 0, open: a[9] || 0 }));
      return true;
    } catch (e) { return false; }
  };

  // ---------- разметка ----------
  const seg = (name, items, cur, cls = '') => `<div class="tk-seg${cls}" role="group">${items.map(x =>
    `<button type="button" data-${name}="${x.k}" aria-pressed="${String(x.k) === String(cur)}"${x.dis ? ' disabled' : ''}><b>${x.t}</b>${x.d ? `<small>${esc(x.d)}</small>` : ''}</button>`).join('')}</div>`;
  const field = (name, label, val, min, max, step = 10) => `<label class="tk-f"><span>${label}</span><input type="number" inputmode="numeric" min="${min}" max="${max}" step="${step}" value="${val}" data-${name}></label>`;
  root.innerHTML = `
  <div class="tk__viewer">
    <div class="tk__bar">
      <div class="tk-tabs" role="tablist" aria-label="Вид"><button type="button" role="tab" aria-selected="true" data-tk-view="3d">3D-макет</button><button type="button" role="tab" aria-selected="false" data-tk-view="face">Чертёж фасада</button></div>
      <button type="button" class="tk-mode" data-tk-evening aria-pressed="false">Вечер</button>
    </div>
    <div class="tk__stage">
      <div class="tk3d" data-tk-3d><p class="tk3d__msg">Строим макет дома…</p></div>
      <div class="tk-face" data-tk-face hidden></div>
    </div>
    <p class="tk__caption" data-tk-caption></p>
  </div>
  <div class="tk__steps">
    <section class="tk-step"><h2 class="tk-step__t"><i>01</i>Дом</h2>
      <div class="tk-fields">${field('tk-len', 'Длина дома, мм', st.L, H.L.min, H.L.max, 100)}${field('tk-wid', 'Ширина дома, мм', st.B, H.B.min, H.B.max, 100)}</div>
      <div class="tk-row"><span class="tk-lbl">Этажей</span><div data-tk-floors></div></div>
      <div class="tk-row"><span class="tk-lbl">Высота этажей, мм</span><div class="tk-fields tk-fields--fh" data-tk-fh></div></div>
      <div class="tk-row"><span class="tk-lbl">Кровля</span>${seg('roof', ROOFS, st.roof, ' tk-seg--cols')}</div>
      <p class="tk-note" data-tk-dims></p>
    </section>
    <section class="tk-step"><h2 class="tk-step__t"><i>02</i>Сценарий — с чего начать</h2>${seg('scenario', SCEN, st.scenario, ' tk-seg--stack')}
      <p class="tk-note">Сценарий расставляет изделия на все фасады. Дальше любое из них можно изменить, сдвинуть или удалить.</p></section>
    <section class="tk-step"><h2 class="tk-step__t"><i>03</i>Проёмы</h2>
      <div data-tk-facades></div>
      <div class="tk-row"><span class="tk-lbl">Этаж</span><div data-tk-floor-seg></div></div>
      <div class="tk-meter"><span data-tk-meter-t></span><i><b data-tk-meter></b></i></div>
      <ul class="tk-items" data-tk-items></ul>
      <div class="tk-add"><span class="tk-lbl">Добавить на этот этаж</span><div class="tk-seg tk-seg--cols3" role="group"><button type="button" data-add="pano"><b>+ Окно / витраж</b></button><button type="button" data-add="hs"><b>+ HS-портал</b></button><button type="button" data-add="fs"><b>+ FS-портал</b></button></div></div>
      <div class="tk-edit" data-tk-edit hidden></div>
      <div class="tk-links"><button type="button" data-tk-reset-floor>Этот этаж — заново по сценарию</button><button type="button" data-tk-reset>Весь дом — заново по сценарию</button></div>
    </section>
    <section class="tk-step"><h2 class="tk-step__t"><i>04</i>Пристройка со стороны двора</h2>
      ${seg('ext', ['none', 'veranda', 'garden'].map(k => ({ k, t: C.extensions[k].t, d: C.extensions[k].d })), st.ext, ' tk-seg--stack')}
      <div data-tk-ext-opts></div>
    </section>
    <section class="tk-res" data-tk-res></section>
  </div>`;
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];

  // ---------- чертёж фасада (и запасной вид без WebGL); проёмы кликабельны ----------
  function faceSvg() {
    const f = st.facade, Wf = faceLen(f), Ht = totalH(), gableEnd = f === 'left' || f === 'right', k = 0.1;
    const roofH = st.roof === 'gable' ? st.B * 0.32 : st.roof === 'shed' ? st.B * 0.2 : 300;
    const top = roofH + 200, VW = Wf * k + 80, VH = (Ht + top + 450) * k;
    const X = mm => 40 + (mm + Wf / 2) * k, Y = mm => (top + Ht - mm) * k;
    let g = `<rect class="tf-wall" x="${X(-Wf / 2)}" y="${Y(Ht)}" width="${Wf * k}" height="${Ht * k}"/>`;
    if (st.roof === 'gable') g += gableEnd ? `<path class="tf-roof" d="M${X(-Wf / 2 - 300)} ${Y(Ht)}L${X(0)} ${Y(Ht + roofH)}L${X(Wf / 2 + 300)} ${Y(Ht)}Z"/>`
      : `<rect class="tf-roof" x="${X(-Wf / 2 - 300)}" y="${Y(Ht + roofH)}" width="${(Wf + 600) * k}" height="${roofH * k}"/>`;
    else if (st.roof === 'shed') g += gableEnd ? `<path class="tf-roof" d="M${X(-Wf / 2 - 300)} ${Y(Ht)}L${X(-Wf / 2 - 300)} ${Y(Ht + (f === 'left' ? roofH : 250))}L${X(Wf / 2 + 300)} ${Y(Ht + (f === 'left' ? 250 : roofH))}L${X(Wf / 2 + 300)} ${Y(Ht)}Z"/>`
      : `<rect class="tf-roof" x="${X(-Wf / 2 - 300)}" y="${Y(Ht + (f === 'back' ? 250 : roofH))}" width="${(Wf + 600) * k}" height="${(f === 'back' ? 250 : roofH) * k}"/>`;
    else g += `<rect class="tf-roof" x="${X(-Wf / 2 - 100)}" y="${Y(Ht + 300)}" width="${(Wf + 200) * k}" height="${300 * k}"/>`;
    for (let i = 1; i < floors(); i++) g += `<line class="tf-slab" x1="${X(-Wf / 2)}" y1="${Y(floorBase(i))}" x2="${X(Wf / 2)}" y2="${Y(floorBase(i))}"/>`;
    g += `<rect class="tf-cur" x="${X(-Wf / 2) - 4}" y="${Y(floorBase(st.floor + 1)) + 2}" width="${Wf * k + 8}" height="${st.fh[st.floor] * k - 4}"/>`;
    layout().filter(o => o.facade === f).forEach(o => {
      const x0 = X(o.x - o.w / 2), y0 = Y(o.y + o.h), w = o.w * k, h = o.h * k, bad = itemIssues(o).length;
      g += `<g class="tf-o tf-o--${o.type}${o.id === st.sel ? ' is-sel' : ''}${bad ? ' is-bad' : ''}" data-pick="${o.id}"><rect x="${x0}" y="${y0}" width="${w}" height="${h}"/>`;
      for (let j = 1; j < o.n; j++) g += `<line x1="${x0 + w * j / o.n}" y1="${y0}" x2="${x0 + w * j / o.n}" y2="${y0 + h}"/>`;
      if (o.type === 'pano') for (let j = 0; j < (o.open || 0); j++) { const sx = x0 + w * j / o.n; g += `<path class="tf-fold" d="M${sx + w / o.n} ${y0}L${sx} ${y0 + h / 2}L${sx + w / o.n} ${y0 + h}"/>`; }
      if (o.type !== 'pano') P.layout(pType(o), o.n, o.scheme, o.door).forEach((lf, j) => {
        const cx = x0 + w * (j + .5) / o.n, yy = y0 + h * .55, len = Math.min(w / o.n * .3, 14);
        if (lf.kind === 'move' || lf.kind === 'fold') g += `<path class="tf-arrow" d="M${cx - lf.dir * len} ${yy}H${cx + lf.dir * len}m${-lf.dir * 5} -4 ${lf.dir * 5} 4 ${-lf.dir * 5} 4"/>`;
      });
      g += '</g>';
    });
    g += `<line class="tf-ground" x1="0" y1="${Y(0)}" x2="${VW}" y2="${Y(0)}"/>`;
    return `<svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Чертёж фасада: нажмите на проём, чтобы изменить его">${g}</svg>`;
  }

  // ---------- 3D ----------
  let house = null, view = '3d';
  const box3d = $('[data-tk-3d]');
  import(new URL('turnkey3d.js?v=2', SELF).href).then(m => {
    house = m.createHouse(box3d, { onPick: id => select(id) });
    if (!house) throw new Error('no webgl');
    render3d();
  }).catch(err => {
    if (String(err && err.message) !== 'no webgl') console.error('3D-макет:', err);
    box3d.innerHTML = '<p class="tk3d__msg">3D-макет не загрузился в этом браузере — смотрите чертёж фасада.</p>';
    setView('face');
  });
  const render3d = () => { if (house) house.set({ L: st.L, B: st.B, fh: st.fh, roof: st.roof, openings: layout(), sel: st.sel, facade: st.facade,
    ext: st.ext, extW: extWidth(), extD: st.extD, extH: st.extH, extWall: st.extWall, mods: (extEstimate() || {}).mods, evening: st.evening }); };
  function setView(v) {
    view = v;
    $$('[data-tk-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tkView === v)));
    box3d.hidden = v !== '3d'; $('[data-tk-face]').hidden = v !== 'face';
  }
  function select(id) {
    const it = st.items.find(x => x.id === id);
    if (!it) return;
    st.sel = id; st.facade = it.f; st.floor = it.fl;
    update();
    const ed = $('[data-tk-edit]');
    if (ed && innerWidth < 1100) ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- редактор выбранного изделия ----------
  function editor(it) {
    const issues = itemIssues(it), p = itemPrice(it);
    let body = `<div class="tk-fields">${field('e-w', 'Ширина, мм', it.w, 400, 20000)}${field('e-h', 'Высота, мм', it.h, 400, 4500)}${it.type === 'pano' ? field('e-sill', 'От пола, мм', it.sill || 0, 0, 2000) : ''}</div>`;
    if (isPortal(it)) {
      const S = recN(it), type = pType(it);
      body += `<div class="tk-row"><span class="tk-lbl">Секции</span>${seg('e-n', S.list.map(n => ({ k: n, t: `${n}${n === S.rec ? ' <em>Рекомендуем</em>' : ''}`, d: `проход ≈ ${fmt(P.passage(type, it.w, n, P.schemesFor(type, n)[0].code))} мм` })), it.n, ' tk-seg--cols')}</div>`;
      body += `<div class="tk-row"><span class="tk-lbl">Схема</span>${seg('e-scheme', P.schemesFor(type, it.n).map(s => ({ k: s.code, t: `${esc(s.t)} · ${s.code}`, d: s.d })), it.scheme, ' tk-seg--stack')}</div>`;
      if (P.doorAllowed(type, it.n)) body += `<div class="tk-seg tk-seg--multi" role="group"><button type="button" data-e-door aria-pressed="${it.door}"><b>${it.door ? '✓' : '+'} Активная рабочая дверь</b><small>крайняя створка открывается как распашная</small></button></div>`;
      body += `<p class="tk-note">Рама ${P.frameDepth(type, it.n, it.scheme)} мм · проход ≈ ${fmt(P.passage(type, it.w, it.n, it.scheme))} мм${P.triplexForced(it.w, it.h, it.n) ? ' · створка больше 5 м² — триплекс' : ''}</p>`;
    } else {
      const maxN = Math.max(1, Math.min(C.pano.max_sections, Math.floor(it.w / C.pano.sash_min_w)));
      body += `<div class="tk-row"><span class="tk-lbl">Секций</span>${seg('e-n', Array.from({ length: maxN }, (_, j) => ({ k: j + 1, t: String(j + 1) })), it.n, ' tk-seg--cols')}</div>`;
      body += `<div class="tk-row"><span class="tk-lbl">Открывающихся секций</span>${seg('e-open', Array.from({ length: it.n + 1 }, (_, j) => ({ k: j, t: j ? String(j) : 'Глухой' })), it.open || 0, ' tk-seg--cols')}</div>`;
      body += `<p class="tk-note">Секция ≈ ${fmt(it.w / it.n)} мм. Открывающаяся — поворотно-откидная или распашная.</p>`;
    }
    return `<div class="tk-edit__head"><b>${itemName(it)}</b><span>${p ? `${fmt(p)} ₽` : '—'}</span></div>${body}
      ${issues.map(t => `<p class="tk-err">${esc(t)}</p>`).join('')}
      <div class="tk-edit__act"><button type="button" data-e-move="-1" aria-label="Сдвинуть влево">← Левее</button><button type="button" data-e-move="1" aria-label="Сдвинуть вправо">Правее →</button><button type="button" data-e-del>Удалить</button><button type="button" data-e-close>Готово</button></div>`;
  }

  // ---------- обновление ----------
  function update(opts = {}) {
    const E = estimate();
    // 01 дом
    $('[data-tk-floors]').innerHTML = seg('floors', Array.from({ length: H.floors.max }, (_, j) => ({ k: j + 1, t: String(j + 1) })), floors(), ' tk-seg--cols');
    $('[data-tk-fh]').innerHTML = st.fh.map((h, i) => field('tk-fh', `${i + 1}-й`, h, H.floor_h.min, H.floor_h.max, 50).replace('data-tk-fh', `data-tk-fh="${i}"`)).join('');
    $$('[data-roof]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.roof === st.roof)));
    $('[data-tk-dims]').textContent = `Площадь ≈ ${fmt(st.L * st.B / 1e6 * floors())} м² · высота стен ${mm2(totalH())} м`;
    $$('[data-scenario]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scenario === st.scenario)));
    $$('[data-ext]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ext === st.ext)));
    // 03 фасады и этажи
    if (st.floor >= floors()) st.floor = floors() - 1;
    $('[data-tk-facades]').innerHTML = `<div class="tk-seg tk-seg--cols4" role="group">${FACADES.map(F => {
      const n = st.items.filter(it => it.f === F.k).length, over = Array.from({ length: floors() }, (_, i) => usedW(at(F.k, i)) > usable(F.k)).some(Boolean);
      return `<button type="button" data-facade="${F.k}" aria-pressed="${F.k === st.facade}"${over ? ' class="is-bad"' : ''}><b>${F.t}</b><small>${mm2(faceLen(F.k))} м · ${n} ${plural(n, 'проём', 'проёма', 'проёмов')}</small></button>`;
    }).join('')}</div>`;
    $('[data-tk-floor-seg]').innerHTML = seg('floor', st.fh.map((_, i) => ({ k: i, t: `${i + 1}-й` })), st.floor, ' tk-seg--cols');
    const list = at(st.facade, st.floor), u = usedW(list), cap = usable(st.facade);
    $('[data-tk-meter]').style.width = Math.min(100, u / cap * 100) + '%';
    $('.tk-meter').classList.toggle('is-bad', u > cap);
    $('[data-tk-meter-t]').textContent = u > cap ? `Не помещается: ${mm2(u)} м при ширине ${mm2(cap)} м — уменьшите или удалите проём` : `Занято ${mm2(u)} из ${mm2(cap)} м ширины фасада`;
    $('[data-tk-items]').innerHTML = list.length ? list.map(it => {
      const p = itemPrice(it), bad = itemIssues(it).length;
      return `<li><button type="button" data-pick="${it.id}" aria-pressed="${it.id === st.sel}"${bad ? ' class="is-bad"' : ''}><span><b>${itemName(it)}</b><small>${esc(itemSpec(it))}</small></span><em>${p ? `${fmt(p)} ₽` : 'проверьте размер'}</em></button></li>`;
    }).join('') : '<li class="tk-items__empty">На этом этаже фасада проёмов нет — добавьте ниже.</li>';
    const sel = st.items.find(x => x.id === st.sel && x.f === st.facade && x.fl === st.floor);
    const ed = $('[data-tk-edit]');
    ed.hidden = !sel; ed.innerHTML = sel ? editor(sel) : '';
    // 04 пристройка
    const ext = E.ext;
    $('[data-tk-ext-opts]').innerHTML = st.ext === 'none' ? '' : `
      ${st.ext === 'veranda' ? `<div class="tk-row"><span class="tk-lbl">Стены</span>${seg('extwall', EXT_WALLS, st.extWall, ' tk-seg--cols')}</div>` : ''}
      <div class="tk-fields">${field('tk-ext-w', 'Ширина, мм', extWidth(), 2000, st.L, 100)}${field('tk-ext-d', 'Глубина, мм', st.extD, C.ext.d.min, C.ext.d.max, 100)}${field('tk-ext-h', 'Высота, мм', st.extH, C.ext.h.min, C.ext.h.max, 50)}</div>
      <p class="tk-note">Стены: ${ext.mods.map((m, j) => `${['фронт', 'левая', 'правая'][j]} — ${m.length} × ${mm2(m[0])} м`).join(', ')}${st.ext === 'veranda' && st.extWall !== 'pano' ? ` (${st.extWall === 'hs' ? 'HS' : 'FS'}-порталы по ТЗ)` : ''}.${ext.bad ? ' Часть модулей вне лимитов системы — посчитаем по заявке.' : ''}</p>`;
    // вид и подпись
    const F = FACADES.find(x => x.k === st.facade);
    $('[data-tk-caption]').textContent = `${F.t} (${F.d}) · ${mm2(faceLen(st.facade))} м · ${st.floor + 1}-й этаж · нажмите на проём, чтобы изменить его`;
    $('[data-tk-face]').innerHTML = faceSvg();
    // итог
    const counts = { pano: 0, hs: 0, fs: 0 };
    st.items.forEach(it => { counts[it.type]++; });
    $('[data-tk-res]').innerHTML = `
      <h2 class="tk-step__t"><i>✓</i>Ваш проект</h2>
      <div class="tk-res__big"><div><small>Площадь стекла</small><strong>${fmt(E.area)} м²</strong></div><div><small>Ориентировочно, под ключ</small><strong>${E.total ? `≈ ${fmt(E.total)} ₽` : '—'}</strong></div></div>
      <ul class="tk-res__lines">
        ${counts.pano ? `<li><span>Окна и витражи × ${counts.pano}</span><b>${fmt(E.lines.filter(l => l.it.type === 'pano').reduce((a, l) => a + (l.p || 0), 0))} ₽</b></li>` : ''}
        ${counts.hs ? `<li><span>HS-порталы × ${counts.hs}</span><b>${fmt(E.lines.filter(l => l.it.type === 'hs').reduce((a, l) => a + (l.p || 0), 0))} ₽</b></li>` : ''}
        ${counts.fs ? `<li><span>FS-порталы × ${counts.fs}</span><b>${fmt(E.lines.filter(l => l.it.type === 'fs').reduce((a, l) => a + (l.p || 0), 0))} ₽</b></li>` : ''}
        ${ext ? `<li><span>${esc(ext.t)}</span><b>${fmt(ext.sum)} ₽</b></li>` : ''}
        ${E.install ? `<li><span>Доставка и монтаж ≈ ${C.services.install_delivery_pct} %</span><b>≈ ${fmt(E.install)} ₽</b></li>` : ''}
        ${E.goods ? '' : '<li><span>Добавьте проёмы или пристройку</span><b>—</b></li>'}
      </ul>
      ${E.overflow.length || E.bad ? `<p class="tk-err">${E.overflow.length ? `Не помещаются проёмы: ${E.overflow.join('; ')}. ` : ''}${E.bad ? `Проверьте размеры у ${E.bad} ${plural(E.bad, 'изделия', 'изделий', 'изделий')} — они отмечены.` : ''}</p>` : ''}
      <div class="tk-res__inc"><small>Под ключ — это</small><ul>${C.included.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <p class="tk-note">Срок изготовления — ${esc(C.term)}, монтаж — по графику объекта. Цена ориентировочная: точную смету инженер подготовит после замера или по чертежам дома.</p>
      <div class="tk-res__act"><a class="tk-btn" href="#turnkey-form">Получить проект остекления <span aria-hidden="true">↓</span></a><button type="button" class="tk-link" data-tk-copy>Скопировать ссылку на проект</button></div>`;
    const form = document.querySelector('#turnkey-form lead-form');
    if (form && form.setProject) form.setProject(summary(E));
    if (!opts.keepHash) save();
    render3d();
  }

  function summary(E) {
    const rows = FACADES.map(F => Array.from({ length: floors() }, (_, i) => at(F.k, i).map(it => `  ${F.t}, ${i + 1}-й этаж: ${itemName(it)} ${itemSpec(it)}${itemPrice(it) ? ` — ${fmt(itemPrice(it))} ₽` : ''}`).join('\n')).filter(Boolean).join('\n')).filter(Boolean).join('\n');
    return [
      'ОСТЕКЛЕНИЕ ПОД КЛЮЧ — конфигурация из конструктора',
      `Дом: ${mm2(st.L)} × ${mm2(st.B)} м, этажей ${floors()} (высоты ${st.fh.join(' / ')} мм), кровля ${ROOFS.find(r => r.k === st.roof).t.toLowerCase()}`,
      `Сценарий: ${SCEN.find(s => s.k === st.scenario).t}`, 'Изделия:', rows || '  нет',
      E.ext ? `Пристройка: ${E.ext.t}, высота ${mm2(st.extH)} м${st.ext === 'veranda' ? `, стены — ${EXT_WALLS.find(w => w.k === st.extWall).t}` : ''} — ${fmt(E.ext.sum)} ₽` : 'Пристройка: нет',
      `Площадь стекла: ${fmt(E.area)} м²`, `Ориентировочно: ≈ ${fmt(E.total)} ₽ (с доставкой и монтажом)`,
      `Ссылка: ${location.href}`,
    ].join('\n');
  }

  // ---------- события ----------
  const cur = () => st.items.find(x => x.id === st.sel);
  root.addEventListener('click', e => {
    const pick = e.target.closest('[data-pick]');
    if (pick && root.contains(pick)) { select(+pick.dataset.pick); return; }
    const b = e.target.closest('button');
    if (!b || b.disabled || !root.contains(b)) return;
    const d = b.dataset, it = cur();
    if (d.tkView) { setView(d.tkView); return; }
    if ('tkEvening' in d) { st.evening = !st.evening; b.setAttribute('aria-pressed', String(st.evening)); b.textContent = st.evening ? 'День' : 'Вечер'; root.classList.toggle('is-evening', st.evening); render3d(); return; }
    if ('tkCopy' in d) {
      const done = () => { b.textContent = 'Ссылка скопирована'; setTimeout(() => { b.textContent = 'Скопировать ссылку на проект'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, done); else done();
      return;
    }
    if (d.floors) {
      const n = +d.floors, was = floors();
      st.fh = Array.from({ length: n }, (_, i) => st.fh[i] || H.floor_h.def);
      st.items = st.items.filter(x => x.fl < n);
      for (let i = was; i < n; i++) FACADES.forEach(({ k }) => presetFloor(k, i));
    } else if (d.roof) st.roof = d.roof;
    else if (d.scenario) { st.scenario = d.scenario; preset(); }
    else if (d.facade) { st.facade = d.facade; st.sel = null; }
    else if (d.floor) { st.floor = +d.floor; st.sel = null; }
    else if (d.add) { const n = make(d.add, st.facade, st.floor, d.add === 'fs' ? { w: 3600 } : {}); st.items.push(n); st.sel = n.id; }
    else if ('tkReset' in d) preset();
    else if ('tkResetFloor' in d) { presetFloor(st.facade, st.floor); st.sel = null; }
    else if (d.ext) st.ext = d.ext;
    else if (d.extwall) st.extWall = d.extwall;
    else if (it && d.eN) { it.n = +d.eN; normalize(it); }
    else if (it && d.eScheme) it.scheme = d.eScheme;
    else if (it && 'eDoor' in d) it.door = !it.door;
    else if (it && d.eOpen) it.open = +d.eOpen;
    else if (it && d.eMove) {
      const list = at(it.f, it.fl), j = list.indexOf(it), k = j + +d.eMove;
      if (k < 0 || k >= list.length) return;
      const a = st.items.indexOf(list[j]), bI = st.items.indexOf(list[k]);
      [st.items[a], st.items[bI]] = [st.items[bI], st.items[a]];
    } else if (it && 'eDel' in d) { st.items = st.items.filter(x => x !== it); st.sel = null; }
    else if ('eClose' in d) st.sel = null;
    else return;
    update();
  });
  // Поля — по «change» (выход из поля или Enter), чтобы не терять фокус при каждом символе
  root.addEventListener('change', e => {
    const t = e.target, v = parseInt(t.value, 10), it = cur();
    if (!Number.isFinite(v)) return;
    const cl = (x, r) => Math.min(r.max, Math.max(r.min, x));
    if ('tkLen' in t.dataset) st.L = cl(v, H.L);
    else if ('tkWid' in t.dataset) st.B = cl(v, H.B);
    else if ('tkFh' in t.dataset) st.fh[+t.dataset.tkFh] = cl(v, H.floor_h);
    else if ('tkExtW' in t.dataset) st.extW = Math.min(st.L, Math.max(2000, v));
    else if ('tkExtD' in t.dataset) st.extD = cl(v, C.ext.d);
    else if ('tkExtH' in t.dataset) st.extH = cl(v, C.ext.h);
    else if (it && 'eW' in t.dataset) { it.w = Math.max(400, v); normalize(it); }
    else if (it && 'eH' in t.dataset) it.h = Math.max(400, v);
    else if (it && 'eSill' in t.dataset) it.sill = Math.max(0, v);
    else return;
    update();
  });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) e.target.blur(); });

  customElements.whenDefined('lead-form').then(() => requestAnimationFrame(() => update({ keepHash: true })));
  if (!load()) preset();
  update({ keepHash: true });
})();
