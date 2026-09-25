<?php
declare(strict_types=1);

$config = require dirname(__DIR__) . '/config/site.php';
$merchant = is_file(dirname(__DIR__) . '/config/merchant.php') ? require dirname(__DIR__) . '/config/merchant.php' : [];

if (session_status() !== PHP_SESSION_ACTIVE) {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Lax']);
    session_start();
}
if (empty($_SESSION['csrf_token'])) $_SESSION['csrf_token'] = bin2hex(random_bytes(24));

function e(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function site_url(string $path = '/'): string {
    global $config;
    $base = rtrim((string)($config['site_url'] ?? ''), '/');
    if ($base === '') return '/' . ltrim($path, '/');
    return $base . '/' . ltrim($path, '/');
}
function asset(string $path): string {
    if (preg_match('~^https?://~i', $path)) return $path;
    $relative = '/' . ltrim($path, '/');
    $file = dirname(__DIR__) . $relative;
    $version = is_file($file) ? (string)filemtime($file) : '1';
    return $relative . '?v=' . rawurlencode($version);
}
function money_rub(int $value): string { return number_format($value, 0, ',', ' ') . ' ₽'; }
