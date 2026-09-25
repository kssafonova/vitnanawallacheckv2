(function(){
 const dialog = document.getElementById('leadDialog');
 if(!dialog) return;
 const closeBtn = dialog.querySelector('.premium-sheet__close');
 function closeLeadDialog(){
  if(typeof dialog.close === 'function' && dialog.open){ dialog.close(); }
  else { dialog.removeAttribute('open'); }
 }
 if(closeBtn){
  closeBtn.addEventListener('click', function(event){
   event.preventDefault(); event.stopPropagation(); closeLeadDialog();
  });
 }
 dialog.addEventListener('cancel', function(event){ event.preventDefault(); closeLeadDialog(); });
 dialog.addEventListener('pointerdown', function(event){
  if(event.target === dialog) dialog.dataset.backdropPress = '1';
  else delete dialog.dataset.backdropPress;
 });
 dialog.addEventListener('pointerup', function(event){
  if(event.target === dialog && dialog.dataset.backdropPress === '1'){
   delete dialog.dataset.backdropPress; closeLeadDialog();
  }
 });
})();
