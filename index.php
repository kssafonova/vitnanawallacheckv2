<?php
require __DIR__ . '/includes/bootstrap.php';
$pageTitle = '';
$pageDescription = '';
$pagePath = '/';
$pageStyles = ['/assets/css/catalog.css','/assets/css/catalog-desktop.css','/assets/css/calculator.css','/assets/css/calculator-desktop.css'];
$pageScripts = ['/assets/js/systems.js','/assets/js/catalog.js','/assets/js/calculator/calculator.js','/assets/js/calculator/dialog.js','/assets/js/calculator/mobile.js'];
$preloadImage = '/assets/images/hero/hero-house.webp';
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
require __DIR__ . '/includes/mobile-menu.php';
?>
<main id="top">
<?php require __DIR__ . '/includes/sections/home/hero.php'; ?>
<?php require __DIR__ . '/includes/sections/home/systems.php'; ?>
<?php require __DIR__ . '/includes/sections/home/catalog-preview.php'; ?>
<?php require __DIR__ . '/includes/sections/home/projects-intro.php'; ?>
<?php require __DIR__ . '/includes/sections/home/projects.php'; ?>
<?php require __DIR__ . '/includes/sections/home/projects-cta.php'; ?>
<?php require __DIR__ . '/includes/sections/home/why.php'; ?>
<?php require __DIR__ . '/includes/sections/home/calculator.php'; ?>
<?php require __DIR__ . '/includes/sections/home/process.php'; ?>
<?php require __DIR__ . '/includes/sections/home/faq.php'; ?>
<?php require __DIR__ . '/includes/sections/home/resources.php'; ?>
<?php require __DIR__ . '/includes/sections/home/contact.php'; ?>
</main>
<?php require __DIR__ . '/includes/footer.php'; ?>
<?php require __DIR__ . '/includes/scripts.php'; ?>
