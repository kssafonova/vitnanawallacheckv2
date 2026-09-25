// Корзина и карточки товаров.
// Корзина живёт в localStorage браузера (ключ ps-cart): [{sku, qty}]. Цены и названия берутся
// из data/catalog.json на странице корзины — в хранилище только артикулы и количество.
// Счётчик в шапке (<site-menu>) слушает событие ps-cart-change.
(() => {
  const KEY='ps-cart';
  const read=()=>{
    try{
      const v=JSON.parse(localStorage.getItem(KEY)||'[]');
      return Array.isArray(v)?v.filter(i=>i&&typeof i.sku==='string'&&i.qty>0):[];
    }catch(e){return[]}
  };
  const total=items=>items.reduce((n,i)=>n+i.qty,0);
  const write=items=>{
    try{localStorage.setItem(KEY,JSON.stringify(items))}catch(e){}
    window.dispatchEvent(new CustomEvent('ps-cart-change',{detail:{count:total(items)}}));
  };
  const cart={
    items:read,
    count:()=>total(read()),
    has:sku=>read().some(i=>i.sku===sku),
    add(sku,qty=1){
      const items=read(),it=items.find(i=>i.sku===sku);
      if(it)it.qty=Math.min(99,it.qty+qty);else items.push({sku,qty});
      write(items);
    },
    set(sku,qty){
      let items=read();
      if(qty<=0)items=items.filter(i=>i.sku!==sku);
      else{const it=items.find(i=>i.sku===sku);if(it)it.qty=Math.min(99,qty);else items.push({sku,qty})}
      write(items);
    },
    remove(sku){write(read().filter(i=>i.sku!==sku))},
    // Смена варианта (цвет/схема) в корзине; если такой артикул уже есть — количество складывается
    replace(from,to){
      if(from===to)return;
      const items=read(),a=items.find(i=>i.sku===from);
      if(!a)return;
      const b=items.find(i=>i.sku===to);
      if(b){b.qty=Math.min(99,b.qty+a.qty);items.splice(items.indexOf(a),1)}else a.sku=to;
      write(items);
    },
    clear(){write([])}
  };
  window.PSCart=cart;

  // Кнопки «В корзину». Товар уже в корзине — кнопка ведёт к оформлению.
  const syncButton=btn=>{
    const inCart=cart.has(btn.dataset.sku);
    btn.classList.toggle('is-in-cart',inCart);
    btn.innerHTML=inCart?'В корзине <span>→</span>':'В корзину <span>+</span>';
  };
  const syncAll=()=>document.querySelectorAll('[data-add-to-cart]').forEach(syncButton);
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-add-to-cart]');
    if(!btn)return;
    if(cart.has(btn.dataset.sku)){location.href=btn.dataset.cartHref;return}
    cart.add(btn.dataset.sku);
  });
  window.addEventListener('ps-cart-change',syncAll);
  window.addEventListener('storage',e=>{if(e.key===KEY)syncAll()});

  // Карточки: цвет и схема переключаются на месте — фото, ссылки, артикул для корзины.
  // Без JS свотчи остаются обычными ссылками на страницы вариантов.
  document.querySelectorAll('[data-card]').forEach(card=>{
    let variants;
    try{variants=JSON.parse(card.dataset.variants)}catch(e){return}
    const state={
      c:card.querySelector('[data-color].is-active')?.dataset.color||variants[0].c,
      s:card.querySelector('[data-scheme].is-active')?.dataset.scheme||variants[0].s
    };
    const mark=(selector,key,value,labelEl)=>card.querySelectorAll(selector).forEach(el=>{
      const on=el.dataset[key]===value;
      el.classList.toggle('is-active',on);
      if(on){el.setAttribute('aria-current','true');if(labelEl)labelEl.textContent=el.dataset.name}
      else el.removeAttribute('aria-current');
    });
    const apply=()=>{
      const v=variants.find(x=>x.c===state.c&&x.s===state.s);
      if(!v)return;
      card.querySelectorAll('[data-card-link]').forEach(a=>{a.href=v.href+(a.dataset.cardHash||'')});
      const img=card.querySelector('[data-card-img]');
      if(img&&img.getAttribute('src')!==v.img)img.src=v.img;
      mark('[data-color]','color',state.c,card.querySelector('[data-card-color]'));
      mark('[data-scheme]','scheme',state.s,card.querySelector('[data-card-scheme]'));
      card.querySelectorAll('[data-scheme-svg]').forEach(el=>{el.hidden=el.dataset.schemeSvg!==state.s});
      const btn=card.querySelector('[data-add-to-cart]');
      if(btn){btn.dataset.sku=v.sku;syncButton(btn)}
    };
    card.addEventListener('click',e=>{
      const opt=e.target.closest('[data-color],[data-scheme]');
      if(!opt)return;
      e.preventDefault();
      if(opt.dataset.color)state.c=opt.dataset.color;else state.s=opt.dataset.scheme;
      apply();
    });
  });

  syncAll();
})();
