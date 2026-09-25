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
 * 5. Adds a cross-check between thermal contour and glazing package: warns
 *    when the combination is commercially/physically pointless (e.g. cold
 *    contour + energy-saving multifunctional glass, or warm contour +
 *    basic tempered glass with no coating).
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

  // Matches THERMAL_CONTOURS priceFactor values inside calculator.js.
  var WARM_FACTOR = 1.08;
  var COLD_FACTOR = 0.94;

  function contourGlazingNote(thermalFactor, glazingArg){
    var isCold = Math.abs(thermalFactor - COLD_FACTOR) < 0.001;
    var isWarm = Math.abs(thermalFactor - WARM_FACTOR) < 0.001;
    var glazingLabel = glazingArg && glazingArg.label ? glazingArg.label : '';

    if (isCold && glazingLabel === 'Мультифункция') {
      return 'в холодном контуре энергопокрытие стекла почти бессмысленно — без терморазрыва в раме его эффект теряется. Для сезонной террасы дешевле взять закалённое стекло.';
    }
    if (isCold && glazingLabel === 'Триплекс') {
      return 'в холодном контуре триплекс даёт безопасность и акустику, но не тепло — если цель только в тепле, дешевле взять закалённое.';
    }
    if (isWarm && glazingLabel === 'Закалённое') {
      return 'для круглогодичного проживания рекомендуем стеклопакет с энергосберегающим покрытием — иначе тёплый профиль частично теряет смысл из-за простого стекла.';
    }
    return null;
  }

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
    var notes = [];

    if (aestheticWarning) {
      notes.push('створки получаются узкими при таком количестве секций — фасад может выглядеть дробным. рекомендуем меньше секций или другую ширину проёма');
    }

    var cgNote = contourGlazingNote(args.thermalFactor, args.glazing);
    if (cgNote) {
      notes.push(cgNote);
      result.contourGlazingWarning = true;
    }

    if (notes.length > 0) {
      var joined = notes.join('. ');
      result.customerNote = joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
    }

    result.proportionRatio = proportionRatio;
    result.aestheticWarning = aestheticWarning;
    return result;
  };

  window.pickRecommendedOption = function(availableOptions){
    var safeOptions = availableOptions.filter(function(option){
      return option.internal.loadRatio <= SAFE_LOAD_RATIO && !option.aestheticWarning && !option.contourGlazingWarning;
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

/**
 * PATCH 2 — UI-level: hides the "Мультифункция" glazing card while the cold
 * contour is selected, and removes the default active highlighting from
 * step 2 (thermal contour / glazing) on initial page load. NOTE: this only
 * clears the *visual* highlighting on load — calculator.js's own internal
 * defaults (warm contour, multifunctional glazing) still drive the first
 * calculation until the user clicks a card, because that internal state
 * variable is not exposed outside calculator.js. Wrapping setThermalContour/
 * setGlazing (both are global function declarations) lets us react to every
 * user click and keep the hidden-card case consistent.
 */
(function(){
  if (typeof window.setThermalContour !== 'function' ||
      typeof window.setGlazing !== 'function') {
    return;
  }

  var userTouchedThermal = false;
  var userTouchedGlazing = false;

  function syncGlazingVisibility(isCold){
    document.querySelectorAll('[data-glazing]').forEach(function(card){
      if (card.dataset.glazing === 'multifunctional') {
        card.hidden = isCold;
      }
    });
  }

  var originalSetThermalContour = window.setThermalContour;
  window.setThermalContour = function(thermalContour){
    originalSetThermalContour(thermalContour);
    userTouchedThermal = true;
    var isCold = thermalContour === 'cold';
    syncGlazingVisibility(isCold);
    if (isCold) {
      var activeCard = document.querySelector('[data-glazing].is-active');
      if (activeCard && activeCard.dataset.glazing === 'multifunctional') {
        window.setGlazing('triplex');
      }
    }
  };

  var originalSetGlazing = window.setGlazing;
  window.setGlazing = function(glazing){
    originalSetGlazing(glazing);
    userTouchedGlazing = true;
  };

  function clearStep2DefaultHighlighting(){
    if (!userTouchedThermal) {
      document.querySelectorAll('[data-thermal].is-active').forEach(function(c){ c.classList.remove('is-active'); });
    }
    if (!userTouchedGlazing) {
      document.querySelectorAll('[data-glazing].is-active').forEach(function(c){ c.classList.remove('is-active'); });
    }
  }

  syncGlazingVisibility(false); // warm is calculator.js's initial default
  clearStep2DefaultHighlighting();
})();