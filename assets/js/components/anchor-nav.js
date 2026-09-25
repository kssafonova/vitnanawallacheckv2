class AnchorNav extends HTMLElement{
  connectedCallback(){
    const links=[...this.querySelectorAll('a[href^="#"]')];
    const sections=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const setActive=(id)=>{links.forEach(a=>a.classList.toggle('is-active',a.getAttribute('href')==='#'+id));const current=links.find(a=>a.classList.contains('is-active'));current?.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'})};
    if(sections.length){const io=new IntersectionObserver(entries=>{entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio).slice(0,1).forEach(e=>setActive(e.target.id))},{rootMargin:'-130px 0px -60% 0px',threshold:[.01,.15,.35]});sections.forEach(s=>io.observe(s));}
  }
}
customElements.define('anchor-nav',AnchorNav);
