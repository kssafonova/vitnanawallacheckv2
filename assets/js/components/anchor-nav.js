class AnchorNav extends HTMLElement{
  connectedCallback(){
    const raw=(this.getAttribute('items')||'').split('|').map(x=>x.trim()).filter(Boolean);
    const items=raw.map(x=>{const [id,label]=x.split(':');return{id,label:label||id}});
    this.innerHTML=`<nav class="anchor-nav" aria-label="Навигация по странице"><div class="anchor-nav__track">${items.map((x,i)=>`<a href="#${x.id}" class="${i===0?'is-active':''}">${x.label}</a>`).join('')}</div></nav>`;
    const links=[...this.querySelectorAll('a')],sections=items.map(x=>document.getElementById(x.id)).filter(Boolean);
    if(!('IntersectionObserver' in window))return;
    const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){links.forEach(a=>a.classList.toggle('is-active',a.getAttribute('href')==='#'+e.target.id));this.querySelector('a.is-active')?.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'})}})},{rootMargin:'-110px 0px -65% 0px',threshold:.01});
    sections.forEach(s=>io.observe(s));
  }
}
customElements.define('anchor-nav',AnchorNav);
