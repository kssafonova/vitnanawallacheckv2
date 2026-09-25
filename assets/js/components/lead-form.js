class LeadForm extends HTMLElement{
  connectedCallback(){
    const dark=this.hasAttribute('dark'),label=this.getAttribute('button')||'Получить расчёт';
    this.innerHTML=`<form class="form ${dark?'form--dark':''}" novalidate><div class="form__grid form__grid--2"><label class="field"><span>Имя</span><input name="name" autocomplete="name" placeholder="Ваше имя" required></label><label class="field"><span>Телефон</span><input name="phone" autocomplete="tel" inputmode="tel" placeholder="+7 999 000-00-00" required></label></div><label class="form__consent"><input type="checkbox" required><span>Соглашаюсь на обработку данных. Текст политики будет подключён перед публикацией.</span></label><button class="btn ${dark?'btn--light':'btn--dark'} btn--full" type="submit">${label}<span>→</span></button><p class="form__status" aria-live="polite"></p></form>`;
    const form=this.querySelector('form'),status=this.querySelector('.form__status');
    form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form),name=String(fd.get('name')||'').trim(),digits=String(fd.get('phone')||'').replace(/\D/g,''),consent=form.querySelector('input[type=checkbox]').checked;if(!name||digits.length<10||!consent){status.textContent='Проверьте имя, телефон и согласие.';return}status.textContent='Форма готова. Endpoint будет подключён перед публикацией.'});
  }
}
customElements.define('lead-form',LeadForm);
