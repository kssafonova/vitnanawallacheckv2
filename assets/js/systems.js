/* Главная, блок «Системы»: аккордеон и три схемы на canvas (HS, FS, панорамное остекление).
   Схема рисуется линиями в архитектурной манере; ползунок и перетаскивание по схеме — «Закрыто → Открыто». */
(() => {
  const items = [...document.querySelectorAll('.sysx-item')];
  const redraw = new Map();

  items.forEach(item => {
    const head = item.querySelector('.sysx-head');
    head?.addEventListener('click', () => {
      const opening = !item.classList.contains('is-open');
      items.forEach(x => { x.classList.remove('is-open'); x.querySelector('.sysx-head')?.setAttribute('aria-expanded', 'false'); });
      if (opening) {
        item.classList.add('is-open');
        head.setAttribute('aria-expanded', 'true');
        const r = redraw.get(item.querySelector('[data-sx]'));
        if (r) requestAnimationFrame(r);
      }
    });
  });

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const C = { line: 'rgba(244,243,241,.9)', soft: 'rgba(244,243,241,.35)', faint: 'rgba(244,243,241,.14)', glass: 'rgba(170,196,204,.10)', glassOn: 'rgba(190,214,222,.20)', accent: '#d9c690' };

  function arrow(ctx, x1, y, x2, s = 7) {
    ctx.strokeStyle = C.accent; ctx.fillStyle = C.accent; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    const d = Math.sign(x2 - x1) || 1;
    ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2 - d * s, y - s * .55); ctx.lineTo(x2 - d * s, y + s * .55); ctx.closePath(); ctx.fill();
  }
  function pane(ctx, x, y, w, h, on, mullion) {
    ctx.fillStyle = on ? C.glassOn : C.glass; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = on ? C.line : C.soft; ctx.lineWidth = on ? 1.6 : 1.1; ctx.strokeRect(x, y, w, h);
    const m = Math.min(w, h) * (mullion || .06);
    ctx.strokeStyle = C.faint; ctx.lineWidth = 1; ctx.strokeRect(x + m, y + m, w - 2 * m, h - 2 * m);
    // блик на стекле
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(x + w * .18, y + h * .22); ctx.lineTo(x + w * .34, y + h * .12); ctx.stroke();
  }
  function floor(ctx, l, r, y) {
    ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(l - 10, y + 6 + i * 5); ctx.lineTo(r + 10, y + 6 + i * 5); ctx.stroke(); }
  }

  // HS: две створки; правая (активная) сначала приподнимается, потом уходит влево поверх глухой
  function drawHs(ctx, w, h, p) {
    const mob = w < 520, pad = w * (mob ? .08 : .1), top = h * .2, bot = h * .82, L = pad, R = w - pad, fw = R - L, fh = bot - top;
    ctx.strokeStyle = C.line; ctx.lineWidth = mob ? 2 : 2.4; ctx.strokeRect(L, top, fw, fh);
    const inset = 5, half = (fw - inset * 2) / 2;
    pane(ctx, L + inset, top + inset, half, fh - inset * 2, false);
    const lift = ease(clamp(p / .22, 0, 1)), slide = ease(clamp((p - .22) / .78, 0, 1));
    const x = lerp(L + inset + half, L + inset + half * .12, slide), y = top + inset - lift * (mob ? 4 : 6);
    pane(ctx, x, y, half, fh - inset * 2, true);
    // ручка: вертикально → горизонтально при подъёме
    const hx = x + half * .1, hy = y + (fh - inset * 2) * .52, len = mob ? 16 : 22, a = lift * Math.PI / 2;
    ctx.strokeStyle = C.line; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.sin(a) * len * .8, hy + Math.cos(a) * len); ctx.stroke(); ctx.lineCap = 'butt';
    // направляющие
    ctx.strokeStyle = C.soft; ctx.lineWidth = 1;
    [bot + 3, bot + 7].forEach(yy => { ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke(); });
    if (p < .96) arrow(ctx, L + fw * .78, top + fh * .5, L + fw * .6);
    floor(ctx, L, R, bot + 8);
  }

  // FS: шесть створок складываются к левому краю
  function drawFs(ctx, w, h, p) {
    const mob = w < 520, pad = w * (mob ? .08 : .1), top = h * .2, bot = h * .82, L = pad, R = w - pad, fw = R - L, n = 6, q = ease(p);
    ctx.strokeStyle = C.line; ctx.lineWidth = mob ? 2 : 2.4; ctx.strokeRect(L, top, fw, bot - top);
    const pw = (fw - 10) / n, packed = Math.max(8, fw * .03);
    for (let i = n - 1; i >= 0; i--) {
      const x = lerp(L + 5 + i * pw, L + 5 + i * packed, q), th = q * Math.PI / 2 * .92;
      const aw = Math.max(packed, pw * Math.cos(th) * (1 - q) + packed * q), dep = Math.sin(th) * pw * .22 * (i % 2 ? -1 : 1);
      ctx.beginPath(); ctx.moveTo(x, top + 5); ctx.lineTo(x + aw, top + 5 + dep); ctx.lineTo(x + aw, bot - 5 - dep * .2); ctx.lineTo(x, bot - 5); ctx.closePath();
      ctx.fillStyle = i === n - 1 ? C.glassOn : C.glass; ctx.fill();
      ctx.strokeStyle = i === n - 1 ? C.line : C.soft; ctx.lineWidth = i === n - 1 ? 1.6 : 1.1; ctx.stroke();
    }
    if (p < .96) arrow(ctx, L + fw * .7, top + (bot - top) * .5, L + fw * .45);
    floor(ctx, L, R, bot + 2);
  }

  // Панорама: фасад из секций, средняя внизу открывается (поворотная створка, условное обозначение — треугольник)
  function drawPano(ctx, w, h, p) {
    const mob = w < 520, pad = w * (mob ? .08 : .1), top = h * .18, bot = h * .84, L = pad, R = w - pad, fw = R - L, fh = bot - top;
    ctx.strokeStyle = C.line; ctx.lineWidth = mob ? 2 : 2.4; ctx.strokeRect(L, top, fw, fh);
    const cols = 3, cw = fw / cols, tr = fh * .26; // фрамуга сверху
    for (let c = 0; c < cols; c++) {
      pane(ctx, L + c * cw + 4, top + 4, cw - 8, tr - 8, false, .1);
      if (c !== 1) pane(ctx, L + c * cw + 4, top + tr, cw - 8, fh - tr - 4, false);
    }
    // открывающаяся створка: распахивается наружу на петлях слева (до 80°)
    const x = L + cw + 4, y = top + tr, sw = cw - 8, sh = fh - tr - 4, q = ease(p), th = q * Math.PI * .44;
    // проём: за створкой виден «улица» — светлое небо, линия горизонта, кроны
    const sky = ctx.createLinearGradient(0, y, 0, y + sh);
    sky.addColorStop(0, `rgba(196,214,222,${.05 + q * .28})`); sky.addColorStop(1, `rgba(120,140,130,${.04 + q * .16})`);
    ctx.fillStyle = '#0b0b0a'; ctx.fillRect(x, y, sw, sh);
    ctx.fillStyle = sky; ctx.fillRect(x, y, sw, sh);
    if (q > .02) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, sw, sh); ctx.clip();
      ctx.strokeStyle = `rgba(244,243,241,${.35 * q})`; ctx.lineWidth = 1;
      const hy = y + sh * .62; ctx.beginPath(); ctx.moveTo(x, hy); ctx.lineTo(x + sw, hy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, hy);
      for (let i = 0; i <= 8; i++) ctx.lineTo(x + sw * i / 8, hy - sh * (.08 + .07 * Math.abs(Math.sin(i * 1.7))));
      ctx.lineTo(x + sw, hy); ctx.stroke();
      ctx.restore();
    }
    // сама створка: свободный край уходит к зрителю — становится выше и сдвигается к петлям
    const fx = x + sw * Math.cos(th), grow = Math.sin(th) * sh * .09;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; // тень от створки на откосе
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sw * .12 * q, y); ctx.lineTo(x + sw * .12 * q, y + sh); ctx.lineTo(x, y + sh); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(fx, y - grow); ctx.lineTo(fx, y + sh + grow); ctx.lineTo(x, y + sh); ctx.closePath();
    ctx.fillStyle = q > .02 ? 'rgba(200,222,230,.26)' : C.glassOn; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1.8; ctx.stroke();
    // внутренняя рамка створки
    const ins = .07;
    ctx.strokeStyle = C.faint; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(lerp(x, fx, ins), lerp(y, y - grow, ins) + sh * ins); ctx.lineTo(lerp(x, fx, 1 - ins), lerp(y, y - grow, 1 - ins) + sh * ins);
    ctx.lineTo(lerp(x, fx, 1 - ins), lerp(y + sh, y + sh + grow, 1 - ins) - sh * ins); ctx.lineTo(lerp(x, fx, ins), lerp(y + sh, y + sh + grow, ins) - sh * ins); ctx.closePath(); ctx.stroke();
    // ручка на свободном краю
    ctx.strokeStyle = C.line; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    const hx = lerp(x, fx, .9), hy2 = y + sh * .5; ctx.beginPath(); ctx.moveTo(hx, hy2); ctx.lineTo(hx, hy2 + (mob ? 12 : 16)); ctx.stroke(); ctx.lineCap = 'butt';
    // обозначение открывания: пунктир, вершина у петель
    if (q < .02) {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = C.accent; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + sw, y); ctx.lineTo(x, y + sh / 2); ctx.lineTo(x + sw, y + sh); ctx.stroke(); ctx.setLineDash([]);
    }
    // стрелка: створка распахивается наружу
    if (q < .96) {
      const ax = lerp(x, fx, .5) + sw * .18, ay = y + sh * .2;
      ctx.strokeStyle = C.accent; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(ax + sw * .22, ay + sh * .1); ctx.quadraticCurveTo(ax + sw * .2, ay - sh * .06, ax, ay - sh * .04); ctx.stroke();
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.moveTo(ax - 1, ay - sh * .04); ctx.lineTo(ax + 7, ay - sh * .04 - 4); ctx.lineTo(ax + 6, ay - sh * .04 + 4); ctx.closePath(); ctx.fill();
    }
    floor(ctx, L, R, bot);
  }

  const DRAW = { hs: drawHs, fs: drawFs, pano: drawPano };
  const STATE = { hs: ['Закрыто', p => (p < .22 ? 'Створка поднята' : 'Сдвигается'), 'Открыто'], fs: ['Закрыто', 'Складывается', 'Открыто'], pano: ['Закрыто', 'Открывается', 'Открыто'] };

  document.querySelectorAll('[data-sx]').forEach(root => {
    const key = root.dataset.sx, draw = DRAW[key];
    const canvas = root.querySelector('[data-sx-canvas]'), stage = root.querySelector('[data-sx-stage]');
    const range = root.querySelector('[data-sx-range]'), state = root.querySelector('[data-sx-state]');
    if (!canvas || !draw) return;
    const ctx = canvas.getContext('2d');
    let p = 0, drag = false;
    const render = () => {
      const r = canvas.getBoundingClientRect(); if (!r.width) return;
      const d = Math.min(devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(r.width * d)) { canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d); }
      ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
      draw(ctx, r.width, r.height, p);
      const s = STATE[key]; state.textContent = p < .02 ? s[0] : p > .98 ? s[2] : (typeof s[1] === 'function' ? s[1](p) : s[1]);
    };
    const set = v => { p = clamp(v, 0, 1); range.value = Math.round(p * 100); render(); };
    range.addEventListener('input', () => set(+range.value / 100));
    const fromPointer = e => { const r = stage.getBoundingClientRect(); set(1 - (e.clientX - r.left) / r.width); };
    stage.addEventListener('pointerdown', e => { drag = true; stage.setPointerCapture(e.pointerId); fromPointer(e); });
    stage.addEventListener('pointermove', e => { if (drag) fromPointer(e); });
    ['pointerup', 'pointercancel'].forEach(t => stage.addEventListener(t, () => { drag = false; }));
    // подсказка: при первом показе схема один раз сама приоткрывается и закрывается — видно, что её можно двигать
    let touched = false, shown = false;
    ['pointerdown', 'keydown'].forEach(t => root.addEventListener(t, () => { touched = true; }));
    range.addEventListener('input', () => { touched = true; });
    const demo = () => {
      if (shown || touched || matchMedia('(prefers-reduced-motion: reduce)').matches || !canvas.getBoundingClientRect().width) return;
      shown = true;
      const t0 = performance.now(), up = 900, hold = 350, down = 700;
      const step = now => {
        if (touched) return;
        const t = now - t0;
        const v = t < up ? t / up : t < up + hold ? 1 : 1 - (t - up - hold) / down;
        set(.72 * clamp(v, 0, 1));
        if (t < up + hold + down) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setTimeout(demo, 250); }), { threshold: .6 }).observe(stage);
    }
    redraw.set(root, () => { render(); setTimeout(demo, 350); });
    if ('ResizeObserver' in window) new ResizeObserver(render).observe(canvas); else addEventListener('resize', render);
    render();
  });
})();
