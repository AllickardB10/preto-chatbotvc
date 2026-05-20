/* Preto Chatbot — Frontend JS */

const state = {
  messages: [],         // { role, content }[]
  knowledgeFiles: [],   // { name, content }[]
  isStreaming: false,
};

// ── DOM refs ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const messagesEl   = $('messages');
const inputEl      = $('user-input');
const sendBtn      = $('send-btn');
const newChatBtn   = $('new-chat-btn');
const kbUpload     = $('kb-upload');
const kbFilesList  = $('kb-files');
const kbStatus     = $('kb-status');
const kbDot        = kbStatus.querySelector('.kb-dot');
const kbLabel      = kbStatus.querySelector('.kb-label');
const badge        = $('connection-badge');
const modeSelect   = $('mode-select');
const ollamaUrlEl  = $('ollama-url');
const phpUrlEl     = $('php-url');
const ollamaLabel  = $('ollama-url-label');
const phpLabel     = $('php-url-label');
const modelEl      = $('model-name');

// ── Config ─────────────────────────────────────────────────────────────────
function getConfig() {
  return {
    mode: modeSelect.value,
    ollamaUrl: ollamaUrlEl.value.replace(/\/$/, ''),
    phpUrl: phpUrlEl.value.replace(/\/$/, ''),
    model: modelEl.value || 'qwen2.5:7b',
  };
}

modeSelect.addEventListener('change', () => {
  const isDirect = modeSelect.value === 'direct';
  ollamaLabel.style.display = isDirect ? '' : 'none';
  phpLabel.style.display    = isDirect ? 'none' : '';
  checkConnection();
});

// ── Connection check ────────────────────────────────────────────────────────
async function checkConnection() {
  badge.className = 'badge badge-checking';
  badge.textContent = 'Verificando...';
  const { mode, ollamaUrl, phpUrl } = getConfig();
  try {
    if (mode === 'direct') {
      const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error();
    } else {
      const res = await fetch(`${phpUrl}/health.php`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error();
    }
    badge.className = 'badge badge-online';
    badge.textContent = mode === 'direct' ? 'Ollama conectado' : 'Backend conectado';
    sendBtn.disabled = false;
  } catch {
    badge.className = 'badge badge-offline';
    badge.textContent = 'Sin conexión';
    sendBtn.disabled = true;
  }
}

// Re-check when URLs change
[ollamaUrlEl, phpUrlEl, modelEl].forEach(el => {
  el.addEventListener('change', checkConnection);
});

// ── Knowledge base ──────────────────────────────────────────────────────────
kbUpload.addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    const content = await readFile(file);
    if (!state.knowledgeFiles.find(f => f.name === file.name)) {
      state.knowledgeFiles.push({ name: file.name, content });
      addKbFileItem(file.name);
    }
  }
  updateKbStatus();
  kbUpload.value = '';
});

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

function addKbFileItem(name) {
  const li = document.createElement('li');
  li.className = 'kb-file-item';
  li.dataset.name = name;
  li.innerHTML = `
    <span class="kb-file-name" title="${name}">${name}</span>
    <button class="kb-file-remove" title="Eliminar">×</button>
  `;
  li.querySelector('.kb-file-remove').addEventListener('click', () => {
    state.knowledgeFiles = state.knowledgeFiles.filter(f => f.name !== name);
    li.remove();
    updateKbStatus();
  });
  kbFilesList.appendChild(li);
}

function updateKbStatus() {
  const count = state.knowledgeFiles.length;
  kbDot.className = `kb-dot ${count > 0 ? 'active' : 'inactive'}`;
  kbLabel.textContent = count > 0 ? `${count} archivo${count > 1 ? 's' : ''}` : 'Sin archivos';
}

function buildSystemPrompt() {
  let system = 'Eres Preto, un asistente inteligente útil, claro y conciso. Responde siempre en el mismo idioma que el usuario.';
  if (state.knowledgeFiles.length > 0) {
    system += '\n\nTienes acceso a la siguiente base de conocimiento. Úsala para responder con precisión:\n\n';
    system += '--- BASE DE CONOCIMIENTO ---\n';
    state.knowledgeFiles.forEach(f => {
      system += `\n[Archivo: ${f.name}]\n${f.content.slice(0, 8000)}\n`;
    });
    system += '\n--- FIN DE BASE DE CONOCIMIENTO ---\n';
  }
  return system;
}

// ── Messages ────────────────────────────────────────────────────────────────
function clearWelcome() {
  const welcome = messagesEl.querySelector('.welcome-message');
  if (welcome) welcome.remove();
}

function appendMessage(role, content = '') {
  clearWelcome();
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const avatarText = role === 'user' ? 'U' : '◆';
  div.innerHTML = `
    <div class="message-avatar">${avatarText}</div>
    <div class="message-bubble"></div>
  `;
  const bubble = div.querySelector('.message-bubble');
  bubble.textContent = content;
  messagesEl.appendChild(div);
  scrollToBottom();
  return bubble;
}

function appendTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'message bot';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="message-avatar">◆</div>
    <div class="message-bubble"><div class="typing"><span></span><span></span><span></span></div></div>
  `;
  messagesEl.appendChild(div);
  scrollToBottom();
  return div;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Streaming helpers ────────────────────────────────────────────────────────
async function streamOllama(bubble) {
  const { ollamaUrl, model } = getConfig();
  const systemPrompt = buildSystemPrompt();

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...state.messages,
    ],
    stream: true,
  };

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Ollama respondió ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  // Show cursor while streaming
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  bubble.appendChild(cursor);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value, { stream: true }).split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        const token = json.message?.content ?? '';
        fullText += token;
        bubble.textContent = fullText;
        bubble.appendChild(cursor);
        scrollToBottom();
      } catch { /* ignore parse errors on partial lines */ }
    }
  }

  cursor.remove();
  return fullText;
}

async function streamPHP(bubble) {
  const { phpUrl, model } = getConfig();
  const systemPrompt = buildSystemPrompt();

  const res = await fetch(`${phpUrl}/chat.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: state.messages,
      system: systemPrompt,
    }),
  });

  if (!res.ok) throw new Error(`Backend respondió ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  bubble.appendChild(cursor);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    // PHP backend sends SSE: "data: <token>\n\n"
    const events = chunk.split('\n\n');
    for (const event of events) {
      const dataLine = event.trim();
      if (!dataLine.startsWith('data:')) continue;
      const data = dataLine.slice(5).trim();
      if (data === '[DONE]') break;
      try {
        const json = JSON.parse(data);
        const token = json.token ?? '';
        fullText += token;
        bubble.textContent = fullText;
        bubble.appendChild(cursor);
        scrollToBottom();
      } catch { /* ignore */ }
    }
  }

  cursor.remove();
  return fullText;
}

// ── Send message ────────────────────────────────────────────────────────────
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || state.isStreaming) return;

  state.isStreaming = true;
  sendBtn.disabled = true;
  inputEl.value = '';
  autoResize(inputEl);

  state.messages.push({ role: 'user', content: text });
  appendMessage('user', text);

  const typingEl = appendTypingIndicator();

  try {
    const { mode } = getConfig();
    typingEl.remove();
    const bubble = appendMessage('bot', '');
    let fullText;

    if (mode === 'direct') {
      fullText = await streamOllama(bubble);
    } else {
      fullText = await streamPHP(bubble);
    }

    state.messages.push({ role: 'assistant', content: fullText });
  } catch (err) {
    typingEl?.remove();
    const errBubble = appendMessage('bot', '');
    errBubble.textContent = `Error: ${err.message}. Verifica que Ollama esté corriendo y tenga CORS habilitado.`;
    errBubble.classList.add('error');
    console.error(err);
  } finally {
    state.isStreaming = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

// ── Input handling ───────────────────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

inputEl.addEventListener('input', () => {
  autoResize(inputEl);
  sendBtn.disabled = !inputEl.value.trim() || state.isStreaming;
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

newChatBtn.addEventListener('click', () => {
  state.messages = [];
  messagesEl.innerHTML = `
    <div class="welcome-message">
      <div class="welcome-logo">
        <svg width="48" height="48" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="10" fill="#ff4a4a"/>
          <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
            font-family="Poppins,sans-serif" font-weight="800" font-size="18" fill="#fff">10</text>
        </svg>
      </div>
      <h2>Hola, soy Preto</h2>
      <p>El asistente inteligente de <strong>Base 10</strong>.<br/>
      Puedo responder sobre nuestros servicios, frameworks y metodología.<br/>
      También puedes subir tus propios archivos de contexto.</p>
      <div class="welcome-chips">
        <button class="chip" data-msg="¿Qué servicios ofrece Base 10?">¿Qué servicios ofrecen?</button>
        <button class="chip" data-msg="¿Qué es Visión21?">¿Qué es Visión21?</button>
        <button class="chip" data-msg="¿Cómo es el proceso de trabajo de Base 10?">Proceso de trabajo</button>
        <button class="chip" data-msg="¿Cuáles son los resultados que ha logrado Base 10?">Resultados</button>
      </div>
    </div>
  `;
});

// ── Welcome chips ────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  inputEl.value = chip.dataset.msg;
  autoResize(inputEl);
  sendBtn.disabled = !inputEl.value.trim() || state.isStreaming;
  inputEl.focus();
});

// ── Init ─────────────────────────────────────────────────────────────────────
checkConnection();
inputEl.focus();
