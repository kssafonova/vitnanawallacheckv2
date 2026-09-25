<?php
$catalogProducts = require dirname(__DIR__, 3) . '/config/catalog.php';
?>
<section class="home-catalog" aria-labelledby="homeCatalogTitle">
  <div class="wrap">
    <div class="home-catalog__head">
      <div><p class="eyebrow">Типовые решения</p><h2 id="homeCatalogTitle">Каталог</h2></div>
      <a href="/catalog/">Смотреть все модели ↗</a>
    </div>
    <div class="catalog-grid">
      <?php foreach ($catalogProducts as $product): ?>
        <?php require dirname(__DIR__, 2) . '/components/product-card.php'; ?>
      <?php endforeach; ?>
    </div>
    <div class="home-catalog__more"><a class="btn" href="/catalog/">Открыть каталог <span>→</span></a></div>
  </div>
</section>
