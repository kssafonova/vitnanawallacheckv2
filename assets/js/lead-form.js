(()=>{
  const csrf=document.querySelector('meta[name="csrf-token"]')?.content||'';
  document.querySelectorAll('[data-lead-form]').forEach(form=>{
    const status=form.querySelector('.form-status');
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const fd=new FormData(form);
      const phone=String(fd.get('phone')||'').trim();
      if(phone.replace(/\D/g,'').length<10){if(status)status.textContent='Проверьте номер телефона.';return;}
      if(!form.querySelector('[name="privacy_consent"]:checked')){if(status)status.textContent='Подтвердите согласие с политикой конфиденциальности.';return;}
      if(csrf)fd.set('csrf_token',csrf);
      const submit=form.querySelector('[type="submit"]');
      const initial=submit?.textContent||'Отправить';
      if(submit){submit.disabled=true;submit.textContent='Отправляем…';}
      if(status)status.textContent='';
      try{
        const res=await fetch(form.action||'/api/lead.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'},credentials:'same-origin'});
        const data=await res.json();
        if(!res.ok||!data.ok)throw new Error(data.message||'Ошибка отправки');
        if(status)status.textContent='Спасибо. Заявка отправлена инженеру.';
        form.reset();
      }catch(err){if(status)status.textContent='Не удалось отправить заявку. Позвоните: ';}
      finally{if(submit){submit.disabled=false;submit.textContent=initial;}}
    });
  });
})();
