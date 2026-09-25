class SiteFooter extends HTMLElement {
 connectedCallback(){const root=this.getAttribute('root')||'';this.innerHTML=`<footer class="site-footer"><div class="container"><div class="site-footer__brand">Portal Systems</div><div class="site-footer__grid"><div><h3>Системы</h3><a href="${root}systems/sliding/">HS · Sliding</a><a href="${root}catalog/#fs">FS · Folding</a></div><div><h3>Проект</h3><a href="${root}catalog/">Каталог</a><a href="${root}index.html#projects">Проекты</a></div><div><h3>Контакты</h3><p>Москва и Московская область</p></div><div><h3>Документы</h3><a href="#">Политика</a><a href="#">Реквизиты</a></div></div><div class="site-footer__bottom">Prototype · SEO fields intentionally blank</div></div></footer>`}
}
customElements.define('site-footer',SiteFooter);
