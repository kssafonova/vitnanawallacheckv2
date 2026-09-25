<?php
declare(strict_types=1);
require dirname(__DIR__) . '/includes/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
$isAjax = strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '')) === 'xmlhttprequest';
function respond(bool $ok,string $message,int $status=200,bool $isAjax=true): never { http_response_code($status); if(!$isAjax&&$ok){header('Location: /thanks/',true,303);exit;} echo json_encode(['ok'=>$ok,'message'=>$message],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(false,'Method not allowed',405,$isAjax);
$csrf=(string)($_POST['csrf_token'] ?? '');
if(empty($_SESSION['csrf_token'])||!$csrf||!hash_equals((string)$_SESSION['csrf_token'],$csrf)) respond(false,'Сессия формы устарела.',419,$isAjax);
if(!empty($_POST['website']??'')) respond(true,'OK',200,$isAjax);
$name=trim(strip_tags((string)($_POST['name']??'')));$phone=trim(strip_tags((string)($_POST['phone']??'')));
$digits=preg_replace('/\D+/','',$phone);
if($name===''||strlen($digits)<10) respond(false,'Проверьте имя и телефон.',422,$isAjax);
if(empty($config['mail']['enabled'])) respond(true,'Демо-режим: форма проверена, внешняя отправка отключена.',200,$isAjax);
respond(false,'Почтовый транспорт не настроен.',503,$isAjax);
