<?php
define('OLLAMA_URL', getenv('OLLAMA_URL') ?: 'http://localhost:11434');
define('DEFAULT_MODEL', getenv('OLLAMA_MODEL') ?: 'qwen2.5:7b');
define('KNOWLEDGE_DIR', __DIR__ . '/../knowledge/');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
