// Страница корзины /cart/: список товаров, количество, итог и оформление заказа.
// Цены и названия — из data/catalog.json (собирает tools/build.mjs), в корзине только артикулы.
// Заказ уходит в forms/send.php (source=cart), после успеха — /cart/done/?order=НОМЕР.
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

  const lines=()=>cart.items().map(i=>({...i,v:catalog.get(i.sku)})).filter(i=>i.v);

  const render=()=>{
    const items=lines();
    root.hidden=!items.length;
    empty.hidden=!!items.length;
    if(!items.length)return;
    list.innerHTML=items.map(({sku,qty,v})=>`
      <li class="cart-item" data-sku="${esc(sku)}">
        <a class="cart-item__img" href="${base+esc(v.url)}"><img src="${base+esc(v.image)}" alt="" loading="lazy"></a>
        <div class="cart-item__info">
          <a class="cart-item__title" href="${base+esc(v.url)}">${esc(v.code)} · ${esc(v.name)}</a>
          <p class="cart-item__meta">${esc(v.size)} · ${esc(v.color)}<br>${esc(v.scheme)}</p>
          <p class="cart-item__sku">Артикул ${esc(sku)}</p>
        </div>
        <div class="cart-item__qty" role="group" aria-label="Количество">
          <button type="button" data-qty="-1" aria-label="Уменьшить количество">−</button><output>${qty}</output><button type="button" data-qty="1" aria-label="Увеличить количество"${qty>=99?' disabled':''}>+</button>
        </div>
        <div class="cart-item__price"><small>от</small><strong>${money(v.price*qty)}</strong></div>
        <button class="cart-item__remove" type="button" data-remove>Удалить</button>
      </li>`).join('');
    const count=items.reduce((n,i)=>n+i.qty,0);
    root.querySelector('[data-cart-count]').textContent=count;
    root.querySelector('[data-cart-total]').textContent='от '+money(items.reduce((n,i)=>n+i.v.price*i.qty,0));
  };

  list.addEventListener('click',e=>{
    const item=e.target.closest('[data-sku]');
    if(!item)return;
    const sku=item.dataset.sku;
    const q=e.target.closest('[data-qty]');
    if(q){const it=cart.items().find(i=>i.sku===sku);cart.set(sku,(it?it.qty:0)+Number(q.dataset.qty))}
    if(e.target.closest('[data-remove]'))cart.remove(sku);
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
    const total=items.reduce((n,i)=>n+i.v.price*i.qty,0);
    const project=items.map((i,n)=>`${n+1}. ${i.v.code} ${i.v.name} — ${i.v.size}, ${i.v.color}, ${i.v.scheme}\n   Артикул ${i.sku} × ${i.qty} = от ${money(i.v.price*i.qty)}\n   ${new URL(base+i.v.url,location.href).href}`).join('\n')+`\n\nИтого: от ${money(total)}`;
    const data=new FormData(form);
    data.set('source','cart');data.set('order_id',id);data.set('project',project);
    const button=form.querySelector('button[type="submit"]'),old=button.innerHTML;
    button.disabled=true;button.textContent='Отправляем…';status.textContent='';
    try{
      const res=await fetch(form.dataset.endpoint,{method:'POST',body:data});
      const json=await res.json().catch(()=>({}));
      if(!res.ok||!json.ok)throw new Error(json.message||'HTTP '+res.status);
      const number=json.order_id||id;
      try{sessionStorage.setItem('ps-last-order',JSON.stringify({id:number,total,items:items.map(i=>({title:`${i.v.code} · ${i.v.name}`,meta:`${i.v.size} · ${i.v.color}`,qty:i.qty,sum:i.v.price*i.qty}))}))}catch(e){}
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
      // Артикулы, которых больше нет в продаже, убираем и сообщаем об этом
      const gone=cart.items().filter(i=>!catalog.has(i.sku));
      if(gone.length){gone.forEach(i=>cart.remove(i.sku));note.hidden=false;note.textContent='Часть товаров больше недоступна к заказу и убрана из корзины.'}
      render();
    })
    .catch(()=>{empty.hidden=false;empty.querySelector('p').textContent='Не удалось загрузить каталог. Обновите страницу.'});
})();
