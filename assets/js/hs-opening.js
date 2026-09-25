/* Блок «Как открывается дверь» (systems/hs/#schemes).
   Ширина × активная створка → схема поверх фото, ползунок открытия, свободный проход, ссылка на товар. */
(() => {
  const root = document.querySelector('[data-hsx-open]');
  if (!root) return;

  const CAT = '../../catalog/hs-portaly/';
  const DATA = {
    hs30: {
      code: 'HS/30', width: 3000, height: 2300, def: 'right',
      variants: {
        left:  { label: 'Слева',  sections: 2, moving: [0], targets: [1], passage: 1500, ratio: .5,
                 dir: 'левая,<br>сдвигается вправо', use: 'выхода на террасу,<br>из гостиной', href: CAT + 'alumark-s158-3000x2300-belyi-aktivnaya-sleva/' },
        right: { label: 'Справа', sections: 2, moving: [1], targets: [0], passage: 1500, ratio: .5,
                 dir: 'правая,<br>сдвигается влево', use: 'выхода на террасу,<br>из гостиной', href: CAT + 'alumark-s158-3000x2300-belyi-aktivnaya-sprava/' }
      }
    },
    hs36: {
      code: 'HS/36', width: 3600, height: 2300, def: 'right',
      variants: {
        left:  { label: 'Слева',  sections: 3, moving: [0, 1], targets: [2, 2], passage: 2400, ratio: .667,
                 dir: 'две левые,<br>сдвигаются вправо', use: 'широкого выхода<br>на террасу', href: CAT + 'alumark-s158-3600x2300-antratsit-dve-aktivnye-odna-fiksirovannaya/' },
        right: { label: 'Справа', sections: 3, moving: [1, 2], targets: [0, 0], passage: 2400, ratio: .667,
                 dir: 'две правые,<br>сдвигаются влево', use: 'широкого выхода<br>на террасу', href: CAT + 'alumark-s158-3600x2300-antratsit-dve-aktivnye-odna-fiksirovannaya/' }
      }
    },
    hs48: {
      code: 'HS/48', width: 4800, height: 2300, def: 'center',
      variants: {
        center: { label: 'От центра', sections: 4, moving: [1, 2], targets: [0, 3], passage: 2400, ratio: .5,
                  dir: 'две центральные<br>расходятся', use: 'главного выхода,<br>большой террасы', href: CAT + 'alumark-s158-4800x2300-antratsit-otkryvanie-ot-centra/' }
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

  function arrow(x1, y, x2) {
    ctx.strokeStyle = '#11110f'; ctx.fillStyle = '#11110f'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    const d = x2 > x1 ? -1 : 1, s = 7;
    ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2 + d * s, y - s * .55); ctx.lineTo(x2 + d * s, y + s * .55); ctx.closePath(); ctx.fill();
  }

  function draw() {
    const W = canvas.getBoundingClientRect().width, H = canvas.getBoundingClientRect().height;
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    if (view === 'interior') return;

    const v = variant(), p = progress / 100, n = v.sections, mobile = W < 650;
    const left = W * (mobile ? .07 : .095), right = W * (mobile ? .07 : .08);
    const top = H * (mobile ? .11 : .09), bottom = H * (mobile ? .12 : .09);
    const fw = W - left - right, fh = H - top - bottom, leafW = fw / n;

    ctx.fillStyle = 'rgba(247,247,243,.16)';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(17,17,15,.88)';
    ctx.lineWidth = mobile ? 1.6 : 2.2;
    ctx.strokeRect(left, top, fw, fh);

    const pos = {};
    const fixed = [...Array(n).keys()].filter(i => !v.moving.includes(i));
    const panel = (i, moving) => {
      const base = left + i * leafW;
      let x = base;
      if (moving) {
        const mi = v.moving.indexOf(i), target = v.targets[mi];
        x = lerp(base, left + target * leafW, p);
        if (v.moving.length > 1 && v.targets.every(t => t === target)) x += (mi - (v.moving.length - 1) / 2) * (mobile ? 4 : 7) * p;
      }
      ctx.fillStyle = moving ? 'rgba(236,242,241,.34)' : 'rgba(255,255,255,.06)';
      ctx.fillRect(x + 2, top + 2, leafW - 4, fh - 4);
      ctx.strokeStyle = moving ? 'rgba(17,17,15,.82)' : 'rgba(17,17,15,.42)';
      ctx.lineWidth = mobile ? 1.2 : 1.5;
      ctx.strokeRect(x + 2, top + 2, leafW - 4, fh - 4);
      pos[i] = { x, w: leafW };
    };
    fixed.forEach(i => panel(i, false));
    v.moving.forEach(i => panel(i, true));

    const ay = top + fh * .52;
    if (variantKey === 'left') arrow(left + fw * .28, ay, left + fw * .44);
    if (variantKey === 'right') arrow(left + fw * .72, ay, left + fw * .56);
    if (variantKey === 'center') { arrow(left + fw * .47, ay, left + fw * .35); arrow(left + fw * .53, ay, left + fw * .65); }

    // ручки: на ведущей створке, при открывании от центра — на обеих центральных
    const handles = variantKey === 'center' ? [1, 2] : [variantKey === 'left' ? Math.max(...v.moving) : Math.min(...v.moving)];
    handles.forEach((i, k) => {
      const q = pos[i]; if (!q) return;
      const hx = variantKey === 'center' ? (k === 0 ? q.x + q.w * .82 : q.x + q.w * .18) : (variantKey === 'left' ? q.x + q.w * .84 : q.x + q.w * .16);
      const hy = top + fh * .55;
      ctx.strokeStyle = 'rgba(17,17,15,.9)'; ctx.lineWidth = mobile ? 2 : 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hy - 17); ctx.lineTo(hx, hy + 17); ctx.stroke(); ctx.lineCap = 'butt';
    });

    ctx.strokeStyle = 'rgba(17,17,15,.25)'; ctx.lineWidth = .8;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(left, top + fh + 5 + i * 4); ctx.lineTo(left + fw, top + fh + 5 + i * 4); ctx.stroke(); }
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
