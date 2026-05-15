# Preto Chatbot

Chatbot web con base de conocimiento personalizable, usando **Ollama + qwen2.5:7b**, PHP y JavaScript puro.

## Demo rápida (GitHub Pages)

Abre `https://<tu-usuario>.github.io/preto-chatbot/`

> Requiere Ollama corriendo localmente con CORS habilitado (ver abajo).

## Tecnologías

- **Modelo**: Ollama `qwen2.5:7b`
- **Backend**: PHP 8.1+ (opcional, para uso en servidor)
- **Frontend**: HTML + CSS + JS vanilla (sin dependencias)

---

## Instalación local

### 1. Instalar Ollama

```bash
# Windows: winget install Ollama.Ollama
# macOS:   brew install ollama
# Linux:   curl -fsSL https://ollama.ai/install.sh | sh
```

### 2. Descargar el modelo

```bash
ollama pull qwen2.5:7b
```

### 3. Habilitar CORS en Ollama (para modo directo desde el navegador)

```powershell
# Windows PowerShell
$env:OLLAMA_ORIGINS = "*"
ollama serve
```

```bash
# macOS / Linux
OLLAMA_ORIGINS="*" ollama serve
```

### 4. Servir el frontend

```bash
# Python
python -m http.server 3000

# PHP built-in server
php -S localhost:3000
```

Abre `http://localhost:3000` en el navegador.

---

## Uso del backend PHP (opcional)

```bash
php -S localhost:8080 -t .
```

En la interfaz, cambia el **Modo de conexión** a `PHP Backend` y ajusta la URL a `http://localhost:8080/api`.

---

## Base de conocimiento

Sube archivos `.txt`, `.md` o `.json` desde la barra lateral. El contenido se inyecta en el contexto del modelo.

---

## Estructura

```
preto-chatbot/
├── index.html
├── css/style.css
├── js/chat.js
├── api/
│   ├── config.php
│   ├── chat.php        # SSE streaming → Ollama
│   ├── health.php
│   └── upload.php
└── knowledge/
```

## Variables de entorno (PHP)

| Variable | Default | Descripción |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | URL del servidor Ollama |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Modelo a usar |
