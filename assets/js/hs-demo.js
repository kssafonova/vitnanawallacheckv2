(() => {
  const root = document.getElementById('hsPortalDemo');
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

  function drawRect(x, y, w, h, fill, stroke, lineWidth = 0) {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
    }
    if (stroke && lineWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(x, y, w, h);
    }
  }

  function drawGlassPane(x, y, w, h, frameWidth, fillStrength = 1, frameColor = '#1d2020') {
    const glass = ctx.createLinearGradient(x, y, x + w, y + h);
    glass.addColorStop(0, `rgba(249,251,251,${0.58 * fillStrength})`);
    glass.addColorStop(0.38, `rgba(214,222,222,${0.22 * fillStrength})`);
    glass.addColorStop(0.72, `rgba(198,208,210,${0.12 * fillStrength})`);
    glass.addColorStop(1, `rgba(245,247,246,${0.50 * fillStrength})`);

    drawRect(x, y, w, h, glass, frameColor, frameWidth);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 10);
    ctx.lineTo(x + w - 10, y + h - 12);
    ctx.strokeStyle = 'rgba(255,255,255,.42)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawHandle(x, y, h, color, recessed = false) {
    if (recessed) {
      drawRect(x - 5, y - 5, 13, h + 10, 'rgba(255,255,255,.08)', color, 1);
      drawRect(x, y, 3, h, color, null, 0);
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.stroke();
    }
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    const mobile = w < 640;
    const left = w * (mobile ? 0.06 : 0.055);
    const right = w - left;
    const top = h * (mobile ? 0.14 : 0.13);
    const bottom = h * (mobile ? 0.80 : 0.81);

    const openingW = right - left;
    const openingH = bottom - top;
    const frameW = mobile ? 7 : 10;
    const innerFrame = mobile ? 5 : 7;
    const p = clamp(progress, 0, 1);
    const eased = easeOutCubic(p);

    // backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#f1f0ed');
    bg.addColorStop(0.66, '#e8e7e3');
    bg.addColorStop(1, '#dedcd7');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // floor
    const floor = ctx.createLinearGradient(0, bottom, 0, h);
    floor.addColorStop(0, 'rgba(255,255,255,.04)');
    floor.addColorStop(1, 'rgba(0,0,0,.05)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, bottom, w, h - bottom);

    // shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.12)';
    ctx.shadowBlur = mobile ? 16 : 24;
    ctx.shadowOffsetY = mobile ? 8 : 12;
    ctx.strokeStyle = '#242727';
    ctx.lineWidth = frameW;
    ctx.strokeRect(left, top, openingW, openingH);
    ctx.restore();

    // outer frame
    ctx.strokeStyle = '#1c1f1f';
    ctx.lineWidth = frameW;
    ctx.strokeRect(left, top, openingW, openingH);

    // highlight
    ctx.strokeStyle = 'rgba(255,255,255,.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 4, top + 4, openingW - 8, openingH - 8);

    // tracks
    const trackY1 = bottom - (mobile ? 18 : 20);
    const trackY2 = bottom - (mobile ? 10 : 10);
    const trackInset = mobile ? 10 : 14;

    ctx.strokeStyle = 'rgba(23,25,24,.20)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left + trackInset, trackY1);
    ctx.lineTo(right - trackInset, trackY1);
    ctx.moveTo(left + trackInset, trackY2);
    ctx.lineTo(right - trackInset, trackY2);
    ctx.stroke();

    const leafW = openingW * 0.52;
    const fixedVisibleW = openingW * 0.48;
    const slideTravel = openingW - leafW - frameW * 0.7;

    // how HS opens:
    // 1) slight "lift" from gasket seal
    // 2) then horizontal sliding motion
    const liftPhase = Math.min(1, p / 0.14);
    const slidePhase = p <= 0.14 ? 0 : (p - 0.14) / 0.86;
    const liftOffset = lerp(0, mobile ? -6 : -8, easeOutCubic(liftPhase));
    const innerShadowAlpha = lerp(0, 0.12, liftPhase);

    const fixedX = right - fixedVisibleW - frameW * 0.4;
    const fixedY = top + innerFrame + 2;
    const paneH = openingH - innerFrame * 2 - 4;

    // opening void on the left when sliding
    if (p > 0.01) {
      const openW = slideTravel * easeOutCubic(slidePhase);
      const openFill = ctx.createLinearGradient(left + innerFrame + 2, top, left + openW + 60, bottom);
      openFill.addColorStop(0, 'rgba(248,248,245,.98)');
      openFill.addColorStop(0.55, 'rgba(232,232,228,.96)');
      openFill.addColorStop(1, 'rgba(219,219,215,.98)');
      ctx.fillStyle = openFill;
      ctx.fillRect(left + innerFrame + 2, top + innerFrame + 2, openW, openingH - innerFrame * 2 - 4);
    }

    // fixed panel: back track
    drawGlassPane(
      fixedX,
      fixedY,
      fixedVisibleW - innerFrame,
      paneH,
      mobile ? 5 : 6,
      0.82,
      '#222526'
    );

    // indicate frame of fixed leaf
    ctx.strokeStyle = '#26292a';
    ctx.lineWidth = mobile ? 5 : 6;
    ctx.strokeRect(
      fixedX,
      fixedY,
      fixedVisibleW - innerFrame,
      paneH
    );

    // stationary jamb / meeting style marker
    const meetingX = left + openingW * 0.51;
    ctx.fillStyle = 'rgba(23,25,24,.07)';
    ctx.fillRect(meetingX, top + innerFrame, mobile ? 1 : 1.25, openingH - innerFrame * 2);

    // active sliding sash on front track
    const activeClosedX = left + innerFrame + 1;
    const activeOpenX = activeClosedX + slideTravel;
    const activeX = lerp(activeClosedX, activeOpenX, easeOutCubic(slidePhase));
    const activeY = top + innerFrame + 2 + liftOffset;
    const activeW = leafW - innerFrame * 0.4;
    const activeH = paneH;

    // shadow under lifted sash
    if (liftPhase > 0.02) {
      ctx.fillStyle = `rgba(0,0,0,${innerShadowAlpha})`;
      ctx.fillRect(
        activeX + 12,
        activeY + activeH + 4,
        Math.max(0, activeW - 24),
        mobile ? 4 : 5
      );
    }

    // active sash glass and frame
    drawGlassPane(
      activeX,
      activeY,
      activeW,
      activeH,
      mobile ? 6 : 7,
      1,
      '#1b1e1f'
    );

    // additional sash frame
    ctx.strokeStyle = '#1b1e1f';
    ctx.lineWidth = mobile ? 6 : 7;
    ctx.strokeRect(activeX, activeY, activeW, activeH);

    // leading stile to show sash thickness
    ctx.fillStyle = 'rgba(18,20,20,.28)';
    ctx.fillRect(activeX + activeW - (mobile ? 7 : 8), activeY + 3, mobile ? 7 : 8, activeH - 6);

    // handle on active sash
    const handleX = activeX + (mobile ? 14 : 18);
    const handleY = activeY + activeH * 0.48 - (mobile ? 16 : 20);
    drawHandle(handleX, handleY, mobile ? 32 : 40, '#151717', true);

    // top gap when lifted
    if (liftPhase > 0.02) {
      const gapAlpha = lerp(0, 0.18, liftPhase);
      ctx.fillStyle = `rgba(0,0,0,${gapAlpha})`;
      ctx.fillRect(activeX + 10, activeY - 2, activeW - 20, 2);
    }

    // side depth cue showing sash on front track
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(activeX + 3, activeY + 3, 2, activeH - 6);

    // endpoints on bottom track
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
