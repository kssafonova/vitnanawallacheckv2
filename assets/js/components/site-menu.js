(() => {
  const normBase=value=>{const base=(value||'./').trim();return base.endsWith('/')?base:base+'/'};
  class SiteMenu extends HTMLElement{
    connectedCallback(){
      if(this.shadowRoot)return;
      const base=normBase(this.dataset.base),root=this.attachShadow({mode:'open'});
      root.innerHTML=\`
      <style>
      :host{display:block;position:relative;z-index:100;font-family:Arial,Helvetica,sans-serif;color:#fff}
      *{box-sizing:border-box}a{color:inherit;text-decoration:none}button{font:inherit;color:inherit}
      .head{height:136px;background:#050505;border-bottom:1px solid rgba(255,255,255,.32);display:flex;align-items:center}
      .in{width:min(100%,1440px);margin:auto;padding:0 20px;display:flex;align-items:center;justify-content:space-between;gap:24px}
      .brand{display:flex;align-items:center;gap:18px;min-width:0;font-size:14px;letter-spacing:.34em;white-space:nowrap}
      .brand:before,.brand:after{content:"";width:1px;height:74px;background:rgba(255,255,255,.42)}
      .nav{display:none;align-items:center;gap:30px;font-size:12px;letter-spacing:.06em;text-transform:uppercase}
      .nav a{position:relative;padding:10px 0}.nav a:after{content:"";position:absolute;left:0;right:100%;bottom:4px;height:1px;background:currentColor;transition:.22s}.nav a:hover:after{right:0}
      .menu{width:52px;height:52px;border:0;background:transparent;position:relative;cursor:pointer}
      .menu i,.menu:before,.menu:after{content:"";position:absolute;left:8px;right:8px;height:1px;background:#fff;transition:.25s}.menu:before{top:15px}.menu i{top:25px}.menu:after{top:35px}
      .menu[aria-expanded="true"]:before{top:25px;transform:rotate(45deg)}.menu[aria-expanded="true"] i{opacity:0}.menu[aria-expanded="true"]:after{top:25px;transform:rotate(-45deg)}
      .panel{position:fixed;inset:136px 0 0;background:#050505;opacity:0;visibility:hidden;transform:translateY(-8px);transition:.23s;overflow:auto}
      .panel.open{opacity:1;visibility:visible;transform:none}.panel-in{width:min(100%,1440px);margin:auto;padding:28px 20px 44px}
      .links a{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 0;border-bottom:1px solid rgba(255,255,255,.22);font-size:30px;line-height:1;letter-spacing:-.04em}
      .meta{display:grid;gap:10px;margin-top:34px;color:#a8a8a1;font-size:13px;line-height:1.5}
      .cta{margin-top:24px;min-height:54px;padding:0 16px;border:1px solid #c9bb91;background:#c9bb91;color:#111;display:flex;align-items:center;justify-content:space-between;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
      @media(min-width:900px){.head{height:104px}.in{padding:0 40px}.brand:before,.brand:after{height:60px}.nav{display:flex}.menu{display:none}.panel{display:none}}
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