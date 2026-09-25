(()=>{
  const button=document.querySelector('.menu-btn');
  const menu=document.getElementById('mobileMenu');
  if(!button||!menu)return;
  let lastFocus=null;
  const focusables=()=>[...menu.querySelectorAll('a,button,[tabindex]:not([tabindex="-1"])')];
  const setMenu=open=>{
    if(open)lastFocus=document.activeElement;
    button.setAttribute('aria-expanded',String(open));
    menu.setAttribute('aria-hidden',String(!open));
    menu.classList.toggle('is-open',open);
    document.body.classList.toggle('menu-open',open);
    if(open)requestAnimationFrame(()=>focusables()[0]?.focus());
    else if(lastFocus instanceof HTMLElement)lastFocus.focus();
  };
  button.addEventListener('click',()=>setMenu(button.getAttribute('aria-expanded')!=='true'));
  menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){setMenu(false);return;}
    if(e.key!=='Tab'||button.getAttribute('aria-expanded')!=='true')return;
    const items=focusables(); if(!items.length)return;
    const first=items[0],last=items[items.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
})();
