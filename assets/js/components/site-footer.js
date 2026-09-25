class SiteFooter extends HTMLElement{
  connectedCallback(){
    const root=this.getAttribute('root')||'';
    this.innerHTML=`<footer class="site-footer"><div class="container"><div class="site-footer__brand">PORTAL SYSTEMS</div><div class="site-footer__grid"><div><h4>Системы</h4><a href="${root}systems/sliding/">HS-порталы</a><a href="${root}catalog/#fs">FS-порталы</a></div><div><h4>Каталог</h4><a href="${root}catalog/">Готовые решения</a><a href="${root}#contact">Индивидуальный проект</a></div><div><h4>Проекты</h4><a href="${root}#projects">Архитектура</a><a href="${root}#approach">Подход</a></div><div><h4>Информация</h4><a href="${root}#contact">Контакты</a><a href="#">Политика</a></div></div><div class="site-footer__bottom">© 2026 · Prototype · SEO disabled</div></div></footer>`;
  }
}
customElements.define('site-footer',SiteFooter);
