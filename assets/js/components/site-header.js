class SiteHeader extends HTMLElement{
  connectedCallback(){
    const root=this.getAttribute('root')||'';
    this.innerHTML=`<header class="site-header"><div class="site-header__inner">
      <a class="site-brand" href="${root}"><span class="site-brand__word">PORTAL SYSTEMS</span></a>
      <nav class="site-nav" aria-label="Основная навигация"><a href="${root}systems/sliding/">Системы</a><a href="${root}catalog/">Каталог</a><a href="${root}#projects">Проекты</a><a href="${root}#approach">Подход</a><a href="${root}#contact">Контакты</a></nav>
      <button class="menu-btn" type="button" aria-expanded="false" aria-label="Открыть меню"><span></span><span></span><span></span></button>
    </div></header><div class="mobile-menu"><nav><a href="${root}systems/sliding/">Системы <span>↘</span></a><a href="${root}catalog/">Каталог <span>↘</span></a><a href="${root}#projects">Проекты <span>↘</span></a><a href="${root}#approach">Подход <span>↘</span></a><a href="${root}#contact">Контакты <span>↘</span></a></nav><div class="mobile-menu__meta">Москва и МО<br>Контакты будут добавлены перед публикацией.</div></div>`;
    const btn=this.querySelector('.menu-btn'),menu=this.querySelector('.mobile-menu');
    const close=()=>{btn?.setAttribute('aria-expanded','false');menu?.classList.remove('is-open');document.body.classList.remove('menu-open')};
    btn?.addEventListener('click',()=>{const open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));menu.classList.toggle('is-open',!open);document.body.classList.toggle('menu-open',!open)});
    menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  }
}
customElements.define('site-header',SiteHeader);
