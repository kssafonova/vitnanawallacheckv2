(()=>{
 const menuBtn=document.querySelector('.menu-btn'), menu=document.getElementById('mobileMenu');
 const setMenu=open=>{menuBtn.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-hidden',String(!open));menu.classList.toggle('is-open',open);document.body.classList.toggle('menu-open',open)};
 menuBtn.addEventListener('click',()=>setMenu(menuBtn.getAttribute('aria-expanded')!=='true'));
 menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));

 const systemItems=[...document.querySelectorAll('.system')];
 systemItems.forEach(item=>item.addEventListener('toggle',()=>{if(item.open) systemItems.forEach(other=>{if(other!==item) other.open=false})}));
 const whyItems=[...document.querySelectorAll('.why-item')];
 whyItems.forEach(item=>item.addEventListener('toggle',()=>{if(item.open) whyItems.forEach(other=>{if(other!==item) other.open=false})}));
 const faqItems=[...document.querySelectorAll('.faq-item')];
 faqItems.forEach(item=>item.addEventListener('toggle',()=>{if(item.open) faqItems.forEach(other=>{if(other!==item) other.open=false})}));


 const form=document.getElementById('contactForm'), status=document.getElementById('formStatus');
 if(form){form.addEventListener('submit',async e=>{
  e.preventDefault();
  const fd=new FormData(form);
  const phone=(fd.get('phone')||'').toString().trim();
  if(phone.replace(/\D/g,'').length<10){status.textContent='Проверьте номер телефона.';return}
  const submit=form.querySelector('[type=submit]');
  const initial=submit?.textContent||'Получить расчёт →';
  if(submit){submit.disabled=true;submit.textContent='Отправляем…'}
  status.textContent='';
  fd.append('source','contact');
  try{
   const res=await fetch('forms/send.php',{method:'POST',body:fd,headers:{'X-Requested-With':'XMLHttpRequest'}});
   const data=await res.json();
   if(!res.ok||!data.ok) throw new Error(data.message||'Ошибка отправки');
   status.textContent='Спасибо. Заявка отправлена инженеру.';
   form.reset();
  }catch(err){status.textContent='Не удалось отправить заявку. Позвоните: ';}
  finally{if(submit){submit.disabled=false;submit.textContent=initial}}
 });}
})();
