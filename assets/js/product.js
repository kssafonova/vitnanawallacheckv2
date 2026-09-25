// Страницы вариантов собирает tools/build.mjs — вся информация уже в HTML.
// Здесь только поведение: отправка формы и появление блоков при прокрутке.
(() => {
  const initForm=()=>{
    const form=document.querySelector('[data-product-form]');
    if(!form)return;
    const status=form.querySelector('[data-form-status]');
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=form.querySelector('button[type="submit"]');
      const old=button?.innerHTML;
      if(button){button.disabled=true;button.textContent='Отправляем…'}
      if(status)status.textContent='';
      try{
        const res=await fetch(form.dataset.endpoint,{method:'POST',body:new FormData(form)});
        if(!res.ok)throw new Error('HTTP '+res.status);
        if(status)status.textContent='Спасибо. Получили запрос — свяжемся с вами для уточнения проекта.';
        form.reset();
      }catch(e){
        if(status)status.textContent='Не удалось отправить форму. Позвоните нам или попробуйте ещё раз.';
      }finally{
        if(button){button.disabled=false;button.innerHTML=old}
      }
    });
  };

  const initReveal=()=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver' in window))return;
    const items=[...document.querySelectorAll('[data-reveal]')];
    items.forEach(el=>el.classList.add('reveal-ready'));
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target)}
    }),{threshold:.12,rootMargin:'0px 0px -7% 0px'});
    items.forEach(el=>io.observe(el));
  };

  // Фото «Закрыто / Открыто» — один ракурс, переключение без перезагрузки
  const initMedia=()=>{
    const media=document.querySelector('[data-media-toggle]');
    if(!media)return;
    media.addEventListener('click',e=>{
      const btn=e.target.closest('[data-media-state]');
      if(!btn)return;
      const open=btn.dataset.mediaState==='open';
      media.classList.toggle('is-open',open);
      media.querySelectorAll('[data-media-state]').forEach(b=>{const on=b===btn;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on))});
    });
  };

  initForm();initReveal();initMedia();
})();
