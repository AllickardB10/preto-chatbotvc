/* Sparky10 · Base 10 Chatbot */

// ── Config ───────────────────────────────────────────────────────────────────
const CONFIG = {
  backendUrl: 'https://app.base10.mx/preto-api',
  model: 'qwen2.5:1.5b',
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
  messages:    [],   // { role, content }[]
  isStreaming: false,
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const messagesEl    = $('messages');
const inputEl       = $('user-input');
const sendBtn       = $('send-btn');
const newChatBtn    = $('new-chat-btn');
const badge         = $('connection-badge');
const sidebarToggle = $('sidebar-toggle');
const sidebarClose  = $('sidebar-close');
const sidebarOverlay= $('sidebar-overlay');
const themeToggle   = $('theme-toggle');

// ── Theme ────────────────────────────────────────────────────────────────────
function getAutoTheme() {
  const h = new Date().getHours();
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
// The system prompt is built entirely server-side — we only send messages + model.
// The typing indicator stays visible until the first token arrives.
async function streamResponse(typingEl) {
  const res = await fetch(`${CONFIG.backendUrl}/chat.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:    CONFIG.model,
      messages: state.messages,
    }),
  });

  if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText  = '';
  let bubble    = null;

  const cursor = document.createElement('span');
  cursor.className = 'cursor';

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
        if (token !== '') {
          if (!bubble) {
            // First token: swap typing indicator for the real bubble
            typingEl.remove();
            bubble = appendMessage('bot', '');
            bubble.appendChild(cursor);
          }
          fullText += token;
          bubble.textContent = fullText;
          bubble.appendChild(cursor);
          scrollToBottom();
        }
      } catch { /* ignore partial JSON */ }
    }
  }

  cursor.remove();

  if (!bubble) {
    typingEl.remove();
    bubble = appendMessage('bot', '');
  }

  return { bubble, fullText };
}

// ── Send message ──────────────────────────────────────────────────────────────
async function sendMessage(text) {
  text = (text ?? inputEl.value).trim();
  if (!text || state.isStreaming) return;

  state.isStreaming = true;
  sendBtn.disabled  = true;
  inputEl.value     = '';
  autoResize(inputEl);

  state.messages.push({ role: 'user', content: text });
  appendMessage('user', text);

  const typingEl = appendTypingIndicator();

  try {
    const { fullText } = await streamResponse(typingEl);
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
  const bubble = document.getElementById('sparky-bubble');
  if (!peeker) return;

  const messages = [
    '¡Hola! ¿En qué te puedo ayudar? 👋',
    '¡Pregúntame sobre Base 10! 😊',
    '🍅 ¡Toma un tomate! Ahora sí, ¿hablamos?',
    '¡Soy Sparky10, el robot más amigable! 🤖',
    '¿Conoces el framework Visión21? 🚀',
    '¡Base 10 puede hacer crecer tu negocio! 📈',
    '¿Necesitas una estrategia de marketing? ✨',
    '¡Aquí estoy, listo para ayudarte! 😄',
  ];

  let active = false;
  let msgIndex = 0;

  function peek() {
    if (active) return;
    active = true;

    if (bubble) {
      bubble.textContent = messages[msgIndex % messages.length];
      msgIndex++;
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
      peeker.classList.add('visible');
    }));

    setTimeout(() => {
      peeker.classList.remove('visible');
      setTimeout(() => { active = false; }, 700);
    }, 5000);

    setTimeout(peek, 15000 + Math.random() * 15000);
  }

  setTimeout(peek, 4000);
}

// ── Init ──────────────────────────────────────────────────────────────────────
initTheme();
checkConnection();
initSparkyPeeker();
inputEl.focus();
