// Информационные страницы: карта Яндекса по нажатию и отправка формы.
(() => {
  // Карта грузится только когда посетитель сам попросил: без сторонних запросов и лишнего веса при открытии страницы
  document.querySelectorAll('[data-map]').forEach(map=>{
    const btn=map.querySelector('[data-map-load]');
    if(!btn)return;
    btn.addEventListener('click',()=>{
      const frame=document.createElement('iframe');
      frame.src=map.dataset.mapSrc;
      frame.title='Производство PORTAL SYSTEMS на Яндекс Картах';
      frame.loading='lazy';
      frame.allowFullscreen=true;
      frame.referrerPolicy='strict-origin-when-cross-origin';
      map.querySelector('.ct-map__stub')?.remove();
      map.appendChild(frame);
    });
  });

  document.querySelectorAll('[data-page-form]').forEach(form=>{
    const status=form.querySelector('[data-form-status]');
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=form.querySelector('button[type="submit"]'),old=button.innerHTML;
      button.disabled=true;button.textContent='Отправляем…';status.textContent='';
      try{
        const res=await fetch(form.dataset.endpoint,{method:'POST',body:new FormData(form)});
        const json=await res.json().catch(()=>({}));
        if(!res.ok||!json.ok)throw new Error(json.message||'');
        status.textContent='Спасибо! Перезвоним в рабочее время.';
        form.reset();
      }catch(err){
        status.textContent=(err.message?err.message+' ':'')+'Не удалось отправить. Позвоните нам: +7 977 410-24-79.';
      }finally{button.disabled=false;button.innerHTML=old}
    });
  });
})();
