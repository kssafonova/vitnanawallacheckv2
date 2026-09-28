/* «Остекление под ключ» (/osteklenie-pod-klyuch/, [data-turnkey]) — интерактивный конструктор остекления дома.
   01 Дом: этажи, площадь, кровля → в 3D появляется «голый» дом-макет без окон.
   02 Сценарий: «Классика» / «Панорама» / «Максимум стекла» — проёмы расставляются сами по фасадам и этажам.
   03 Проёмы: фасад (фасад, двор, левый, правый) × этаж, счётчики «− N +» для панорамных окон, HS- и FS-порталов;
      вместимость фасада контролируется (сумма ширин + промежутки ≤ ширины фасада).
   04 Пристройка: веранда (стены HS / FS / панорамы) или зимний сад со стороны двора, глубина 3–5 м.
   Итог: площадь стекла, позиции, монтаж и доставка (services), «≈ итого», что входит, срок, ссылка на проект (#c=…) и форма.
   Данные и цены-заглушки — data/turnkey.json (блок build:turnkey-data), HS / FS — по формуле ТЗ (portal-calc.js).
   3D — assets/js/turnkey3d.js (three.js, грузится сразу, без WebGL остаётся вид фасада в 2D). */
(() => {
  const root = document.querySelector('[data-turnkey]');
  const P = window.PSPortal;
  let C;
  try { C = JSON.parse(document.querySelector('[data-tk-json]').textContent); } catch (e) { return; }
  if (!root || !P) return;
  const SELF = (document.currentScript && document.currentScript.src) || location.href;
  const fmt = n => new Intl.NumberFormat('ru-RU').format(Math.round(n));
  const m1 = mm => (mm / 1000).toFixed(1).replace('.', ',');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TYPES = ['pano', 'hs', 'fs'];
  const FACADES = [
    { k: 'front', t: 'Фасад', d: 'со стороны въезда' },
    { k: 'back', t: 'Двор', d: 'терраса и сад' },
    { k: 'left', t: 'Левый', d: 'торец' },
    { k: 'right', t: 'Правый', d: 'торец' },
  ];
  const SCEN = [
    { k: 'classic', t: 'Классика', d: 'Панорамные окна на всех фасадах, без порталов' },
    { k: 'panorama', t: 'Панорама', d: 'Больше окон в пол и HS-портал во двор' },
    { k: 'max', t: 'Максимум стекла', d: 'Стеклянный фасад во двор, порталы на первом этаже' },
  ];
  const ROOFS = [{ k: 'gable', t: 'Двускатная' }, { k: 'flat', t: 'Плоская' }];
  const EXT_WALLS = [{ k: 'hs', t: 'HS-порталы' }, { k: 'fs', t: 'FS-гармошка' }, { k: 'pano', t: 'Панорамы' }];

  const st = {
    floors: C.floors.default, area: C.area.default, roof: 'gable', scenario: 'panorama',
    facade: 'back', floor: 0, ext: 'none', extDepth: C.ext_depths[1], extWall: 'hs', evening: false, open: {},
  };

  // ---------- геометрия дома: пятно = площадь / этажи, пропорция 1,6 : 1, длинная сторона — фасад и двор ----------
  const dims = () => {
    const fp = st.area * 1e6 / st.floors;
    const W = Math.round(Math.sqrt(fp * 1.6) / 100) * 100, D = Math.round(fp / W / 100) * 100;
    return { W, D, H: st.floors * C.floor_height };
  };
  const faceW = f => (f === 'front' || f === 'back' ? dims().W : dims().D);
  const usable = f => faceW(f) - 2 * C.margin;
  const used = cnt => {
    const n = TYPES.reduce((a, t) => a + (cnt[t] || 0), 0);
    return TYPES.reduce((a, t) => a + (cnt[t] || 0) * C.types[t].w, 0) + Math.max(0, n - 1) * C.gap;
  };
  const cell = (f, i) => { st.open[f] = st.open[f] || []; st.open[f][i] = st.open[f][i] || { pano: 0, hs: 0, fs: 0 }; return st.open[f][i]; };
  // Лишнее не помещается — убираем сначала окна, потом FS, потом HS
  const clamp = (f, c) => { for (const t of ['pano', 'fs', 'hs']) while (c[t] > 0 && used(c) > usable(f)) c[t]--; return c; };
  const fit = (f, w) => Math.max(0, Math.floor((usable(f) + C.gap) / (w + C.gap)));

  // ---------- сценарии: проёмы по фасадам и этажам ----------
  function preset() {
    st.open = {};
    FACADES.forEach(({ k: f }) => {
      for (let i = 0; i < st.floors; i++) {
        const c = cell(f, i), long = f === 'front' || f === 'back', pw = C.types.pano.w;
        if (st.scenario === 'classic') c.pano = Math.min(fit(f, pw), Math.max(long ? 1 : 0, Math.floor(faceW(f) / (long ? 3800 : 4800))));
        else if (st.scenario === 'panorama') {
          if (f === 'back' && i === 0) { c.hs = 1; c.pano = Math.floor(Math.max(0, usable(f) - C.types.hs.w - C.gap) / (pw + C.gap) / 2) * 2; }
          else c.pano = Math.min(fit(f, pw), Math.max(1, Math.floor(faceW(f) / (long ? 2900 : 3800))));
        } else {
          if (f === 'back' && i === 0) c.hs = Math.min(3, fit(f, C.types.hs.w));
          else if (i === 0 && !long && faceW(f) >= C.types.fs.w + 2 * C.margin) c.fs = 1;
          else c.pano = fit(f, pw) ? Math.max(1, Math.floor(fit(f, pw) * (long ? 0.9 : 0.6))) : 0;
          if (f === 'back' && i === 0) c.pano = Math.floor(Math.max(0, usable(f) - used(c) - C.gap) / (pw + C.gap));
        }
        clamp(f, c);
      }
    });
  }

  // Раскладка проёмов на фасаде: половина окон слева, порталы по центру, остальные окна справа; x — центр проёма от центра фасада, мм
  function layoutFace(f, i) {
    const c = cell(f, i), items = [];
    const left = Math.floor((c.pano || 0) / 2), right = (c.pano || 0) - left;
    const push = (t, k) => { for (let j = 0; j < k; j++) items.push({ type: t, w: C.types[t].w, h: C.types[t].h, n: C.types[t].n || 1 }); };
    push('pano', left); push('hs', c.hs || 0); push('fs', c.fs || 0); push('pano', right);
    let x = -used(c) / 2;
    items.forEach((it, j) => { it.x = x + it.w / 2; x += it.w + C.gap; it.facade = f; it.floor = i; it.key = `${f}-${i}-${j}-${it.type}`; });
    return items;
  }
  const allOpenings = () => FACADES.flatMap(({ k }) => Array.from({ length: st.floors }, (_, i) => layoutFace(k, i)).flat());

  // ---------- цена ----------
  const unit = t => {
    const T = C.types[t];
    if (t === 'pano') return T.rate * T.w * T.h / 1e6;
    return P.price({ type: t === 'hs' ? 'HS' : 'FS', w: T.w, h: T.h, n: T.n, scheme: T.scheme, glass: 'standard', color: 'mono', handle: 'standard', extraSections: [T.n] }) || 0;
  };
  function estimate() {
    const counts = { pano: 0, hs: 0, fs: 0 };
    FACADES.forEach(({ k }) => { for (let i = 0; i < st.floors; i++) TYPES.forEach(t => { counts[t] += cell(k, i)[t] || 0; }); });
    const lines = TYPES.filter(t => counts[t]).map(t => ({ t: C.types[t].t, q: counts[t], sum: counts[t] * unit(t), area: counts[t] * C.types[t].w * C.types[t].h / 1e6 }));
    let ext = null;
    if (st.ext !== 'none') {
      const { W } = dims(), d = st.extDepth, wall = (W + 2 * d) * C.ext_height / 1e6, roof = W * d / 1e6, E = C.extensions[st.ext];
      const sum = st.ext === 'garden' ? wall * E.wall_rate + roof * 1.08 * E.roof_rate : wall * C.ext_wall_rates[st.extWall] + roof * E.roof_rate;
      ext = { t: `${E.t} ${m1(W)} × ${m1(d)} м`, sum, area: wall + (st.ext === 'garden' ? roof * 1.08 : 0) };
    }
    const goods = lines.reduce((a, l) => a + l.sum, 0) + (ext ? ext.sum : 0);
    const S = C.services || {};
    const install = goods ? Math.max(Math.round(goods * (S.install_delivery_pct || 12) / 100 / 1000) * 1000, S.install_delivery_min || 0) : 0;
    const area = lines.reduce((a, l) => a + l.area, 0) + (ext ? ext.area : 0);
    return { counts, lines, ext, goods, install, total: goods + install, area };
  }

  // ---------- ссылка на проект: состояние в #c=… ----------
  const save = () => {
    const c = { f: st.floors, a: st.area, r: st.roof, s: st.scenario, e: st.ext, d: st.extDepth, w: st.extWall, o: st.open };
    try { history.replaceState(null, '', '#c=' + btoa(unescape(encodeURIComponent(JSON.stringify(c))))); } catch (e) { /* без ссылки */ }
  };
  const load = () => {
    const m = location.hash.match(/#c=([\w+/=]+)/);
    if (!m) return false;
    try {
      const c = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      Object.assign(st, { floors: c.f, area: c.a, roof: c.r, scenario: c.s, ext: c.e, extDepth: c.d, extWall: c.w, open: c.o || {} });
      st.floors = Math.min(C.floors.max, Math.max(C.floors.min, +st.floors || 2));
      st.area = Math.min(C.area.max, Math.max(C.area.min, +st.area || 180));
      return true;
    } catch (e) { return false; }
  };

  // ---------- разметка ----------
  const seg = (name, items, cur, cls = '') => `<div class="tk-seg${cls}" role="group">${items.map(x =>
    `<button type="button" data-${name}="${x.k}" aria-pressed="${String(x.k) === String(cur)}"><b>${esc(x.t)}</b>${x.d ? `<small>${esc(x.d)}</small>` : ''}</button>`).join('')}</div>`;
  root.innerHTML = `
  <div class="tk__viewer">
    <div class="tk__bar">
      <div class="tk-tabs" role="tablist" aria-label="Вид"><button type="button" role="tab" aria-selected="true" data-tk-view="3d">3D-макет</button><button type="button" role="tab" aria-selected="false" data-tk-view="face">Фасад</button></div>
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
      <div class="tk-row"><span class="tk-lbl">Этажей</span>${seg('floors', [1, 2, 3].map(n => ({ k: n, t: String(n) })), st.floors, ' tk-seg--cols')}</div>
      <div class="tk-row"><span class="tk-lbl">Площадь дома <b data-tk-area-v></b></span>
        <input class="tk-range" type="range" min="${C.area.min}" max="${C.area.max}" step="${C.area.step}" value="${st.area}" data-tk-area aria-label="Площадь дома, м²">
        <p class="tk-note" data-tk-dims></p></div>
      <div class="tk-row"><span class="tk-lbl">Кровля</span>${seg('roof', ROOFS, st.roof, ' tk-seg--cols')}</div>
    </section>
    <section class="tk-step"><h2 class="tk-step__t"><i>02</i>Сценарий остекления</h2>${seg('scenario', SCEN, st.scenario, ' tk-seg--stack')}
      <p class="tk-note">Проёмы расставятся сами — дальше их можно поправить на каждом фасаде.</p></section>
    <section class="tk-step"><h2 class="tk-step__t"><i>03</i>Проёмы по фасадам</h2>
      <div data-tk-facades></div>
      <div class="tk-row"><span class="tk-lbl">Этаж</span><div data-tk-floor-seg></div></div>
      <div class="tk-counters" data-tk-counters></div>
      <div class="tk-meter"><span data-tk-meter-t></span><i><b data-tk-meter></b></i></div>
      <div class="tk-links"><button type="button" data-tk-clear>Убрать проёмы с этого этажа</button><button type="button" data-tk-reset>Вернуть по сценарию</button></div>
    </section>
    <section class="tk-step"><h2 class="tk-step__t"><i>04</i>Пристройка</h2>
      ${seg('ext', ['none', 'veranda', 'garden'].map(k => ({ k, t: C.extensions[k].t, d: C.extensions[k].d })), st.ext, ' tk-seg--stack')}
      <div data-tk-ext-opts></div>
    </section>
    <section class="tk-res" data-tk-res></section>
  </div>`;
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];

  // ---------- 2D-вид фасада (и запасной вид без WebGL) ----------
  function faceSvg() {
    const f = st.facade, { D, H } = dims(), Wf = faceW(f), k = 0.1, roofH = st.roof === 'gable' ? D * 0.35 : 300;
    const gableEnd = f === 'left' || f === 'right', top = roofH + 200, VW = Wf * k + 80, VH = (H + top + 500) * k;
    const X = mm => 40 + (mm + Wf / 2) * k, Y = mm => (top + H - mm) * k;
    let g = `<rect class="tf-wall" x="${X(-Wf / 2)}" y="${Y(H)}" width="${Wf * k}" height="${H * k}"/>`;
    if (st.roof === 'gable') g += gableEnd
      ? `<path class="tf-roof" d="M${X(-Wf / 2 - 300)} ${Y(H)}L${X(0)} ${Y(H + roofH)}L${X(Wf / 2 + 300)} ${Y(H)}Z"/>`
      : `<rect class="tf-roof" x="${X(-Wf / 2 - 300)}" y="${Y(H + roofH)}" width="${(Wf + 600) * k}" height="${roofH * k}"/>`;
    else g += `<rect class="tf-roof" x="${X(-Wf / 2 - 100)}" y="${Y(H + 300)}" width="${(Wf + 200) * k}" height="${300 * k}"/>`;
    for (let i = 1; i < st.floors; i++) g += `<line class="tf-slab" x1="${X(-Wf / 2)}" y1="${Y(i * C.floor_height)}" x2="${X(Wf / 2)}" y2="${Y(i * C.floor_height)}"/>`;
    for (let i = 0; i < st.floors; i++) layoutFace(f, i).forEach(o => {
      const x0 = X(o.x - o.w / 2), y0 = Y(i * C.floor_height + 100 + o.h), w = o.w * k, h = o.h * k;
      g += `<g class="tf-o tf-o--${o.type}${i === st.floor ? ' is-cur' : ''}"><rect x="${x0}" y="${y0}" width="${w}" height="${h}"/>`;
      for (let j = 1; j < o.n; j++) g += `<line x1="${x0 + w * j / o.n}" y1="${y0}" x2="${x0 + w * j / o.n}" y2="${y0 + h}"/>`;
      if (o.type === 'hs') g += `<path class="tf-arrow" d="M${x0 + w * .62} ${y0 + h * .55}H${x0 + w * .38}m6 -5-6 5 6 5"/>`;
      if (o.type === 'fs') for (let j = 0; j < o.n; j++) g += `<path class="tf-fold" d="M${x0 + w * (j + 1) / o.n} ${y0}L${x0 + w * j / o.n} ${y0 + h / 2}L${x0 + w * (j + 1) / o.n} ${y0 + h}"/>`;
      g += '</g>';
    });
    if (st.floor < st.floors) g += `<rect class="tf-cur" x="${X(-Wf / 2) - 4}" y="${Y((st.floor + 1) * C.floor_height) + 2}" width="${Wf * k + 8}" height="${C.floor_height * k - 4}"/>`;
    g += `<line class="tf-ground" x1="0" y1="${Y(0)}" x2="${VW}" y2="${Y(0)}"/>`;
    g += `<path class="tf-dim" d="M${X(-Wf / 2)} ${Y(0) + 26}H${X(Wf / 2)}M${X(-Wf / 2)} ${Y(0) + 18}v16M${X(Wf / 2)} ${Y(0) + 18}v16"/>`;
    return `<svg viewBox="0 0 ${VW} ${VH + 20}" role="img" aria-label="Вид фасада">${g}</svg>`;
  }

  // ---------- 3D ----------
  let house = null;
  const box3d = $('[data-tk-3d]');
  import(new URL('turnkey3d.js?v=1', SELF).href).then(m => {
    house = m.createHouse(box3d);
    if (!house) throw new Error('no webgl');
    render3d();
  }).catch(err => {
    if (String(err && err.message) !== 'no webgl') console.error('3D-макет:', err);
    box3d.innerHTML = '<p class="tk3d__msg">3D-макет не загрузился в этом браузере — смотрите вид фасада.</p>';
    setView('face');
  });
  const render3d = () => { if (house) house.set({ ...dims(), floors: st.floors, fh: C.floor_height, roof: st.roof, openings: allOpenings(), ext: st.ext, extDepth: st.extDepth, extWall: st.extWall, extH: C.ext_height, facade: st.facade, evening: st.evening }); };

  let view = '3d';
  function setView(v) {
    view = v;
    $$('[data-tk-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tkView === v)));
    box3d.hidden = v !== '3d'; $('[data-tk-face]').hidden = v !== 'face';
  }

  // ---------- обновление ----------
  function update(opts = {}) {
    const { W, D } = dims(), E = estimate();
    $('[data-tk-area-v]').textContent = `${st.area} м²`;
    $('[data-tk-dims]').textContent = `Пятно дома ≈ ${m1(W)} × ${m1(D)} м, высота ${st.floors} × 3 м`;
    $$('[data-floors]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.floors === st.floors)));
    $$('[data-roof]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.roof === st.roof)));
    $$('[data-scenario]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scenario === st.scenario)));
    $$('[data-ext]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ext === st.ext)));
    // фасады: сколько проёмов на каждом
    $('[data-tk-facades]').innerHTML = `<div class="tk-seg tk-seg--cols4" role="group">${FACADES.map(F => {
      const n = Array.from({ length: st.floors }, (_, i) => TYPES.reduce((a, t) => a + (cell(F.k, i)[t] || 0), 0)).reduce((a, b) => a + b, 0);
      return `<button type="button" data-facade="${F.k}" aria-pressed="${F.k === st.facade}"><b>${F.t}</b><small>${m1(faceW(F.k))} м · ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'проём' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'проёма' : 'проёмов'}</small></button>`;
    }).join('')}</div>`;
    if (st.floor >= st.floors) st.floor = st.floors - 1;
    $('[data-tk-floor-seg]').innerHTML = `<div class="tk-seg tk-seg--cols" role="group">${Array.from({ length: st.floors }, (_, i) =>
      `<button type="button" data-floor="${i}" aria-pressed="${i === st.floor}"><b>${i + 1}-й</b></button>`).join('')}</div>`;
    const c = cell(st.facade, st.floor), free = usable(st.facade) - used(c);
    $('[data-tk-counters]').innerHTML = TYPES.map(t => {
      const T = C.types[t], canAdd = used({ ...c, [t]: (c[t] || 0) + 1 }) <= usable(st.facade);
      return `<div class="tk-cnt"><span><b>${T.t}</b><small>${m1(T.w)} × ${m1(T.h)} м · ${T.d}</small></span>
        <div class="tk-cnt__ctl"><button type="button" data-dec="${t}" aria-label="Убрать: ${T.t}"${c[t] ? '' : ' disabled'}>−</button><output>${c[t] || 0}</output><button type="button" data-inc="${t}" aria-label="Добавить: ${T.t}"${canAdd ? '' : ' disabled'}>+</button></div></div>`;
    }).join('');
    const pct = Math.min(100, Math.max(0, used(c) / usable(st.facade) * 100));
    $('[data-tk-meter]').style.width = pct + '%';
    $('[data-tk-meter-t]').textContent = free >= 0 ? `Занято ${m1(used(c))} из ${m1(usable(st.facade))} м ширины` : 'Не помещается';
    // пристройка
    $('[data-tk-ext-opts]').innerHTML = st.ext === 'none' ? '' : `
      ${st.ext === 'veranda' ? `<div class="tk-row"><span class="tk-lbl">Стены веранды</span>${seg('extwall', EXT_WALLS, st.extWall, ' tk-seg--cols')}</div>` : ''}
      <div class="tk-row"><span class="tk-lbl">Глубина</span>${seg('extdepth', C.ext_depths.map(d => ({ k: d, t: `${m1(d)} м` })), st.extDepth, ' tk-seg--cols')}</div>
      <p class="tk-note">Со стороны двора, во всю длину дома — ${m1(W)} м.</p>`;
    // итог
    const F = FACADES.find(x => x.k === st.facade);
    $('[data-tk-caption]').textContent = `${F.t} (${F.d}) · ${m1(faceW(st.facade))} м · выделен ${st.floor + 1}-й этаж`;
    $('[data-tk-face]').innerHTML = faceSvg();
    $('[data-tk-res]').innerHTML = `
      <h2 class="tk-step__t"><i>✓</i>Ваш проект</h2>
      <div class="tk-res__big"><div><small>Площадь стекла</small><strong>${fmt(E.area)} м²</strong></div><div><small>Ориентировочно, под ключ</small><strong>${E.total ? `≈ ${fmt(E.total)} ₽` : '—'}</strong></div></div>
      <ul class="tk-res__lines">
        ${E.lines.map(l => `<li><span>${esc(l.t)} × ${l.q}</span><b>${fmt(l.sum)} ₽</b></li>`).join('')}
        ${E.ext ? `<li><span>${esc(E.ext.t)}</span><b>${fmt(E.ext.sum)} ₽</b></li>` : ''}
        ${E.install ? `<li><span>Доставка и монтаж ≈ ${C.services.install_delivery_pct} %</span><b>≈ ${fmt(E.install)} ₽</b></li>` : ''}
        ${E.goods ? '' : '<li><span>Добавьте проёмы или пристройку</span><b>—</b></li>'}
      </ul>
      <div class="tk-res__inc"><small>Под ключ — это</small><ul>${C.included.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <p class="tk-note">Срок изготовления — ${esc(C.term)}, монтаж — по графику объекта. Цена ориентировочная: точную смету инженер подготовит после замера или по чертежам дома.</p>
      <div class="tk-res__act"><a class="tk-btn" href="#turnkey-form">Получить проект остекления <span aria-hidden="true">↓</span></a><button type="button" class="tk-link" data-tk-copy>Скопировать ссылку на проект</button></div>`;
    const form = document.querySelector('#turnkey-form lead-form');
    if (form && form.setProject) form.setProject(summary(E));
    if (!opts.keepHash) save();
    render3d();
  }

  function summary(E) {
    const { W, D } = dims();
    const rows = FACADES.map(F => Array.from({ length: st.floors }, (_, i) => {
      const c = cell(F.k, i), parts = TYPES.filter(t => c[t]).map(t => `${C.types[t].t} × ${c[t]}`);
      return parts.length ? `  ${F.t}, ${i + 1}-й этаж: ${parts.join(', ')}` : '';
    }).filter(Boolean).join('\n')).filter(Boolean).join('\n');
    return [
      'ОСТЕКЛЕНИЕ ПОД КЛЮЧ — конфигурация из конструктора',
      `Дом: ${st.floors} эт., ${st.area} м², пятно ≈ ${m1(W)} × ${m1(D)} м, кровля ${st.roof === 'gable' ? 'двускатная' : 'плоская'}`,
      `Сценарий: ${SCEN.find(s => s.k === st.scenario).t}`, 'Проёмы:', rows || '  нет',
      st.ext !== 'none' ? `Пристройка: ${E.ext.t}${st.ext === 'veranda' ? `, стены — ${EXT_WALLS.find(w => w.k === st.extWall).t}` : ''}` : 'Пристройка: нет',
      `Площадь стекла: ${fmt(E.area)} м²`, `Ориентировочно: ≈ ${fmt(E.total)} ₽ (с доставкой и монтажом)`,
      `Ссылка: ${location.href}`,
    ].join('\n');
  }

  // ---------- события ----------
  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled || !root.contains(b)) return;
    const d = b.dataset;
    if (d.tkView) { setView(d.tkView); return; }
    if ('tkEvening' in d) { st.evening = !st.evening; b.setAttribute('aria-pressed', String(st.evening)); b.textContent = st.evening ? 'День' : 'Вечер'; root.classList.toggle('is-evening', st.evening); render3d(); return; }
    if ('tkCopy' in d) {
      const done = () => { b.textContent = 'Ссылка скопирована'; setTimeout(() => { b.textContent = 'Скопировать ссылку на проект'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, done); else done();
      return;
    }
    if (d.floors) { st.floors = +d.floors; preset(); }
    else if (d.roof) st.roof = d.roof;
    else if (d.scenario) { st.scenario = d.scenario; preset(); }
    else if (d.facade) { st.facade = d.facade; }
    else if (d.floor) st.floor = +d.floor;
    else if (d.inc) { const c = cell(st.facade, st.floor); c[d.inc] = (c[d.inc] || 0) + 1; clamp(st.facade, c); }
    else if (d.dec) { const c = cell(st.facade, st.floor); c[d.dec] = Math.max(0, (c[d.dec] || 0) - 1); }
    else if ('tkClear' in d) st.open[st.facade][st.floor] = { pano: 0, hs: 0, fs: 0 };
    else if ('tkReset' in d) preset();
    else if (d.ext) st.ext = d.ext;
    else if (d.extwall) st.extWall = d.extwall;
    else if (d.extdepth) st.extDepth = +d.extdepth;
    else return;
    update();
  });
  // площадь: пока тянут — только подписи и макет; при отпускании — проёмы по сценарию заново (ширины фасадов изменились)
  const area = $('[data-tk-area]');
  area.addEventListener('input', () => { st.area = +area.value; FACADES.forEach(({ k }) => { for (let i = 0; i < st.floors; i++) clamp(k, cell(k, i)); }); update(); });
  area.addEventListener('change', () => { preset(); update(); });

  customElements.whenDefined('lead-form').then(() => requestAnimationFrame(() => update({ keepHash: true })));
  if (!load()) preset();
  area.value = st.area;
  update({ keepHash: true });
})();
