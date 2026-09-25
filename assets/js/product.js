(() => {
  const form=document.querySelector('[data-product-form]');
  if(form){
    const status=form.querySelector('[data-form-status]');
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=form.querySelector('button[type="submit"]');
      const old=button?.innerHTML;
      if(button){button.disabled=true;button.textContent='Отправляем…'}
      if(status)status.textContent='';
      try{
        const endpoint=form.dataset.endpoint || '../../../forms/send.php';
        const res=await fetch(endpoint,{method:'POST',body:new FormData(form)});
        if(!res.ok)throw new Error('HTTP '+res.status);
        if(status)status.textContent='Спасибо. Получили запрос — свяжемся с вами для уточнения проекта.';
        form.reset();
      }catch(err){
        if(status)status.textContent='Не удалось отправить форму. Позвоните нам или попробуйте ещё раз.';
      }finally{
        if(button){button.disabled=false;button.innerHTML=old}
      }
    });
  }

  if(!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window){
    const items=[...document.querySelectorAll('[data-reveal]')];
    items.forEach(el=>el.classList.add('reveal-ready'));
    const io=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target)}
      })
    },{threshold:.12,rootMargin:'0px 0px -7% 0px'});
    items.forEach(el=>io.observe(el));
  }
})();