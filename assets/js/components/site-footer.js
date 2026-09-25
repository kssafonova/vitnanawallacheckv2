(() => {
  const normBase=value=>{const base=(value||'./').trim();return base.endsWith('/')?base:base+'/'};
  class SiteFooter extends HTMLElement{
    connectedCallback(){
      if(this.shadowRoot)return;
      const base=normBase(this.dataset.base),root=this.attachShadow({mode:'open'});
      root.innerHTML=\`
      <style>
      :host{display:block;font-family:Arial,Helvetica,sans-serif}*{box-sizing:border-box}a{color:inherit;text-decoration:none}
      .footer{background:#050505;color:#fff;padding:58px 20px 22px;border-top:1px solid #272727}.in{width:min(100%,1440px);margin:auto}
      .brand{font-size:clamp(38px,12vw,110px);line-height:.82;font-weight:300;letter-spacing:-.065em;padding-bottom:32px;border-bottom:1px solid #333}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:30px 18px;padding:32px 0 40px}
      h3{margin:0 0 13px;color:#7f7f79;font-size:10px;line-height:1;text-transform:uppercase;letter-spacing:.13em;font-weight:400}
      a,p{display:block;margin:0 0 8px;font-size:13px;line-height:1.45}a:hover{opacity:.65}
      .bottom{display:flex;justify-content:space-between;gap:20px;padding-top:18px;border-top:1px solid #333;color:#777770;font-size:10px;letter-spacing:.08em;text-transform:uppercase}
      @media(min-width:800px){.footer{padding:82px 40px 26px}.grid{grid-template-columns:repeat(4,1fr);gap:36px;padding:42px 0 60px}a,p{font-size:14px}}
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