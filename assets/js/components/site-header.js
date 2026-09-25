class SiteHeader extends HTMLElement {
  connectedCallback() {
    const root=this.getAttribute('root')||'';
    this.innerHTML=`<header class="site-header"><div class="site-header__inner"><a class="site-brand" href="${root}index.html">Portal Systems</a><nav class="site-nav" aria-label="Основная навигация"><a href="${root}systems/sliding/">Системы</a><a href="${root}catalog/">Каталог</a><a href="${root}index.html#projects">Проекты</a><a href="${root}contact/">Контакты</a></nav><button class="site-menu-button" type="button" aria-label="Открыть меню" aria-expanded="false"><span></span></button></div></header><aside class="site-menu" aria-hidden="true"><nav><a href="${root}systems/sliding/">Системы <span>→</span></a><a href="${root}catalog/">Каталог <span>→</span></a><a href="${root}index.html#projects">Проекты <span>→</span></a><a href="${root}contact/">Контакты <span>→</span></a></nav><div class="site-menu__meta"><span>Москва и Московская область</span></div></aside>`;
    const btn=this.querySelector('.site-menu-button'), menu=this.querySelector('.site-menu');
    btn.addEventListener('click',()=>{const open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));menu.classList.toggle('is-open',!open);menu.setAttribute('aria-hidden',String(open));document.body.classList.toggle('is-menu-open',!open)});
    menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{btn.setAttribute('aria-expanded','false');menu.classList.remove('is-open');menu.setAttribute('aria-hidden','true');document.body.classList.remove('is-menu-open')}));
  }
}
customElements.define('site-header',SiteHeader);
