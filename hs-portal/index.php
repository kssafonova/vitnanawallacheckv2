<?php
require __DIR__ . '/../includes/bootstrap.php';
$pageTitle = '';
$pageDescription = '';
$pagePath = '/hs-portal/';
$pageStyles = ["/assets/css/hs-demo.css"];
$pageScripts = ["/assets/js/hs-demo.js"];
require __DIR__ . '/../includes/head.php';
require __DIR__ . '/../includes/header.php';
require __DIR__ . '/../includes/mobile-menu.php';
?>
<main>
<?php require __DIR__ . '/../includes/components/hs-demo.php'; ?>
<section class="projects__cta"><a class="btn" href="/calculator/">Рассчитать HS-портал <span>→</span></a></section>
</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>
<?php require __DIR__ . '/../includes/scripts.php'; ?>
