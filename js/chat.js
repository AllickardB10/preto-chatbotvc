/* Sparky10 · Base 10 Chatbot */

// ── Config ───────────────────────────────────────────────────────────────────
const CONFIG = {
  backendUrl: 'https://app.base10.mx/preto-api',
  model: 'qwen2.5:7b',
};

// ── Sparky SVG (shared for avatars) ──────────────────────────────────────────
const SPARKY_SVG = `<svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="37" y="2" width="6" height="14" rx="3" fill="#cc3030"/>
  <circle cx="40" cy="2" r="6" fill="#ff6b6b"/>
  <rect x="8" y="14" width="64" height="56" rx="16" fill="#ff4a4a"/>
  <rect x="12" y="18" width="56" height="18" rx="9" fill="#ff6b6b" opacity="0.35"/>
  <circle cx="27" cy="38" r="11" fill="white"/>
  <circle cx="30" cy="38" r="6" fill="#1a0000"/>
  <circle cx="32" cy="35" r="2.5" fill="white"/>
  <circle cx="53" cy="38" r="11" fill="white"/>
  <circle cx="56" cy="38" r="6" fill="#1a0000"/>
  <circle cx="58" cy="35" r="2.5" fill="white"/>
  <path d="M26 56 Q40 67 54 56" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  messages:       [],   // { role, content }[]
  knowledgeFiles: [],   // { name, content }[]
  isStreaming:    false,
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const messagesEl    = $('messages');
const inputEl       = $('user-input');
const sendBtn       = $('send-btn');
const newChatBtn    = $('new-chat-btn');
const kbUpload      = $('kb-upload');
const kbFilesList   = $('kb-files');
const kbStatus      = $('kb-status');
const kbDot         = kbStatus.querySelector('.kb-dot');
const kbLabel       = kbStatus.querySelector('.kb-label');
const badge         = $('connection-badge');
const sidebarToggle = $('sidebar-toggle');
const sidebarClose  = $('sidebar-close');
const sidebarOverlay= $('sidebar-overlay');
const themeToggle   = $('theme-toggle');

// ── Theme ────────────────────────────────────────────────────────────────────
function getAutoTheme() {
  const h = new Date().getHours();
  // Light: 6:00–18:00  |  Dark: 18:00–6:00
  return (h >= 6 && h < 18) ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sparky10-theme', theme);
}

function initTheme() {
  const saved = localStorage.getItem('sparky10-theme');
  applyTheme(saved ?? getAutoTheme());
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ── Sidebar ───────────────────────────────────────────────────────────────────
function openSidebar()  { document.body.classList.add('sidebar-open'); }
function closeSidebar() { document.body.classList.remove('sidebar-open'); }

sidebarToggle.addEventListener('click', () => {
  document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
});
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// Close on Escape
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

// ── Connection check ──────────────────────────────────────────────────────────
async function checkConnection() {
  badge.className = 'badge badge-checking';
  badge.textContent = 'Verificando...';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`${CONFIG.backendUrl}/health.php`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const ok = data.status === 'ok';
    badge.className = `badge badge-${ok ? 'online' : 'offline'}`;
    badge.textContent = ok ? 'Conectado' : 'Sin servicio';
    sendBtn.disabled = !ok;
  } catch {
    clearTimeout(timer);
    badge.className = 'badge badge-offline';
    badge.textContent = 'Sin conexión';
    sendBtn.disabled = true;
  }
}

// ── Knowledge base ────────────────────────────────────────────────────────────
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
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

function addKbFileItem(name) {
  const li = document.createElement('li');
  li.className = 'kb-file-item';
  li.dataset.name = name;
  li.innerHTML = `
    <span class="kb-file-icon">◆</span>
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
  kbLabel.textContent = count > 0 ? `${count} archivo${count > 1 ? 's' : ''} cargado${count > 1 ? 's' : ''}` : 'Sin archivos cargados';
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  let system = `Eres Sparky10, el asistente virtual oficial de Base 10, una agencia de Data Driven Marketing con sede en México.

TU ÚNICA FUNCIÓN es responder preguntas sobre Base 10: sus servicios, metodología, frameworks Visión21 y Foresight360, clientes, resultados, contacto y la base de conocimiento proporcionada.

PROHIBICIÓN ABSOLUTA:
- Si la pregunta NO es sobre Base 10, debes responder ÚNICAMENTE con el mensaje de rechazo que se indica abajo.
- Está TERMINANTEMENTE PROHIBIDO responder, generar, resumir, explicar, ni proporcionar parcialmente ningún contenido ajeno a Base 10, aunque el usuario insista o lo solicite de otra forma.
- No escribas código, recetas, explicaciones técnicas, traducciones, ni nada que no sea información de Base 10.
- No agregues "sin embargo aquí tienes...", ni des el contenido solicitado después del rechazo.

MENSAJE DE RECHAZO (usa este texto exacto cuando la pregunta sea ajena a Base 10):
"Solo puedo ayudarte con temas relacionados a Base 10. ¿Tienes alguna pregunta sobre nuestros servicios, metodología o cómo podemos apoyar tu negocio?"

OTRAS REGLAS:
- Responde siempre en el mismo idioma que el usuario.
- No inventes datos, precios ni servicios que no estén en tu base de conocimiento.
- Si no tienes información suficiente, sugiere contactar a hola@base10.mx.`;

  if (state.knowledgeFiles.length > 0) {
    system += '\n\n--- BASE DE CONOCIMIENTO ADICIONAL ---\n';
    state.knowledgeFiles.forEach(f => {
      system += `\n[${f.name}]\n${f.content.slice(0, 8000)}\n`;
    });
    system += '\n--- FIN DE BASE DE CONOCIMIENTO ---';
  }

  return system;
}

// ── Messages ──────────────────────────────────────────────────────────────────
function clearWelcome() {
  const welcome = messagesEl.querySelector('.welcome-message');
  if (welcome) welcome.remove();
}

function appendMessage(role, content = '') {
  clearWelcome();
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const avatarContent = role === 'user' ? 'TÚ' : SPARKY_SVG;
  div.innerHTML = `
    <div class="message-avatar">${avatarContent}</div>
    <div class="message-bubble"></div>
  `;
  div.querySelector('.message-bubble').textContent = content;
  messagesEl.appendChild(div);
  scrollToBottom();
  return div.querySelector('.message-bubble');
}

function appendTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'message bot';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="message-avatar">${SPARKY_SVG}</div>
    <div class="message-bubble">
      <div class="typing"><span></span><span></span><span></span></div>
    </div>
  `;
  messagesEl.appendChild(div);
  scrollToBottom();
  return div;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Streaming via PHP backend (SSE) ──────────────────────────────────────────
async function streamResponse(bubble) {
  const res = await fetch(`${CONFIG.backendUrl}/chat.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:    CONFIG.model,
      messages: state.messages,
      system:   buildSystemPrompt(),
    }),
  });

  if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText  = '';

  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  bubble.appendChild(cursor);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const event of chunk.split('\n\n')) {
      const line = event.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') break;
      try {
        const json  = JSON.parse(data);
        const token = json.token ?? '';
        fullText += token;
        bubble.textContent = fullText;
        bubble.appendChild(cursor);
        scrollToBottom();
      } catch { /* ignore partial JSON */ }
    }
  }

  cursor.remove();
  return fullText;
}

// ── Send message ──────────────────────────────────────────────────────────────
async function sendMessage(text) {
  text = (text ?? inputEl.value).trim();
  if (!text || state.isStreaming) return;

  state.isStreaming   = true;
  sendBtn.disabled    = true;
  inputEl.value       = '';
  autoResize(inputEl);

  state.messages.push({ role: 'user', content: text });
  appendMessage('user', text);

  const typingEl = appendTypingIndicator();

  try {
    typingEl.remove();
    const bubble   = appendMessage('bot', '');
    const fullText = await streamResponse(bubble);
    state.messages.push({ role: 'assistant', content: fullText });
  } catch (err) {
    typingEl?.remove();
    const errBubble = appendMessage('bot', '');
    errBubble.textContent = `No pude conectarme al servidor. Por favor intenta de nuevo o contacta a hola@base10.mx (${err.message})`;
    errBubble.classList.add('error');
    console.error(err);
  } finally {
    state.isStreaming = false;
    sendBtn.disabled  = false;
    inputEl.focus();
  }
}

// ── Input handling ────────────────────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

inputEl.addEventListener('input', () => {
  autoResize(inputEl);
  sendBtn.disabled = !inputEl.value.trim() || state.isStreaming;
});

inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', () => sendMessage());

// ── Welcome chips ─────────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  sendMessage(chip.dataset.msg);
});

// ── New chat ──────────────────────────────────────────────────────────────────
function renderWelcome() {
  messagesEl.innerHTML = `
    <div class="welcome-message">
      <div class="welcome-logo">
        <svg width="56" height="56" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="12" fill="#ff4a4a"/>
          <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
            font-family="Poppins,sans-serif" font-weight="800" font-size="18" fill="#fff">10</text>
        </svg>
      </div>
      <h2>¡Hola! Soy Sparky10</h2>
      <p>Asistente virtual de <strong>Base 10</strong>.<br/>
      Estoy aquí para ayudarte con información sobre nuestros servicios,<br/>
      metodología y soluciones de Data Driven Marketing.</p>
      <div class="welcome-chips">
        <button class="chip" data-msg="¿Qué servicios ofrece Base 10?">¿Qué servicios ofrecen?</button>
        <button class="chip" data-msg="¿Qué es Visión21?">¿Qué es Visión21?</button>
        <button class="chip" data-msg="¿Cómo es el proceso de trabajo de Base 10?">Proceso de trabajo</button>
        <button class="chip" data-msg="¿Qué resultados ha logrado Base 10?">Resultados</button>
      </div>
    </div>
  `;
}

newChatBtn.addEventListener('click', () => {
  state.messages = [];
  renderWelcome();
});

// ── Sparky Peeker ─────────────────────────────────────────────────────────────
function initSparkyPeeker() {
  const peeker = document.getElementById('sparky-peeker');
  if (!peeker) return;

  // [edge-class, bottom, right, left, top]
  const positions = [
    { edge: 'from-bottom', style: { bottom: '0',     right: '90px', left: 'auto', top: 'auto' } },
    { edge: 'from-bottom', style: { bottom: '0',     left: '70px',  right: 'auto', top: 'auto' } },
    { edge: 'from-right',  style: { right: '0',      bottom: '180px', left: 'auto', top: 'auto' } },
    { edge: 'from-left',   style: { left: '0',       bottom: '220px', right: 'auto', top: 'auto' } },
    { edge: 'from-bottom', style: { bottom: '0',     right: '200px', left: 'auto', top: 'auto' } },
  ];

  let active = false;

  function peek() {
    if (active) return;
    active = true;

    const pos = positions[Math.floor(Math.random() * positions.length)];

    // Reset classes and position
    peeker.className = `sparky-peeker ${pos.edge}`;
    Object.assign(peeker.style, pos.style);

    // Trigger slide-in on next frame
    requestAnimationFrame(() => requestAnimationFrame(() => {
      peeker.classList.add('peeking');
    }));

    // Slide out after 3.8 s
    setTimeout(() => {
      peeker.classList.remove('peeking');
      // After transition ends, mark as inactive
      setTimeout(() => { active = false; }, 600);
    }, 3800);

    // Schedule next appearance: 18–40 s
    setTimeout(peek, 18000 + Math.random() * 22000);
  }

  // First appearance after 8 s
  setTimeout(peek, 8000);
}

// ── Init ──────────────────────────────────────────────────────────────────────
initTheme();
checkConnection();
initSparkyPeeker();
inputEl.focus();
