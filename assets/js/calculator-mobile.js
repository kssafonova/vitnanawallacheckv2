(function(){
  var closed=document.getElementById('portalStateClosedBtn');
  var open=document.getElementById('portalStateOpenBtn');
  var mobileButtons=[].slice.call(document.querySelectorAll('[data-mobile-portal-state]'));
  if(!closed || !open || !mobileButtons.length) return;
  function sync(){
    var isOpen=open.classList.contains('is-active');
    mobileButtons.forEach(function(btn){
      var active=(btn.getAttribute('data-mobile-portal-state')==='open')===isOpen;
      btn.classList.toggle('is-active',active);
      btn.setAttribute('aria-pressed',String(active));
    });
    document.querySelectorAll('.mobile-project-visual__preview .portal-visual').forEach(function(v){v.classList.toggle('is-open-view',isOpen);});
  }
  mobileButtons.forEach(function(btn){
    btn.addEventListener('click',function(){
      (btn.getAttribute('data-mobile-portal-state')==='open'?open:closed).click();
      sync();
    });
  });
  new MutationObserver(sync).observe(open,{attributes:true,attributeFilter:['class','aria-pressed']});
  document.querySelectorAll('.mobile-project-visual__preview').forEach(function(el){new MutationObserver(sync).observe(el,{childList:true,subtree:true});});
  sync();
})();
