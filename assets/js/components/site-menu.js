(() => {
  const normBase=value=>{const base=(value||'./').trim();return base.endsWith('/')?base:base+'/'};
  class SiteMenu extends HTMLElement{
    connectedCallback(){
      if(this.shadowRoot)return;
      const base=normBase(this.dataset.base),root=this.attachShadow({mode:'open'});
      root.innerHTML=\`
      <style>
      :host{display:block;position:relative;z-index:120;font-family:'Manrope',Arial,sans-serif;color:#fff}
      *{box-sizing:border-box}a{color:inherit;text-decoration:none}button{font:inherit;color:inherit}
      .head{height:72px;background:#050505;border-bottom:1px solid rgba(255,255,255,.18);display:flex;align-items:center}
      .in{width:min(100%,1440px);margin:auto;padding:0 20px;display:flex;align-items:center;justify-content:space-between;gap:22px}
      .brand{font-size:11px;font-weight:500;letter-spacing:.22em;white-space:nowrap}
      .nav{display:none;align-items:center;gap:27px;font-size:9px;font-weight:500;letter-spacing:.08em;text-transform:uppercase}
      .nav a{position:relative;padding:10px 0;color:#deddd8}.nav a:after{content:"";position:absolute;left:0;right:100%;bottom:4px;height:1px;background:currentColor;transition:.22s}.nav a:hover:after{right:0}
      .menu{width:44px;height:44px;border:0;background:transparent;position:relative;cursor:pointer}
      .menu i,.menu:before,.menu:after{content:"";position:absolute;left:9px;right:9px;height:1px;background:#fff;transition:.25s}.menu:before{top:14px}.menu i{top:22px}.menu:after{top:30px}
      .menu[aria-expanded="true"]:before{top:22px;transform:rotate(45deg)}.menu[aria-expanded="true"] i{opacity:0}.menu[aria-expanded="true"]:after{top:22px;transform:rotate(-45deg)}
      .panel{position:fixed;inset:72px 0 0;background:#050505;opacity:0;visibility:hidden;transform:translateY(-5px);transition:.22s;overflow:auto}
      .panel.open{opacity:1;visibility:visible;transform:none}.panel-in{width:min(100%,1440px);margin:auto;padding:10px 20px 38px}
      .links a{display:flex;align-items:end;justify-content:space-between;gap:20px;padding:17px 0;border-bottom:1px solid rgba(255,255,255,.18);font-size:clamp(30px,9vw,46px);line-height:.92;font-weight:300;letter-spacing:-.05em}
      .links a span:last-child{font-size:15px;color:#85827a}
      .meta{display:grid;gap:7px;margin-top:28px;color:#85827a;font-size:9px;line-height:1.5;letter-spacing:.07em;text-transform:uppercase}
      .cta{margin-top:20px;min-height:52px;padding:0 14px;border:1px solid #e5e2d9;color:#fff;display:flex;align-items:center;justify-content:space-between;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em}
      @media(min-width:900px){.head{height:88px}.in{padding:0 48px}.brand{font-size:12px}.nav{display:flex}.menu{display:none}.panel{display:none}}
      </style>
      <header class="head"><div class="in">
        <a class="brand" href="\${base}index.html#top">PORTAL SYSTEMS</a>
        <nav class="nav" aria-label="Основная навигация">
          <a href="\${base}systems/hs/">HS система</a><a href="\${base}index.html#systems">Системы</a><a href="\${base}catalog/">Каталог</a><a href="\${base}index.html#projects">Проекты</a><a href="\${base}index.html#calculator">Калькулятор</a><a href="\${base}index.html#contact">Контакты</a>
        </nav>
        <button class="menu" type="button" aria-expanded="false" aria-label="Открыть меню"><i></i></button>
      </div></header>
      <div class="panel" aria-hidden="true"><div class="panel-in">
        <nav class="links">
          <a href="\${base}systems/hs/"><span>HS система</span><span>↘</span></a>
          <a href="\${base}index.html#systems"><span>Все системы</span><span>↘</span></a>
          <a href="\${base}catalog/"><span>Каталог</span><span>↘</span></a>
          <a href="\${base}index.html#projects"><span>Проекты</span><span>↘</span></a>
          <a href="\${base}index.html#calculator"><span>Калькулятор</span><span>↘</span></a>
          <a href="\${base}index.html#contact"><span>Контакты</span><span>↘</span></a>
        </nav>
        <div class="meta"><span>Москва и Московская область</span><span>Панорамное остекление · HS · FS</span></div>
        <a class="cta" href="\${base}index.html#calculator"><span>Рассчитать проект</span><span>→</span></a>
      </div></div>\`;
      const btn=root.querySelector('.menu'),panel=root.querySelector('.panel');
      const setOpen=open=>{btn.setAttribute('aria-expanded',String(open));btn.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');panel.setAttribute('aria-hidden',String(!open));panel.classList.toggle('open',open);document.documentElement.style.overflow=open?'hidden':''};
      btn.addEventListener('click',()=>setOpen(btn.getAttribute('aria-expanded')!=='true'));
      panel.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
      this._esc=e=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('keydown',this._esc);
    }
    disconnectedCallback(){if(this._esc)document.removeEventListener('keydown',this._esc);document.documentElement.style.overflow=''}
  }
  if(!customElements.get('site-menu'))customElements.define('site-menu',SiteMenu);
})();