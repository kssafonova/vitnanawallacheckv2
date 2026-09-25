<?php
require __DIR__ . '/../includes/bootstrap.php';
$pageTitle = '';
$pageDescription = '';
$pagePath = '/calculator/';
$pageStyles = ["/assets/css/calculator.css", "/assets/css/calculator-desktop.css"];
$pageScripts = ["/assets/js/calculator/calculator.js", "/assets/js/calculator/dialog.js", "/assets/js/calculator/mobile.js"];
require __DIR__ . '/../includes/head.php';
require __DIR__ . '/../includes/header.php';
require __DIR__ . '/../includes/mobile-menu.php';
?>
<main>
<?php require __DIR__ . '/../includes/sections/home/calculator.php'; ?>

</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>
<?php require __DIR__ . '/../includes/scripts.php'; ?>
