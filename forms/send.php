<?php
header('Content-Type: application/json; charset=utf-8');
http_response_code(501);
echo json_encode(['ok'=>false,'message'=>'Form transport is not configured yet.']);
