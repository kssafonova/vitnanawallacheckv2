(() => {
  const normBase=value=>{const base=(value||'./').trim();return base.endsWith('/')?base:base+'/'};
  class SiteFooter extends HTMLElement{
    connectedCallback(){
      if(this.shadowRoot)return;
      const base=normBase(this.dataset.base),root=this.attachShadow({mode:'open'});
      root.innerHTML=`
      <style>
      :host{display:block;font-family:var(--font,'Manrope',Arial,sans-serif)}*{box-sizing:border-box}a{color:inherit;text-decoration:none}
      .footer{background:#050505;color:#f1f0eb;padding:clamp(56px,8vw,96px) var(--ui-pad,20px) calc(22px + env(safe-area-inset-bottom));border-top:1px solid #292927}.in{width:min(100%,1440px);margin:auto}
      .brand{font-size:clamp(34px,9.4vw,150px);line-height:.8;white-space:nowrap;font-weight:300;letter-spacing:-.05em;word-spacing:.12em;padding-bottom:34px;border-bottom:1px solid #2d2d2a}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:30px 18px;padding:34px 0 44px}
      h3{margin:0 0 14px;color:#8a877f;font-size:var(--fs-label,11px);line-height:1;text-transform:uppercase;letter-spacing:.13em;font-weight:500}
      a,p{display:block;margin:0 0 10px;color:#d7d4cb;font-size:var(--fs-small,13px);line-height:1.45}a:hover{opacity:.62}
      .bottom{display:flex;justify-content:space-between;gap:20px;padding-top:16px;border-top:1px solid #2d2d2a;color:#8a877f;font-size:var(--fs-label,11px);letter-spacing:.09em;text-transform:uppercase}
      @media(min-width:768px){.grid{grid-template-columns:repeat(4,1fr);gap:45px;padding:44px 0 62px}}
      </style>
      <footer class="footer"><div class="in">
        <div class="brand">PORTAL SYSTEMS</div>
        <div class="grid">
          <div><h3>Системы</h3><a href="${base}systems/hs/">Подъёмно-раздвижная HS</a><a href="${base}index.html#systems">Складная FS</a><a href="${base}index.html#systems">Панорамные окна</a></div>
          <div><h3>Проект</h3><a href="${base}catalog/">Готовые конфигурации</a><a href="${base}index.html#projects">Проекты</a><a href="${base}index.html#calculator">Калькулятор</a></div>
          <div><h3>Компания</h3><a href="${base}about/">О компании</a><a href="${base}about/#why">Почему мы</a><a href="${base}contacts/">Контакты</a><a href="${base}contacts/#pickup">Самовывоз</a><a href="${base}about/#requisites">Реквизиты</a></div>
          <div><h3>Связь</h3><a href="tel:+79774102479">+7 977 410-24-79</a><a href="mailto:info@steclodom.ru">info@steclodom.ru</a><p>Ежедневно, 10:00–20:00</p><p>Москва и Московская область</p></div>
        </div>
        <div class="bottom"><span>© PORTAL SYSTEMS</span><span>Архитектурное остекление</span></div>
      </div></footer>`;
    }
  }
  if(!customElements.get('site-footer'))customElements.define('site-footer',SiteFooter);
})();