<?php
define('OLLAMA_URL', getenv('OLLAMA_URL') ?: 'http://localhost:11434');
define('DEFAULT_MODEL', getenv('OLLAMA_MODEL') ?: 'qwen2.5:7b');
define('KNOWLEDGE_DIR', __DIR__ . '/../knowledge/');

$allowed_origins = [
    'https://allickardb10.github.io',
    'http://localhost:3000',
    'http://localhost:8080',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
