<section aria-labelledby="hsTitle" class="hs-demo" id="hsPortalDemo">
<header class="hs-demo__header">
<div class="hs-demo__intro">
<p class="hs-demo__eyebrow">HS · подъёмно-сдвижная система</p>
<h1 class="hs-demo__title" id="hsTitle">Плавное открывание больших проёмов</h1>
<p class="hs-demo__lead">
            Потяните по визуализации или используйте ползунок — активная створка сначала слегка поднимается,
            затем плавно уходит вправо по направляющим.
          </p>
</div>
<div aria-live="polite" class="hs-demo__status">
<span class="hs-demo__status-label">Положение</span>
<strong id="portalState">Закрыто</strong>
</div>
</header>
<div class="hs-demo__stage" id="portalStage">
<canvas aria-label="Интерактивная анимация открывания HS-портала" id="portalCanvas"></canvas>
<div aria-hidden="true" class="hs-demo__hint">
<span>←</span>
<span>Потяните</span>
<span>→</span>
</div>
</div>
<div class="hs-demo__controls">
<div class="hs-demo__range-wrap">
<div aria-hidden="true" class="hs-demo__range-labels">
<span>Закрыто</span>
<span>Открыто</span>
</div>
<input aria-label="Степень открытия HS-портала" class="hs-demo__range" id="portalProgress" max="100" min="0" step="1" type="range" value="0"/>
</div>
<button class="hs-demo__toggle" id="portalToggle" type="button">
          Открыть
        </button>
</div>
</section>
