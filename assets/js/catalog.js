(()=>{
  const grid=document.querySelector('[data-catalog-grid]');
  const filters=[...document.querySelectorAll('[data-catalog-filter]')];
  const cards=[...document.querySelectorAll('[data-product-card]')];
  if(grid&&filters.length){
    filters.forEach(btn=>btn.addEventListener('click',()=>{
      const value=btn.dataset.catalogFilter||'all';
      filters.forEach(x=>x.classList.toggle('is-active',x===btn));
      grid.classList.add('is-filtering');
      cards.forEach(card=>{
        const visible=value==='all'||card.dataset.family===value;
        card.classList.toggle('is-visible',visible);
        card.hidden=!visible;
      });
      requestAnimationFrame(()=>setTimeout(()=>grid.classList.remove('is-filtering'),180));
    }));
  }
  document.querySelectorAll('[data-card-view]').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      const card=btn.closest('[data-product-card]');
      if(!card)return;
      const next=!card.classList.contains('is-open-view');
      card.classList.toggle('is-open-view',next);
      btn.setAttribute('aria-label',next?'Показать портал в закрытом виде':'Показать портал в открытом виде');
    });
  });
})();
