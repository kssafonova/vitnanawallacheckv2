<?php
require __DIR__ . '/../includes/bootstrap.php';
$pageTitle = '';
$pageDescription = '';
$pagePath = '/faq/';
$pageStyles = [];
$pageScripts = [];
require __DIR__ . '/../includes/head.php';
require __DIR__ . '/../includes/header.php';
require __DIR__ . '/../includes/mobile-menu.php';
?>
<main>
<?php require __DIR__ . '/../includes/sections/home/faq.php'; ?>
<?php require __DIR__ . '/../includes/sections/home/resources.php'; ?>

</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>
<?php require __DIR__ . '/../includes/scripts.php'; ?>
