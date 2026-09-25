import {url} from '../config.js';
class SiteFooter extends HTMLElement{
  connectedCallback(){this.innerHTML=`<footer class="site-footer"><div class="u-container"><div class="site-footer__brand">PORTAL SYSTEMS</div><div class="site-footer__grid"><div><h3>Системы</h3><a href="${url('systems/sliding/')}">Подъёмно-раздвижные</a><a href="${url('catalog/#fs')}">Складные</a></div><div><h3>Каталог</h3><a href="${url('catalog/#hs')}">HS-порталы</a><a href="${url('catalog/#fs')}">FS-порталы</a></div><div><h3>Проект</h3><a href="${url('index.html#projects')}">Проекты</a><a href="${url('index.html#contact')}">Отправить проект</a></div><div><h3>Контакты</h3><p>Поля будут заполнены перед публикацией.</p></div></div><div class="site-footer__bottom"><span>Prototype</span><span>Архитектурное остекление</span></div></div></footer>`}
}
customElements.define('site-footer',SiteFooter);
