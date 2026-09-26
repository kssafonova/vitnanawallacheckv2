/* Блок «Как открывается дверь» (systems/hs/#schemes).
   Ширина × активная створка → схема на canvas (стена, рама, створки, улица за стеклом, размер прохода), ползунок открытия, свободный проход, ссылка на товар. */
(() => {
  const root = document.querySelector('[data-hsx-open]');
  if (!root) return;
  const SELF = (document.currentScript && document.currentScript.src) || location.href;

  const CAT = '../../catalog/hs-portaly/';
  const DATA = {
    hs30: {
      code: 'HS/30', width: 3000, height: 2300, def: 'right',
      variants: {
        left:  { label: 'Слева',  sections: 2, moving: [0], targets: [1], passage: 1500, ratio: .5,
                 dir: 'левая,<br> сдвигается вправо', use: 'выхода на террасу,<br> из гостиной', href: CAT + 'alumark-s158-3000x2300-belyi-aktivnaya-sleva/' },
        right: { label: 'Справа', sections: 2, moving: [1], targets: [0], passage: 1500, ratio: .5,
                 dir: 'правая,<br> сдвигается влево', use: 'выхода на террасу,<br> из гостиной', href: CAT + 'alumark-s158-3000x2300-belyi-aktivnaya-sprava/' }
      }
    },
    hs36: {
      code: 'HS/36', width: 3600, height: 2300, def: 'right',
      variants: {
        left:  { label: 'Слева',  sections: 3, moving: [0, 1], targets: [2, 2], passage: 2400, ratio: .667,
                 dir: 'две левые,<br> сдвигаются вправо', use: 'широкого выхода<br> на террасу', href: CAT + 'alumark-s158-3600x2300-antratsit-dve-aktivnye-odna-fiksirovannaya/' },
        right: { label: 'Справа', sections: 3, moving: [1, 2], targets: [0, 0], passage: 2400, ratio: .667,
                 dir: 'две правые,<br> сдвигаются влево', use: 'широкого выхода<br> на террасу', href: CAT + 'alumark-s158-3600x2300-antratsit-dve-aktivnye-odna-fiksirovannaya/' }
      }
    },
    hs48: {
      code: 'HS/48', width: 4800, height: 2300, def: 'center',
      variants: {
        center: { label: 'От центра', sections: 4, moving: [1, 2], targets: [0, 3], passage: 2400, ratio: .5,
                  dir: 'две центральные<br> расходятся', use: 'главного выхода,<br> большой террасы', href: CAT + 'alumark-s158-4800x2300-antratsit-otkryvanie-ot-centra/' }
      }
    }
  };

  const $ = s => root.querySelector(s);
  const widthGroup = $('[data-hsx-widths]');
  const sideGroup = $('[data-hsx-sides]');
  const range = $('[data-hsx-range]');
  const visual = $('[data-hsx-visual]');
  const canvas = $('[data-hsx-canvas]');
  const tabs = [...root.querySelectorAll('[data-hsx-view]')];
  const ctx = canvas.getContext('2d');
  const fmt = n => new Intl.NumberFormat('ru-RU').format(n);
  const lerp = (a, b, t) => a + (b - a) * t;

  let familyKey = 'hs30', variantKey = DATA.hs30.def, progress = 0, view = 'scheme', dragging = false;
  const family = () => DATA[familyKey];
  const variant = () => family().variants[variantKey];

  const icon = side => {
    if (side === 'center') return '<svg viewBox="0 0 42 34" aria-hidden="true"><rect x="1" y="1" width="40" height="32"/><path d="M21 1v32M18 17H8m0 0 4-4m-4 4 4 4M24 17h10m0 0-4-4m4 4-4 4"/></svg>';
    const flip = side === 'right' ? ' transform="translate(42 0) scale(-1 1)"' : '';
    return `<svg viewBox="0 0 42 34" aria-hidden="true"><g${flip}><rect x="1" y="1" width="40" height="32"/><path d="M21 1v32M8 17h10m0 0-4-4m4 4-4 4"/></g></svg>`;
  };

  function renderSides() {
    const keys = Object.keys(family().variants);
    sideGroup.classList.toggle('is-single', keys.length === 1);
    sideGroup.innerHTML = keys.map(k =>
      `<button type="button" class="hsx-side" data-variant="${k}" aria-pressed="${k === variantKey}">${icon(k)}<span>${family().variants[k].label}</span></button>`
    ).join('');
  }

  function update() {
    const f = family(), v = variant();
    $('[data-hsx-passage]').textContent = fmt(v.passage);
    $('[data-hsx-percent]').textContent = `${Math.round(v.ratio * 100)}% ширины проёма`;
    $('[data-hsx-size]').textContent = `${fmt(f.width)} × ${fmt(f.height)} мм`;
    $('[data-hsx-leaves]').textContent = v.sections;
    $('[data-hsx-dir]').innerHTML = v.dir;
    $('[data-hsx-use]').innerHTML = v.use;
    renderNext();
    range.value = progress;
    range.setAttribute('aria-valuetext', `${Math.round(progress)}% открыто`);
    draw();
    sync3d();
  }

  // «В интерьере» — 3D-сцена (hs-interior3d.js + three.js) грузится только при первом открытии вкладки.
  // Пока грузится или если WebGL недоступен — рисованный интерьер на canvas (drawInterior).
  let i3d = null, i3dState = 'idle';
  function sync3d() {
    if (i3d && view === 'interior') i3d.set({ width: family().width, height: family().height, variant: variant(), key: variantKey, progress: progress / 100 });
  }
  function load3d() {
    if (i3dState !== 'idle') return;
    i3dState = 'loading'; visual.classList.add('is-loading');
    import(new URL('hs-interior3d.js', SELF).href).then(m => {
      i3d = m.createInterior(visual, {
        viewSrc: new URL('../images/systems/hs-interior-view.webp', SELF).href,
        onReady() { i3dState = 'ready'; visual.classList.remove('is-loading'); visual.classList.add('has-3d'); sync3d(); }
      });
      if (!i3d) throw new Error('no webgl');
    }).catch(() => { i3dState = 'failed'; visual.classList.remove('is-loading'); });
  }

  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  // Цвета схемы: светлый нейтральный фон, профиль — почти чёрный, стекло — холодный полупрозрачный
  const INK = '#1b1b19', ACC = '#8f8266';
  function arrow(x1, y, x2) {
    ctx.strokeStyle = ACC; ctx.fillStyle = ACC; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    const d = x2 > x1 ? -1 : 1, s = 8;
    ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2 + d * s, y - s * .55); ctx.lineTo(x2 + d * s, y + s * .55); ctx.closePath(); ctx.fill();
  }

  // «Улица» за стеклом: небо, линия горизонта, кроны, настил террасы — бледно, чтобы не спорить со схемой
  function outside(x, y, w, h) {
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, '#dfe5e7'); sky.addColorStop(.58, '#eef0ef'); sky.addColorStop(.6, '#dcdcd8'); sky.addColorStop(1, '#d2d1cd');
    ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
    const hy = y + h * .6;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = 'rgba(120,130,120,.18)'; ctx.beginPath(); ctx.moveTo(x, hy);
    for (let i = 0; i <= 24; i++) ctx.lineTo(x + w * i / 24, hy - h * (.05 + .06 * Math.abs(Math.sin(i * 1.9)) + .03 * Math.abs(Math.sin(i * .7))));
    ctx.lineTo(x + w, hy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(27,27,25,.12)'; ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) { const yy = hy + (y + h - hy) * i / 5; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
    ctx.restore();
  }

  // Створка: рама-профиль, стекло, блик
  function leaf(x, y, w, h, prof, moving) {
    ctx.fillStyle = moving ? 'rgba(214,226,229,.42)' : 'rgba(214,226,229,.26)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = INK;
    ctx.fillRect(x, y, w, prof); ctx.fillRect(x, y + h - prof, w, prof);
    ctx.fillRect(x, y, prof, h); ctx.fillRect(x + w - prof, y, prof, h);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + w * .18, y + h * .2); ctx.lineTo(x + w * .36, y + h * .1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * .2, y + h * .27); ctx.lineTo(x + w * .3, y + h * .215); ctx.stroke();
  }

  function draw() {
    const W = canvas.getBoundingClientRect().width, H = canvas.getBoundingClientRect().height;
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    if (view === 'interior') { drawInterior(W, H); return; }

    const f = family(), v = variant(), p = progress / 100, n = v.sections, mobile = W < 650;
    const left = W * (mobile ? .07 : .09), right = left;
    const top = H * (mobile ? .08 : .08), bottom = H * (mobile ? .2 : .17);
    const fw = W - left - right, fh = H - top - bottom;
    const frame = Math.max(5, fw * .013), prof = Math.max(3, fw * .008);
    const ix = left + frame, iy = top + frame, iw = fw - frame * 2, ih = fh - frame * 2, leafW = iw / n;

    // стена и пол
    ctx.fillStyle = '#ecebe9'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e2e1de'; ctx.fillRect(0, top + fh, W, H - top - fh);
    ctx.strokeStyle = 'rgba(27,27,25,.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, top + fh + .5); ctx.lineTo(W, top + fh + .5); ctx.stroke();

    // проём: за стеклом улица, рама
    outside(ix, iy, iw, ih);
    ctx.fillStyle = INK;
    ctx.fillRect(left, top, fw, frame); ctx.fillRect(left, top + fh - frame, fw, frame);
    ctx.fillRect(left, top, frame, fh); ctx.fillRect(left + fw - frame, top, frame, fh);

    const fixed = [...Array(n).keys()].filter(i => !v.moving.includes(i));
    const pos = {}, spans = [];
    const place = (i, moving) => {
      const base = ix + i * leafW;
      let x = base;
      if (moving) {
        const mi = v.moving.indexOf(i), target = v.targets[mi];
        x = lerp(base, ix + target * leafW, p);
        spans.push([x, x + leafW]); // проход считаем без сдвига пакета — он только для наглядности
        if (v.moving.length > 1 && v.targets.every(t => t === target)) x += (mi - (v.moving.length - 1) / 2) * (mobile ? 4 : 7) * p;
      } else spans.push([x, x + leafW]);
      pos[i] = { x, w: leafW };
      leaf(x, iy, leafW, ih, prof, moving);
    };
    fixed.forEach(i => place(i, false));
    v.moving.forEach(i => place(i, true));

    // ручки: на ведущей створке, при открывании от центра — на обеих центральных
    const handles = variantKey === 'center' ? [1, 2] : [variantKey === 'left' ? Math.max(...v.moving) : Math.min(...v.moving)];
    handles.forEach((i, k) => {
      const q = pos[i]; if (!q) return;
      const lead = variantKey === 'center' ? (k === 0 ? 'r' : 'l') : (variantKey === 'left' ? 'r' : 'l');
      const hx = lead === 'r' ? q.x + q.w - prof - (mobile ? 6 : 10) : q.x + prof + (mobile ? 6 : 10);
      const hy = iy + ih * .52, len = mobile ? 14 : 22;
      ctx.strokeStyle = INK; ctx.lineWidth = mobile ? 2.4 : 3.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hy - len); ctx.lineTo(hx, hy + len); ctx.stroke(); ctx.lineCap = 'butt';
    });

    // направление движения — пока дверь не открыта полностью
    if (p < .97) {
      const ay = iy + ih * .38;
      if (variantKey === 'left') arrow(ix + iw * .3, ay, ix + iw * .46);
      if (variantKey === 'right') arrow(ix + iw * .7, ay, ix + iw * .54);
      if (variantKey === 'center') { arrow(ix + iw * .46, ay, ix + iw * .34); arrow(ix + iw * .54, ay, ix + iw * .66); }
    }

    // порог-направляющая
    ctx.fillStyle = '#9d9b96'; ctx.fillRect(left, top + fh, fw, Math.max(2, frame * .4));

    // размерная линия свободного прохода — по фактическому просвету между створками
    spans.sort((a, b) => a[0] - b[0]);
    let gap = [0, 0], cur = ix;
    spans.forEach(([a, b]) => { if (a - cur > gap[1] - gap[0]) gap = [cur, a]; cur = Math.max(cur, b); });
    if (ix + iw - cur > gap[1] - gap[0]) gap = [cur, ix + iw];
    const gw = gap[1] - gap[0];
    const dy = top + fh + (H - top - fh) * .42;
    if (gw > 14) {
      const mm = Math.round(gw / iw * f.width / 10) * 10;
      ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gap[0], dy); ctx.lineTo(gap[1], dy);
      [gap[0], gap[1]].forEach(x => { ctx.moveTo(x, dy - 6); ctx.lineTo(x, dy + 6); ctx.moveTo(x - 4, dy + 4); ctx.lineTo(x + 4, dy - 4); });
      ctx.stroke();
      const label = `проход ≈ ${fmt(mm)} мм`;
      ctx.font = `500 ${mobile ? 12 : 13}px Manrope, system-ui, sans-serif`;
      const tw = ctx.measureText(label).width, tx = Math.min(Math.max(gap[0] + gw / 2 - tw / 2, 4), W - tw - 4);
      const inside = tw + 36 < gw; // не помещается на линии — подпись под ней
      ctx.textBaseline = 'middle';
      if (inside) { ctx.fillStyle = '#e2e1de'; ctx.fillRect(tx - 6, dy - 9, tw + 12, 18); }
      ctx.fillStyle = INK; ctx.fillText(label, tx, inside ? dy + .5 : dy + (mobile ? 15 : 17));
    } else {
      ctx.font = `400 ${mobile ? 12 : 13}px Manrope, system-ui, sans-serif`;
      ctx.fillStyle = '#6f6c64'; ctx.textBaseline = 'middle';
      const label = 'Потяните схему или ползунок, чтобы открыть';
      const tw = ctx.measureText(label).width; ctx.fillText(label, left + (fw - tw) / 2, dy);
    }
  }

  // Позиции створок в проёме [ix, ix + iw] при открытии p: общая логика для схемы и интерьера
  function leaves(ix, iw, p, stackGap) {
    const v = variant(), n = v.sections, leafW = iw / n, out = [];
    [...Array(n).keys()].filter(i => !v.moving.includes(i)).forEach(i => out.push({ i, x: ix + i * leafW, w: leafW, moving: false }));
    v.moving.forEach(i => {
      const mi = v.moving.indexOf(i), target = v.targets[mi];
      let x = lerp(ix + i * leafW, ix + target * leafW, p);
      if (v.moving.length > 1 && v.targets.every(t => t === target)) x += (mi - (v.moving.length - 1) / 2) * stackGap * p;
      out.push({ i, x, w: leafW, moving: true });
    });
    return out;
  }

  // «В интерьере»: гостиная в перспективе, в задней стене — выбранный портал; ползунок открывает и здесь.
  // Солнце падает через стекло на пол; в открытом проёме пятно света ярче.
  function drawInterior(W, H) {
    const v = variant(), p = progress / 100, mobile = W < 650;
    const vpX = W * .5, vpY = H * .5;
    const bx0 = W * .12, bx1 = W * .88, by0 = H * .07, by1 = H * .76; // задняя стена
    const fl = (x, y) => vpX + (x - vpX) * ((y - vpY) / (by1 - vpY)); // x на полу на глубине y для точки x у задней стены

    // потолок, стены, пол
    ctx.fillStyle = '#f4f4f3'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e4e3e1';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bx0, by0); ctx.lineTo(bx0, by1); ctx.lineTo(0, H * 1.08); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#dcdbd8';
    ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(bx1, by0); ctx.lineTo(bx1, by1); ctx.lineTo(W, H * 1.08); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ecebe9'; ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    const floor = ctx.createLinearGradient(0, by1, 0, H);
    floor.addColorStop(0, '#c9c8c4'); floor.addColorStop(1, '#b3b1ad');
    ctx.fillStyle = floor;
    ctx.beginPath(); ctx.moveTo(bx0, by1); ctx.lineTo(bx1, by1); ctx.lineTo(W, H * 1.08); ctx.lineTo(0, H * 1.08); ctx.closePath(); ctx.fill();
    // доски пола сходятся к точке схода
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1;
    for (let k = 0; k <= 14; k++) { const x = bx0 + (bx1 - bx0) * k / 14; ctx.beginPath(); ctx.moveTo(x, by1); ctx.lineTo(fl(x, H), H); ctx.stroke(); }
    // светильники в потолке
    ctx.fillStyle = 'rgba(27,27,25,.18)';
    [.3, .5, .7].forEach(t => { const x = bx0 + (bx1 - bx0) * t; ctx.beginPath(); ctx.ellipse(x, by0 * .55, W * .012, 2, 0, 0, Math.PI * 2); ctx.fill(); });

    // проём портала в задней стене
    const ox0 = bx0 + (bx1 - bx0) * .05, ox1 = bx1 - (bx1 - bx0) * .05, oy0 = by0 + (by1 - by0) * .08, oy1 = by1;
    const fw = ox1 - ox0, fh = oy1 - oy0, frame = Math.max(4, fw * .012), prof = Math.max(2.5, fw * .007);
    const ix = ox0 + frame, iy = oy0 + frame, iw = fw - frame * 2, ih = fh - frame;

    // за стеклом: небо, лес, настил террасы
    const sky = ctx.createLinearGradient(0, iy, 0, iy + ih);
    sky.addColorStop(0, '#b9cdd8'); sky.addColorStop(.55, '#e7ecec'); sky.addColorStop(.56, '#aeb3ab'); sky.addColorStop(1, '#9fa39c');
    ctx.fillStyle = sky; ctx.fillRect(ix, iy, iw, ih);
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
    const hz = iy + ih * .56;
    [[.07, '#9aa79f', 1.1], [.12, '#7d8c84', 1.35], [.19, '#5f6f67', 1.6]].forEach(([hgt, col, sc], row) => {
      ctx.fillStyle = col;
      const step = iw / (mobile ? 14 : 22);
      for (let x = ix - step; x < ix + iw + step; x += step * (.7 + ((row * 7 + x) % 5) / 10)) {
        const th = ih * hgt * (.7 + Math.abs(Math.sin(x * .37 + row)) * .6), tw = step * .55 * sc;
        ctx.beginPath(); ctx.moveTo(x, hz - th); ctx.lineTo(x + tw / 2, hz); ctx.lineTo(x - tw / 2, hz); ctx.closePath(); ctx.fill();
      }
    });
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    for (let k = 1; k < 6; k++) { const y = hz + (iy + ih - hz) * k / 6; ctx.beginPath(); ctx.moveTo(ix, y); ctx.lineTo(ix + iw, y); ctx.stroke(); }
    ctx.restore();

    // створки
    const ls = leaves(ix, iw, p, mobile ? 3 : 5);
    const glassSpans = [];
    ls.forEach(l => {
      ctx.fillStyle = l.moving ? 'rgba(225,236,240,.22)' : 'rgba(225,236,240,.14)'; ctx.fillRect(l.x, iy, l.w, ih);
      ctx.fillStyle = '#1b1b19';
      ctx.fillRect(l.x, iy, l.w, prof); ctx.fillRect(l.x, iy + ih - prof, l.w, prof);
      ctx.fillRect(l.x, iy, prof, ih); ctx.fillRect(l.x + l.w - prof, iy, prof, ih);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(l.x + l.w * .2, iy + ih * .22); ctx.lineTo(l.x + l.w * .42, iy + ih * .08); ctx.stroke();
      glassSpans.push([l.x + prof, l.x + l.w - prof]);
    });
    const lead = variantKey === 'center' ? ls.filter(l => l.moving) : [ls.find(l => l.i === (variantKey === 'left' ? Math.max(...v.moving) : Math.min(...v.moving)))];
    lead.forEach(l => {
      const right = variantKey === 'left' || (variantKey === 'center' && l.i === Math.min(...v.moving));
      const hx = right ? l.x + l.w - prof - 7 : l.x + prof + 7, hy = iy + ih * .5, len = mobile ? 10 : 16;
      ctx.strokeStyle = '#c9c7c2'; ctx.lineWidth = mobile ? 2 : 2.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hy - len); ctx.lineTo(hx, hy + len); ctx.stroke(); ctx.lineCap = 'butt';
    });
    ctx.fillStyle = '#1b1b19';
    ctx.fillRect(ox0, oy0, fw, frame); ctx.fillRect(ox0, oy0, frame, fh); ctx.fillRect(ox1 - frame, oy0, frame, fh);
    ctx.fillStyle = '#8f8d88'; ctx.fillRect(ox0, oy1 - 2, fw, 3);

    // солнце на полу: проекция стекла и открытого проёма (свет падает справа)
    const cov = ls.map(l => [l.x, l.x + l.w]).sort((a, b) => a[0] - b[0]);
    const gaps = []; let cur = ix;
    cov.forEach(([a, b]) => { if (a - cur > 2) gaps.push([cur, a]); cur = Math.max(cur, b); });
    if (ix + iw - cur > 2) gaps.push([cur, ix + iw]);
    const depth = H * 1.02, shift = -W * .09;
    const patch = ([a, b], alpha) => {
      const g = ctx.createLinearGradient(0, by1, 0, depth);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(a, by1); ctx.lineTo(b, by1); ctx.lineTo(fl(b, depth) + shift, depth); ctx.lineTo(fl(a, depth) + shift, depth); ctx.closePath(); ctx.fill();
    };
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    glassSpans.forEach(sp => patch(sp, .55));
    ctx.restore();
    gaps.forEach(sp => patch(sp, .42));

    // мебель: ковёр, диван, растение — силуэтами, по краям, чтобы не закрывать портал
    ctx.fillStyle = 'rgba(245,245,244,.55)';
    const ry0 = H * .84, ry1 = H * 1.02, rx0 = W * .3, rx1 = W * .7;
    ctx.beginPath(); ctx.moveTo(fl(rx0, ry0), ry0); ctx.lineTo(fl(rx1, ry0), ry0); ctx.lineTo(fl(rx1, ry1), ry1); ctx.lineTo(fl(rx0, ry1), ry1); ctx.closePath(); ctx.fill();
    const sofa = (x, y, w, h) => {
      ctx.fillStyle = '#6f6d69'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#85837e'; ctx.fillRect(x, y - h * .55, w, h * .6);
      ctx.fillStyle = '#5c5a56'; ctx.fillRect(x - w * .04, y - h * .35, w * .06, h * 1.35); ctx.fillRect(x + w * .98, y - h * .35, w * .06, h * 1.35);
      ctx.fillStyle = 'rgba(27,27,25,.18)'; ctx.fillRect(x - w * .04, y + h, w * 1.08, 3);
    };
    sofa(-W * .04, H * .86, W * .28, H * .09);
    // растение в горшке справа
    const px = W * .92, py = H * .9;
    ctx.fillStyle = '#3f3e3b'; ctx.fillRect(px - W * .025, py, W * .05, H * .1);
    ctx.fillStyle = '#56645a';
    for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * .28; ctx.beginPath(); ctx.ellipse(px + Math.cos(a) * W * .035, py - H * .06 + Math.sin(a) * H * .07, W * .012, H * .045, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill(); }
    // торшер слева у стены
    ctx.strokeStyle = '#2b2b29'; ctx.lineWidth = 1.5;
    const lx = W * .06; ctx.beginPath(); ctx.moveTo(lx, H * .82); ctx.lineTo(lx, H * .42); ctx.lineTo(lx + W * .05, H * .36); ctx.stroke();
    ctx.fillStyle = '#2b2b29'; ctx.beginPath(); ctx.moveTo(lx + W * .035, H * .36); ctx.lineTo(lx + W * .075, H * .36); ctx.lineTo(lx + W * .065, H * .4); ctx.lineTo(lx + W * .045, H * .4); ctx.closePath(); ctx.fill();

    // лёгкая виньетка
    const vg = ctx.createRadialGradient(vpX, vpY, Math.min(W, H) * .3, vpX, vpY, Math.max(W, H) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.14)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  // Итог под схемой: одна карточка выбранного готового решения (фото и цена — из карточек #stock, цены не дублируем)
  // и одна строка для тех, кому размер не подходит: калькулятор с этой конфигурацией или бесплатный замер.
  const next = $('[data-hsx-next]');
  const sideText = () => ({ left: 'активная слева', right: 'активная справа', center: 'открывание от центра' }[variantKey]);
  function renderNext() {
    if (!next) return;
    const f = family(), v = variant();
    let img = '', price = '';
    for (const card of document.querySelectorAll('#stock [data-card]')) {
      let list = []; try { list = JSON.parse(card.dataset.variants || '[]'); } catch (_) {}
      const hit = list.find(x => x.href === v.href);
      if (hit) { img = hit.img; price = ((card.querySelector('.m-card__price strong') || {}).textContent || '').trim(); break; }
    }
    $('[data-next-card]').href = v.href;
    if (img) $('[data-next-img]').src = img;
    $('[data-next-title]').textContent = `${f.code} · ${fmt(f.width)} × ${fmt(f.height)} мм`;
    $('[data-next-price]').textContent = price;
    $('[data-next-side]').textContent = `${price ? '· ' : ''}${sideText()}`;
    const q = new URLSearchParams({ w: f.width, h: f.height, n: v.sections, from: `HS, схемы: ${f.code}, ${sideText()}` });
    $('[data-next-calc]').href = `../../raschet/?${q}`;
    $('[data-next-form]').dataset.comment = `Нужен бесплатный замер. Смотрели ${f.code}, ${sideText()}.`;
  }
  if (next) next.addEventListener('click', e => {
    const a = e.target.closest('[data-next-form]'); if (!a) return;
    const ta = document.querySelector('#project-form textarea[name="comment"]');
    if (ta && !ta.value.trim()) ta.value = a.dataset.comment || '';
  });

  const snap = () => { progress = [0, 50, 100].reduce((a, b) => Math.abs(progress - b) < Math.abs(progress - a) ? b : a); update(); };

  widthGroup.addEventListener('click', e => {
    const b = e.target.closest('[data-family]'); if (!b) return;
    familyKey = b.dataset.family; variantKey = family().def; progress = 0;
    [...widthGroup.children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderSides(); update();
  });
  sideGroup.addEventListener('click', e => {
    const b = e.target.closest('[data-variant]'); if (!b) return;
    variantKey = b.dataset.variant; progress = 0;
    [...sideGroup.children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    update();
  });
  tabs.forEach(t => t.addEventListener('click', () => {
    view = t.dataset.hsxView;
    visual.classList.toggle('is-interior', view === 'interior');
    tabs.forEach(x => x.setAttribute('aria-selected', String(x === t)));
    draw();
    if (view === 'interior') { load3d(); sync3d(); }
  }));
  range.addEventListener('input', () => { progress = +range.value; update(); });
  range.addEventListener('change', snap);

  const fromPointer = ev => {
    const r = canvas.getBoundingClientRect();
    let q = (ev.clientX - r.left) / r.width;
    if (variantKey === 'right') q = 1 - q;
    if (variantKey === 'center') q = Math.min(1, Math.abs(q - .5) * 2);
    progress = Math.max(0, Math.min(100, q * 100));
    update();
  };
  canvas.addEventListener('pointerdown', ev => { dragging = true; canvas.setPointerCapture(ev.pointerId); fromPointer(ev); });
  canvas.addEventListener('pointermove', ev => { if (dragging) fromPointer(ev); });
  canvas.addEventListener('pointerup', ev => { if (!dragging) return; dragging = false; try { canvas.releasePointerCapture(ev.pointerId); } catch (_) {} snap(); });
  canvas.addEventListener('pointercancel', () => { if (dragging) { dragging = false; snap(); } });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else addEventListener('resize', resize);
  renderSides(); update(); resize();
})();
