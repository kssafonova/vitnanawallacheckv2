/* Блок «Как открывается дверь» (systems/hs/#schemes).
   Ширина × активная створка → схема на canvas (стена, рама, створки, улица за стеклом, размер прохода), ползунок открытия, свободный проход, ссылка на товар. */
(() => {
  const root = document.querySelector('[data-hsx-open]');
  if (!root) return;

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
    const cta = $('[data-hsx-cta]');
    cta.href = v.href;
    cta.querySelector('span').textContent = `Выбрать ${f.code}`;
    range.value = progress;
    range.setAttribute('aria-valuetext', `${Math.round(progress)}% открыто`);
    draw();
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
    if (view === 'interior') return;

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
  canvas.addEventListener('pointerdown', ev => { if (view !== 'scheme') return; dragging = true; canvas.setPointerCapture(ev.pointerId); fromPointer(ev); });
  canvas.addEventListener('pointermove', ev => { if (dragging) fromPointer(ev); });
  canvas.addEventListener('pointerup', ev => { if (!dragging) return; dragging = false; try { canvas.releasePointerCapture(ev.pointerId); } catch (_) {} snap(); });
  canvas.addEventListener('pointercancel', () => { if (dragging) { dragging = false; snap(); } });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else addEventListener('resize', resize);
  renderSides(); update(); resize();
})();
