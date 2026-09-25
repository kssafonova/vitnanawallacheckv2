<?php
require __DIR__ . '/../includes/bootstrap.php';
$pageTitle = '';
$pageDescription = '';
$pagePath = '/company/';
$pageStyles = [];
$pageScripts = [];
require __DIR__ . '/../includes/head.php';
require __DIR__ . '/../includes/header.php';
require __DIR__ . '/../includes/mobile-menu.php';
?>
<main>
<?php require __DIR__ . '/../includes/sections/home/why.php'; ?>
<?php require __DIR__ . '/../includes/sections/home/process.php'; ?>

</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>
<?php require __DIR__ . '/../includes/scripts.php'; ?>
