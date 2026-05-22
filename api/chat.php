<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method Not Allowed');
}

$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    http_response_code(400);
    exit('Invalid JSON');
}

$model    = htmlspecialchars($body['model'] ?? DEFAULT_MODEL, ENT_QUOTES);
$messages = $body['messages'] ?? [];
$system   = $body['system'] ?? 'Eres Sparky10, el asistente virtual de Base 10.';

// Auto-load server-side knowledge files and append to system prompt
// Limit per-file to 3500 chars to keep the prompt short and inference fast
$knowledgeFiles = glob(__DIR__ . '/*.txt');
if ($knowledgeFiles) {
    $system .= "\n\n--- BASE DE CONOCIMIENTO ---\n";
    foreach ($knowledgeFiles as $file) {
        $content = @file_get_contents($file);
        if ($content) {
            $system .= "\n[" . basename($file) . "]\n" . substr($content, 0, 3500) . "\n";
        }
    }
    $system .= "--- FIN DE BASE DE CONOCIMIENTO ---";
}

// Sanitize messages
$messages = array_map(fn($m) => [
    'role'    => in_array($m['role'] ?? '', ['user', 'assistant']) ? $m['role'] : 'user',
    'content' => substr(strip_tags($m['content'] ?? ''), 0, 32000),
], $messages);

// Prepend system message
array_unshift($messages, ['role' => 'system', 'content' => $system]);

$payload = json_encode([
    'model'       => $model,
    'messages'    => $messages,
    'stream'      => true,
    'keep_alive'  => -1,
    'options'     => [
        'num_predict' => 500,
        'num_thread'  => 16,
        'num_ctx'     => 2048,
        'temperature' => 0.6,
    ],
]);

// SSE headers
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no');

$ctx = stream_context_create([
    'http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/json\r\n",
        'content' => $payload,
        'timeout' => 300,
    ],
]);

$stream = @fopen(OLLAMA_URL . '/api/chat', 'rb', false, $ctx);
if (!$stream) {
    echo "data: " . json_encode(['error' => 'No se pudo conectar a Ollama']) . "\n\n";
    flush();
    exit;
}

while (!feof($stream)) {
    $line = fgets($stream);
    if (!$line) continue;
    $json = json_decode(trim($line), true);
    if (!$json) continue;

    $token = $json['message']['content'] ?? '';
    if ($token !== '') {
        echo "data: " . json_encode(['token' => $token]) . "\n\n";
        flush();
        if (ob_get_level()) ob_flush();
    }

    if (!empty($json['done'])) break;
}

fclose($stream);
echo "data: [DONE]\n\n";
flush();
