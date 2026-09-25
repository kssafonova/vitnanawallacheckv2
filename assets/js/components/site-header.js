class SiteHeader extends HTMLElement {
  connectedCallback(){
    const root=this.getAttribute('root')||'';
    this.innerHTML=`<header class="site-header"><div class="site-header__inner"><a class="brand" href="${root}index.html" aria-label="На главную"><span>PORTAL SYSTEMS</span></a><nav class="desktop-nav" aria-label="Основная навигация"><a href="${root}systems/">Системы</a><a href="${root}catalog/">Каталог</a><a href="${root}index.html#projects">Проекты</a><a href="${root}index.html#calculator">Калькулятор</a><a href="${root}index.html#contact">Контакты</a></nav><button class="menu-btn" type="button" aria-label="Открыть меню" aria-expanded="false"><span></span></button></div></header><div class="mobile-menu" aria-hidden="true"><nav><a href="${root}systems/">Системы <span>↘</span></a><a href="${root}catalog/">Каталог <span>↘</span></a><a href="${root}index.html#projects">Проекты <span>↘</span></a><a href="${root}index.html#calculator">Калькулятор <span>↘</span></a><a href="${root}index.html#contact">Контакты <span>↘</span></a></nav><div class="mobile-menu__meta"><span>Москва и Московская область</span><span>Контакты будут добавлены перед публикацией</span></div><a class="btn btn--fill mobile-menu__cta" href="${root}index.html#calculator">Рассчитать проект <span>→</span></a></div>`;
    const btn=this.querySelector('.menu-btn'), menu=this.querySelector('.mobile-menu');
    const set=open=>{btn.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-hidden',String(!open));menu.classList.toggle('is-open',open);document.body.classList.toggle('menu-open',open)};
    btn.addEventListener('click',()=>set(btn.getAttribute('aria-expanded')!=='true'));
    menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>set(false)));
  }
}
customElements.define('site-header',SiteHeader);