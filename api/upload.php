<?php
require_once __DIR__ . '/config.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['error' => 'Method Not Allowed']));
}

if (empty($_FILES['file'])) {
    http_response_code(400);
    exit(json_encode(['error' => 'No file uploaded']));
}

$allowed = ['txt', 'md', 'json'];
$file    = $_FILES['file'];
$ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($ext, $allowed)) {
    http_response_code(415);
    exit(json_encode(['error' => 'Tipo de archivo no permitido. Usa .txt, .md o .json']));
}

if ($file['size'] > 2 * 1024 * 1024) {
    http_response_code(413);
    exit(json_encode(['error' => 'Archivo demasiado grande (máximo 2MB)']));
}

if (!is_dir(KNOWLEDGE_DIR)) {
    mkdir(KNOWLEDGE_DIR, 0755, true);
}

$safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($file['name']));
$dest     = KNOWLEDGE_DIR . $safeName;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    http_response_code(500);
    exit(json_encode(['error' => 'Error al guardar el archivo']));
}

echo json_encode(['success' => true, 'file' => $safeName]);
