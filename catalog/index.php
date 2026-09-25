<?php
require __DIR__.'/../includes/bootstrap.php';
$products=require __DIR__.'/../config/catalog.php';
$pageTitle='';$pageDescription='';$pagePath='/catalog/';$pageStyles=['/assets/css/catalog.css','/assets/css/catalog-desktop.css'];$pageScripts=['/assets/js/catalog.js'];
$hsCount=count(array_filter($products,fn($p)=>$p['family']==='hs'));$fsCount=count(array_filter($products,fn($p)=>$p['family']==='fs'));
require __DIR__.'/../includes/head.php';require __DIR__.'/../includes/header.php';require __DIR__.'/../includes/mobile-menu.php';
?>
<main>
<section class="catalog-hero"><div class="wrap"><div class="catalog-hero__meta"><span>Product catalogue · prototype</span><span>ALUMARK</span></div><h1>Порталы <span>как продукт</span></h1><div class="catalog-hero__bottom"><p>Пять базовых моделей без дублирования карточек по цветам. Цвет и направление открывания живут как вариации SKU внутри товарной модели.</p><div class="catalog-hero__count"><b><?= count($products) ?></b><span>базовых моделей</span></div></div></div></section>
<section class="catalog-shell"><div class="wrap">
<div class="catalog-tools"><div class="catalog-tools__inner"><button class="catalog-filter is-active" data-catalog-filter="all">Все <span class="catalog-filter__count"><?= count($products) ?></span></button><button class="catalog-filter" data-catalog-filter="hs">HS <span class="catalog-filter__count"><?= $hsCount ?></span></button><button class="catalog-filter" data-catalog-filter="fs">FS <span class="catalog-filter__count"><?= $fsCount ?></span></button></div></div>
<div class="catalog-note"><p>Товарная структура уже содержит фиксированные цену, наличие, срок, цветовые варианты и отдельный SKU для направления L/R. SEO, финальные ЧПУ, YML и JSON-LD пока отключены и оставлены пустыми в конфиге.</p><span>Prototype / commerce-ready</span></div>
<div class="catalog-grid" data-catalog-grid><?php foreach($products as $product) require __DIR__.'/../includes/components/product-card.php'; ?></div>
<div class="catalog-custom"><span class="catalog-custom__index">Individual</span><div><h2>Нужен другой размер или схема?</h2><p>Типовые товары остаются фиксированными офферами. Нестандартный проём уходит в калькулятор как отдельный проект.</p></div><div class="catalog-custom__actions"><a class="btn" href="/calculator/">Собрать проект <span>→</span></a><a class="btn btn--fill" href="/contact/">Отправить размеры <span>→</span></a></div></div>
</div></section></main>
<?php require __DIR__.'/../includes/footer.php';require __DIR__.'/../includes/scripts.php'; ?>
