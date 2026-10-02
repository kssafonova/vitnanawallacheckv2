// Корзина в localStorage (ps-cart: [{sku, qty, ...}]) и карточки .m-card.
// В корзину попадают конфигурации со сроком до 45 дней; более долгие — «Обсудить проект» (страница товара → форма инженеру).
// У позиции могут быть стекло (glass), цвет «любой RAL» (color) и свой размер (custom + config) — цену корзина пересчитывает сама.
(() => {
  const CART_KEY='ps-cart';
  const parse=(key)=>{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}};
  const count=items=>items.reduce((n,i)=>n+(+i.qty||0),0);
  const emit=(key,event,items)=>{try{localStorage.setItem(key,JSON.stringify(items))}catch(e){}window.dispatchEvent(new CustomEvent(event,{detail:{count:count(items)}}))};

  const cart={
    items:()=>parse(CART_KEY).filter(i=>i&&typeof i.sku==='string'&&i.qty>0),
    count(){return count(this.items())},has(sku){return this.items().some(i=>i.sku===sku)},
    add(sku,qty=1,meta={}){const a=this.items(),i=a.find(x=>x.sku===sku),clean=Object.fromEntries(Object.entries(meta).filter(([,v])=>v!==undefined&&v!==null&&v!==''));if(i){i.qty=Math.min(99,i.qty+qty);Object.assign(i,clean)}else a.push({sku,qty,...clean});emit(CART_KEY,'ps-cart-change',a)},
    set(sku,qty){let a=this.items();if(qty<=0)a=a.filter(i=>i.sku!==sku);else{const i=a.find(x=>x.sku===sku);if(i)i.qty=Math.min(99,qty);else a.push({sku,qty})}emit(CART_KEY,'ps-cart-change',a)},
    remove(sku){emit(CART_KEY,'ps-cart-change',this.items().filter(i=>i.sku!==sku))},
    update(sku,patch){const a=this.items(),i=a.find(x=>x.sku===sku);if(!i)return;Object.assign(i,patch);emit(CART_KEY,'ps-cart-change',a)},
    setColor(sku,color){const a=this.items(),i=a.find(x=>x.sku===sku);if(!i)return;if(color)i.color=color;else delete i.color;emit(CART_KEY,'ps-cart-change',a)},
    replace(from,to){if(from===to)return;const a=this.items(),x=a.find(i=>i.sku===from);if(!x)return;const y=a.find(i=>i.sku===to);if(y){y.qty=Math.min(99,y.qty+x.qty);a.splice(a.indexOf(x),1)}else x.sku=to;emit(CART_KEY,'ps-cart-change',a)},
    clear(){emit(CART_KEY,'ps-cart-change',[])}
  };
  window.PSCart=cart;

  const money=n=>new Intl.NumberFormat('ru-RU').format(Math.round(n))+'\u00a0₽';
  const cardPrice=btn=>btn.hasAttribute('data-card-action')&&btn.dataset.cardActionPrice?` <strong>${money(+btn.dataset.cardActionPrice)}</strong>`:'';
  const syncCart=btn=>{const on=cart.has(btn.dataset.sku),a=btn.dataset.cartLabel||'В корзину',b=btn.dataset.cartAddedLabel||'В корзине';btn.classList.toggle('is-in-cart',on);btn.innerHTML=on?`${b} <span>→</span>`:`${a}${cardPrice(btn)}${btn.hasAttribute('data-card-action')?'':' <span>+</span>'}`};
  const syncAll=()=>document.querySelectorAll('[data-add-to-cart]').forEach(syncCart);
  document.addEventListener('click',e=>{
    const p=e.target.closest('[data-card-project]');
    if(p){location.href=p.dataset.cardProject;return}
    const c=e.target.closest('[data-add-to-cart]');
    if(c){if(cart.has(c.dataset.sku)){location.href=c.dataset.cartHref;return}let config;try{config=JSON.parse(c.dataset.cartConfig||'null')}catch(e){config=null}cart.add(c.dataset.sku,1,{sourceSku:c.dataset.cartSourceSku,color:c.dataset.cartColor,glass:c.dataset.cartGlass,glassLabel:c.dataset.cartGlassLabel,price:c.dataset.cartPrice?+c.dataset.cartPrice:undefined,term:c.dataset.cartTerm,custom:!!config,config})}
  });
  window.addEventListener('ps-cart-change',syncAll);
  window.addEventListener('storage',e=>{if(e.key===CART_KEY)syncAll()});

  const glassName=glass=>({base:'Базовый',standard:'Стандарт',triplex:'Триплекс',solar:'Solar'}[glass]||glass);

  document.querySelectorAll('[data-card-gallery]').forEach(gallery=>{
    const track=gallery.querySelector('[data-card-gallery-track]'),slides=[...gallery.querySelectorAll('.m-card__slide')],current=gallery.querySelector('[data-card-gallery-current]');
    if(!track||slides.length<2)return;
    let active=0,raf=0;
    const setCurrent=i=>{active=Math.max(0,Math.min(slides.length-1,i));if(current)current.textContent=String(active+1)};
    const go=i=>{setCurrent(i);track.scrollTo({left:active*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
    gallery.querySelector('[data-card-gallery-prev]')?.addEventListener('click',e=>{e.preventDefault();go(active-1)});
    gallery.querySelector('[data-card-gallery-next]')?.addEventListener('click',e=>{e.preventDefault();go(active+1)});
    track.addEventListener('scroll',()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;setCurrent(Math.round(track.scrollLeft/Math.max(1,track.clientWidth)))})},{passive:true});
  });

  document.querySelectorAll('[data-card]').forEach(card=>{
    let variants,sizes={},cfg={};try{variants=JSON.parse(card.dataset.variants);sizes=JSON.parse(card.dataset.sizes||'{}');cfg=JSON.parse(card.dataset.cardConfig||'{}')}catch(e){return}
    const first=variants[0],state={w:+(card.querySelector('[data-size].is-active')?.dataset.size||first.w),c:card.querySelector('[data-color].is-active')?.dataset.color||first.c,s:card.querySelector('[data-scheme].is-active')?.dataset.scheme||first.s,ral:false,custom:null};
    const mark=(selector,key,value,label)=>card.querySelectorAll(selector).forEach(el=>{const on=el.dataset[key]===value;el.classList.toggle('is-active',on);on?el.setAttribute('aria-current','true'):el.removeAttribute('aria-current');if(on&&label)label.textContent=el.dataset.name});
    const selected=()=>variants.find(x=>x.w===state.w&&x.c===state.c&&x.s===state.s)||variants.find(x=>x.c===state.c&&x.s===state.s)||first;
    const makeItem=(v,w,h,price,custom,glass=v.triplex?'triplex':'base',term=custom?.term||`до ${window.PSPortal?.days(v.type,glass,false,false)||45} дней`)=>({
      sku:v.sku,sourceSku:v.sku,system:v.type,model:cfg.model,code:v.code,name:v.name,width:w,height:h,sections:v.n,
      scheme:v.schemeName,schemeCode:v.scheme,color:state.ral?'Любой однотонный RAL — оттенок уточнить':v.color,
      glass,glassLabel:({base:'Базовый',standard:'Стандарт',triplex:'Триплекс',solar:'Solar'}[glass]||glass),price,image:v.img,url:v.href,custom:!!custom,term
    });
    const buyMode=(v,custom)=>{
      let btn=card.querySelector('.m-card__cart');if(!btn||btn.tagName==='A')return;
      btn.removeAttribute('data-add-to-cart');delete btn.dataset.cardProject;delete btn.dataset.cartColor;
      const glass=custom?.glass||(v.triplex?'triplex':'base'),days=custom?.days||(window.PSPortal?.days(v.type,glass,false,false)||45),direct=days<=45,item=makeItem(v,custom?.w||v.w,custom?.h||v.h,custom?.price||v.price,custom,glass,`до ${days} дней`);
      btn.dataset.cardActionPrice=String(custom?.price||v.price);
      delete btn.dataset.cartConfig;delete btn.dataset.cartSourceSku;delete btn.dataset.cartGlass;delete btn.dataset.cartGlassLabel;delete btn.dataset.cartPrice;delete btn.dataset.cartTerm;
      if(!direct){btn.dataset.cardProject=v.href;btn.classList.remove('is-in-cart');btn.innerHTML=`Обсудить проект <strong>${money(custom?.price||v.price)}</strong>`}
      else{btn.setAttribute('data-add-to-cart','');btn.dataset.sku=custom?`CUSTOM:${v.sku}:${custom.w}x${custom.h}:${glass}`:v.sku;btn.dataset.cartSourceSku=v.sku;btn.dataset.cartHref=cfg.cartHref;btn.dataset.cartGlass=glass;btn.dataset.cartGlassLabel=glass==='triplex'?'Триплекс':'Базовый';btn.dataset.cartPrice=String(custom?.price||v.price);btn.dataset.cartTerm=`до ${days} дней`;if(custom)btn.dataset.cartConfig=JSON.stringify(item);if(state.ral)btn.dataset.cartColor='Любой однотонный RAL — оттенок уточнить'}
      syncAll();
    };
    const apply=()=>{
      const v=selected(),z=sizes[state.w],custom=state.custom;
      if(!custom&&z){card.querySelector('[data-card-title]')&&(card.querySelector('[data-card-title]').textContent=z.t);card.querySelector('[data-card-meta]')&&(card.querySelector('[data-card-meta]').textContent=z.m);card.querySelectorAll('[data-card-price]').forEach(el=>el.textContent=z.p)}
      if(custom){card.querySelector('[data-card-title]')&&(card.querySelector('[data-card-title]').textContent=`${v.type}-портал по вашему размеру`);card.querySelector('[data-card-meta]')&&(card.querySelector('[data-card-meta]').textContent=`${custom.w} × ${custom.h} мм · ${v.n} ${v.n<5?'секции':'секций'}`);card.querySelectorAll('[data-card-price]').forEach(el=>el.textContent='≈ '+money(custom.price))}
      const glass=custom?.glass||(v.triplex?'triplex':'base'),days=custom?.days||(window.PSPortal?.days(v.type,glass,false,false)||45);card.querySelectorAll('[data-card-price-note]').forEach(note=>note.textContent=`${glassName(glass)} · до ${days} дней`);
      const passage=card.querySelector('[data-card-passage]');if(passage){const p=custom?window.PSPortal?.passage(v.type,custom.w,v.n,v.scheme):v.passage,ratio=p?Math.round(p/(custom?.w||v.w)*100):v.passageRatio;passage.textContent=p?`Открытый проход ≈ ${ratio}%`:'Открытый проход после проверки'}
      if(!custom){card.querySelectorAll('[data-card-link]').forEach(a=>a.href=v.href+(a.dataset.cardHash||''));const img=card.querySelector('[data-card-img]');if(img&&img.src!==v.img)img.src=v.img;const fallback=card.querySelector('[data-card-3d-fallback]');if(fallback&&fallback.src!==v.img)fallback.src=v.img;const open=card.querySelector('[data-card-img-open]');if(open){open.closest('.m-card__slide').hidden=!v.open;if(v.open&&open.src!==v.open)open.src=v.open}}
      mark('[data-size]','size',String(state.w));mark('[data-color]','color',state.c,card.querySelector('[data-card-color]'));mark('[data-scheme]','scheme',state.s,card.querySelector('[data-card-scheme]'));
      const ral=card.querySelector('[data-custom-ral]');if(ral){ral.classList.toggle('is-active',state.ral);ral.setAttribute('aria-pressed',String(state.ral));if(state.ral)card.querySelectorAll('[data-color]').forEach(el=>{el.classList.remove('is-active');el.removeAttribute('aria-current')})}
      card.querySelectorAll('[data-scheme-svg]').forEach(el=>el.hidden=el.dataset.schemeSvg!==state.s);buyMode(v,custom);card.dispatchEvent(new CustomEvent('ps-card-variant',{detail:{w:custom?.w||state.w,h:custom?.h||v.h,c:state.c,s:state.s,custom:!!custom}}));
    };
    card.addEventListener('click',e=>{
      const opt=e.target.closest('[data-size],[data-color],[data-scheme],[data-custom-ral]');if(!opt)return;e.preventDefault();
      if(opt.hasAttribute('data-custom-ral'))state.ral=true;else if(opt.dataset.size){state.w=+opt.dataset.size;state.custom=null}else if(opt.dataset.color){state.c=opt.dataset.color;state.ral=false}else state.s=opt.dataset.scheme;apply();
    });
    apply();
  });
  syncAll();
})();
