/* <site-menu> — шапка сайта (Shadow DOM, атрибут data-base — путь до корня).
   Как на vitrocsa.com: логотип в рамке из вертикальных линий; на телефоне — меню во весь экран на чёрном: логотип и белая
   квадратная кнопка «×», строка поиска, крупные пункты прописными, вложенные раскрываются «⌄ / ⌃». На компьютере — те же
   разделы в строку, вложенные — выпадающим списком. Пункты — в MENU, поиск — по MENU и SEARCH_EXTRA. */
(() => {
  const normBase = value => { const base = (value || './').trim(); return base.endsWith('/') ? base : base + '/'; };
  const MENU = [
    { t: 'Системы', sub: [['HS · подъёмно-раздвижные', 'systems/hs/'], ['FS · складные', 'systems/fs/'], ['Панорамное остекление', 'index.html#systems'], ['Калькулятор стоимости', 'raschet/']] },
    { t: 'Каталог', href: 'catalog/' },
    { t: 'Проекты', href: 'projects/' },
    { t: 'Компания', sub: [['О компании', 'about/'], ['Почему мы', 'about/#why'], ['Реквизиты', 'about/#requisites']] },
    { t: 'Покупателям', sub: [['Калькулятор стоимости', 'raschet/'], ['Корзина', 'cart/'], ['Самовывоз с производства', 'contacts/#pickup'], ['Вопросы и ответы', 'index.html#faq']] },
    { t: 'Контакты', href: 'contacts/' },
  ];
  // Дополнительные слова для поиска: [название, адрес, ключевые слова]
  const SEARCH_EXTRA = [
    ['Раздвижная дверь 3,0 м · HS/30', 'catalog/#hs', 'hs30 3000 две створки готовая цена купить'],
    ['Раздвижная дверь 3,6 м · HS/36', 'catalog/#hs', 'hs36 3600 три створки готовая цена купить'],
    ['Раздвижная дверь 4,8 м · HS/48', 'catalog/#hs', 'hs48 4800 четыре створки от центра готовая цена купить'],
    ['Складные двери FS', 'catalog/#fs', 'fs гармошка складная скоро'],
    ['Доставка и монтаж', 'cart/', 'доставка монтаж установка стоимость'],
    ['Адрес производства', 'contacts/', 'адрес производство тинао краснопахорский карта маршрут телефон'],
    ['Замер бесплатно', 'contacts/#write', 'замер заявка инженер позвонить'],
    ['Индивидуальный заказ', 'raschet/', 'свой размер нестандартный расчёт цена'],
  ];

  class SiteMenu extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      const base = normBase(this.dataset.base), root = this.attachShadow({ mode: 'open' });
      const u = h => base + h;
      const desk = MENU.map(m => m.sub
        ? `<div class="dd"><button type="button" class="dd__btn" aria-expanded="false">${m.t}<i aria-hidden="true"></i></button><div class="dd__panel">${m.sub.map(([t, h]) => `<a href="${u(h)}">${t}</a>`).join('')}</div></div>`
        : `<a class="nav__a" href="${u(m.href)}">${m.t}</a>`).join('');
      const mob = MENU.map((m, i) => m.sub
        ? `<li><button type="button" class="big" aria-expanded="false" aria-controls="sm${i}">${m.t}<i aria-hidden="true"></i></button><div class="subs" id="sm${i}" hidden>${m.sub.map(([t, h]) => `<a href="${u(h)}">${t}</a>`).join('')}</div></li>`
        : `<li><a class="big" href="${u(m.href)}">${m.t}</a></li>`).join('');
      const index = [...MENU.flatMap(m => m.sub ? m.sub.map(([t, h]) => [t, h, m.t]) : [[m.t, m.href, '']]), ...SEARCH_EXTRA];
      root.innerHTML = `
      <style>
      :host{display:block;position:sticky;top:0;z-index:120;font-family:var(--font,'Manrope',Arial,sans-serif);color:#fff}
      *{box-sizing:border-box}a{color:inherit;text-decoration:none}button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
      .head{height:var(--header-h,72px);background:#050505;border-bottom:1px solid rgba(255,255,255,.18);display:flex;align-items:center}
      .in{width:min(100%,var(--ui-max,1680px));margin:auto;padding:0 var(--ui-pad,20px);display:flex;align-items:center;justify-content:space-between;gap:22px}
      .brand{display:flex;align-items:center;height:calc(var(--header-h,72px) - 22px);padding:0 clamp(18px,2.4vw,30px);border-left:1px solid rgba(255,255,255,.55);border-right:1px solid rgba(255,255,255,.55);font-size:var(--fs-small,13px);font-weight:400;letter-spacing:.34em;white-space:nowrap}
      .nav{display:none;align-items:center;gap:clamp(18px,2.4vw,40px);font-size:var(--fs-label,11px);font-weight:500;letter-spacing:.08em;text-transform:uppercase}
      .nav__a,.dd__btn{position:relative;display:flex;align-items:center;gap:8px;padding:12px 0;color:#dcdbda;letter-spacing:.08em;text-transform:uppercase}
      .nav__a:after{content:"";position:absolute;left:0;right:100%;bottom:6px;height:1px;background:currentColor;transition:.22s}.nav__a:hover:after{right:0}
      .dd{position:relative}
      .dd__btn i,.big i{display:inline-block;width:7px;height:7px;border-right:1px solid currentColor;border-bottom:1px solid currentColor;transform:translateY(-2px) rotate(45deg);transition:transform .2s}
      .dd__panel{position:absolute;left:-20px;top:100%;min-width:260px;padding:10px 20px 14px;background:#050505;border:1px solid rgba(255,255,255,.18);border-top:0;opacity:0;visibility:hidden;transform:translateY(-4px);transition:.18s}
      .dd__panel a{display:block;padding:9px 0;color:#dcdbda;font-size:var(--fs-small,13px);font-weight:300;letter-spacing:0;text-transform:none}
      .dd__panel a:hover{color:#fff;text-decoration:underline;text-underline-offset:4px}
      .dd:hover .dd__panel,.dd:focus-within .dd__panel,.dd.open .dd__panel{opacity:1;visibility:visible;transform:none}
      .dd:hover .dd__btn i,.dd.open .dd__btn i{transform:translateY(1px) rotate(-135deg)}
      .tools{display:flex;align-items:center;gap:clamp(10px,1.6vw,24px)}
      .cart{position:relative;width:44px;height:44px;display:grid;place-items:center;color:#dcdbda}
      .cart svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.3}
      .count{position:absolute;top:3px;right:0;min-width:18px;height:18px;padding:0 5px;background:#fff;color:#050505;font-size:var(--fs-label,11px);font-weight:600;line-height:18px;text-align:center}
      .count[hidden]{display:none}
      .burger{width:48px;height:48px;position:relative}
      .burger:before,.burger:after,.burger i{content:"";position:absolute;left:8px;right:8px;height:1px;background:#fff}
      .burger:before{top:15px}.burger i{top:24px}.burger:after{top:33px}
      /* Меню на телефоне — во весь экран */
      .panel{position:fixed;inset:0;z-index:130;background:#050505;opacity:0;visibility:hidden;transition:opacity .22s,visibility .22s;overflow:auto;overscroll-behavior:contain}
      .panel.open{opacity:1;visibility:visible}
      .p-top{height:var(--header-h,72px);display:flex;align-items:center;justify-content:space-between;padding:0 var(--ui-pad,20px)}
      .close{width:48px;height:48px;display:grid;place-items:center;background:#fff;color:#050505}
      .close svg{width:26px;height:26px;stroke:currentColor;stroke-width:1.4;fill:none}
      .p-body{padding:clamp(28px,6vh,56px) var(--ui-pad,20px) calc(40px + env(safe-area-inset-bottom))}
      .search{display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,.7)}
      .search svg{flex:none;width:18px;height:18px;fill:none;stroke:#fff;stroke-width:1.6}
      .search input{flex:1;min-width:0;min-height:48px;border:0;background:transparent;color:#fff;outline:0;font:300 var(--fs-lead,17px)/1 var(--font,'Manrope',Arial,sans-serif)}
      .search input::placeholder{color:#8f8c85}
      .search input::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none}
      .list{margin:clamp(20px,4vh,36px) 0 0;padding:0;list-style:none}
      .big{display:inline-flex;align-items:center;gap:14px;padding:clamp(12px,2.2vh,20px) 0;font:300 var(--fs-h3,28px)/1.1 var(--font,'Manrope',Arial,sans-serif);letter-spacing:-.01em;text-transform:uppercase;text-align:left}
      .big[aria-expanded="true"] i{transform:translateY(3px) rotate(-135deg)}
      .subs{display:grid;gap:4px;padding:0 0 14px}
      .subs[hidden]{display:none}
      .subs a{padding:7px 0;font:300 var(--fs-lead,17px)/1.3 var(--font,'Manrope',Arial,sans-serif);color:#e6e5e3}
      .results{display:grid;margin:24px 0 0}
      .results[hidden],.list[hidden]{display:none}
      .results a{display:grid;gap:4px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.14)}
      .results b{font:300 var(--fs-h4,18px)/1.25 var(--font,'Manrope',Arial,sans-serif)}
      .results small{color:#8f8c85;font-size:var(--fs-caption,12px);letter-spacing:.06em;text-transform:uppercase}
      .results p{margin:0;color:#8f8c85;font-size:var(--fs-body,15px)}
      .p-foot{display:grid;gap:6px;margin-top:clamp(28px,5vh,48px);color:#8f8c85;font-size:var(--fs-label,11px);letter-spacing:.07em;text-transform:uppercase}
      .p-foot a{color:#fff;font-size:var(--fs-body,15px);letter-spacing:0;text-transform:none}
      @media(min-width:1100px){.nav{display:flex}.burger{display:none}.panel{display:none}}
      </style>
      <header class="head"><div class="in">
        <a class="brand" href="${base}index.html#top">PORTAL SYSTEMS</a>
        <nav class="nav" aria-label="Основная навигация">${desk}</nav>
        <div class="tools">
          <a class="cart" href="${base}cart/" aria-label="Корзина"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg><b class="count" hidden>0</b></a>
          <button class="burger" type="button" aria-expanded="false" aria-label="Открыть меню"><i></i></button>
        </div>
      </div></header>
      <div class="panel" role="dialog" aria-modal="true" aria-label="Меню" aria-hidden="true">
        <div class="p-top"><a class="brand" href="${base}index.html#top">PORTAL SYSTEMS</a><button class="close" type="button" aria-label="Закрыть меню"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l16 16M20 4 4 20"/></svg></button></div>
        <div class="p-body">
          <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input type="search" placeholder="Поиск по сайту" aria-label="Поиск по сайту" enterkeyhint="go"></label>
          <ul class="list">${mob}</ul>
          <div class="results" hidden></div>
          <div class="p-foot"><span>Москва и Московская область</span><a href="tel:+79774102479">+7 977 410-24-79</a></div>
        </div>
      </div>`;
      const burger = root.querySelector('.burger'), panel = root.querySelector('.panel'), close = root.querySelector('.close');
      const input = root.querySelector('.search input'), list = root.querySelector('.list'), results = root.querySelector('.results');
      const setOpen = open => {
        burger.setAttribute('aria-expanded', String(open)); panel.setAttribute('aria-hidden', String(!open));
        panel.classList.toggle('open', open); document.documentElement.style.overflow = open ? 'hidden' : '';
        if (open) setTimeout(() => close.focus(), 50); else burger.focus({ preventScroll: true });
      };
      burger.addEventListener('click', () => setOpen(true));
      close.addEventListener('click', () => setOpen(false));
      root.querySelectorAll('.big[aria-controls]').forEach(b => b.addEventListener('click', () => {
        const open = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', String(open)); root.getElementById(b.getAttribute('aria-controls')).hidden = !open;
      }));
      panel.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
      // Выпадающие списки на компьютере: наведение или клик (для клавиатуры и планшетов)
      root.querySelectorAll('.dd').forEach(dd => {
        const btn = dd.querySelector('.dd__btn');
        btn.addEventListener('click', () => { const open = !dd.classList.contains('open'); root.querySelectorAll('.dd.open').forEach(x => { x.classList.remove('open'); x.querySelector('.dd__btn').setAttribute('aria-expanded', 'false'); }); dd.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); });
      });
      this._outside = e => { if (!e.composedPath().includes(this)) root.querySelectorAll('.dd.open').forEach(x => { x.classList.remove('open'); x.querySelector('.dd__btn').setAttribute('aria-expanded', 'false'); }); };
      document.addEventListener('click', this._outside);
      // Поиск по разделам сайта
      const norm = s => s.toLowerCase().replace(/ё/g, 'е');
      const find = q => { const w = norm(q).split(/\s+/).filter(Boolean); const seen = new Set(); return index.filter(([t, h, k]) => w.every(x => norm(`${t} ${k || ''}`).includes(x)) && !seen.has(h) && seen.add(h)).slice(0, 8); };
      input.addEventListener('input', () => {
        const q = input.value.trim();
        list.hidden = !!q; results.hidden = !q;
        if (!q) { results.innerHTML = ''; return; }
        const r = find(q);
        results.innerHTML = r.length ? r.map(([t, h, k]) => `<a href="${u(h)}"><small>${MENU.some(m => m.t === k) ? k : 'Страница'}</small><b>${t}</b></a>`).join('')
          : `<p>Ничего не нашли. Позвоните: <a href="tel:+79774102479">+7 977 410-24-79</a></p>`;
      });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { const a = results.querySelector('a'); if (a) location.href = a.href; } });
      this._esc = e => { if (e.key === 'Escape' && panel.classList.contains('open')) setOpen(false); };
      document.addEventListener('keydown', this._esc);
      // Счётчик корзины: localStorage ps-cart, обновляется событием ps-cart-change (assets/js/shop.js) и из других вкладок
      const count = root.querySelector('.count'), cartLink = root.querySelector('.cart');
      this._cart = () => {
        let n = 0;
        try { n = (JSON.parse(localStorage.getItem('ps-cart') || '[]') || []).reduce((s, i) => s + (+i.qty || 0), 0); } catch (e) { /* пусто */ }
        count.hidden = !n; count.textContent = n > 99 ? '99+' : String(n);
        cartLink.setAttribute('aria-label', n ? `Корзина, товаров: ${n}` : 'Корзина');
      };
      this._storage = e => { if (e.key === 'ps-cart') this._cart(); };
      window.addEventListener('ps-cart-change', this._cart); window.addEventListener('storage', this._storage); this._cart();
    }
    disconnectedCallback() {
      if (this._esc) document.removeEventListener('keydown', this._esc);
      if (this._outside) document.removeEventListener('click', this._outside);
      document.documentElement.style.overflow = '';
      if (this._cart) { window.removeEventListener('ps-cart-change', this._cart); window.removeEventListener('storage', this._storage); }
    }
  }
  if (!customElements.get('site-menu')) customElements.define('site-menu', SiteMenu);
})();
