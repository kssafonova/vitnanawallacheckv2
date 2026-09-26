// Каталог: вид листинга «Списком» / «Плиткой» (атрибут data-view на <main>, стили — catalog.css).
// По умолчанию на телефоне — список, шире — плитка; выбор посетителя запоминается в этом браузере.
(() => {
  const main=document.querySelector('main'),box=document.querySelector('.catalog-view');
  if(!main||!box)return;
  const KEY='ps-catalog-view';
  let saved=null;
  try{saved=localStorage.getItem(KEY)}catch(e){}
  const set=(view,remember)=>{
    main.dataset.view=view;
    box.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    if(remember)try{localStorage.setItem(KEY,view)}catch(e){}
  };
  set(saved==='list'||saved==='grid'?saved:(matchMedia('(max-width:639px)').matches?'list':'grid'));
  box.hidden=false;
  box.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)set(b.dataset.view,true)});
})();
