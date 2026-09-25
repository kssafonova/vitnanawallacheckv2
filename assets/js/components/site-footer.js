(() => {
  const normBase=value=>{const base=(value||'./').trim();return base.endsWith('/')?base:base+'/'};
  class SiteFooter extends HTMLElement{
    connectedCallback(){
      if(this.shadowRoot)return;
      const base=normBase(this.dataset.base),root=this.attachShadow({mode:'open'});
      root.innerHTML=\`
      <style>
      :host{display:block;font-family:Arial,Helvetica,sans-serif}*{box-sizing:border-box}a{color:inherit;text-decoration:none}
      .footer{background:#080808;color:#f1f0eb;padding:60px 20px 22px;border-top:1px solid #292927}.in{width:min(100%,1440px);margin:auto}
      .brand{font-size:clamp(48px,15vw,150px);line-height:.72;font-weight:300;letter-spacing:-.075em;padding-bottom:36px;border-bottom:1px solid #2d2d2a}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:34px 20px;padding:34px 0 46px}
      h3{margin:0 0 13px;color:#77746d;font-size:8px;line-height:1;text-transform:uppercase;letter-spacing:.13em;font-weight:400}
      a,p{display:block;margin:0 0 8px;color:#d5d2c9;font-size:12px;line-height:1.45}a:hover{opacity:.62}
      .bottom{display:flex;justify-content:space-between;gap:20px;padding-top:16px;border-top:1px solid #2d2d2a;color:#6f6c65;font-size:8px;letter-spacing:.09em;text-transform:uppercase}
      @media(min-width:800px){.footer{padding:84px 48px 24px}.grid{grid-template-columns:repeat(4,1fr);gap:45px;padding:44px 0 62px}a,p{font-size:13px}}
      </style>
      <footer class="footer"><div class="in">
        <div class="brand">PORTAL SYSTEMS</div>
        <div class="grid">
          <div><h3>Системы</h3><a href="\${base}systems/hs/">Подъёмно-раздвижная HS</a><a href="\${base}index.html#systems">Складная FS</a><a href="\${base}index.html#systems">Панорамные окна</a></div>
          <div><h3>Проект</h3><a href="\${base}catalog/">Готовые конфигурации</a><a href="\${base}index.html#projects">Проекты</a><a href="\${base}index.html#calculator">Калькулятор</a></div>
          <div><h3>Бюро</h3><a href="\${base}index.html#why">Подход</a><a href="\${base}index.html#faq">FAQ</a><a href="\${base}index.html#contact">Контакты</a></div>
          <div><h3>Регион</h3><p>Москва и Московская область</p><p>Проектирование · производство · монтаж</p></div>
        </div>
        <div class="bottom"><span>© PORTAL SYSTEMS</span><span>Архитектурное остекление</span></div>
      </div></footer>\`;
    }
  }
  if(!customElements.get('site-footer'))customElements.define('site-footer',SiteFooter);
})();