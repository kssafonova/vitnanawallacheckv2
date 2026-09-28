/* «Остекление под ключ» (/osteklenie-pod-klyuch/, [data-turnkey]) — пошаговый конструктор, который ведёт к заявке.
   Клиент отвечает на 3 простых вопроса, инженерия — под капотом:
   1 «Какой у вас дом»: этажи, размер плиткой S / M / L (или свои размеры, высоты этажей, материал стен), кровля → 3D-макет.
   2 «Что хотите остеклить»: задачи (выход на террасу HS, витраж гостиной от угла до угла, складной выход FS, окна в пол наверху,
     остальные окна, зимний сад / веранда) — каждая ставит реальные изделия по инженерным правилам.
   3 «На какой стадии дом»: проект / строится / коробка готова / жилой — меняет кнопку и следующий шаг (расчёт по проекту или замер).
   4 Результат: вилка цены под ключ, м² стекла, состав проекта понятным языком, что входит, срок, «что дальше» и форма здесь же.
     «Настроить каждый проём» (свёрнуто) — детальный редактор: фасад × этаж, изделия и их параметры, пристройка.
   На телефоне снизу — плашка с вилкой и кнопкой «Смета».
   Инженерные правила: проём «в пол до потолка» = высота этажа − перекрытие с полом (floor_build); простенки и отступ от угла —
   по материалу стен; витраж — сетка секций (модуль ~1,4 м, секция 0,6–2,5 м), выше glass_max_h — ригель с фрамугой;
   открывающаяся секция не больше open_max_w × open_max_h; витраж + HS + витраж — единая система без простенков;
   HS / FS — секции, схемы, лимиты и цена по ТЗ (portal-calc.js). Цены витражей, окон, пристроек — data/turnkey.json (заглушки).
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
  // Размер дома плиткой: пятно дома (длина × ширина); площадь зависит от этажей
  const SIZES = [{ k: 's', L: 10000, B: 8000, t: 'Компактный' }, { k: 'm', L: 12000, B: 9000, t: 'Средний' }, { k: 'l', L: 15000, B: 11000, t: 'Большой' }];
  // Задачи клиента — каждая ставит реальные изделия (preset)
  const NEEDS = [
    { k: 'terrace', t: 'Выход на террасу', d: 'Раздвижной HS-портал из гостиной во двор' },
    { k: 'living', t: 'Гостиная: стеклянная стена', d: 'Витраж от угла до угла, от пола до потолка' },
    { k: 'fold', t: 'Складной выход в сад', d: 'FS-гармошка открывает проём почти целиком' },
    { k: 'upper', t: 'Окна в пол на втором этаже', d: 'Панорамные окна в спальнях и холле', minFloors: 2 },
    { k: 'windows', t: 'Остальные окна', d: 'Алюминиевые окна с подоконником на фасаде и торцах' },
    { k: 'garden', t: 'Зимний сад', d: 'Стеклянная пристройка со стеклянной кровлей', ext: true },
    { k: 'veranda', t: 'Остеклённая веранда', d: 'Стены из HS-порталов, непрозрачная кровля', ext: true },
  ];
  const STAGES = [
    { k: 'project', t: 'Есть проект', d: 'Дом ещё не строится', cta: 'Получить расчёт по проекту', next: 'Приложите проект или планировки — инженер посчитает по чертежам и предложит решения по проёмам.' },
    { k: 'building', t: 'Дом строится', d: 'Проёмы ещё можно поменять', cta: 'Согласовать проёмы с инженером', next: 'Инженер подскажет размеры проёмов под выбранные системы, пока их ещё можно поменять.' },
    { k: 'box', t: 'Коробка готова', d: 'Проёмы уже есть', cta: 'Вызвать замерщика — бесплатно', next: 'Замерщик приедет, снимет точные размеры и согласует узлы примыкания.' },
    { k: 'living', t: 'Дом жилой', d: 'Меняю или добавляю остекление', cta: 'Вызвать замерщика — бесплатно', next: 'Замерщик приедет, снимет размеры и оценит демонтаж старых окон.' },
  ];
  const ROOFS = [{ k: 'gable', t: 'Двускатная' }, { k: 'shed', t: 'Односкатная' }, { k: 'flat', t: 'Плоская' }];
  const EXT_WALLS = [{ k: 'hs', t: 'HS-порталы' }, { k: 'fs', t: 'FS-гармошки' }, { k: 'pano', t: 'Витражи' }];
  const H = C.house, T = { pano: C.pano, win: C.win, hs: C.hs, fs: C.fs };
  const WALLS = Object.entries(C.walls).map(([k, v]) => ({ k, t: v.t, d: v.d }));

  let uid = 1;
  const st = {
    L: SIZES[1].L, B: SIZES[1].B, fh: Array(H.floors.def).fill(H.floor_h.def), roof: 'gable', size: 'm',
    needs: new Set(['terrace', 'living', 'upper', 'windows']), stage: '', step: 1,
    facade: 'back', floor: 0, sel: null, items: [], wall: 'masonry',
    ext: 'none', extW: 0, extD: C.ext.d.def, extH: C.ext.h.def, extWall: 'hs', evening: false,
  };
  const floors = () => st.fh.length;
  const faceLen = f => (f === 'front' || f === 'back' ? st.L : st.B);
  const floorBase = i => st.fh.slice(0, i).reduce((a, b) => a + b, 0);
  const totalH = () => floorBase(floors());
  const at = (f, i) => st.items.filter(it => it.f === f && it.fl === i);
  const WL = () => C.walls[st.wall];
  const usable = f => faceLen(f) - 2 * WL().corner;
  // ширина по фасаду: изделия + простенки между ними (у состыкованных — без простенка, единая система)
  const usedW = list => list.reduce((a, it, j) => a + it.w + (j && !it.join ? WL().pier : 0), 0);
  const clearH = i => st.fh[i] - C.floor_build;                 // «в пол до потолка» на этом этаже
  const maxH = (i, sill = 0) => clearH(i) - sill;

  // ---------- изделия ----------
  const isPortal = it => it.type === 'hs' || it.type === 'fs';
  const pType = it => (it.type === 'hs' ? 'HS' : 'FS');
  const recN = it => P.sectionsFor(pType(it), it.w);
  // Секции витража: ширина секции в пределах sec_min…sec_max; фрамуга (ригель) — если стекло выше glass_max_h
  const secW = it => it.w / Math.max(1, it.n);
  const transom = it => (it.type === 'pano' && it.h > C.pano.glass_max_h ? Math.min(2600, it.h - 500) : 0);
  // Глухая фрамуга над HS / FS до потолка (портал ниже проёма этажа — стекло над ним в той же системе)
  const fanH = it => (isPortal(it) && it.fan ? Math.max(0, clearH(it.fl) - it.h) : 0);
  // Открывающаяся секция: не шире open_max_w и не выше open_max_h (по высоте створки — до ригеля, если он есть)
  const canOpen = it => {
    const L = it.type === 'win' ? { open_max_w: C.pano.open_max_w, open_max_h: C.pano.open_max_h } : C.pano;
    return secW(it) <= L.open_max_w && (transom(it) || it.h) <= L.open_max_h;
  };
  function normalize(it) {
    if (isPortal(it)) {
      const S = recN(it);
      if (!S.list.includes(it.n)) it.n = S.rec;
      if (!P.schemesFor(pType(it), it.n).some(s => s.code === it.scheme)) it.scheme = P.schemesFor(pType(it), it.n)[0].code;
      if (!P.doorAllowed(pType(it), it.n)) it.door = false;
    } else {
      const lo = Math.max(1, Math.ceil(it.w / C.pano.sec_max)), hi = Math.max(lo, Math.floor(it.w / C.pano.sec_min));
      if (!it.n) it.n = Math.round(it.w / C.pano.module);
      it.n = Math.min(Math.max(it.n, lo), hi, it.type === 'win' ? 3 : 20);
      it.open = canOpen(it) ? Math.min(it.open || 0, it.n) : 0;
      if (it.type === 'pano') it.sill = 0;
    }
    return it;
  }
  const secRange = it => { const lo = Math.max(1, Math.ceil(it.w / C.pano.sec_max)); return [lo, Math.min(Math.max(lo, Math.floor(it.w / C.pano.sec_min)), it.type === 'win' ? 3 : 20)]; };
  function make(type, f, i, o = {}) {
    const base = { id: uid++, type, f, fl: i, n: 0, scheme: '', door: false, sill: 0, open: 0, join: false };
    let it;
    if (type === 'pano') it = { ...base, w: 2800, h: clearH(i), ...o, sill: 0 };
    else if (type === 'win') it = { ...base, w: C.win.w, h: C.win.h, sill: C.win.sill, n: 1, open: 1, ...o };
    else it = { ...base, w: 3600, h: Math.min(clearH(i), 2800), ...o };
    if (type === 'pano' && !o.h) it.h = clearH(i);
    it.h = Math.min(it.h, maxH(i, it.sill));
    return normalize(it);
  }
  function itemPrice(it) {
    if (it.type === 'pano' || it.type === 'win') { const R = C[it.type]; return it.w * it.h / 1e6 * R.rate_fix + (it.open || 0) * R.sash_add; }
    const p = P.price({ type: pType(it), w: it.w, h: it.h, n: it.n, scheme: it.scheme, door: it.door, glass: 'standard', color: 'mono', handle: 'standard' });
    return p && p + it.w * fanH(it) / 1e6 * C.pano.rate_fix;
  }
  function itemIssues(it) {
    const out = [];
    if (isPortal(it)) out.push(...P.validate(pType(it), it.w, it.h).errors);
    else {
      const R = C[it.type];
      if (it.w < R.min_w || it.w > R.max_w) out.push(`Ширина — от ${fmt(R.min_w)} до ${fmt(R.max_w)} мм`);
      if (it.h < (R.min_h || 600)) out.push(`Высота — от ${fmt(R.min_h || 600)} мм`);
    }
    if (it.h + (it.sill || 0) > clearH(it.fl)) out.push(`Выше проёма этажа: в пол до потолка здесь ${fmt(clearH(it.fl))} мм (этаж ${fmt(st.fh[it.fl])} мм − перекрытие ${C.floor_build} мм)`);
    return out;
  }
  const itemName = it => (it.type === 'pano' ? 'Панорамный витраж' : it.type === 'win' ? 'Окно' : T[it.type].t);
  const itemSpec = it => {
    const size = `${mm2(it.w)} × ${mm2(it.h)} м`;
    if (it.type === 'pano' || it.type === 'win') return `${size} · ${it.n} ${plural(it.n, 'секция', 'секции', 'секций')}${it.open ? `, ${it.open} ${plural(it.open, 'открывается', 'открываются', 'открываются')}` : ', глухой'}${it.type === 'win' ? ` · подоконник ${fmt(it.sill)} мм` : it.h >= clearH(it.fl) ? ' · в пол до потолка' : ' · в пол'}${transom(it) ? ' · с фрамугой' : ''}${it.join ? ' · без простенка' : ''}`;
    return `${size} · ${it.n} ${plural(it.n, 'секция', 'секции', 'секций')} · ${it.scheme}${it.door ? ' + дверь' : ''}${fanH(it) ? ` · фрамуга ${fmt(fanH(it))} мм` : ''}${it.join ? ' · без простенка' : ''}`;
  };

  // ---------- сценарии: стартовая расстановка реальных изделий ----------
  // Витраж «от угла до угла» с HS по центру — единая система: витраж + HS + витраж, стыки без простенков
  function glassWall(f, i, portal) {
    const len = usable(f), h = clearH(i);
    if (!portal || len < 5000) { st.items.push(make('pano', f, i, { w: Math.floor(len / 100) * 100, h })); return; }
    const pw = Math.min(portal === 'hs' ? 6000 : 5000, Math.floor(len * 0.5 / 100) * 100), side = Math.floor((len - pw) / 2 / 100) * 100;
    const L = make('pano', f, i, { w: side, h }), Rr = make('pano', f, i, { w: len - pw - side, h, join: true });
    // портал по высоте — до ригеля витража (если стекло высокое) или до потолка; над ним — глухая фрамуга
    const ph = transom(L) || Math.min(h, portal === 'hs' ? 3200 : 2800);
    const M = make(portal, f, i, { w: pw, h: ph, fan: ph < h, join: true, scheme: portal === 'fs' ? 'FS-2' : '' });
    st.items.push(L, normalize(M), Rr);
  }
  // Ряд одинаковых изделий по осям: столько, сколько помещается с простенками, но не больше share ширины фасада
  function row(f, i, type, o, share, min = 0) {
    const len = usable(f), pier = WL().pier, w = o.w;
    const k = Math.max(min, Math.min(Math.floor((len + pier) / (w + pier)), Math.floor((len * share + pier) / (w + pier))));
    for (let j = 0; j < k; j++) st.items.push(make(type, f, i, { ...o }));
  }
  // Расстановка по задачам клиента: реальные изделия по инженерным правилам
  function preset() {
    st.items = []; st.sel = null;
    const N = st.needs, top = floors() - 1, fsInWall = N.has('fold') && N.has('living') && !N.has('terrace');
    // двор, 1-й этаж: витраж от угла до угла (с HS или FS по центру) или отдельный портал
    if (N.has('living')) glassWall('back', 0, N.has('terrace') ? 'hs' : fsInWall ? 'fs' : null);
    else if (N.has('terrace')) st.items.push(make('hs', 'back', 0, { w: Math.max(3000, Math.min(5400, Math.floor(usable('back') * 0.5 / 100) * 100)) }));
    // складной выход — в торце 1-го этажа (если не встроен в витраж гостиной)
    if (N.has('fold') && !fsInWall) {
      const fw = Math.min(5000, Math.floor(usable('right') / 100) * 100);
      if (fw >= 2000) st.items.push(make('fs', 'right', 0, { w: fw, scheme: 'FS-L' }));
    }
    // окна в пол наверху — по осям на фасаде и со двора
    if (N.has('upper')) for (let i = 1; i <= top; i++) { row('back', i, 'pano', { w: 1600 }, 0.5, 1); row('front', i, 'pano', { w: 1600 }, 0.35, 1); }
    // остальные окна — там, где пусто: окна с подоконником, в торцах — меньше
    if (N.has('windows')) FACADES.forEach(({ k: f }) => {
      for (let i = 0; i <= top; i++) {
        if (at(f, i).length) continue;
        const long = f === 'front' || f === 'back';
        row(f, i, 'win', { w: long ? 1200 : 900 }, long ? 0.4 : 0.25, long ? 1 : 0);
      }
    });
    st.ext = N.has('garden') ? 'garden' : N.has('veranda') ? 'veranda' : 'none';
    if (st.ext === 'veranda') st.extWall = 'hs';
  }

  // Раскладка на фасаде: изделия по порядку, по центру фасада, между ними простенки по материалу стен (у стыков — нет); x — центр, мм от центра фасада; y — низ проёма от земли
  function layout() {
    const out = [];
    FACADES.forEach(({ k: f }) => {
      for (let i = 0; i < floors(); i++) {
        const list = at(f, i);
        let x = -usedW(list) / 2;
        list.forEach((it, j) => {
          if (j && !it.join) x += WL().pier;
          out.push({ ...it, x: x + it.w / 2, y: floorBase(i) + (it.sill || 0), transom: transom(it), fanH: fanH(it), facade: f, floor: i, key: `o${it.id}` });
          x += it.w;
        });
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
    const c = { L: st.L, B: st.B, fh: st.fh, m: st.wall, r: st.roof, n: [...st.needs], z: st.size, g: st.stage, e: [st.ext, st.extW, st.extD, st.extH, st.extWall],
      i: st.items.map(it => [it.type, it.f[0], it.fl, it.w, it.h, it.n, it.scheme, it.door ? 1 : 0, it.sill, it.open, it.join ? 1 : 0, it.fan ? 1 : 0]) };
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
      st.wall = C.walls[c.m] ? c.m : 'masonry';
      st.roof = ROOFS.some(r => r.k === c.r) ? c.r : 'gable';
      st.needs = new Set((c.n || []).filter(k => NEEDS.some(x => x.k === k))); st.size = c.z || 'custom';
      st.stage = STAGES.some(x => x.k === c.g) ? c.g : ''; st.step = 4;
      [st.ext, st.extW, st.extD, st.extH, st.extWall] = c.e || ['none', 0, C.ext.d.def, C.ext.h.def, 'hs'];
      const TY = { pano: 'pano', win: 'win', hs: 'hs', fs: 'fs' }, FA = { f: 'front', b: 'back', l: 'left', r: 'right' };
      st.items = (c.i || []).filter(a => TY[a[0]] && FA[a[1]] && a[2] < floors()).map(a => normalize({ id: uid++, type: TY[a[0]], f: FA[a[1]], fl: a[2], w: a[3], h: a[4], n: a[5], scheme: a[6], door: !!a[7], sill: a[8] || 0, open: a[9] || 0, join: !!a[10], fan: !!a[11] }));
      return true;
    } catch (e) { return false; }
  };

  // ---------- разметка ----------
  const seg = (name, items, cur, cls = '') => `<div class="tk-seg${cls}" role="group">${items.map(x =>
    `<button type="button" data-${name}="${x.k}" aria-pressed="${String(x.k) === String(cur)}"${x.dis ? ' disabled' : ''}><b>${x.t}</b>${x.d ? `<small>${esc(x.d)}</small>` : ''}</button>`).join('')}</div>`;
  const field = (name, label, val, min, max, step = 10) => `<label class="tk-f"><span>${label}</span><input type="number" inputmode="numeric" min="${min}" max="${max}" step="${step}" value="${val}" data-${name}></label>`;
  const STEPS = ['Дом', 'Остекление', 'Стадия', 'Проект'];
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
  <div class="tk__flow">
    <ol class="tk-prog">${STEPS.map((t, i) => `<li><button type="button" data-go="${i + 1}"><i>${i + 1}</i>${t}</button></li>`).join('')}</ol>

    <section class="tk-q" data-step="1">
      <h2 class="tk-q__t">Какой у вас дом?</h2>
      <div class="tk-row"><span class="tk-lbl">Этажей</span><div data-tk-floors></div></div>
      <div class="tk-row"><span class="tk-lbl">Размер</span><div data-tk-sizes></div></div>
      <div class="tk-row"><span class="tk-lbl">Кровля</span>${seg('roof', ROOFS, st.roof, ' tk-seg--cols')}</div>
      <details class="tk-more" data-tk-more-house><summary>Указать точные размеры, высоту этажей и материал стен</summary>
        <div class="tk-more__in">
          <div class="tk-fields">${field('tk-len', 'Длина дома, мм', st.L, H.L.min, H.L.max, 100)}${field('tk-wid', 'Ширина дома, мм', st.B, H.B.min, H.B.max, 100)}</div>
          <div class="tk-row"><span class="tk-lbl">Высота этажей (от пола до пола), мм</span><div class="tk-fields tk-fields--fh" data-tk-fh></div></div>
          <div class="tk-row"><span class="tk-lbl">Стены</span>${seg('wall', WALLS, st.wall, ' tk-seg--stack')}</div>
        </div>
      </details>
      <p class="tk-note" data-tk-dims></p>
    </section>

    <section class="tk-q" data-step="2" hidden>
      <h2 class="tk-q__t">Что хотите остеклить?</h2>
      <p class="tk-q__sub">Можно выбрать несколько — проект соберётся по инженерным правилам: окна в пол до потолка, простенки, стекло под нагрузку.</p>
      <div data-tk-needs></div>
    </section>

    <section class="tk-q" data-step="3" hidden>
      <h2 class="tk-q__t">На какой стадии дом?</h2>
      <p class="tk-q__sub">От этого зависит следующий шаг: расчёт по проекту или бесплатный замер.</p>
      <div data-tk-stages></div>
    </section>

    <section class="tk-q tk-q--res" data-step="4" hidden>
      <div data-tk-res></div>
      <div class="tk-form" data-tk-form></div>
      <div data-tk-res2></div>
      <details class="tk-more tk-adv" data-tk-adv><summary>Настроить каждый проём</summary>
        <div class="tk-more__in">
          <div data-tk-facades></div>
          <div class="tk-row"><span class="tk-lbl">Этаж</span><div data-tk-floor-seg></div></div>
          <div class="tk-meter"><span data-tk-meter-t></span><i><b data-tk-meter></b></i></div>
          <ul class="tk-items" data-tk-items></ul>
          <div class="tk-add"><span class="tk-lbl">Добавить на этот этаж</span><div class="tk-seg tk-seg--cols4" role="group"><button type="button" data-add="pano"><b>+ Витраж в пол</b></button><button type="button" data-add="win"><b>+ Окно</b></button><button type="button" data-add="hs"><b>+ HS-портал</b></button><button type="button" data-add="fs"><b>+ FS-портал</b></button></div></div>
          <div class="tk-edit" data-tk-edit hidden></div>
          <div class="tk-row"><span class="tk-lbl">Пристройка со стороны двора</span>${seg('ext', ['none', 'veranda', 'garden'].map(k => ({ k, t: C.extensions[k].t, d: C.extensions[k].d })), st.ext, ' tk-seg--stack')}</div>
          <div data-tk-ext-opts></div>
          <div class="tk-links"><button type="button" data-tk-reset>Собрать заново по выбранным задачам</button></div>
        </div>
      </details>
    </section>

    <div class="tk-nav" data-tk-nav>
      <p class="tk-nav__sum" data-tk-live></p>
      <div class="tk-nav__btns"><button type="button" class="tk-back" data-back>Назад</button><button type="button" class="tk-btn" data-next>Далее <span aria-hidden="true">→</span></button></div>
    </div>
  </div>
  <div class="tk-sticky" data-tk-sticky hidden><span><small>Под ключ</small><b data-tk-sticky-p></b></span><button type="button" class="tk-btn" data-go="4">Смета <span aria-hidden="true">→</span></button></div>`;
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
      if (o.fanH) g += `<g class="tf-o tf-o--pano" data-pick="${o.id}"><rect x="${x0}" y="${Y(o.y + o.h + o.fanH)}" width="${w}" height="${o.fanH * k}"/></g>`;
      g += `<g class="tf-o tf-o--${o.type}${o.id === st.sel ? ' is-sel' : ''}${bad ? ' is-bad' : ''}" data-pick="${o.id}"><rect x="${x0}" y="${y0}" width="${w}" height="${h}"/>`;
      for (let j = 1; j < o.n; j++) g += `<line x1="${x0 + w * j / o.n}" y1="${y0}" x2="${x0 + w * j / o.n}" y2="${y0 + h}"/>`;
      if (o.transom) g += `<line x1="${x0}" y1="${Y(o.y + o.transom)}" x2="${x0 + w}" y2="${Y(o.y + o.transom)}"/>`;
      if (o.type === 'win') g += `<line class="tf-sill" x1="${x0 - 3}" y1="${y0 + h + 1.5}" x2="${x0 + w + 3}" y2="${y0 + h + 1.5}"/>`;
      if (o.type === 'pano' || o.type === 'win') for (let j = 0; j < (o.open || 0); j++) { const sx = x0 + w * j / o.n; g += `<path class="tf-fold" d="M${sx + w / o.n} ${y0}L${sx} ${y0 + h / 2}L${sx + w / o.n} ${y0 + h}"/>`; }
      if (isPortal(o)) P.layout(pType(o), o.n, o.scheme, o.door).forEach((lf, j) => {
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
  import(new URL('turnkey3d.js?v=3', SELF).href).then(m => {
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
    st.sel = id; st.facade = it.f; st.floor = it.fl; st.step = 4;
    const adv = $('[data-tk-adv]'); if (adv) adv.open = true;
    update();
    const ed = $('[data-tk-edit]');
    if (ed && innerWidth < 1100) ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- редактор выбранного изделия ----------
  function editor(it) {
    const issues = itemIssues(it), p = itemPrice(it), list = at(it.f, it.fl), idx = list.indexOf(it);
    const free = usable(it.f) - usedW(list);
    let body = `<div class="tk-fields">${field('e-w', 'Ширина, мм', it.w, 400, 20000)}${field('e-h', 'Высота, мм', it.h, 400, 4500)}${it.type === 'win' ? field('e-sill', 'Подоконник, мм', it.sill || 0, 300, 1500) : ''}</div>`;
    body += `<p class="tk-note">В пол до потолка на ${it.fl + 1}-м этаже — ${fmt(clearH(it.fl))} мм${it.type !== 'win' && it.h < clearH(it.fl) ? ` · <button type="button" class="tk-inline" data-e-full-h>до потолка</button>` : ''}${free > 0 || it.type !== 'win' ? ` · свободно по фасаду ${fmt(Math.max(0, free))} мм${free > 0 ? ` · <button type="button" class="tk-inline" data-e-fill>на всю стену</button>` : ''}` : ''}</p>`;
    if (isPortal(it)) {
      const S = recN(it), type = pType(it);
      body += `<div class="tk-row"><span class="tk-lbl">Секции</span>${seg('e-n', S.list.map(n => ({ k: n, t: `${n}${n === S.rec ? ' <em>Рекомендуем</em>' : ''}`, d: `проход ≈ ${fmt(P.passage(type, it.w, n, P.schemesFor(type, n)[0].code))} мм` })), it.n, ' tk-seg--cols')}</div>`;
      body += `<div class="tk-row"><span class="tk-lbl">Схема</span>${seg('e-scheme', P.schemesFor(type, it.n).map(s => ({ k: s.code, t: `${esc(s.t)} · ${s.code}`, d: s.d })), it.scheme, ' tk-seg--stack')}</div>`;
      if (P.doorAllowed(type, it.n)) body += `<div class="tk-seg tk-seg--multi" role="group"><button type="button" data-e-door aria-pressed="${it.door}"><b>${it.door ? '✓' : '+'} Активная рабочая дверь</b><small>крайняя створка открывается как распашная</small></button></div>`;
      if (it.h < clearH(it.fl)) body += `<div class="tk-seg tk-seg--multi" role="group"><button type="button" data-e-fan aria-pressed="${!!it.fan}"><b>${it.fan ? '✓' : '+'} Глухая фрамуга над порталом до потолка</b><small>${fmt(clearH(it.fl) - it.h)} мм стекла над ${type} в той же системе</small></button></div>`;
      body += `<p class="tk-note">Рама ${P.frameDepth(type, it.n, it.scheme)} мм · створка ${fmt(it.w / it.n)} × ${fmt(it.h)} мм · проход ≈ ${fmt(P.passage(type, it.w, it.n, it.scheme))} мм${P.triplexForced(it.w, it.h, it.n) ? ' · створка больше 5 м² — триплекс' : ''}</p>`;
    } else {
      const [lo, hi] = secRange(it), ok = canOpen(it);
      body += `<div class="tk-row"><span class="tk-lbl">Секций (шаг импостов)</span>${seg('e-n', Array.from({ length: hi - lo + 1 }, (_, j) => ({ k: lo + j, t: String(lo + j), d: `${fmt(it.w / (lo + j))} мм` })), it.n, ' tk-seg--cols')}</div>`;
      body += `<div class="tk-row"><span class="tk-lbl">Открывающихся секций</span>${seg('e-open', Array.from({ length: it.n + 1 }, (_, j) => ({ k: j, t: j ? String(j) : 'Все глухие', dis: j && !ok })), it.open || 0, ' tk-seg--cols')}</div>`;
      body += `<p class="tk-note">Секция ${fmt(secW(it))} × ${fmt(transom(it) || it.h)} мм${transom(it) ? ` + фрамуга ${fmt(it.h - transom(it))} мм (стекло выше ${fmt(C.pano.glass_max_h)} мм — нужен ригель)` : ''}. ${ok ? 'Открывающаяся — поворотно-откидная.' : `Открывающаяся створка — не больше ${fmt(C.pano.open_max_w)} × ${fmt(C.pano.open_max_h)} мм: увеличьте число секций или поставьте рядом HS-портал.`}</p>`;
    }
    if (idx > 0) body += `<div class="tk-seg tk-seg--multi" role="group"><button type="button" data-e-join aria-pressed="${!!it.join}"><b>${it.join ? '✓' : '+'} Стык с соседним без простенка</b><small>одна витражная система: стойка вместо стены между изделиями</small></button></div>`;
    return `<div class="tk-edit__head"><b>${itemName(it)}</b><span>${p ? `${fmt(p)} ₽` : '—'}</span></div>${body}
      ${issues.map(t => `<p class="tk-err">${esc(t)}</p>`).join('')}
      <div class="tk-edit__act"><button type="button" data-e-move="-1" aria-label="Сдвинуть влево">← Левее</button><button type="button" data-e-move="1" aria-label="Сдвинуть вправо">Правее →</button><button type="button" data-e-del>Удалить</button><button type="button" data-e-close>Готово</button></div>`;
  }

  // ---------- вилка цены: точные размеры, стекло и узлы уточняются на замере ----------
  const money = v => (v >= 1e6 ? `${(v / 1e6).toFixed(1).replace('.', ',')}` : `${Math.round(v / 1000)}`);
  const range = t => {
    if (!t) return '—';
    const lo = t * 0.92, hi = t * 1.12, big = hi >= 1e6;
    return `≈ ${money(lo)}–${money(hi)} ${big ? 'млн' : 'тыс.'} ₽`;
  };
  // Состав проекта понятным языком: группы изделий
  function composition(E) {
    const rows = [], by = (type, pred = () => true) => st.items.filter(it => it.type === type && pred(it));
    by('hs').forEach(it => rows.push([`Раздвижной HS-портал ${mm2(it.w)} м`, `${FACADES.find(f => f.k === it.f).t.toLowerCase()}, ${it.fl + 1}-й этаж · ${it.n} ${plural(it.n, 'створка', 'створки', 'створок')} · проход ≈ ${mm2(P.passage('HS', it.w, it.n, it.scheme))} м`]));
    by('fs').forEach(it => rows.push([`Складной FS-портал ${mm2(it.w)} м`, `${FACADES.find(f => f.k === it.f).t.toLowerCase()}, ${it.fl + 1}-й этаж · ${it.n} ${plural(it.n, 'створка', 'створки', 'створок')}`]));
    const wall = by('pano', it => it.join || at(it.f, it.fl).some(x => x.join));
    if (wall.length) rows.push([`Витраж гостиной от угла до угла`, `${mm2(wall.reduce((a, x) => a + x.w, 0) + st.items.filter(x => isPortal(x) && x.join).reduce((a, x) => a + x.w, 0))} м по фасаду · в пол до потолка ${mm2(clearH(0))} м`]);
    const pano = by('pano', it => !wall.includes(it));
    if (pano.length) rows.push([`Панорамные окна в пол × ${pano.length}`, `${[...new Set(pano.map(x => `${mm2(x.w)} × ${mm2(x.h)} м`))].join(', ')}`]);
    const win = by('win');
    if (win.length) rows.push([`Окна с подоконником × ${win.length}`, `${[...new Set(win.map(x => `${mm2(x.w)} × ${mm2(x.h)} м`))].join(', ')}`]);
    if (E.ext) rows.push([E.ext.t, st.ext === 'garden' ? 'стеклянная кровля, витражные стены' : 'стены из HS-порталов, кровля']);
    return rows;
  }

  // ---------- обновление ----------
  let formStage = null;
  function update(opts = {}) {
    const E = estimate(), stage = STAGES.find(x => x.k === st.stage);
    // шаг 1 — дом
    $('[data-tk-floors]').innerHTML = seg('floors', Array.from({ length: H.floors.max }, (_, j) => ({ k: j + 1, t: String(j + 1) })), floors(), ' tk-seg--cols');
    $('[data-tk-sizes]').innerHTML = seg('size', SIZES.map(z => ({ k: z.k, t: z.t, d: `${mm2(z.L)} × ${mm2(z.B)} м · ≈ ${fmt(z.L * z.B / 1e6 * floors())} м²` })), st.size, ' tk-seg--cols3 tk-seg--tiles');
    $('[data-tk-fh]').innerHTML = st.fh.map((h, i) => field('tk-fh', `${i + 1}-й`, h, H.floor_h.min, H.floor_h.max, 50).replace('data-tk-fh', `data-tk-fh="${i}"`)).join('');
    $('[data-tk-len]').value = st.L; $('[data-tk-wid]').value = st.B;
    $$('[data-roof]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.roof === st.roof)));
    $$('[data-wall]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wall === st.wall)));
    $('[data-tk-dims]').textContent = `${mm2(st.L)} × ${mm2(st.B)} м · ≈ ${fmt(st.L * st.B / 1e6 * floors())} м² · окна в пол до потолка ${st.fh.map(h => mm2(h - C.floor_build)).join(' / ')} м`;
    // шаг 2 — задачи
    $('[data-tk-needs]').innerHTML = `<div class="tk-seg tk-seg--need" role="group">${NEEDS.map(n => {
      const on = st.needs.has(n.k), dis = n.minFloors && floors() < n.minFloors;
      return `<button type="button" data-need="${n.k}" aria-pressed="${on && !dis}"${dis ? ' disabled' : ''}><i aria-hidden="true">${on && !dis ? '✓' : '+'}</i><b>${n.t}</b><small>${dis ? 'для домов от 2 этажей' : n.d}</small></button>`;
    }).join('')}</div>`;
    // шаг 3 — стадия
    $('[data-tk-stages]').innerHTML = seg('stage', STAGES.map(x => ({ k: x.k, t: x.t, d: x.d })), st.stage, ' tk-seg--cols2 tk-seg--tiles');
    // мастер: видимый шаг, прогресс, кнопки
    $$('[data-step]').forEach(sec => { sec.hidden = +sec.dataset.step !== st.step; });
    $$('.tk-prog button').forEach(b => { const n = +b.dataset.go; b.setAttribute('aria-current', n === st.step ? 'step' : 'false'); b.classList.toggle('is-done', n < st.step); });
    $('[data-back]').hidden = st.step === 1;
    $('[data-next]').hidden = st.step === 4;
    $('[data-next]').innerHTML = st.step === 3 ? 'Показать мой проект <span aria-hidden="true">→</span>' : 'Далее <span aria-hidden="true">→</span>';
    $('[data-tk-live]').innerHTML = st.step >= 2 && st.step < 4 && E.total ? `Сейчас: <b>${range(E.total)}</b> под ключ · стекла ${fmt(E.area)} м²` : '';
    $('[data-tk-sticky]').hidden = !(st.step >= 2 && st.step < 4 && E.total);
    $('[data-tk-sticky-p]').textContent = range(E.total);
    // шаг 4 — детальная настройка (свёрнута)
    if (st.floor >= floors()) st.floor = floors() - 1;
    $$('[data-ext]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ext === st.ext)));
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
    const ext = E.ext;
    $('[data-tk-ext-opts]').innerHTML = st.ext === 'none' ? '' : `
      ${st.ext === 'veranda' ? `<div class="tk-row"><span class="tk-lbl">Стены</span>${seg('extwall', EXT_WALLS, st.extWall, ' tk-seg--cols')}</div>` : ''}
      <div class="tk-fields">${field('tk-ext-w', 'Ширина, мм', extWidth(), 2000, st.L, 100)}${field('tk-ext-d', 'Глубина, мм', st.extD, C.ext.d.min, C.ext.d.max, 100)}${field('tk-ext-h', 'Высота, мм', st.extH, C.ext.h.min, C.ext.h.max, 50)}</div>
      <p class="tk-note">Стены: ${ext.mods.map((m, j) => `${['фронт', 'левая', 'правая'][j]} — ${m.length} × ${mm2(m[0])} м`).join(', ')}.${ext.bad ? ' Часть модулей вне лимитов системы — посчитаем по заявке.' : ''}</p>`;
    // вид и подпись
    const F = FACADES.find(x => x.k === st.facade);
    $('[data-tk-caption]').textContent = st.step === 4 ? `${F.t} (${F.d}) · ${st.floor + 1}-й этаж · нажмите на проём, чтобы изменить его` : 'Потяните макет, чтобы осмотреть дом со всех сторон';
    $('[data-tk-face]').innerHTML = faceSvg();
    // шаг 4 — результат
    const rows = composition(E);
    $('[data-tk-res]').innerHTML = `
      <p class="ui-eyebrow">Ваш проект остекления</p>
      <div class="tk-res__big"><strong>${range(E.total)}</strong><span>под ключ · стекла ${fmt(E.area)} м² · ${st.items.length} ${plural(st.items.length, 'изделие', 'изделия', 'изделий')}${E.ext ? ' + пристройка' : ''}</span></div>
      <p class="tk-note">Вилка — потому что точные размеры проёмов, стекло и узлы примыкания уточняются на замере или по чертежам. Включены доставка и монтаж.</p>
      <ul class="tk-comp">${rows.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('') || '<li><b>Ничего не выбрано</b><span>Вернитесь к шагу 2 и отметьте, что остеклить</span></li>'}</ul>
      ${E.overflow.length || E.bad ? `<p class="tk-err">${E.overflow.length ? `Не помещаются проёмы: ${E.overflow.join('; ')}. ` : ''}${E.bad ? 'Часть изделий требует проверки размеров — инженер предложит решение.' : ''}</p>` : ''}
`;
    $('[data-tk-res2]').innerHTML = `
      <div class="tk-res__inc"><small>Под ключ — это</small><ul>${C.included.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <ol class="tk-next">
        <li><b>Заявка</b><span>Инженер позвонит в рабочее время и уточнит детали</span></li>
        <li><b>${st.stage === 'project' ? 'Расчёт по проекту' : st.stage === 'building' ? 'Согласование проёмов' : 'Бесплатный замер'}</b><span>${esc(stage ? stage.next : 'Уточним размеры проёмов — по чертежам или на объекте.')}</span></li>
        <li><b>Смета и договор</b><span>Точная цена по вашему проекту, изготовление — ${esc(C.term)}, затем монтаж</span></li>
      </ol>
      <p class="tk-res__links"><button type="button" class="tk-link" data-tk-copy>Скопировать ссылку на проект</button><button type="button" class="tk-link" data-go="2">Изменить задачи</button></p>`;
    // форма — создаётся один раз под стадию (чтобы не терять введённое при пересчёте)
    const slot = $('[data-tk-form]');
    if (st.step === 4 && formStage !== st.stage) {
      formStage = st.stage;
      slot.innerHTML = `<h3 class="tk-form__t">${esc(stage ? stage.cta : 'Получить проект и точную смету')}</h3>
        <lead-form data-base="../" data-source="turnkey" data-cta="${esc(stage ? stage.cta : 'Получить проект и смету')}" data-context="остекление под ключ${stage ? `, стадия: ${stage.t.toLowerCase()}` : ''}"></lead-form>`;
    }
    const form = slot.querySelector('lead-form');
    if (form && form.setProject) form.setProject(summary(E));
    else if (form) customElements.whenDefined('lead-form').then(() => requestAnimationFrame(() => form.setProject && form.setProject(summary(E))));
    if (!opts.keepHash) save();
    render3d();
  }

  function summary(E) {
    const stage = STAGES.find(x => x.k === st.stage);
    const rows = FACADES.map(F => Array.from({ length: floors() }, (_, i) => at(F.k, i).map(it => `  ${F.t}, ${i + 1}-й этаж: ${itemName(it)} ${itemSpec(it)}${itemPrice(it) ? ` — ${fmt(itemPrice(it))} ₽` : ''}`).join('\n')).filter(Boolean).join('\n')).filter(Boolean).join('\n');
    return [
      'ОСТЕКЛЕНИЕ ПОД КЛЮЧ — заявка из конструктора',
      `Стадия: ${stage ? `${stage.t} (${stage.d})` : 'не указана'}`,
      `Дом: ${mm2(st.L)} × ${mm2(st.B)} м, этажей ${floors()} (высоты ${st.fh.join(' / ')} мм), стены — ${C.walls[st.wall].t.toLowerCase()}, кровля ${ROOFS.find(r => r.k === st.roof).t.toLowerCase()}`,
      `Задачи: ${NEEDS.filter(n => st.needs.has(n.k)).map(n => n.t).join(', ') || 'не выбраны'}`, 'Изделия:', rows || '  нет',
      E.ext ? `Пристройка: ${E.ext.t}, высота ${mm2(st.extH)} м — ${fmt(E.ext.sum)} ₽` : 'Пристройка: нет',
      `Площадь стекла: ${fmt(E.area)} м²`, `Ориентировочно под ключ: ${range(E.total)} (расчёт ${fmt(E.total)} ₽ с доставкой и монтажом)`,
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
    if (d.go) { st.step = +d.go; update(); root.querySelector('.tk__flow').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if ('next' in d) { st.step = Math.min(4, st.step + 1); update(); if (innerWidth < 1100) root.querySelector('.tk__flow').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if ('back' in d) { st.step = Math.max(1, st.step - 1); update(); return; }
    if (d.floors) {
      const n = +d.floors;
      st.fh = Array.from({ length: n }, (_, i) => st.fh[i] || H.floor_h.def);
      preset();
    } else if (d.size) { const z = SIZES.find(x => x.k === d.size); st.size = z.k; st.L = z.L; st.B = z.B; preset(); }
    else if (d.roof) st.roof = d.roof;
    else if (d.wall) { st.wall = d.wall; preset(); }
    else if (d.need) {
      const n = NEEDS.find(x => x.k === d.need);
      if (st.needs.has(n.k)) st.needs.delete(n.k);
      else { st.needs.add(n.k); if (n.ext) NEEDS.filter(x => x.ext && x.k !== n.k).forEach(x => st.needs.delete(x.k)); }
      preset();
    } else if (d.stage) st.stage = d.stage;
    else if (d.facade) { st.facade = d.facade; st.sel = null; }
    else if (d.floor) { st.floor = +d.floor; st.sel = null; }
    else if (d.add) { const n = make(d.add, st.facade, st.floor, d.add === 'fs' ? { w: 3600 } : {}); st.items.push(n); st.sel = n.id; }
    else if ('tkReset' in d) preset();
    else if (d.ext) st.ext = d.ext;
    else if (d.extwall) st.extWall = d.extwall;
    else if (it && d.eN) { it.n = +d.eN; normalize(it); }
    else if (it && d.eScheme) it.scheme = d.eScheme;
    else if (it && 'eDoor' in d) it.door = !it.door;
    else if (it && d.eOpen) it.open = +d.eOpen;
    else if (it && 'eJoin' in d) it.join = !it.join;
    else if (it && 'eFan' in d) it.fan = !it.fan;
    else if (it && 'eFullH' in d) { it.h = clearH(it.fl); normalize(it); }
    else if (it && 'eFill' in d) { it.w += Math.max(0, usable(it.f) - usedW(at(it.f, it.fl))); it.w = Math.floor(it.w / 10) * 10; it.n = 0; normalize(it); }
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
    if ('tkLen' in t.dataset) { st.L = cl(v, H.L); st.size = 'custom'; preset(); }
    else if ('tkWid' in t.dataset) { st.B = cl(v, H.B); st.size = 'custom'; preset(); }
    else if ('tkFh' in t.dataset) { st.fh[+t.dataset.tkFh] = cl(v, H.floor_h); preset(); }
    else if ('tkExtW' in t.dataset) st.extW = Math.min(st.L, Math.max(2000, v));
    else if ('tkExtD' in t.dataset) st.extD = cl(v, C.ext.d);
    else if ('tkExtH' in t.dataset) st.extH = cl(v, C.ext.h);
    else if (it && 'eW' in t.dataset) { it.w = Math.max(400, v); if (!isPortal(it)) it.n = 0; normalize(it); }
    else if (it && 'eH' in t.dataset) { it.h = Math.max(400, v); normalize(it); }
    else if (it && 'eSill' in t.dataset) { it.sill = Math.max(0, v); normalize(it); }
    else return;
    update();
  });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) e.target.blur(); });

  if (!load()) preset();
  update({ keepHash: true });
})();
