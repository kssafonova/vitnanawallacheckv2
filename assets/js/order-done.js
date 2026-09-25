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
    +`<li class="cart-done__total"><span>Итого</span><span>от ${money(order.total)}</span></li>`;
  list.hidden=false;
})();
