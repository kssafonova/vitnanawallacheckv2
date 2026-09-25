<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok'=>false,'message'=>'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$config = require __DIR__ . '/config.php';

// Simple same-origin protection when the browser sends Origin.
if (!empty($_SERVER['HTTP_ORIGIN'])) {
    $originHost = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST);
    $requestHost = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
    if ($originHost && $requestHost && strcasecmp($originHost, $requestHost) !== 0) {
        http_response_code(403);
        echo json_encode(['ok'=>false,'message'=>'Forbidden'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Honeypot: bots often fill hidden fields.
if (!empty($_POST['website'] ?? '')) {
    echo json_encode(['ok'=>true], JSON_UNESCAPED_UNICODE);
    exit;
}

$name = trim((string)($_POST['name'] ?? ''));
$phone = trim((string)($_POST['phone'] ?? ''));
$comment = trim((string)($_POST['comment'] ?? ''));
$project = trim((string)($_POST['project'] ?? ''));
$source = trim((string)($_POST['source'] ?? 'site'));

$digits = preg_replace('/\D+/', '', $phone);
$nameLen = function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') : strlen($name);
if ($name === '' || $nameLen > 100 || strlen($digits) < 10 || strlen($digits) > 15) {
    http_response_code(422);
    echo json_encode(['ok'=>false,'message'=>'Проверьте имя и телефон.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Basic request rate limit per PHP session.
if (session_status() !== PHP_SESSION_ACTIVE) { session_start(); }
$now = time();
$last = (int)($_SESSION['last_form_submit'] ?? 0);
if ($last && ($now - $last) < 8) {
    http_response_code(429);
    echo json_encode(['ok'=>false,'message'=>'Повторите отправку через несколько секунд.'], JSON_UNESCAPED_UNICODE);
    exit;
}
$_SESSION['last_form_submit'] = $now;

$clean = static function(string $value, int $max=5000): string {
    $value = strip_tags($value);
    $value = str_replace(["\r\0", "\n\0"], '', $value);
    return function_exists('mb_substr') ? mb_substr($value, 0, $max, 'UTF-8') : substr($value, 0, $max);
};
$name = $clean($name, 100);
$phone = $clean($phone, 40);
$comment = $clean($comment, 3000);
$project = $clean($project, 12000);
$source = $clean($source, 40);

$subject = 'Новая заявка Portal Systems — ' . ($source === 'calculator' ? 'калькулятор' : 'сайт');
$body = "Новая заявка с сайта Portal Systems\n\n";
$body .= "Источник: {$source}\n";
$body .= "Имя: {$name}\n";
$body .= "Телефон: {$phone}\n";
if ($comment !== '') $body .= "\nКомментарий:\n{$comment}\n";
if ($project !== '') $body .= "\nПараметры проекта:\n{$project}\n";
$body .= "\nСтраница: " . ($_SERVER['HTTP_REFERER'] ?? 'не определена') . "\n";
$body .= "IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'не определён') . "\n";

$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$from = preg_replace('/[^a-zA-Z0-9@._+-]/', '', (string)$config['from_email']);
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: ' . $config['site_name'] . ' <' . $from . '>',
    'X-Mailer: PHP/' . PHP_VERSION,
];

$sent = @mail((string)$config['recipient'], $encodedSubject, $body, implode("\r\n", $headers));
if (!$sent) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'message'=>'Сервер не смог отправить письмо. Проверьте почту/SMTP в панели REG.RU.'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['ok'=>true], JSON_UNESCAPED_UNICODE);
