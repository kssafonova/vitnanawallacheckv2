/* До / после (.ba[data-ba], главная): линия между кадрами — невидимый <input type="range"> поверх блока,
   поэтому работают мышь, палец (вертикальная прокрутка не блокируется) и клавиатура.
   При первом появлении в кадре блок раскрывается (классы is-pre → is-in), затем линия сама уходит от края к середине.
   prefers-reduced-motion — без анимации. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-ba]').forEach(ba => {
    const range = ba.querySelector('[data-ba-range]');
    let touched = false;
    const set = v => ba.style.setProperty('--pos', v + '%');
    const onInput = () => { touched = true; set(range.value); };
    range.addEventListener('input', onInput);
    // стрелки — заметный шаг (у ползунка шаг 0,1 для плавного перетаскивания)
    range.addEventListener('keydown', e => {
      const d = { ArrowLeft: -4, ArrowDown: -4, ArrowRight: 4, ArrowUp: 4, PageDown: -20, PageUp: 20 }[e.key];
      const abs = { Home: 0, End: 100 }[e.key];
      if (d == null && abs == null) return;
      e.preventDefault();
      range.value = abs ?? Math.max(0, Math.min(100, +range.value + d)); onInput();
    });
    set(range.value);
    if (reduced || !('IntersectionObserver' in window)) return;
    ba.classList.add('is-pre');
    set(82); range.value = 82;
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      requestAnimationFrame(() => { ba.classList.add('is-in'); ba.classList.remove('is-pre'); });
      // подсказка: линия уезжает к середине после раскрытия кадра
      setTimeout(() => {
        if (touched) return;
        const from = 82, to = 50, dur = 1300, t0 = performance.now();
        const ease = t => 1 - Math.pow(1 - t, 3);
        const step = now => {
          if (touched) return;
          const k = Math.min(1, (now - t0) / dur), v = from + (to - from) * ease(k);
          set(v.toFixed(2)); range.value = v;
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, 1000);
    }, { threshold: 0.35 });
    io.observe(ba);
  });
})();
