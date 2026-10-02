/* Правила онлайн-калькулятора порталов — по ТЗ владельца («ТЕХНИЧЕСКОЕ ЗАДАНИЕ: ОНЛАЙН-КАЛЬКУЛЯТОР ПОРТАЛЬНЫХ СИСТЕМ»).
   Один источник для сайта и генератора: калькулятор /raschet/ (quick-calc.js), блок «Цена по размерам проёма» (opening-draw.js)
   и tools/build.mjs (цены и проходы готовых дверей каталога считает этим же файлом — через node:vm).
   window.PSPortal: limits, validate, sectionsFor, schemesFor, passage, layout, glassFor, price, frameDepth. Без DOM. */
(function (root) {
  const BASE = { HS: 35000, FS: 55000 };                     // ₽ за м²: базовое стекло и стандартные размеры
  const LIMITS = {                                           // ТЗ 1.2
    HS: { wMin: 1500, wMax: 19800, hMin: 1800, hMax: 3700 },
    FS: { wMin: 1500, wMax: 12000, hMin: 1800, hMax: 2800 },
  };
  const LOCK_PRICE = 18000;                                  // Control-Lock (ТЗ 3.3)
  const TRIPLEX_LEAF = 5000000;                              // мм²: створка больше 5 м² → триплекс обязательно (ТЗ 3.1)
  const fmt = n => new Intl.NumberFormat('ru-RU').format(n);

  // 1.2. Ошибки (расчёт невозможен) и предупреждения (плашки)
  function validate(type, w, h) {
    const L = LIMITS[type], errors = [], warnings = [];
    if (type === 'HS') {
      if (!(h >= L.hMin && h <= L.hMax)) errors.push('Высота портала должна быть от 1800 до 3700 мм');
      if (!(w >= L.wMin && w <= L.wMax)) errors.push('Ширина портала должна быть от 1500 до 19800 мм');
      if (!errors.length && (w / 2) * h > 8500000) warnings.push('Внимание: Крупноформатные створки. Потребуется спецтехника для монтажа и стеклопакеты толщиной от 8 мм');
    } else {
      if (!(h >= L.hMin && h <= L.hMax)) errors.push('Высота складной системы должна быть от 1800 до 2800 мм');
      if (w > L.wMax) errors.push('Предельная длина складной системы превышена. Рекомендуется использовать подъемно-сдвижную систему');
      else if (!(w >= L.wMin)) errors.push('Ширина складной системы должна быть от 1500 до 12000 мм');
      if (h > 2400 && h <= 2800) warnings.push('Внимание: Высота более 2.4 м требует установки дополнительных элементов жесткости');
    }
    return { errors, warnings, ok: !errors.length };
  }

  // 1.3. Доступное число секций и «Рекомендуем»
  function sectionsFor(type, w) {
    if (type === 'HS') {
      if (w < 4000) return { list: [2], rec: 2 };
      if (w < 6000) return { list: [2, 3], rec: 3 };
      if (w < 8000) return { list: [3, 4], rec: 4 };
      if (w <= 12000) return { list: [4, 6], rec: 6 };
      return { list: [6], rec: 6 };
    }
    if (w < 2500) return { list: [2, 3], rec: 3 };
    if (w < 4000) return { list: [3, 4], rec: 4 };
    if (w < 6000) return { list: [5, 6], rec: 6 };
    if (w < 7500) return { list: [6, 7], rec: 7 };
    return { list: [7, 8], rec: 8 };
  }

  // 2. Схемы открывания. cascade — трёхполозная рама 246 мм и коэффициент 1,4 (ТЗ 4.2.3)
  const HS_SCHEMES = {
    2: [
      { code: 'A-L', t: 'Слева', d: 'Активная створка слева, уезжает вправо за глухую' },
      { code: 'A-R', t: 'Справа', d: 'Активная створка справа, уезжает влево за глухую' },
    ],
    3: [
      { code: 'D-L', t: 'Налево', d: 'Две правые створки уезжают влево каскадом', cascade: true },
      { code: 'D-R', t: 'Направо', d: 'Две левые створки уезжают вправо каскадом', cascade: true },
      { code: 'G', t: 'Центр', d: 'Боковые створки глухие, двигается только центральная' },
    ],
    4: [{ code: 'F-Center', t: 'Из центра', d: 'Крайние створки глухие, две центральные раздвигаются из центра в разные стороны' }],
    6: [{ code: 'C-Double', t: 'Из центра каскадом', d: 'Крайние створки глухие, по две центральные разъезжаются каскадом влево и вправо', cascade: true }],
  };
  function schemesFor(type, n) {
    if (type === 'HS') return HS_SCHEMES[n] || [];
    const list = [
      { code: 'FS-L', t: 'Влево', d: 'Весь пакет створок складывается влево' },
      { code: 'FS-R', t: 'Вправо', d: 'Весь пакет створок складывается вправо' },
    ];
    if (n % 2 === 0) list.push({ code: 'FS-2', t: 'В две стороны', d: `Створки делятся поровну (${n / 2} влево + ${n / 2} вправо) и расходятся к краям` });
    return list;
  }
  const schemeOf = (type, n, code) => schemesFor(type, n).find(s => s.code === code) || schemesFor(type, n)[0];
  const doorAllowed = (type, n) => type === 'FS' && n % 2 === 1;     // «Активная рабочая дверь» — только 3, 5, 7 секций

  // 1.3. Чистый проход, мм (для схемы G — своя формула)
  function passage(type, w, n, code) {
    let p;
    if (type === 'FS') p = w - n * 95 - 120;
    else if (code === 'G') p = w / 3 - 120;
    else if (n === 2) p = w / 2 - 150;
    else if (n === 3) p = (w / 3) * 2 - 200;
    else if (n === 4) p = w / 2 - 250;
    else p = (w / 6) * 4 - 300;
    return Math.max(0, Math.round(p));
  }
  const frameDepth = (type, n, code) => (type === 'FS' ? 70 : (schemeOf(type, n, code) || {}).cascade ? 246 : 158);

  // Раскладка створок для чертежа: kind fix | move | fold | door, dir −1 влево / 1 вправо, handle — сторона ручки
  function layout(type, n, code, door) {
    const L = [];
    if (type === 'HS') {
      const F = { kind: 'fix' }, M = (dir, handle) => ({ kind: 'move', dir, handle });
      if (code === 'A-L') L.push(M(1, 'l'), F);
      else if (code === 'A-R') L.push(F, M(-1, 'r'));
      else if (code === 'D-L') L.push(F, M(-1), M(-1, 'r'));
      else if (code === 'D-R') L.push(M(1, 'l'), M(1), F);
      else if (code === 'G') L.push(F, M(1, 'l'), { kind: 'fix' });
      else if (code === 'F-Center') L.push(F, M(-1, 'r'), M(1, 'l'), { kind: 'fix' });
      else L.push(F, M(-1), M(-1, 'r'), M(1, 'l'), M(1), { kind: 'fix' });
      return L;
    }
    for (let i = 0; i < n; i++) {
      const dir = code === 'FS-L' ? -1 : code === 'FS-R' ? 1 : i < n / 2 ? -1 : 1;
      L.push({ kind: 'fold', dir });
    }
    // рабочая дверь — крайняя створка со стороны, куда складывается пакет
    if (door && doorAllowed(type, n)) { const i = code === 'FS-R' ? n - 1 : 0; L[i] = { kind: 'door', dir: L[i].dir, handle: i ? 'l' : 'r' }; }
    return L;
  }

  // 3.1. Стекло: триплекс включается сам и не снимается, если любая створка больше 5 м²
  const GLASS = [
    { k: 'base', code: 'SP-Base', t: 'Базовый', d: 'Базовая комплектация для стандартного проёма', f: 1 },
    { k: 'standard', code: 'SP-Standart', t: 'Стандарт', d: 'Двухкамерный энергосберегающий закалённый 40 мм · +5 %', f: 1.05 },
    { k: 'triplex', code: 'SP-Triplex', t: 'Триплекс', d: 'Ударопрочный закалённый триплекс · +10 %', f: 1.10 },
    { k: 'solar', code: 'SP-Solar', t: 'Solar', d: 'Мультифункциональный солнцезащитный закалённый стеклопакет · +10 %', f: 1.10 },
  ];
  const triplexForced = (w, h, n) => (w / n) * h > TRIPLEX_LEAF;
  const glassFor = (w, h, n, k) => (triplexForced(w, h, n) ? 'triplex' : k || 'base');
  const days = (type, glass, customWidth = false, customHeight = false) => (type === 'FS' ? 40 : 30) + ({ base: 0, standard: 5, triplex: 10, solar: 10 }[glass] || 0) + (customWidth ? 5 : 0) + (customHeight ? 10 : 0);
  const rate = (type, glass, customHeight = false) => Math.round(BASE[type] * ((GLASS.find(g => g.k === glass) || GLASS[0]).f || 1) * (customHeight ? 1.02 : 1));
  const COLORS = [
    { k: 'mono', code: 'Color-Mono', t: 'Однотонный RAL', d: 'Любой цвет RAL: антрацит, белый, чёрный и нестандартные оттенки', f: 1 },
    { k: 'bi', code: 'Color-Bi', t: 'Двухсторонний', d: 'Разный цвет снаружи и внутри · без доплаты', f: 1 },
  ];
  const HANDLES = [
    { k: 'standard', code: 'Control-Standard', t: 'Стандарт', d: 'Ручка изнутри + скрытая ручка-ракушка снаружи', add: 0 },
    { k: 'lock', code: 'Control-Lock', t: 'С замком', d: 'Двухсторонняя нажимная ручка с замком на ключ · +18 000 ₽', add: LOCK_PRICE },
  ];

  // 4.2. Цена: S × базу системы → стекло +0/5/10 % → нестандартная высота +2 % → для HS каскад ×1,4.
  // Нестандартная ширина меняет срок, но не цену. Затем +18 000 ₽ за замок.
  function price(o) {
    const type = o.type || 'HS', w = o.w, h = o.h, n = o.n;
    if (!validate(type, w, h).ok || !sectionsFor(type, w).list.concat(o.extraSections || []).includes(n)) return null;
    const glass = GLASS.find(g => g.k === glassFor(w, h, n, o.glass)) || GLASS.find(g => g.k === 'standard');
    let cost = (w / 1000) * (h / 1000) * BASE[type] * glass.f * (o.customHeight ? 1.02 : 1);
    const s = schemeOf(type, n, o.scheme);
    if (type === 'HS' && s && (s.cascade)) cost *= 1.4;
    if (o.handle === 'lock') cost += LOCK_PRICE;
    return Math.round(cost);
  }

  root.PSPortal = {
    BASE, LIMITS, LOCK_PRICE, TRIPLEX_LEAF, GLASS, COLORS, HANDLES, fmt,
    validate, sectionsFor, schemesFor, schemeOf, doorAllowed, passage, frameDepth, layout, triplexForced, glassFor, days, rate, price,
  };
})(typeof window !== 'undefined' ? window : globalThis);
