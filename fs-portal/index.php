<?php
require __DIR__ . '/../includes/bootstrap.php';
$pageTitle = '';
$pageDescription = '';
$pagePath = '/fs-portal/';
$pageStyles = ["/assets/css/fs-demo.css"];
$pageScripts = ["/assets/js/fs-demo.js"];
require __DIR__ . '/../includes/head.php';
require __DIR__ . '/../includes/header.php';
require __DIR__ . '/../includes/mobile-menu.php';
?>
<main>
<?php require __DIR__ . '/../includes/components/fs-demo.php'; ?>
<section class="projects__cta"><a class="btn" href="/calculator/">Рассчитать FS-портал <span>→</span></a></section>
</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>
<?php require __DIR__ . '/../includes/scripts.php'; ?>
