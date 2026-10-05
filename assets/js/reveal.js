/* Появление блоков при прокрутке — как на vitrocsa.com: заголовки, тексты, карточки и фото мягко поднимаются
   и проявляются, когда доходят до экрана; элементы одного ряда — с небольшой задержкой друг за другом, фото — с лёгким
   «наездом» камеры (масштаб 1,06 → 1). Подключается на всех страницах из <site-menu> (site-menu.js).
   Без JS, при prefers-reduced-motion и в браузерах без IntersectionObserver всё видно сразу.
   Отключить для блока — атрибут data-no-reveal на нём или на секции. Стили — .rv / .rv-img в components.css. */
(() => {
  if (window.__psReveal) return;
  window.__psReveal = true;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  const main = document.querySelector('main');
  if (!main) return;

  // Ряды однотипных элементов — каждый появляется отдельно, по очереди
  const ITEMS = [
    '.m-card', '.project', '.faq-list__item', '.tl > li', '.split-list li', '.dims > li', '.hs-intro__list > li',
    '.cta-rows > li', '.hs-make__item', '.hsx-stat', '.hs-home-process__steps > article', '.home-process li',
    '.family-tech__grid > div', '.family-interiors figure', '.pg-rows > div', '.pj-grid > *', '.sysx-item',
    '.hs-ral > li', '.cart-item',
  ].join(',');
  // Обёртки секций — анимируем их детей, а не саму обёртку
  const WRAP = /(^|\s)(wrap|ui-wrap|hs-container|p-wrap|w)(\s|$)/;
  // Не трогаем: крошки, мини-меню, служебные и интерактивные сцены с собственными координатами
  const SKIP = 'nav.crumbs, .crumbs, .hs-localnav, script, style, template, [hidden], [data-no-reveal], .calc-legacy, .gm-hero, .gm-stage, .gm-scene, [data-gm-reveal], .family-hero, .hs-mobile-cta, .family-mobile-buy, .mobile-buy';
  const IMG_WRAP = '.project, .pg-split__media, .family-interiors figure, .hs-home-contact__media, .home-contact__media';

  const tagged = new Set();
  const tag = (el, i = 0) => {
    if (tagged.has(el) || el.closest(SKIP)) return;
    tagged.add(el);
    el.classList.add('rv');
    if (i) el.style.setProperty('--rv-i', Math.min(i, 6));
  };

  // 1) ряды: дети одного родителя — по очереди
  const groups = new Map();
  main.querySelectorAll(ITEMS).forEach(el => {
    if (el.closest(SKIP) || el.parentElement.closest(ITEMS)) return;
    const p = el.parentElement;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(el);
  });
  groups.forEach(list => list.forEach((el, i) => tag(el, i)));

  // 2) крупные блоки секций: заголовки, абзацы, сетки — дети обёртки секции (если внутри нет уже размеченных рядов)
  const blocks = el => {
    const kids = [...el.children].filter(c => !c.matches(SKIP));
    if (kids.length === 1 && WRAP.test(kids[0].className || '')) return blocks(kids[0]);
    return kids;
  };
  main.querySelectorAll(':scope > section, :scope > header, :scope > div:not([hidden]), :scope > article').forEach(sec => {
    if (sec.matches(SKIP)) return;
    const kids = WRAP.test(sec.className || '') ? [...sec.children] : blocks(sec);
    let i = 0;
    kids.forEach(k => {
      if (k.matches(SKIP) || tagged.has(k)) return;
      // внутри уже есть ряд — заголовки и тексты рядом с ним анимируем, а сам контейнер ряда оставляем
      if ([...tagged].some(t => k.contains(t))) {
        const inner = WRAP.test(k.className || '') || k.children.length < 8 ? [...k.children] : [];
        inner.forEach(c => { if (!tagged.has(c) && ![...tagged].some(t => c.contains(t))) tag(c, i++); });
        return;
      }
      tag(k, i++);
    });
  });

  // 3) фото: лёгкий «наезд» при появлении
  main.querySelectorAll(IMG_WRAP).forEach(el => { if (!el.closest(SKIP)) el.classList.add('rv-img'); });

  document.documentElement.classList.add('rv-on');
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    io.unobserve(en.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  tagged.forEach(el => io.observe(el));
  main.querySelectorAll('.rv-img').forEach(el => { if (!tagged.has(el)) io.observe(el); });

  // Быстрая прокрутка (колесо, якорь, «Наверх») может проскочить блок между кадрами — всё, что уже выше низа экрана,
  // проявляем по scroll (раз в кадр; список уменьшается, пока не опустеет)
  let pending = [...tagged, ...main.querySelectorAll('.rv-img')], raf = 0;
  const sweep = () => {
    raf = 0;
    const h = innerHeight;
    pending = pending.filter(el => {
      if (el.classList.contains('is-in')) return false;
      if (el.getBoundingClientRect().top < h * .92) { el.classList.add('is-in'); io.unobserve(el); return false; }
      return true;
    });
    if (!pending.length) removeEventListener('scroll', onScroll);
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(sweep); };
  addEventListener('scroll', onScroll, { passive: true });

  // Переход по якорю или печать — показываем всё сразу, чтобы не было пустых мест
  const showAll = () => document.querySelectorAll('.rv:not(.is-in), .rv-img:not(.is-in)').forEach(el => el.classList.add('is-in'));
  addEventListener('beforeprint', showAll);
  // Подстраховка: если блок так и не попал в наблюдение (скрытая вкладка, нестандартная прокрутка) — через 6 с показываем
  setTimeout(() => document.querySelectorAll('.rv:not(.is-in)').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0) el.classList.add('is-in');
  }), 6000);
})();
