// Страница «Заказ принят»: номер из ?order=, состав — из sessionStorage (сохраняет cart.js перед переходом)
(() => {
  const id=(new URLSearchParams(location.search).get('order')||'').toUpperCase();
  if(!/^PS-\d{6}-[A-Z0-9]{4}$/.test(id))return;
  document.querySelector('[data-order-number]').textContent=id;
  document.querySelector('[data-order-wrap]').hidden=false;
  let order=null;
  try{order=JSON.parse(sessionStorage.getItem('ps-last-order')||'null')}catch(e){}
  if(!order||order.id!==id||!Array.isArray(order.items))return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
  const list=document.querySelector('[data-order-items]');
  list.innerHTML=order.items.map(i=>`<li><span><b>${esc(i.title)}</b><small>${esc(i.meta)} · ${i.qty} шт.</small></span><span>от ${money(i.sum)}</span></li>`).join('')
    +(typeof order.service==='number'?`<li><span><b>${order.pickup?'Самовывоз с производства':'Доставка и монтаж'}</b>${order.pickup&&order.factory?.address?`<small>${esc(order.factory.address)} · ${esc(order.factory.hours||'')}</small>`:'<small>предварительная оценка, точно — после замера</small>'}</span><span>${order.pickup?'0 ₽':'от '+money(order.service)}</span></li>`:'')
    +`<li class="cart-done__total"><span>Итого</span><span>от ${money(order.total)}</span></li>`
    +(order.eta?`<li><span><b>${order.pickup?'Самовывоз':'Доставка и монтаж'} ориентировочно с ${esc(order.eta)}</b><small>срок изготовления ${esc(order.days)} дн. · точную дату согласует менеджер при подтверждении заказа</small></span><span></span></li>`:'');
  list.hidden=false;
  if(order.pickup&&order.factory?.yandex_route){
    const a=document.querySelector('[data-order-route]');
    if(a){a.href=order.factory.yandex_route;a.hidden=false}
  }
})();
