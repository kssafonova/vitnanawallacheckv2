<?php
declare(strict_types=1);
/* Адаптер CRM для заявок «Персональной карты остекления».
   Шлёт JSON (EngineeringLeadPayload: name, contact, preferredContact, location, stage, comment, files, glazingMap,
   pageUrl, referrer, utm) POST-запросом на вебхук из config.php → crm_webhook. Пустой адрес — ничего не делает.
   Бизнес-логика CRM (сделки, поля) — на стороне вебхука; здесь только доставка. */
function crm_send(array $payload, array $config): bool {
    $url = trim((string)($config['crm_webhook'] ?? ''));
    if ($url === '' || !preg_match('~^https://~i', $url)) return false;
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) return false;
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'timeout' => 6, 'ignore_errors' => true,
        'header' => "Content-Type: application/json; charset=utf-8\r\nContent-Length: " . strlen($json) . "\r\n",
        'content' => $json,
    ]]);
    $res = @file_get_contents($url, false, $ctx);
    if ($res === false) { error_log('crm_send: webhook failed'); return false; }
    return true;
}
