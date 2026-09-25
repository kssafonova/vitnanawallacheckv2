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

/**
 * PATCH — wraps existing global functions from calculator.js (loaded before
 * this file). Does not modify calculator.js itself.
 * 1. Hides leaf configurations that are too narrow to look good (prison-bar
 *    effect), even if they pass weight/size engineering checks.
 * 2. Excludes visually-borderline configurations from being recommended.
 * 3. Fixes the recommendation tiebreak to match the documented business
 *    rule: on equal openRatio, prefer the higher price.
 * 4. Fixes calculateHsPortal() so its thermalContour parameter actually
 *    controls the thermal contour instead of silently remapping to the
 *    glazing package axis.
 */
(function(){
  if (typeof window.evaluateFramework !== 'function' ||
      typeof window.evaluatePreset !== 'function' ||
      typeof window.pickRecommendedOption !== 'function' ||
      typeof window.calculatePortal !== 'function') {
    return; // calculator.js did not load as expected — do nothing.
  }

  var AESTHETIC_HIDE_RATIO = 0.35;
  var AESTHETIC_WARN_RATIO = 0.5;
  var SAFE_LOAD_RATIO = 0.8; // must match the value inside calculator.js

  var originalEvaluateFramework = window.evaluateFramework;
  window.evaluateFramework = function(args){
    var result = originalEvaluateFramework(args);
    if (!result) return null;
    var proportionRatio = result.leafWidthMm / args.height;
    if (proportionRatio < AESTHETIC_HIDE_RATIO) return null;
    result.proportionRatio = proportionRatio;
    return result;
  };

  var originalEvaluatePreset = window.evaluatePreset;
  window.evaluatePreset = function(args){
    var result = originalEvaluatePreset(args);
    if (!result.available) return result;
    var proportionRatio = result.leafWidthMm / args.height;
    var aestheticWarning = proportionRatio < AESTHETIC_WARN_RATIO;
    if (aestheticWarning) {
      result.customerNote = "Створки получаются узкими при таком количестве секций — фасад может выглядеть дробным. Рекомендуем меньше секций или другую ширину проёма.";
    }
    result.proportionRatio = proportionRatio;
    result.aestheticWarning = aestheticWarning;
    return result;
  };

  window.pickRecommendedOption = function(availableOptions){
    var safeOptions = availableOptions.filter(function(option){
      return option.internal.loadRatio <= SAFE_LOAD_RATIO && !option.aestheticWarning;
    });

    if (safeOptions.length > 0) {
      var sorted = safeOptions.slice().sort(function(a, b){
        if (a.openRatio !== b.openRatio) return b.openRatio - a.openRatio;
        return b.price - a.price; // tie -> prefer higher price, as documented
      });
      return { option: sorted[0], isSafePick: true };
    }

    var safestAvailable = availableOptions.slice().sort(function(a, b){
      return a.internal.loadRatio - b.internal.loadRatio;
    });
    return { option: safestAvailable[0], isSafePick: false };
  };

  window.calculateHsPortal = function(width, height, thermalContour){
    var validContour = (thermalContour === 'cold') ? 'cold' : 'warm';
    return window.calculatePortal({
      type: 'HS',
      width: width,
      height: height,
      thermalContour: validContour,
    });
  };
})();