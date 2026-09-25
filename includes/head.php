<?php
$pageTitle = $pageTitle ?? '';
$pageDescription = $pageDescription ?? '';
$pagePath = $pagePath ?? '/';
$pageStyles = $pageStyles ?? [];
$seoEnabled = !empty($config['seo']['enabled']);
$canonical = $seoEnabled && !empty($config['site_url']) ? site_url($pagePath) : '';
$styles = array_merge(['/assets/css/site.css','/assets/css/desktop.css'], $pageStyles);
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title><?= $seoEnabled ? e($pageTitle) : '' ?></title>
  <?php if ($seoEnabled && $pageDescription !== ''): ?><meta name="description" content="<?= e($pageDescription) ?>"><?php endif; ?>
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#050505">
  <meta name="csrf-token" content="<?= e((string)$_SESSION['csrf_token']) ?>">
  <?php if ($canonical !== ''): ?><link rel="canonical" href="<?= e($canonical) ?>"><?php endif; ?>
  <link rel="icon" href="<?= e(asset('/assets/favicon.svg')) ?>" type="image/svg+xml">
<?php foreach ($styles as $style): ?>
  <link rel="stylesheet" href="<?= e(asset($style)) ?>">
<?php endforeach; ?>
<?php if (!empty($preloadImage)): ?>
  <link rel="preload" as="image" href="<?= e(asset($preloadImage)) ?>" fetchpriority="high">
<?php endif; ?>
  <!-- SEO placeholders are intentionally disabled in prototype mode.
       Prepared fields: title, description, canonical, Open Graph, Product/Offer JSON-LD, BreadcrumbList. -->
</head>
<body class="<?= e($bodyClass ?? '') ?>">
