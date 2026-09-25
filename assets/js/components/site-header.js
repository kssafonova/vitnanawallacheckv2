import {url} from '../config.js';
class SiteHeader extends HTMLElement{
  connectedCallback(){
    const solid=this.hasAttribute('solid');
    this.innerHTML=`<header class="site-header ${solid?'is-solid':''}"><div class="site-header__inner">
      <a class="site-brand" href="${url('')}"><span class="site-brand__rule"></span><span class="site-brand__word">PORTAL SYSTEMS</span><span class="site-brand__rule"></span></a>
      <nav class="site-nav" aria-label="Основная навигация"><a href="${url('systems/sliding/')}">Системы</a><a href="${url('catalog/')}">Каталог</a><a href="${url('index.html#projects')}">Проекты</a><a href="${url('index.html#approach')}">Подход</a><a href="${url('index.html#contact')}">Контакты</a></nav>
      <button class="menu-btn" aria-expanded="false" aria-label="Меню"><span></span><span></span><span></span></button>
    </div></header>
    <div class="mobile-menu"><nav><a href="${url('systems/sliding/')}">Системы <span>↘</span></a><a href="${url('catalog/')}">Каталог <span>↘</span></a><a href="${url('index.html#projects')}">Проекты <span>↘</span></a><a href="${url('index.html#approach')}">Подход <span>↘</span></a><a href="${url('index.html#contact')}">Контакты <span>↘</span></a></nav><div class="mobile-menu__meta">Контакты будут добавлены перед публикацией.</div></div>`;
    const btn=this.querySelector('.menu-btn'), menu=this.querySelector('.mobile-menu');
    btn?.addEventListener('click',()=>{const open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));menu.classList.toggle('is-open',!open);document.body.classList.toggle('menu-open',!open)});
    menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{btn.setAttribute('aria-expanded','false');menu.classList.remove('is-open');document.body.classList.remove('menu-open')}));
  }
}
customElements.define('site-header',SiteHeader);
