(() => {
  const root = document.getElementById('fsPortalDemo');
  const stage = document.getElementById('portalStage');
  const canvas = document.getElementById('portalCanvas');
  const slider = document.getElementById('portalProgress');
  const toggle = document.getElementById('portalToggle');
  const stateLabel = document.getElementById('portalState');

  if (!root || !stage || !canvas || !slider || !toggle || !stateLabel) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let progress = 0;
  let target = 0;
  let rafId = 0;
  let isDragging = false;

  const PANEL_COUNT = 6;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, amount) {
    return a + (b - a) * amount;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    draw();
  }

  function roundedLine(x1, y1, x2, y2, width, color) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawPolygon(points, fill, stroke, lineWidth) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.closePath();

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }

    if (stroke && lineWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    const mobile = w < 640;

    const marginX = mobile ? w * 0.06 : w * 0.075;
    const top = h * (mobile ? 0.14 : 0.13);
    const bottom = h * (mobile ? 0.80 : 0.81);

    const left = marginX;
    const right = w - marginX;
    const openingW = right - left;
    const openingH = bottom - top;

    const p = clamp(progress, 0, 1);
    const eased = easeOutCubic(p);

    // Stage backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#f1f0ed');
    bg.addColorStop(0.66, '#e8e7e3');
    bg.addColorStop(1, '#dedcd7');

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Floor
    const floor = ctx.createLinearGradient(0, bottom, 0, h);
    floor.addColorStop(0, 'rgba(255,255,255,.04)');
    floor.addColorStop(1, 'rgba(0,0,0,.05)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, bottom, w, h - bottom);

    // Soft portal shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.12)';
    ctx.shadowBlur = mobile ? 16 : 26;
    ctx.shadowOffsetY = mobile ? 8 : 13;
    ctx.strokeStyle = '#242727';
    ctx.lineWidth = mobile ? 7 : 10;
    ctx.strokeRect(left, top, openingW, openingH);
    ctx.restore();

    // Outer frame
    ctx.strokeStyle = '#1c1f1f';
    ctx.lineWidth = mobile ? 7 : 10;
    ctx.strokeRect(left, top, openingW, openingH);

    // Inner frame highlight
    ctx.strokeStyle = 'rgba(255,255,255,.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      left + (mobile ? 4 : 5),
      top + (mobile ? 4 : 5),
      openingW - (mobile ? 8 : 10),
      openingH - (mobile ? 8 : 10)
    );

    const closedPanelW = openingW / PANEL_COUNT;
    const foldedVisualW = Math.max(
      mobile ? 15 : 18,
      openingW * (mobile ? 0.035 : 0.026)
    );

    const foldedStackW = foldedVisualW * PANEL_COUNT;
    const openAreaStart = left + foldedStackW + (mobile ? 10 : 14);

    // Opening visible behind folded leaves
    if (p > 0.015) {
      const openX = lerp(right, openAreaStart, eased);

      const openFill = ctx.createLinearGradient(openX, top, right, bottom);
      openFill.addColorStop(0, 'rgba(248,248,245,.98)');
      openFill.addColorStop(0.55, 'rgba(232,232,228,.96)');
      openFill.addColorStop(1, 'rgba(219,219,215,.98)');

      ctx.fillStyle = openFill;
      ctx.fillRect(
        openX,
        top + (mobile ? 6 : 8),
        Math.max(0, right - openX - (mobile ? 6 : 8)),
        openingH - (mobile ? 12 : 16)
      );

      // Subtle depth in open void
      const depth = ctx.createLinearGradient(openX, 0, right, 0);
      depth.addColorStop(0, 'rgba(0,0,0,.075)');
      depth.addColorStop(0.18, 'rgba(0,0,0,0)');
      depth.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = depth;
      ctx.fillRect(openX, top + 8, Math.max(0, right - openX), openingH - 16);
    }

    // Draw the leaves from right to left for better overlap
    for (let i = PANEL_COUNT - 1; i >= 0; i--) {
      const closedX = left + i * closedPanelW;
      const stackX = left + i * foldedVisualW;

      const x = lerp(closedX, stackX, eased);
      const widthFront = lerp(closedPanelW, foldedVisualW, eased);

      const alternate = i % 2 === 0 ? 1 : -1;
      const phase = Math.min(1, p * 1.08);
      const theta = phase * (Math.PI / 2) * 0.91;

      const apparentWidth = Math.max(
        foldedVisualW,
        widthFront * Math.cos(theta)
      );

      const perspectiveDepth =
        Math.sin(theta) *
        closedPanelW *
        (mobile ? 0.24 : 0.30) *
        alternate;

      const x2 = x + apparentWidth;

      const points = [
        { x: x,  y: top + 7 },
        { x: x2, y: top + 7 + perspectiveDepth },
        { x: x2, y: bottom - 7 - perspectiveDepth * 0.16 },
        { x: x,  y: bottom - 7 }
      ];

      const glass = ctx.createLinearGradient(x, top, x2 + closedPanelW * 0.35, bottom);
      glass.addColorStop(0, 'rgba(249,251,251,.58)');
      glass.addColorStop(0.38, 'rgba(214,222,222,.22)');
      glass.addColorStop(0.72, 'rgba(198,208,210,.12)');
      glass.addColorStop(1, 'rgba(245,247,246,.50)');

      drawPolygon(
        points,
        glass,
        '#1d2020',
        mobile ? 5 : 7
      );

      // Glass reflection
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.moveTo(points[0].x + 5, points[0].y + 7);
      ctx.lineTo(points[2].x - 6, points[2].y - 8);
      ctx.strokeStyle = 'rgba(255,255,255,.66)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Hinge detail
      if (p > 0.10 && i < PANEL_COUNT - 1) {
        const hingeX = points[0].x - 1.5;
        const hingeY = top + openingH * 0.47;

        ctx.fillStyle = '#111313';
        ctx.fillRect(
          hingeX,
          hingeY,
          mobile ? 2.5 : 3,
          mobile ? 15 : 20
        );
      }
    }

    // Handle on leading leaf
    const handleClosedX = left + closedPanelW - (mobile ? 15 : 18);
    const handleOpenX = left + foldedStackW - (mobile ? 8 : 10);
    const handleX = lerp(handleClosedX, handleOpenX, eased);
    const handleY = top + openingH * 0.47;

    roundedLine(
      handleX,
      handleY,
      handleX,
      handleY + (mobile ? 30 : 42),
      mobile ? 4 : 5,
      '#151717'
    );

    // Bottom track
    ctx.beginPath();
    ctx.moveTo(left, bottom + (mobile ? 8 : 10));
    ctx.lineTo(right, bottom + (mobile ? 8 : 10));
    ctx.strokeStyle = 'rgba(23,25,24,.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Little endpoint markers
    ctx.fillStyle = 'rgba(23,25,24,.40)';
    ctx.fillRect(left - 1, bottom + 5, 2, mobile ? 7 : 10);
    ctx.fillRect(right - 1, bottom + 5, 2, mobile ? 7 : 10);

    updateUI();
  }

  function updateUI() {
    const percent = Math.round(clamp(progress, 0, 1) * 100);

    if (percent <= 1) {
      stateLabel.textContent = 'Закрыто';
    } else if (percent >= 99) {
      stateLabel.textContent = 'Открыто';
    } else {
      stateLabel.textContent = `${percent}%`;
    }

    toggle.textContent = progress > 0.5 ? 'Закрыть' : 'Открыть';
  }

  function setProgress(next, syncSlider = true) {
    progress = clamp(next, 0, 1);
    target = progress;

    if (syncSlider) {
      slider.value = String(Math.round(progress * 100));
    }

    root.classList.add('is-used');
    draw();
  }

  function animateTo(nextTarget) {
    cancelAnimationFrame(rafId);

    target = clamp(nextTarget, 0, 1);
    root.classList.add('is-used');

    if (reduceMotion) {
      progress = target;
      slider.value = String(Math.round(progress * 100));
      draw();
      return;
    }

    const step = () => {
      const delta = target - progress;

      if (Math.abs(delta) < 0.0015) {
        progress = target;
        slider.value = String(Math.round(progress * 100));
        draw();
        return;
      }

      progress += delta * 0.075;
      slider.value = String(Math.round(progress * 100));
      draw();

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
  }

  function pointerToProgress(event) {
    const rect = stage.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    return x / rect.width;
  }

  slider.addEventListener('input', () => {
    cancelAnimationFrame(rafId);
    setProgress(Number(slider.value) / 100, false);
  });

  toggle.addEventListener('click', () => {
    animateTo(progress > 0.5 ? 0 : 1);
  });

  stage.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    isDragging = true;
    cancelAnimationFrame(rafId);
    stage.setPointerCapture?.(event.pointerId);
    setProgress(pointerToProgress(event));
  });

  stage.addEventListener('pointermove', event => {
    if (!isDragging) return;
    setProgress(pointerToProgress(event));
  });

  function finishDrag(event) {
    if (!isDragging) return;
    isDragging = false;

    try {
      if (stage.hasPointerCapture?.(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
      }
    } catch (_) {}
  }

  stage.addEventListener('pointerup', finishDrag);
  stage.addEventListener('pointercancel', finishDrag);

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
  } else {
    window.addEventListener('resize', resizeCanvas, { passive: true });
  }

  resizeCanvas();
})();
