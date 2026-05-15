<?php
require_once __DIR__ . '/config.php';
header('Content-Type: application/json');

$ollamaOk = false;
try {
    $ctx = stream_context_create(['http' => ['timeout' => 3]]);
    $res = file_get_contents(OLLAMA_URL . '/api/tags', false, $ctx);
    $ollamaOk = $res !== false;
} catch (Throwable $e) {}

echo json_encode([
    'status' => $ollamaOk ? 'ok' : 'ollama_unreachable',
    'ollama_url' => OLLAMA_URL,
    'model' => DEFAULT_MODEL,
]);
