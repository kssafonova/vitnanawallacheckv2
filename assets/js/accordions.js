(()=>{
  for(const selector of ['.system','.why-item','.faq-item']){
    const items=[...document.querySelectorAll(selector)];
    items.forEach(item=>item.addEventListener('toggle',()=>{
      if(item.open)items.forEach(other=>{if(other!==item)other.open=false});
    }));
  }
})();
