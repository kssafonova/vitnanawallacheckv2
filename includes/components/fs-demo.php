<section aria-labelledby="fsTitle" class="fs-demo" id="fsPortalDemo">
<header class="fs-demo__header">
<div class="fs-demo__intro">
<p class="fs-demo__eyebrow">FS · складная система</p>
<h1 class="fs-demo__title" id="fsTitle">Откройте проём почти полностью</h1>
<p class="fs-demo__lead">
            Потяните по визуализации или используйте ползунок — створки складываются гармошкой к левой стороне.
          </p>
</div>
<div aria-live="polite" class="fs-demo__status">
<span class="fs-demo__status-label">Положение</span>
<strong id="portalState">Закрыто</strong>
</div>
</header>
<div class="fs-demo__stage" id="portalStage">
<canvas aria-label="Интерактивная анимация открывания складного FS-портала" id="portalCanvas"></canvas>
<div aria-hidden="true" class="fs-demo__hint">
<span>←</span>
<span>Потяните</span>
<span>→</span>
</div>
</div>
<div class="fs-demo__controls">
<div class="fs-demo__range-wrap">
<div aria-hidden="true" class="fs-demo__range-labels">
<span>Закрыто</span>
<span>Открыто</span>
</div>
<input aria-label="Степень открытия FS-портала" class="fs-demo__range" id="portalProgress" max="100" min="0" step="1" type="range" value="0"/>
</div>
<button class="fs-demo__toggle" id="portalToggle" type="button">
          Открыть
        </button>
</div>
</section>
