// Семейная PDP HS / FS: один конфигуратор поверх общей инженерной модели PSPortal.
// Статические SKU остаются отдельными SEO-страницами и подхватываются здесь как точные совпадения.
(() => {
  const root = document.querySelector('[data-family-product]');
  const raw = document.getElementById('family-config');
  const P = window.PSPortal;
  if (!root || !raw || !P) return;

  let cfg;
  try { cfg = JSON.parse(raw.textContent); } catch (_) { return; }
  const CONFIG_PARAMS = ['w', 'h', 'n', 'scheme', 'color', 'glass'];
  const q = new URLSearchParams(location.search);
  const hadLegacyConfig = CONFIG_PARAMS.some(key => q.has(key));
  const num = (key, fallback) => { const value = parseInt(q.get(key), 10); return Number.isFinite(value) && value > 0 ? value : fallback; };
  const allowedValue = (value, list, fallback) => list.includes(value) ? value : fallback;
  const st = {
    w: num('w', cfg.default.w), h: num('h', cfg.default.h), n: num('n', cfg.default.n),
    scheme: q.get('scheme') || cfg.default.scheme,
    color: allowedValue(q.get('color'), [...cfg.colors.map(c => c.slug), 'ral'], cfg.default.color),
    glass: allowedValue(q.get('glass'), P.GLASS.map(g => g.k), cfg.default.glass),
  };
  let open = false;

  const $ = selector => root.querySelector(selector);
  const $$ = selector => [...root.querySelectorAll(selector)];
  const money = n => new Intl.NumberFormat('ru-RU').format(Math.round(n)) + '\u00a0₽';
  const fmt = n => new Intl.NumberFormat('ru-RU').format(Math.round(n));
  const sectionWord = n => n === 1 ? 'секция' : n >= 2 && n <= 4 ? 'секции' : 'секций';
  const glassName = key => ({ base: 'Базовый', standard: 'Стандарт', triplex: 'Триплекс', solar: 'Solar' }[key] || key);
  const glassBenefit = key => ({
    base: 'Базовая комплектация', standard: 'Повышенная энергоэффективность',
    triplex: 'Дополнительная безопасность', solar: 'Защита от перегрева и бликов',
  }[key] || '');
  const colorName = () => st.color === 'ral' ? 'Любой однотонный RAL' : (cfg.colors.find(c => c.slug === st.color)?.name || st.color) + (cfg.colors.find(c => c.slug === st.color)?.ral ? ` RAL ${cfg.colors.find(c => c.slug === st.color).ral}` : '');
  const configHeading = () => {
    if (cfg.type === 'FS') return st.scheme === 'FS-2' ? 'Створки расходятся к краям — проём открыт почти полностью.' : 'Створки складываются у края — больше открытого пространства.';
    return ({ 2: 'Одна активная створка — лаконичный широкий проход.', 3: 'Две активные створки — больше открытого пространства.', 4: 'Открывание из центра — симметричный широкий проход.', 6: 'Каскадное открывание — максимум панорамы.' }[st.n] || 'Панорамная система, настроенная под ваш проём.');
  };
  const layoutSummary = () => {
    const leaves = P.layout(cfg.type, st.n, st.scheme);
    const active = leaves.filter(leaf => leaf.kind !== 'fix').length;
    const fixed = leaves.length - active;
    return `${active} ${active === 1 ? 'активная' : 'активные'}${fixed ? ` / ${fixed} ${fixed === 1 ? 'глухая' : 'глухие'}` : ''}`;
  };

  const width = $('[data-family-width]'), height = $('[data-family-height]');
  const status = $('[data-family-status]'), buy = $('[data-family-buy]'), buyMobile = $('[data-family-buy-mobile]');
  const sectionBox = $('[data-family-sections]'), widthBox = $('[data-family-widths]'), schemeBox = $('[data-family-schemes]'), colorBox = $('[data-family-colors]'), glassBox = $('[data-family-glasses]');
  const schemeDrawingEl = $('[data-family-scheme-drawing]');
  const schemeDrawing = schemeDrawingEl && window.PSOpening
    ? window.PSOpening.mount(schemeDrawingEl, { type: cfg.type, w: st.w, h: st.h, n: st.n, scheme: st.scheme, presentation: true })
    : null;
  $('[data-family-interior-link]')?.addEventListener('click', event => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = document.getElementById('family-interiors');
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const sections = () => {
    const base = P.sectionsFor(cfg.type, st.w);
    const exact = cfg.ready.filter(v => v.w === st.w && v.h === st.h).map(v => v.n);
    return { list: [...new Set([...base.list, ...exact])].sort((a, b) => a - b), rec: base.rec };
  };
  const fixState = () => {
    const s = sections();
    if (!s.list.includes(st.n)) st.n = s.list.includes(s.rec) ? s.rec : s.list[0];
    const schemes = P.schemesFor(cfg.type, st.n);
    if (!schemes.some(x => x.code === st.scheme)) st.scheme = schemes[0]?.code || '';
    if (P.triplexForced(st.w, st.h, st.n)) st.glass = 'triplex';
  };
  const exactVariant = () => cfg.ready.find(v => v.w === st.w && v.h === st.h && v.n === st.n && v.scheme === st.scheme && v.color === st.color);
  const sourceVariant = () => exactVariant() || cfg.ready.find(v => v.n === st.n && v.color === st.color) || cfg.ready.find(v => v.n === st.n) || cfg.ready[0];
  const model = () => cfg.models[st.n] || cfg.models[Object.keys(cfg.models).sort((a, b) => Math.abs(a - st.n) - Math.abs(b - st.n))[0]];

  const renderSections = () => {
    const options = sections();
    sectionBox.innerHTML = options.list.map(n => `<button class="family-option${n === st.n ? ' is-active' : ''}" type="button" data-family-section="${n}" aria-pressed="${n === st.n}"><b>${n} ${sectionWord(n)}${n === options.rec ? '<span class="family-option__rec">рекомендуем</span>' : ''}</b><small>створка ≈ ${fmt(st.w / n)} мм</small></button>`).join('');
  };
  const renderWidths = () => {
    const readyWidths = [...new Set(cfg.ready.filter(v => v.n === st.n).map(v => v.w))].sort((a, b) => a - b);
    const custom = !readyWidths.includes(st.w);
    widthBox.innerHTML = readyWidths.map(w => `<button class="family-width${w === st.w ? ' is-active' : ''}" type="button" data-family-ready-width="${w}" aria-pressed="${w === st.w}">${(w / 1000).toFixed(1).replace('.', ',')} м</button>`).join('') + `<button class="family-width family-width--custom${custom ? ' is-active' : ''}" type="button" data-family-custom-width aria-pressed="${custom}">Свой размер</button>`;
  };
  const renderSchemes = () => {
    const list = P.schemesFor(cfg.type, st.n);
    schemeBox.innerHTML = list.map(s => `<button class="family-option${s.code === st.scheme ? ' is-active' : ''}" type="button" data-family-scheme="${s.code}" aria-pressed="${s.code === st.scheme}"><b>${s.t}</b><small>${s.code}</small></button>`).join('');
    const active = list.find(s => s.code === st.scheme) || list[0];
    $('[data-family-scheme-copy]').textContent = active?.d || '';
  };
  const renderColors = () => {
    colorBox.innerHTML = cfg.colors.map(c => `<button class="family-color${c.slug === st.color ? ' is-active' : ''}" type="button" data-family-color="${c.slug}" aria-pressed="${c.slug === st.color}"><i style="--sw:${c.hex}"></i><span><b>${c.name}</b><small>RAL ${c.ral}</small></span></button>`).join('') + `<button class="family-color family-color--ral${st.color === 'ral' ? ' is-active' : ''}" type="button" data-family-color="ral" aria-pressed="${st.color === 'ral'}"><i></i><span><b>Любой RAL</b><small>включён в стоимость</small></span></button>`;
  };
  const renderGlass = forced => {
    glassBox.innerHTML = P.GLASS.map(g => `<button class="family-glass-option${g.k === st.glass ? ' is-active' : ''}" type="button" data-family-glass="${g.k}" aria-pressed="${g.k === st.glass}"${forced && g.k !== 'triplex' ? ' disabled' : ''}><strong>${g.t}</strong><small>${forced && g.k === 'triplex' ? 'Обязателен для выбранного размера створки' : glassBenefit(g.k)}</small></button>`).join('');
    $('[data-family-glass-label]').textContent = glassName(st.glass);
  };
  const clearAction = button => {
    button.removeAttribute('data-add-to-cart'); button.removeAttribute('data-add-to-project');
    ['sku','cartHref','cartSourceSku','cartGlass','cartGlassLabel','cartPrice','cartTerm','cartConfig','cartColor','familyProject'].forEach(key => delete button.dataset[key]);
    button.classList.remove('is-in-cart', 'is-in-project');
  };
  const setAction = (button, item, direct, exact, custom) => {
    clearAction(button);
    if (direct) {
      const defaultGlass = P.triplexForced(st.w, st.h, st.n) ? 'triplex' : 'base';
      const source = exact?.sku || item.sourceSku;
      button.setAttribute('data-add-to-cart', '');
      button.dataset.sku = exact && st.glass === defaultGlass && st.color !== 'ral' ? source : `CUSTOM:${source}:${st.w}x${st.h}:${st.n}:${st.scheme}:${st.glass}:${st.color}`;
      button.dataset.cartSourceSku = source; button.dataset.cartHref = cfg.cartHref;
      button.dataset.cartGlass = st.glass; button.dataset.cartGlassLabel = glassName(st.glass);
      button.dataset.cartPrice = String(item.price); button.dataset.cartTerm = item.term;
      if (custom) button.dataset.cartConfig = JSON.stringify(item);
      if (st.color === 'ral') button.dataset.cartColor = item.color;
      button.dataset.cartLabel = 'В корзину'; button.dataset.cartAddedLabel = 'В корзине';
      button.innerHTML = 'В корзину <span>+</span>';
    } else {
      // Срок больше 45 дней — не корзина, а проект: кнопка ведёт к форме инженеру, параметры уже в заявке
      button.dataset.familyProject = '';
      button.innerHTML = 'Отправить проект инженеру <span>→</span>';
    }
  };
  const cleanConfigUrl = () => {
    const next = new URL(location.href);
    CONFIG_PARAMS.forEach(key => next.searchParams.delete(key));
    const query = next.searchParams.toString();
    history.replaceState({ psConfig: { ...st } }, '', `${next.pathname}${query ? `?${query}` : ''}${next.hash}`);
  };

  const render = () => {
    const check = P.validate(cfg.type, st.w, st.h);
    status.classList.toggle('is-error', !check.ok);
    if (!check.ok) { status.textContent = check.errors[0]; return false; }
    fixState();
    const forced = P.triplexForced(st.w, st.h, st.n);
    st.glass = P.glassFor(st.w, st.h, st.n, st.glass);
    const exact = exactVariant(), source = sourceVariant();
    const readyWidths = cfg.ready.filter(v => v.n === st.n).map(v => v.w);
    const customWidth = !readyWidths.includes(st.w), customHeight = st.h !== 2300;
    const price = P.price({ type: cfg.type, w: st.w, h: st.h, n: st.n, scheme: st.scheme, glass: st.glass, color: 'mono', handle: 'standard', customHeight });
    if (!price) { status.textContent = 'Эту конфигурацию нельзя рассчитать. Измените размер или количество секций.'; status.classList.add('is-error'); return false; }
    const days = P.days(cfg.type, st.glass, customWidth, customHeight), direct = days <= 45;
    const passage = P.passage(cfg.type, st.w, st.n, st.scheme), ratio = Math.round(passage / st.w * 100);
    const currentScheme = P.schemeOf(cfg.type, st.n, st.scheme);
    const currentModel = model();
    const custom = !exact || st.glass !== (exact?.triplex ? 'triplex' : 'base') || st.color === 'ral';
    const item = {
      sku: exact?.sku || `FAMILY-${cfg.type}-${st.n}`, sourceSku: source.sku, system: cfg.type, model: currentModel.model,
      code: exact?.code || `${cfg.type}${st.n}/${Math.round(st.w / 100)}`, name: cfg.type === 'HS' ? 'Подъёмно-сдвижной портал' : 'Складная дверь-гармошка',
      width: st.w, height: st.h, sections: st.n, scheme: currentScheme?.t || st.scheme, schemeCode: st.scheme,
      color: colorName(), glass: st.glass, glassLabel: glassName(st.glass), price,
      image: exact?.image || currentModel.image || source.image,
      url: new URL(exact && !custom ? exact.url : cfg.familyHref, location.href).href,
      custom, term: `до ${days} дней`,
    };

    renderSections(); renderWidths(); renderSchemes(); renderColors(); renderGlass(forced);
    schemeDrawing?.set({ type: cfg.type, w: st.w, h: st.h, n: st.n, scheme: st.scheme });
    width.value = st.w; height.value = st.h;
    $$('[data-family-price],[data-family-price-copy],[data-family-mobile-price]').forEach(el => el.textContent = (custom ? '≈ ' : '') + money(price));
    $('[data-family-term]').textContent = `Срок — до ${days} дней`;
    $('[data-family-term-copy]').textContent = `Срок изготовления — до ${days} дней`;
    $('[data-family-mode]').textContent = direct ? 'Можно оформить заказ онлайн' : 'Требуется проверка инженером';
    $('[data-family-passage]').textContent = `≈ ${ratio}% проёма`;
    $('[data-family-sections-summary]').textContent = `${st.n} ${sectionWord(st.n)}`;
    $('[data-family-visual-name]').textContent = `${st.n} ${sectionWord(st.n)} · ${fmt(st.w)} × ${fmt(st.h)} мм`;
    $('[data-family-result-size]').textContent = `${fmt(st.w)} × ${fmt(st.h)} мм`;
    $('[data-family-result-scheme]').textContent = `${currentScheme?.t || st.scheme} · ${st.scheme}`;
    $('[data-family-result-passage]').textContent = `≈ ${fmt(passage)} мм · ${ratio}% проёма`;
    $('[data-family-sections-summary-spec]').textContent = `${st.n} ${sectionWord(st.n)}`;
    $('[data-family-frame]').textContent = `${P.frameDepth(cfg.type, st.n, st.scheme)} мм`;
    $('[data-family-tech-glass]').textContent = glassName(st.glass);
    $('[data-family-leaf]').textContent = `≈ ${fmt(st.w / st.n)} мм`;
    $('[data-family-tech-status]').textContent = exact && !custom ? 'Готовая конфигурация' : 'Изготовление под проект';
    $('[data-family-config-heading]').textContent = configHeading();
    const how = currentScheme?.d ? `${currentScheme.d}.` : '';
    $('[data-family-config-copy]').textContent = cfg.type === 'HS'
      ? `${st.n}-секционный HS-портал для панорамного выхода. ${how} Схема, размер и цвет меняются вместе с настройками выше.`
      : `${st.n}-секционная складная система FS освобождает большую часть проёма. ${how} Схема, размер и цвет меняются вместе с настройками выше.`;
    $('[data-family-config-size]').textContent = `${fmt(st.w)} × ${fmt(st.h)} мм`;
    $('[data-family-config-layout]').textContent = layoutSummary();
    $('[data-family-config-scheme]').textContent = `${st.scheme} · ${currentScheme?.t || ''}`;
    $('[data-family-config-how]').textContent = currentScheme?.d || '';
    $('[data-family-config-color]').textContent = colorName();
    $('[data-family-main-title]').textContent = cfg.type === 'HS' ? `Раздвижная портальная дверь ${(st.w / 1000).toFixed(1).replace('.', ',')} м` : `Складная дверь-гармошка ${(st.w / 1000).toFixed(1).replace('.', ',')} м`;
    $('[data-family-subtitle]').textContent = `${(st.w / 1000).toFixed(1).replace('.', ',')} м · ${st.n} ${sectionWord(st.n)} · ${currentScheme?.t || st.scheme} · ${glassName(st.glass)}`;
    status.textContent = exact && !custom ? 'Найдена готовая конфигурация из каталога.' : (check.warnings[0] || 'Размер принят. Стоимость и срок обновлены.');
    status.classList.remove('is-error');

    setAction(buy, item, direct, exact, custom); setAction(buyMobile, item, direct, exact, custom);
    const form = document.querySelector('#product-contact lead-form');
    if (form && form.setProject) form.setProject([
      `${item.name} ${item.code}${exact && !custom ? ` (артикул ${exact.sku})` : ' — индивидуальная конфигурация'}`,
      `Проём: ${fmt(st.w)} × ${fmt(st.h)} мм · ${st.n} ${sectionWord(st.n)} · схема ${st.scheme}`,
      `Цвет: ${item.color} · стеклопакет: ${item.glassLabel}`,
      `Цена: ${money(price)} (предварительно, без доставки и монтажа) · срок до ${days} дней`,
    ].join('\n'));

    const renderImage = $('[data-family-render]'), renderOpen = $('[data-family-render-open]'), openButton = $('[data-family-state="open"]');
    const renderSlide = $('[data-family-render-slide]'), hasDynamic3d = renderSlide?.hasAttribute('data-family-3d');
    const closedImage = exact?.hasPhoto ? exact.image : (currentModel.image || source.image);
    const openImage = exact?.hasPhoto ? exact.open : '';
    renderImage.src = closedImage; renderOpen.src = openImage;
    openButton.hidden = !openImage && !hasDynamic3d; if (!openImage && !hasDynamic3d) open = false;
    $('[data-family-render-slide]').classList.toggle('is-open', open && !!openImage);
    $$('[data-family-state]').forEach(button => { const on = button.dataset.familyState === (open ? 'open' : 'closed'); button.classList.toggle('is-active', on); button.setAttribute('aria-pressed', String(on)); });
    if (renderSlide) {
      const selectedColor = cfg.colors.find(c => c.slug === st.color) || cfg.colors[0];
      let seed = {}; try { seed = JSON.parse(renderSlide.dataset['3d'] || '{}'); } catch (_) {}
      seed = { ...seed, dynamic: true, sys: cfg.type, w: st.w, h: st.h, n: st.n, scheme: st.scheme, color: st.color, hex: selectedColor?.hex || '#383b3a' };
      renderSlide.dataset['3d'] = JSON.stringify(seed);
      renderSlide.dispatchEvent(new CustomEvent('ps-card-variant', { detail: { type: cfg.type, w: st.w, h: st.h, n: st.n, s: st.scheme, c: st.color, hex: seed.hex } }));
      renderSlide.dispatchEvent(new CustomEvent('ps-family-state', { detail: { open } }));
    }

    window.dispatchEvent(new CustomEvent('ps-cart-change'));
    return true;
  };

  $('[data-family-apply-size]').addEventListener('click', () => {
    const nextW = +width.value, nextH = +height.value, check = P.validate(cfg.type, nextW, nextH);
    if (!check.ok) { status.textContent = check.errors[0]; status.classList.add('is-error'); return; }
    st.w = nextW; st.h = nextH; render();
  });
  [width, height].forEach(input => input.addEventListener('keydown', event => { if (event.key === 'Enter') $('[data-family-apply-size]').click(); }));
  root.addEventListener('click', event => {
    const section = event.target.closest('[data-family-section]');
    const scheme = event.target.closest('[data-family-scheme]');
    const color = event.target.closest('[data-family-color]');
    const glass = event.target.closest('[data-family-glass]');
    const state = event.target.closest('[data-family-state]');
    const readyWidth = event.target.closest('[data-family-ready-width]');
    const customWidth = event.target.closest('[data-family-custom-width]');
    if (section) { st.n = +section.dataset.familySection; st.scheme = ''; render(); }
    else if (readyWidth) { st.w = +readyWidth.dataset.familyReadyWidth; width.value = st.w; render(); }
    else if (customWidth) { width.focus(); width.select(); }
    else if (scheme) { st.scheme = scheme.dataset.familyScheme; render(); }
    else if (color) { st.color = color.dataset.familyColor; render(); }
    else if (glass && !glass.disabled) { st.glass = glass.dataset.familyGlass; render(); }
    else if (state) { open = state.dataset.familyState === 'open'; render(); }
  });
  document.addEventListener('click', event => {
    const project = event.target.closest('[data-family-project]');
    if (!project) return;
    document.getElementById('product-contact')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  customElements.whenDefined('lead-form').then(() => requestAnimationFrame(render));

  render();
  if (hadLegacyConfig) cleanConfigUrl();
})();
