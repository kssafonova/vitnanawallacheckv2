/* Быстрый калькулятор HS «Сколько стоит раздвижная дверь под ваш размер».
   Рисуется в любой [data-quick-calc]: карточка «Индивидуальный расчёт» в каталоге и на странице HS,
   блок «Под ваш проём» на странице товара HS.
   Цены — из data-refs (генератор кладёт туда цены моделей HS из data/products.json):
   цена модели × (площадь / площадь модели) × стеклопакет × цвет, округление вверх до 1000 ₽.
   Без JS вместо калькулятора остаётся ссылка на полный калькулятор. */
(() => {
  const fmt = n => new Intl.NumberFormat('ru-RU').format(n);
  const ceil1000 = v => Math.ceil(v / 1000) * 1000;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const W_MIN = 1400, H_MIN = 1800, H_MAX = 3100, LEAF_MIN = 720, LEAF_MAX = 3000;
  const OPEN = { 2: 1 / 2, 3: 2 / 3, 4: 1 / 2 };
  const recommend = w => (w <= 3300 ? 2 : w <= 4300 ? 3 : 4);
  const FILE_MAX = 15 * 1024 * 1024;
  const FILE_EXT = /\.(pdf|dwg|dxf|jpe?g|png|webp|heic|zip)$/i;

  const ICON = {
    info: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5"/><path d="M10 9v5M10 6.2v.1"/></svg>',
    clip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5 12.3 19.2a5 5 0 0 1-7.1-7.1l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/></svg>',
    check: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10.5 4 4 8-9"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5.5c0 4.3 2.9 7.8 7 9.5 4.1-1.7 7-5.2 7-9.5V6z"/></svg>',
    snow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5M3.7 11.2l3.4 1-1 3.3M20.3 12.8l-3.4-1 1-3.3M5.1 8.4l3.4.9-.9 3.4M18.9 15.6l-3.4-.9.9-3.4"/></svg>',
    ramp: '<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M4 28h40L14 6H4zM10 28 30 10M18 28l16-12M26 28l12-9"/></svg>',
    net: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="26" height="26"/><path d="M8 3v26M13 3v26M18 3v26M23 3v26M3 8h26M3 13h26M3 18h26M3 23h26"/></svg>',
  };
  const GLASS = [
    { k: 'standard', t: 'Стандарт 44', f: 1, icon: '<b>44</b>' },
    { k: 'safe', t: 'Безопасность', f: 1.14, icon: ICON.shield },
    { k: 'climate', t: 'Климат', f: 1.26, icon: ICON.snow, rec: true },
  ];
  // Цвета каталога (белый, антрацит) в одной цене — как в data/products.json; другой RAL дороже
  const COLORS = [
    { k: 'white', t: 'Белый', f: 1, sw: 'linear-gradient(135deg,#fbfaf7,#dcdad4)' },
    { k: 'anthracite', t: 'Антрацит', f: 1, sw: 'linear-gradient(135deg,#4a4f53,#25282b)' },
    { k: 'ral', t: 'Другой RAL', f: 1.09, sw: 'linear-gradient(135deg,#c9c3b6,#8d887d)' },
  ];
  const EXTRAS = [
    { k: 'threshold', t: 'Безбарьерный порог', icon: ICON.ramp },
    { k: 'net', t: 'Москитная система', icon: ICON.net },
  ];
  const leafWord = n => (n === 1 ? 'створка' : n < 5 ? 'створки' : 'створок');
  const leafIcon = n => `<svg class="qc__leaf-ico" viewBox="0 0 ${n * 14 + 2} 26" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<rect x="${1 + i * 14}" y="1" width="14" height="24"/>`).join('')}</svg>`;
  // мини-схема поверх фото: подвижные створки светлее (как бейджи на карточках)
  const MOVING = { 2: [1], 3: [1, 2], 4: [1, 2] };
  const photoScheme = n => {
    const w = 88 / n;
    const panes = Array.from({ length: n }, (_, i) => `<rect class="sm-pane${MOVING[n].includes(i) ? ' is-move' : ''}" x="${(6 + i * w).toFixed(1)}" y="8" width="${w.toFixed(1)}" height="40"/>`).join('');
    return `<svg class="scheme-mini" viewBox="0 0 100 56" aria-hidden="true"><rect class="sm-frame" x="6" y="8" width="88" height="40"/>${panes}</svg>`;
  };

  let uid = 0;

  function init(root) {
    if (root.dataset.ready) return;
    root.dataset.ready = '1';
    const d = root.dataset;
    let refs = {};
    try { refs = JSON.parse(d.refs || '{}'); } catch (_) { refs = {}; }
    const id = 'qc' + (++uid);
    const st = {
      w: +d.width || 3600,
      h: +d.height || 2300,
      n: +d.leaves || 0,
      glass: d.glass || 'climate',
      color: d.color || 'white',
      extras: new Set(),
      manualLeaves: !!d.leaves,
    };
    if (!st.n) st.n = recommend(st.w);

    const opt = (group, k, inner, on, extra = '') =>
      `<button type="button" class="qc__opt" data-${group}="${k}" aria-pressed="${on}"${extra}>${inner}</button>`;

    root.innerHTML = `
<form class="qc" novalidate>
  <header class="qc__head">
    ${d.eyebrow ? `<p class="qc__eyebrow">${esc(d.eyebrow)}</p>` : ''}
    <h2 class="qc__title">${esc(d.title || 'Сколько стоит раздвижная дверь под ваш размер')}</h2>
    <p class="qc__lead">Укажите примерную ширину и высоту проёма. Цену покажем сразу — без регистрации и без телефона.</p>
    <button type="button" class="qc__project" data-qc-project>${ICON.clip}<span><b>Уже есть проект или план?</b> Прикрепите файл — посчитаем по нему</span><i aria-hidden="true">→</i></button>
  </header>
  <div class="qc__grid">
    <div class="qc__steps">
      <div class="qc__step" role="group" aria-labelledby="${id}-s1">
        <div class="qc__legend"><span>01</span><b id="${id}-s1">Размер проёма</b><em>ширина × высота, мм <span class="qc__info" title="Примерный размер проёма в свету. Точный снимем на бесплатном замере.">${ICON.info}</span></em></div>
        <div class="qc__size">
          <label class="qc__num"><span>Ширина</span><input name="width" inputmode="numeric" autocomplete="off" maxlength="4" value="${st.w}" data-qc-w aria-describedby="${id}-hint"><i>мм</i></label>
          <label class="qc__num"><span>Высота</span><input name="height" inputmode="numeric" autocomplete="off" maxlength="4" value="${st.h}" data-qc-h aria-describedby="${id}-hint"><i>мм</i></label>
        </div>
        <p class="qc__hint" id="${id}-hint" data-qc-hint></p>
      </div>
      <div class="qc__step" role="group" aria-labelledby="${id}-s2">
        <div class="qc__legend"><span>02</span><b id="${id}-s2">Сколько створок</b></div>
        <div class="qc__leaves">${[2, 3, 4].map(n => `
          <button type="button" class="qc__leaf" data-leaves="${n}" aria-pressed="${n === st.n}">
            <span class="qc__rec">Рекомендуем</span>
            <span class="qc__leaf-top"><strong>${n}</strong>${leafIcon(n)}</span>
            <span class="qc__leaf-name">${leafWord(n)}</span>
            <span class="qc__leaf-open">≈ ${Math.round(OPEN[n] * 100)}% открытия</span>
          </button>`).join('')}
        </div>
      </div>
      <div class="qc__step" role="group" aria-labelledby="${id}-s3">
        <div class="qc__legend"><span>03</span><b id="${id}-s3">Стеклопакет</b></div>
        <div class="qc__opts">${GLASS.map(g => opt('glass', g.k,
          `<span class="qc__ico">${g.icon}</span><span class="qc__opt-t">${g.t}${g.rec ? '<small>рекомендуем</small>' : ''}</span><i class="qc__radio"></i>`, g.k === st.glass)).join('')}
        </div>
      </div>
      <div class="qc__step" role="group" aria-labelledby="${id}-s4">
        <div class="qc__legend"><span>04</span><b id="${id}-s4">Цвет</b></div>
        <div class="qc__opts">${COLORS.map(c => opt('color', c.k,
          `<span class="qc__sw" style="background:${c.sw}"></span><span class="qc__opt-t">${c.t}</span><i class="qc__radio"></i>`, c.k === st.color)).join('')}
        </div>
      </div>
      <div class="qc__step" role="group" aria-labelledby="${id}-s5">
        <div class="qc__legend"><span>05</span><b id="${id}-s5">Дополнительно</b></div>
        <div class="qc__extras">${EXTRAS.map(x => `
          <label class="qc__extra"><input type="checkbox" name="extra_${x.k}" data-extra="${x.k}"><i class="qc__box">${ICON.check}</i><span><b>${x.t}</b><small>По расчёту</small></span><span class="qc__extra-ico">${x.icon}</span></label>`).join('')}
        </div>
      </div>
    </div>

    <aside class="qc__summary">
      ${d.img ? `<div class="qc__photo"><img src="${esc(d.img)}" alt="" loading="lazy" decoding="async"><span class="qc__badge" data-qc-badge></span></div>` : ''}
      <div class="qc__conf"><small>Предварительная конфигурация</small><strong data-qc-conf></strong><span data-qc-confsub></span></div>
      <div class="qc__total">
        <div class="qc__price"><small>Ориентировочная стоимость</small><strong data-qc-price></strong><span>без доставки и монтажа</span></div>
        <button type="button" class="qc__cta" data-qc-cta aria-expanded="false" aria-controls="${id}-send">Получить точный расчёт <i aria-hidden="true">→</i></button>
      </div>
      <p class="qc__free">${ICON.check}<span><b>Замер — бесплатно.</b> Инженер приедет, проверит проём, порог и примыкание — и назовёт точную цену.</span></p>
      <p class="qc__note" data-qc-note></p>

      <div class="qc__send" id="${id}-send" data-qc-send hidden>
        <p class="qc__send-title">Точный расчёт и бесплатный замер</p>
        <p class="qc__send-lead">Оставьте телефон — инженер перезвонит, уточнит детали и договорится о замере. Если есть проект, прикрепите его: посчитаем по чертежам.</p>
        <label class="qc__field"><span>Имя</span><input name="name" autocomplete="name" required placeholder="Как к вам обращаться"></label>
        <label class="qc__field"><span>Телефон</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="+7 999 000-00-00"></label>
        <label class="qc__file" data-qc-filebox>
          <input type="file" name="project_file" accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.webp,.heic,.zip" data-qc-file>
          ${ICON.clip}<span><b data-qc-filename>Прикрепить проект</b><small>PDF, DWG, JPG, PNG или ZIP · до 15 МБ</small></span>
        </label>
        <label class="qc__field"><span>Комментарий</span><textarea name="comment" rows="2" placeholder="Стадия стройки, сроки, пожелания"></textarea></label>
        <input type="hidden" name="source" value="calculator">
        <input type="hidden" name="project" data-qc-summary>
        <input class="qc__hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button type="submit" class="qc__submit">Отправить заявку <i aria-hidden="true">→</i></button>
        <p class="qc__legal">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>
        <p class="qc__status" data-qc-status role="status" aria-live="polite"></p>
      </div>
    </aside>
  </div>
</form>`;

    const $ = s => root.querySelector(s);
    const $$ = s => [...root.querySelectorAll(s)];
    const form = $('form');
    const inW = $('[data-qc-w]'), inH = $('[data-qc-h]');
    const send = $('[data-qc-send]'), cta = $('[data-qc-cta]'), status = $('[data-qc-status]');
    const fileIn = $('[data-qc-file]'), fileName = $('[data-qc-filename]');

    const leafW = n => st.w / n;
    const leafOk = n => leafW(n) >= LEAF_MIN && leafW(n) <= LEAF_MAX;

    function calc() {
      const ref = refs[st.n];
      const sizeOk = st.w >= W_MIN && st.h >= H_MIN && st.h <= H_MAX;
      if (!ref || !sizeOk || !leafOk(st.n)) return null;
      const g = GLASS.find(x => x.k === st.glass), c = COLORS.find(x => x.k === st.color);
      return ceil1000(ref.price * (st.w * st.h) / (ref.w * ref.h) * g.f * c.f);
    }

    function summary(price) {
      const g = GLASS.find(x => x.k === st.glass), c = COLORS.find(x => x.k === st.color);
      const ex = EXTRAS.filter(x => st.extras.has(x.k)).map(x => x.t);
      return [
        `Проём: ${st.w} × ${st.h} мм`,
        `Створки: ${st.n} (HS · ${st.n} секции)`,
        `Стеклопакет: ${g.t}`,
        `Цвет: ${c.t}`,
        `Дополнительно: ${ex.length ? ex.join(', ') : 'нет'}`,
        `Ориентировочно: ${price ? fmt(price) + ' ₽ (без доставки и монтажа)' : 'по расчёту'}`,
        d.context ? `Откуда: ${d.context}` : '',
      ].filter(Boolean).join('\n');
    }

    function update() {
      const rec = recommend(st.w);
      $$('[data-leaves]').forEach(b => {
        const n = +b.dataset.leaves;
        b.setAttribute('aria-pressed', String(n === st.n));
        b.classList.toggle('is-rec', n === rec);
        b.classList.toggle('is-off', !leafOk(n));
      });
      $$('[data-glass]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.glass === st.glass)));
      $$('[data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === st.color)));

      const price = calc();
      const g = GLASS.find(x => x.k === st.glass), c = COLORS.find(x => x.k === st.color);
      $('[data-qc-conf]').textContent = `HS · ${st.n} секции`;
      $('[data-qc-confsub]').textContent = `${fmt(st.w)} × ${fmt(st.h)} мм · ${g.t} · ${c.t}`;
      $('[data-qc-price]').textContent = price ? `≈ ${fmt(price)} ₽` : 'По расчёту';
      const badge = $('[data-qc-badge]');
      if (badge) badge.innerHTML = photoScheme(st.n);

      let hint = '';
      if (st.w < W_MIN || st.h < H_MIN || st.h > H_MAX) hint = `Готовые конфигурации — от ${fmt(W_MIN)} мм в ширину и от ${fmt(H_MIN)} до ${fmt(H_MAX)} мм в высоту. Другой размер посчитаем индивидуально.`;
      else if (!leafOk(st.n)) hint = `При ширине ${fmt(st.w)} мм створка выйдет ${fmt(Math.round(leafW(st.n)))} мм — ${leafW(st.n) > LEAF_MAX ? 'слишком широкая' : 'слишком узкая'}. Лучше ${rec} ${leafWord(rec)}.`;
      $('[data-qc-hint]').textContent = hint;

      const extras = st.extras.size;
      $('[data-qc-note]').textContent = !price
        ? 'Для этого размера нужна инженерная проверка: подтвердим число створок, массу стекла и монтажный узел.'
        : extras
          ? 'Выбранные дополнительные опции в цену не входят — посчитаем их после проверки размеров и узла.'
          : 'Предварительная оценка. Точную цену подтверждаем после замера и проверки стеклопакета и монтажного узла.';
      $('[data-qc-summary]').value = summary(price);
    }

    const num = el => { el.value = el.value.replace(/\D+/g, '').slice(0, 4); return +el.value || 0; };
    inW.addEventListener('input', () => { st.w = num(inW); if (!st.manualLeaves) st.n = recommend(st.w); update(); });
    inH.addEventListener('input', () => { st.h = num(inH); update(); });
    root.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      if (b.dataset.leaves) { st.n = +b.dataset.leaves; st.manualLeaves = true; update(); }
      else if (b.dataset.glass) { st.glass = b.dataset.glass; update(); }
      else if (b.dataset.color) { st.color = b.dataset.color; update(); }
      else if ('qcCta' in b.dataset) openSend(true);
      else if ('qcProject' in b.dataset) { openSend(false); fileIn.click(); }
    });
    $$('[data-extra]').forEach(i => i.addEventListener('change', () => { i.checked ? st.extras.add(i.dataset.extra) : st.extras.delete(i.dataset.extra); update(); }));

    function openSend(focus) {
      send.hidden = false;
      cta.setAttribute('aria-expanded', 'true');
      cta.classList.add('is-open');
      send.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (focus) setTimeout(() => $('[name=name]').focus({ preventScroll: true }), 350);
    }

    fileIn.addEventListener('change', () => {
      const f = fileIn.files[0];
      status.textContent = '';
      status.classList.remove('is-error');
      if (!f) { fileName.textContent = 'Прикрепить проект'; root.querySelector('[data-qc-filebox]').classList.remove('has-file'); return; }
      if (f.size > FILE_MAX || !FILE_EXT.test(f.name)) {
        fileIn.value = '';
        fileName.textContent = 'Прикрепить проект';
        status.textContent = f.size > FILE_MAX ? 'Файл больше 15 МБ — сожмите его или пришлите ссылку в комментарии.' : 'Этот формат не принимаем: подойдут PDF, DWG, JPG, PNG или ZIP.';
        status.classList.add('is-error');
        return;
      }
      fileName.textContent = f.name;
      root.querySelector('[data-qc-filebox]').classList.add('has-file');
      update();
      openSend(false);
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const nameIn = form.querySelector('[name=name]'), phoneIn = form.querySelector('[name=phone]');
      const name = nameIn.value.trim(), phone = phoneIn.value.replace(/\D+/g, '');
      status.classList.remove('is-error', 'is-ok');
      if (!name || phone.length < 10) {
        status.textContent = 'Укажите имя и телефон — без них инженер не сможет связаться.';
        status.classList.add('is-error');
        (name ? phoneIn : nameIn).focus();
        return;
      }
      update();
      const btn = form.querySelector('.qc__submit');
      btn.disabled = true;
      status.textContent = 'Отправляем…';
      try {
        const res = await fetch(d.endpoint || 'forms/send.php', { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.message || 'send');
        form.classList.add('is-sent');
        status.classList.add('is-ok');
        status.textContent = 'Заявка отправлена. Инженер перезвонит в рабочее время и договорится о бесплатном замере.';
      } catch (err) {
        status.classList.add('is-error');
        status.innerHTML = `Не получилось отправить${err.message && err.message !== 'send' ? ': ' + esc(err.message) : ''}. Позвоните нам: <a href="tel:+79774102479">+7 977 410-24-79</a>`;
        btn.disabled = false;
      }
    });

    update();
  }

  // Карточка «Индивидуальный расчёт»: по нажатию разворачивается на всю ширину ряда, внутри — калькулятор
  document.querySelectorAll('[data-calc-card]').forEach(card => {
    const open = card.querySelector('[data-calc-open]');
    const panel = card.querySelector('[data-calc-panel]');
    const close = card.querySelector('[data-calc-close]');
    if (!open || !panel) return;
    const setOpen = on => {
      card.classList.toggle('is-open', on);
      panel.hidden = !on;
      open.setAttribute('aria-expanded', String(on));
      if (on) {
        const calc = panel.querySelector('[data-quick-calc]');
        if (calc) init(calc);
        requestAnimationFrame(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      } else {
        open.focus({ preventScroll: true });
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
    open.addEventListener('click', e => { e.preventDefault(); setOpen(true); });
    close && close.addEventListener('click', () => setOpen(false));
    if (card.id && location.hash === '#' + card.id) setOpen(true);
  });

  // Калькуляторы вне карточек (страница товара) — сразу
  document.querySelectorAll('[data-quick-calc]').forEach(el => { if (!el.closest('[data-calc-panel]')) init(el); });
})();
