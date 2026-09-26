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

// Запрос больше post_max_size: PHP отдаёт пустой $_POST — скорее всего, слишком большой файл
if (empty($_POST) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    http_response_code(413);
    echo json_encode(['ok'=>false,'message'=>'Файл слишком большой. Пришлите файл до 15 МБ или ссылку на него в комментарии.'], JSON_UNESCAPED_UNICODE);
    exit;
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
$city = trim((string)($_POST['city'] ?? ''));
$orderId = strtoupper(trim((string)($_POST['order_id'] ?? '')));
$isOrder = $source === 'cart';
$pickup = $isOrder && (($_POST['delivery'] ?? '') === 'pickup');

$digits = preg_replace('/\D+/', '', $phone);
$nameLen = function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') : strlen($name);
if ($name === '' || $nameLen > 100 || strlen($digits) < 10 || strlen($digits) > 15) {
    http_response_code(422);
    echo json_encode(['ok'=>false,'message'=>'Проверьте имя и телефон.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Заказ из корзины: нужны город и согласие, номер заказа — PS-ГГММДД-XXXX (создаём, если не пришёл)
if ($isOrder) {
    // Город нужен для доставки и монтажа; при самовывозе — нет
    if ((!$pickup && $city === '') || empty($_POST['privacy_consent'] ?? '')) {
        http_response_code(422);
        echo json_encode(['ok'=>false,'message'=>$pickup ? 'Подтвердите согласие на обработку данных.' : 'Укажите город и подтвердите согласие на обработку данных.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (!preg_match('/^PS-\d{6}-[A-Z0-9]{4}$/', $orderId)) {
        $orderId = 'PS-' . date('ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 4));
    }
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
$city = $clean($city, 120);

// Файл проекта (калькулятор, форма на странице HS): PDF, DWG, DXF, JPG, PNG, WEBP, HEIC, ZIP — до 15 МБ
$attachment = null;
$file = $_FILES['project_file'] ?? null;
if (is_array($file) && ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $fail = static function(string $msg): void {
        http_response_code(422);
        echo json_encode(['ok'=>false,'message'=>$msg], JSON_UNESCAPED_UNICODE);
        exit;
    };
    if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) $fail('Файл больше, чем принимает сервер. Пришлите файл поменьше или ссылку в комментарии.');
    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file((string)$file['tmp_name'])) $fail('Файл не загрузился. Попробуйте ещё раз.');
    if ((int)$file['size'] > 15 * 1024 * 1024) $fail('Файл больше 15 МБ. Пришлите файл поменьше или ссылку в комментарии.');
    $types = ['pdf'=>'application/pdf','dwg'=>'application/acad','dxf'=>'application/dxf','jpg'=>'image/jpeg','jpeg'=>'image/jpeg',
              'png'=>'image/png','webp'=>'image/webp','heic'=>'image/heic','zip'=>'application/zip'];
    $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
    if (!isset($types[$ext])) $fail('Этот формат не принимаем: подойдут PDF, DWG, JPG, PNG или ZIP.');
    $fname = preg_replace('/[^\p{L}\p{N}._ -]+/u', '_', basename((string)$file['name'])) ?: ('project.' . $ext);
    $fname = function_exists('mb_substr') ? mb_substr($fname, -120, null, 'UTF-8') : substr($fname, -120);
    $attachment = ['name'=>$fname, 'type'=>$types[$ext], 'data'=>(string)file_get_contents((string)$file['tmp_name']), 'size'=>(int)$file['size']];
}

$subject = $isOrder
    ? "Заказ {$orderId}" . ($pickup ? ' (самовывоз)' : '') . " — PORTAL SYSTEMS"
    : 'Новая заявка PORTAL SYSTEMS — ' . ($source === 'calculator' ? 'калькулятор' : ($source === 'contacts' ? 'контакты' : 'сайт')) . ($attachment ? ' + файл проекта' : '');
$body = $isOrder ? "Новый заказ с сайта PORTAL SYSTEMS № {$orderId}\n\n" : "Новая заявка с сайта PORTAL SYSTEMS\n\n";
$body .= "Источник: {$source}\n";
$body .= "Имя: {$name}\n";
$body .= "Телефон: {$phone}\n";
if ($isOrder) $body .= 'Получение: ' . ($pickup ? 'самовывоз с производства' : 'доставка и монтаж') . "\n";
if ($city !== '') $body .= "Город / посёлок: {$city}\n";
if ($comment !== '') $body .= "\nКомментарий:\n{$comment}\n";
if ($project !== '') $body .= ($isOrder ? "\nСостав заказа:\n" : "\nПараметры проекта:\n") . "{$project}\n";
if ($attachment) {
    $kb = $attachment['size'] / 1024;
    $body .= "\nПриложен файл: {$attachment['name']} (" . ($kb < 1024 ? max(1, (int)round($kb)) . ' КБ' : round($kb / 1024, 1) . ' МБ') . ")\n";
}
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
if ($attachment) {
    // письмо из двух частей: текст заявки + файл проекта
    $boundary = 'ps-' . bin2hex(random_bytes(12));
    $headers[1] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';
    $body = "--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($body))
        . "--{$boundary}\r\nContent-Type: {$attachment['type']}; name=\"=?UTF-8?B?" . base64_encode($attachment['name']) . "?=\"\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . "Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($attachment['name']) . "\r\n\r\n"
        . chunk_split(base64_encode($attachment['data']))
        . "--{$boundary}--";
}

$sent = @mail((string)$config['recipient'], $encodedSubject, $body, implode("\r\n", $headers));
if (!$sent) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'message'=>'Сервер не смог отправить письмо. Проверьте почту/SMTP в панели REG.RU.'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode($isOrder ? ['ok'=>true,'order_id'=>$orderId] : ['ok'=>true], JSON_UNESCAPED_UNICODE);
