// Страница корзины /cart/: список товаров, количество, итог и оформление заказа.
// Цены и названия — из data/catalog.json (собирает tools/build.mjs), в корзине только артикулы.
// Заказ уходит в forms/send.php (source=cart), после успеха — /cart/done/?order=НОМЕР.
// Получение: доставка и монтаж (оценка — процент от стоимости, не меньше минимума; из site-config.json через catalog.json)
// или самовывоз с производства.
(() => {
  const root=document.querySelector('[data-cart-root]');
  const cart=window.PSCart;
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
  let services={install_delivery_pct:12,install_delivery_min:45000},factory={};
  const mode=()=>form.elements.delivery.value==='pickup'?'pickup':'delivery';
  // Оценка доставки и монтажа, округлённая до тысячи; при самовывозе — 0
  const serviceCost=goods=>mode()==='pickup'?0:Math.max(Math.round(goods*services.install_delivery_pct/100/1000)*1000,services.install_delivery_min);

  const lines=()=>cart.items().map(i=>({...i,v:catalog.get(i.sku)})).filter(i=>i.v);
  // Варианты той же модели: другие цвета при той же схеме и другие схемы при том же цвете
  const siblings=(v,key)=>[...catalog.values()].filter(x=>x.model===v.model&&(key==='color'?x.scheme_slug===v.scheme_slug:x.color_slug===v.color_slug));

  const itemHtml=({sku,qty,v})=>{
    const colors=siblings(v,'color'),schemes=siblings(v,'scheme');
    const swatches=colors.map(x=>`<button type="button" class="m-card__swatch${x.sku===sku?' is-active':''}" data-to="${esc(x.sku)}" style="--sw:${esc(x.hex)}" title="${esc(x.color)}" aria-label="Цвет ${esc(x.color)}" aria-pressed="${x.sku===sku}"></button>`).join('');
    const chips=schemes.length>1?`<div class="m-card__chips">${schemes.map(x=>`<button type="button" class="m-card__chip${x.sku===sku?' is-active':''}" data-to="${esc(x.sku)}" aria-pressed="${x.sku===sku}">${esc(x.scheme_short)}</button>`).join('')}</div>`:'';
    return `
      <li class="cart-item" data-sku="${esc(sku)}">
        <a class="cart-item__img" href="${base+esc(v.url)}"><img src="${base+esc(v.image)}" alt="${esc(v.code)} · ${esc(v.name)}" loading="lazy"></a>
        <div class="cart-item__body">
          <div class="m-card__price"><strong>${money(v.price*qty)}</strong><small>от, ${qty>1?`${money(v.price)} × ${qty}`:'за конструкцию'}</small></div>
          <a class="cart-item__title" href="${base+esc(v.url)}">${esc(v.code)} · ${esc(v.name)}</a>
          <p class="cart-item__meta">${esc(v.size)} · арт. ${esc(sku)}</p>
          <div class="m-card__opt"><span class="m-card__label">Цвет: <b>${esc(v.color)}</b></span><div class="m-card__swatches">${swatches}</div></div>
          <div class="m-card__opt"><span class="m-card__label">${esc(v.scheme_title)}: <b>${esc(v.scheme_short)}</b></span>${chips}</div>
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
    if(!items.length)return;
    list.innerHTML=items.map(itemHtml).join('');
    const count=items.reduce((n,i)=>n+i.qty,0);
    root.querySelector('[data-cart-count]').textContent=count;
    const goods=items.reduce((n,i)=>n+i.v.price*i.qty,0),service=serviceCost(goods),pickup=mode()==='pickup';
    root.querySelector('[data-cart-goods]').textContent='от '+money(goods);
    root.querySelector('[data-cart-service-label]').textContent=pickup?'Самовывоз':`Доставка и монтаж, ≈${services.install_delivery_pct}%`;
    root.querySelector('[data-cart-service]').textContent=pickup?'0 ₽':'от '+money(service);
    root.querySelector('[data-cart-total]').textContent='от '+money(goods+service);
    root.querySelector('[data-cart-note-delivery]').hidden=pickup;
    root.querySelector('[data-cart-note-pickup]').hidden=!pickup;
  };

  list.addEventListener('click',e=>{
    const item=e.target.closest('[data-sku]');
    if(!item)return;
    const sku=item.dataset.sku;
    const q=e.target.closest('[data-qty]');
    if(q){const it=cart.items().find(i=>i.sku===sku);cart.set(sku,(it?it.qty:0)+Number(q.dataset.qty))}
    if(e.target.closest('[data-remove]'))cart.remove(sku);
    const to=e.target.closest('[data-to]');
    if(to)cart.replace(sku,to.dataset.to);
  });
  window.addEventListener('ps-cart-change',render);
  window.addEventListener('storage',e=>{if(e.key==='ps-cart')render()});

  const orderId=()=>{
    const d=new Date(),p=n=>String(n).padStart(2,'0');
    const abc='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r=new Uint8Array(4);
    crypto.getRandomValues(r);
    return `PS-${String(d.getFullYear()).slice(2)}${p(d.getMonth()+1)}${p(d.getDate())}-${[...r].map(x=>abc[x%abc.length]).join('')}`;
  };

  // Самовывоз: город не нужен
  const cityField=form.querySelector('[data-city-field]');
  const syncMode=()=>{const pickup=mode()==='pickup';cityField.hidden=pickup;form.elements.city.required=!pickup;render()};
  form.addEventListener('change',e=>{if(e.target.name==='delivery')syncMode()});

  const phone=form.elements.phone;
  phone.addEventListener('input',()=>phone.setCustomValidity(''));
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const digits=phone.value.replace(/\D/g,'');
    if(digits.length<10||digits.length>15){phone.setCustomValidity('Проверьте номер телефона');phone.reportValidity();return}
    const items=lines();
    if(!items.length){render();return}
    const id=orderId();
    const goods=items.reduce((n,i)=>n+i.v.price*i.qty,0),service=serviceCost(goods),total=goods+service,pickup=mode()==='pickup';
    const deliveryLine=pickup
      ?`Получение: САМОВЫВОЗ с производства (${factory.address||'квартал № 205'})`
      :`Получение: доставка и монтаж — оценка от ${money(service)} (≈${services.install_delivery_pct}%, мин. ${money(services.install_delivery_min)})`;
    const project=items.map((i,n)=>`${n+1}. ${i.v.code} ${i.v.name} — ${i.v.size}, ${i.v.color}, ${i.v.scheme}\n   Артикул ${i.sku} × ${i.qty} = от ${money(i.v.price*i.qty)}\n   ${new URL(base+i.v.url,location.href).href}`).join('\n')
      +`\n\nКонструкции: от ${money(goods)}\n${deliveryLine}\nИтого: от ${money(total)}`;
    const data=new FormData(form);
    data.set('source','cart');data.set('order_id',id);data.set('project',project);data.set('delivery',mode());
    if(pickup)data.delete('city');
    const button=form.querySelector('button[type="submit"]'),old=button.innerHTML;
    button.disabled=true;button.textContent='Отправляем…';status.textContent='';
    try{
      const res=await fetch(form.dataset.endpoint,{method:'POST',body:data});
      const json=await res.json().catch(()=>({}));
      if(!res.ok||!json.ok)throw new Error(json.message||'HTTP '+res.status);
      const number=json.order_id||id;
      try{sessionStorage.setItem('ps-last-order',JSON.stringify({id:number,total,goods,service,pickup,factory,items:items.map(i=>({title:`${i.v.code} · ${i.v.name}`,meta:`${i.v.size} · ${i.v.color}`,qty:i.qty,sum:i.v.price*i.qty}))}))}catch(e){}
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
      if(data.factory)factory=data.factory;
      const hint=form.querySelector('[data-delivery-hint]');
      if(hint&&services.install_delivery_zone)hint.textContent=`${services.install_delivery_zone}. Оценка ≈${services.install_delivery_pct}% от стоимости, от ${money(services.install_delivery_min)}. Замер бесплатно.`;
      // Артикулы, которых больше нет в продаже, убираем и сообщаем об этом
      const gone=cart.items().filter(i=>!catalog.has(i.sku));
      if(gone.length){gone.forEach(i=>cart.remove(i.sku));note.hidden=false;note.textContent='Часть товаров больше недоступна к заказу и убрана из корзины.'}
      render();
    })
    .catch(()=>{empty.hidden=false;empty.querySelector('p').textContent='Не удалось загрузить каталог. Обновите страницу.'});
})();
