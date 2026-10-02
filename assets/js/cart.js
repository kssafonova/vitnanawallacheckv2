// Страница корзины /cart/: список товаров, количество, итог и оформление заказа.
// Названия и базовые цены — из data/catalog.json (собирает tools/build.mjs). Позиция может нести стекло (glass),
// «любой RAL» (color) и свой размер (custom + config) — тогда цену и срок корзина пересчитывает по assets/js/portal-calc.js
// (window.PSPortal), цене из localStorage не доверяем. Срок изготовления — у каждой позиции свой («до N дней»).
// Заказ уходит в forms/send.php (source=cart), после успеха — /cart/done/?order=НОМЕР.
// Получение — только доставка и монтаж (оценка — процент от стоимости, не меньше минимума; из site-config.json через catalog.json).
// Самовывоза нет (решение владельца).
(() => {
  const root=document.querySelector('[data-cart-root]');
  const cart=window.PSCart,P=window.PSPortal;
  if(!root||!cart)return;
  const base='../';
  const list=root.querySelector('[data-cart-list]');
  const note=root.querySelector('[data-cart-note]');
  const empty=document.querySelector('[data-cart-empty]');
  const form=root.querySelector('[data-cart-form]');
  const status=root.querySelector('[data-cart-status]');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
  let catalog=new Map();
  let services={install_delivery_pct:12,install_delivery_min:45000};
  // Оценка доставки и монтажа, округлённая до тысячи
  // Окно получения: сегодня + самый долгий срок среди позиций. Точную дату подтверждает менеджер.
  const etaDate=days=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return d};
  const fmtDay=d=>d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
  const maxDays=items=>Math.max(...items.map(i=>i.days));
  const termText=items=>`до ${maxDays(items)} дней`;
  const etaText=items=>`до ${fmtDay(etaDate(maxDays(items)))}`;
  const GLASS={base:'Базовый',standard:'Стандарт',triplex:'Триплекс',solar:'Solar'};
  const serviceCost=goods=>Math.max(Math.round(goods*services.install_delivery_pct/100/1000)*1000,services.install_delivery_min);

  // Позиция корзины → готовая строка: базовый вариант каталога + стекло, цвет и размер позиции, цена и срок по формулам
  const line=i=>{
    const v=catalog.get(i.sourceSku||i.sku);if(!v)return null;
    const c=i.custom&&i.config?i.config:null;
    const w=c?+c.width:v.width,h=c?+c.height:v.height,n=c?+c.sections:v.sections,scheme=c?c.schemeCode:v.scheme_code;
    const forced=P?P.triplexForced(w,h,n):v.triplex;
    const glass=forced?'triplex':(GLASS[i.glass]?i.glass:v.default_glass||'base');
    const customWidth=!!c&&![...catalog.values()].some(x=>x.system===v.system&&x.width===w&&x.sections===n),customHeight=h!==v.height;
    const std=!c&&glass===(v.default_glass||'base');
    const price=std||!P?v.price:P.price({type:v.system,w,h,n,scheme,glass,color:'mono',handle:'standard',customHeight});
    const days=P?P.days(v.system,glass,customWidth,customHeight):30;
    const title=c?`${v.system==='FS'?'Складная дверь-гармошка':'Раздвижная портальная дверь'} ${(w/1000).toFixed(1).replace('.',',')} м`:v.name;
    return {...i,v,custom:!!c,w,h,n,glass,price,days,title,size:`${w} × ${h} мм`,color:i.color||v.color,scheme:c?`${c.scheme||scheme}`:v.scheme};
  };
  const lines=()=>cart.items().map(line).filter(i=>i&&i.price);
  // Варианты той же модели: другой проём / цвет / схема при остальных тех же (проём — ширина из таблицы размеров)
  const siblings=(v,key)=>[...catalog.values()].filter(x=>x.model===v.model
    &&(key==='width'||x.width===v.width)&&(key==='color'||x.color_slug===v.color_slug)&&(key==='scheme'||x.scheme_slug===v.scheme_slug));

  const itemHtml=i=>{
    const {sku,qty,v}=i;
    const colors=i.custom?[]:siblings(v,'color'),schemes=i.custom?[]:siblings(v,'scheme'),widths=i.custom?[]:siblings(v,'width');
    const sizeChips=widths.length>1?`<div class="m-card__chips">${widths.map(x=>`<button type="button" class="m-card__chip${x.sku===sku?' is-active':''}" data-to="${esc(x.sku)}" aria-pressed="${x.sku===sku}">${esc(x.size_short)}</button>`).join('')}</div>`:'';
    const swatches=colors.map(x=>`<button type="button" class="m-card__swatch${x.sku===sku&&!i.color?' is-active':''}" data-to="${esc(x.sku)}" style="--sw:${esc(x.hex)}" title="${esc(x.color)}" aria-label="Цвет ${esc(x.color)}" aria-pressed="${x.sku===sku}"></button>`).join('');
    const chips=schemes.length>1?`<div class="m-card__chips">${schemes.map(x=>`<button type="button" class="m-card__chip${x.sku===sku?' is-active':''}" data-to="${esc(x.sku)}" aria-pressed="${x.sku===sku}">${esc(x.scheme_short)}</button>`).join('')}</div>`:'';
    return `
      <li class="cart-item" data-sku="${esc(sku)}">
        <a class="cart-item__img" href="${base+esc(v.url)}"><img src="${base+esc(v.image)}" alt="${esc(v.code)} · ${esc(v.name)}" loading="lazy"></a>
        <div class="cart-item__body">
          <div class="m-card__price"><strong>${money(i.price*qty)}</strong><small>${qty>1?`${money(i.price)} × ${qty}`:'за конструкцию'}</small></div>
          <a class="cart-item__title" href="${base+esc(v.url)}">${i.custom?'':`${esc(v.code)} · `}${esc(i.title)}</a>
          <p class="cart-item__meta">${esc(i.size)} · стеклопакет «${esc(GLASS[i.glass])}» · срок до ${i.days} дней${i.custom?' · индивидуальный размер':` · арт. ${esc(v.sku)}`}</p>
          <div class="m-card__opt"><span class="m-card__label">Проём: <b>${i.custom?esc(i.size):esc(v.size_short)}</b></span>${sizeChips}</div>
          <div class="m-card__opt"><span class="m-card__label">Цвет: <b>${esc(i.color)}</b></span><div class="m-card__swatches">${swatches}</div></div>
          <div class="m-card__opt"><span class="m-card__label">${esc(v.scheme_title)}: <b>${esc(i.custom?i.scheme:v.scheme_short)}</b></span>${chips}</div>
          <div class="cart-item__foot">
            <div class="cart-item__qty" role="group" aria-label="Количество">
              <button type="button" data-qty="-1" aria-label="Уменьшить количество">−</button><output>${qty}</output><button type="button" data-qty="1" aria-label="Увеличить количество"${qty>=99?' disabled':''}>+</button>
            </div>
            <button class="cart-item__remove" type="button" data-remove>Удалить</button>
          </div>
        </div>
      </li>`;
  };

  const render=()=>{
    const items=lines();
    root.hidden=!items.length;
    empty.hidden=!!items.length;
    const head=document.querySelector('[data-cart-head]'),steps=document.querySelector('[data-cart-steps]');
    if(head)head.hidden=!items.length;
    if(steps)steps.hidden=!items.length;
    if(!items.length)return;
    list.innerHTML=items.map(itemHtml).join('');
    const count=items.reduce((n,i)=>n+i.qty,0);
    root.querySelector('[data-cart-count]').textContent=count;
    const hc=document.querySelector('[data-cart-head-count]');if(hc)hc.textContent=count;
    const goods=items.reduce((n,i)=>n+i.price*i.qty,0),service=serviceCost(goods);
    root.querySelector('[data-cart-goods]').textContent=money(goods);
    root.querySelector('[data-cart-service-label]').textContent=`Доставка и монтаж, ≈${services.install_delivery_pct}%`;
    root.querySelector('[data-cart-service]').textContent='≈ '+money(service);
    root.querySelector('[data-cart-total]').textContent=money(goods+service);
    root.querySelector('[data-cart-days]').textContent=termText(items);
    root.querySelector('[data-cart-eta-date]').textContent=etaText(items);
  };

  list.addEventListener('click',e=>{
    const item=e.target.closest('[data-sku]');
    if(!item)return;
    const sku=item.dataset.sku;
    const q=e.target.closest('[data-qty]');
    if(q){const it=cart.items().find(i=>i.sku===sku);cart.set(sku,(it?it.qty:0)+Number(q.dataset.qty))}
    if(e.target.closest('[data-remove]'))cart.remove(sku);
    const to=e.target.closest('[data-to]');
    if(to){if(cart.items().find(i=>i.sku===sku)?.color)cart.setColor(sku,'');cart.replace(sku,to.dataset.to)}
  });
  window.addEventListener('ps-cart-change',render);
  window.addEventListener('storage',e=>{if(e.key==='ps-cart')render()});

  const orderId=()=>{
    const d=new Date(),p=n=>String(n).padStart(2,'0');
    const abc='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r=new Uint8Array(4);
    crypto.getRandomValues(r);
    return `PS-${String(d.getFullYear()).slice(2)}${p(d.getMonth()+1)}${p(d.getDate())}-${[...r].map(x=>abc[x%abc.length]).join('')}`;
  };


  const phone=form.elements.phone;
  phone.addEventListener('input',()=>phone.setCustomValidity(''));
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const digits=phone.value.replace(/\D/g,'');
    if(digits.length<10||digits.length>15){phone.setCustomValidity('Проверьте номер телефона');phone.reportValidity();return}
    const items=lines();
    if(!items.length){render();return}
    const id=orderId();
    const goods=items.reduce((n,i)=>n+i.price*i.qty,0),service=serviceCost(goods),total=goods+service;
    const deliveryLine=`Получение: доставка и монтаж — оценка ≈ ${money(service)} (≈${services.install_delivery_pct}%, мин. ${money(services.install_delivery_min)})`;
    const project=items.map((i,n)=>`${n+1}. ${i.custom?`ИНДИВИДУАЛЬНЫЙ РАЗМЕР (на основе ${i.v.code})`:i.v.code} ${i.title} — ${i.size}, ${i.n} секц., ${i.color}, ${i.scheme}, стеклопакет «${GLASS[i.glass]}», срок до ${i.days} дней\n   ${i.custom?'База':'Артикул'} ${i.v.sku} × ${i.qty} = ${money(i.price*i.qty)}\n   ${new URL(base+i.v.url,location.href).href}`).join('\n')
      +`\n\nКонструкции: ${money(goods)}\n${deliveryLine}\nИтого: ${money(total)}`
      +`\nСрок изготовления: ${termText(items)}. Ориентировочно доставка и монтаж: ${etaText(items)} — дату нужно подтвердить клиенту.`;
    const data=new FormData(form);
    data.set('source','cart');data.set('order_id',id);data.set('project',project);
    const button=form.querySelector('button[type="submit"]'),old=button.innerHTML;
    button.disabled=true;button.textContent='Отправляем…';status.textContent='';
    try{
      const res=await fetch(form.dataset.endpoint,{method:'POST',body:data});
      const json=await res.json().catch(()=>({}));
      if(!res.ok||!json.ok)throw new Error(json.message||'HTTP '+res.status);
      const number=json.order_id||id;
      try{sessionStorage.setItem('ps-last-order',JSON.stringify({id:number,total,goods,service,eta:etaText(items),days:termText(items),items:items.map(i=>({title:`${i.custom?'':i.v.code+' · '}${i.title}`,meta:`${i.size} · ${i.color} · ${GLASS[i.glass]}`,qty:i.qty,sum:i.price*i.qty}))}))}catch(e){}
      cart.clear();
      location.href='done/?order='+encodeURIComponent(number);
    }catch(err){
      status.textContent=(err.message&&!/^HTTP|Failed|NetworkError|JSON/.test(err.message)?err.message+' ':'')+'Не удалось отправить заказ. Попробуйте ещё раз или позвоните нам — корзина сохранена.';
      button.disabled=false;button.innerHTML=old;
    }
  });

  fetch(base+'data/catalog.json')
    .then(r=>{if(!r.ok)throw new Error('catalog.json');return r.json()})
    .then(data=>{
      catalog=new Map(data.variants.filter(v=>v.available).map(v=>[v.sku,v]));
      if(data.services)services={...services,...data.services};
      const hint=form.querySelector('[data-delivery-hint]');
      if(hint&&services.install_delivery_zone)hint.textContent=`${services.install_delivery_zone}. Оценка ≈${services.install_delivery_pct}% от стоимости, минимум ${money(services.install_delivery_min)}. Замер бесплатно.`;
      // Артикулы, которых больше нет в продаже, убираем и сообщаем об этом
      const gone=cart.items().filter(i=>!catalog.has(i.sourceSku||i.sku));
      if(gone.length){gone.forEach(i=>cart.remove(i.sku));note.hidden=false;note.textContent='Часть товаров больше недоступна к заказу и убрана из корзины.'}
      render();
    })
    .catch(()=>{empty.hidden=false;empty.querySelector('.cart-head__lead').textContent='Не удалось загрузить каталог. Обновите страницу.'});
})();
