/* ================================================================
   YO NUNCA — lógica de juego
   ================================================================ */
(function () {
  'use strict';

  // ── Frases de fallback (sin conexión a la API) ──────────────────
  const FALLBACK = [
    { texto: 'mentido para salir de un compromiso',         categoria: 'suave'   },
    { texto: 'comido directamente del bote',                categoria: 'suave'   },
    { texto: 'fingido no haber visto un mensaje',           categoria: 'suave'   },
    { texto: 'vomitado en la calle de tanto beber',         categoria: 'fiesta'  },
    { texto: 'bailado encima de una mesa',                  categoria: 'fiesta'  },
    { texto: 'perdido el móvil de fiesta',                  categoria: 'fiesta'  },
    { texto: 'practicado sexting',                          categoria: 'picante' },
    { texto: 'fantaseado con alguien de aquí presente',     categoria: 'picante' },
    { texto: 'mandado una foto comprometedora',             categoria: 'picante' },
  ];

  // Estado global
  let frases      = [];
  let currentIdx  = 0;
  let activeCats  = new Set();

  // ── Utilidades DOM ──────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
    // Forzar reflow para que la animación se dispare
    void $(id).offsetWidth;
    $(id).style.animation = 'none';
    requestAnimationFrame(() => { $(id).style.animation = ''; });
  }

  // Fisher-Yates shuffle
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Navegación ──────────────────────────────────────────────────
  function goHome() { showScreen('screen-inicio'); }

  function goCategories() {
    showScreen('screen-cats');
    updatePlayBtn();
  }

  function goSend() { showScreen('screen-send'); }

  // ── Toggles de categoría ────────────────────────────────────────
  function initToggles() {
    document.querySelectorAll('.cat-toggle input').forEach(input => {
      const label = input.closest('.cat-toggle');
      input.addEventListener('change', () => {
        label.classList.toggle('on', input.checked);
        if (input.checked) activeCats.add(input.value);
        else activeCats.delete(input.value);
        updatePlayBtn();
      });
    });
  }

  function updatePlayBtn() {
    $('btn-jugar').disabled = activeCats.size === 0;
  }

  // ── Arranque del juego ──────────────────────────────────────────
  async function startGame() {
    const cats = [...activeCats];
    $('offline-notice').classList.remove('visible');
    frases = [];

    try {
      const url = `/api/frases?categorias=${cats.join(',')}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      frases = await res.json();
    } catch (_) {
      // Fallback: frases embebidas filtradas por categoría seleccionada
      frases = shuffle(FALLBACK.filter(f => cats.includes(f.categoria)));
      $('offline-notice').classList.add('visible');
    }

    if (frases.length === 0) {
      frases = shuffle(FALLBACK.filter(f => cats.includes(f.categoria)));
      $('offline-notice').classList.add('visible');
    }

    currentIdx = 0;
    renderPhrase();
    showScreen('screen-game');
  }

  function renderPhrase() {
    const total   = frases.length;
    const current = currentIdx + 1;
    $('phrase-counter').textContent = `Frase ${current} de ${total}`;
    $('phrase-text').textContent    = frases[currentIdx].texto;
    $('progress-bar').style.width   = `${(current / total) * 100}%`;
  }

  function nextPhrase() {
    currentIdx++;
    if (currentIdx >= frases.length) {
      showScreen('screen-fin');
      return;
    }
    renderPhrase();
  }

  function restart() {
    frases = shuffle(frases);
    currentIdx = 0;
    renderPhrase();
    showScreen('screen-game');
  }

  // ── Envío de frases ─────────────────────────────────────────────
  function initSendForm() {
    const textarea = $('frase-texto');
    textarea.addEventListener('input', () => {
      $('char-count').textContent = `${textarea.value.length} / 200 caracteres`;
    });
  }

  async function submitPhrase() {
    const errEl   = $('send-error');
    const textarea = $('frase-texto');
    const texto    = textarea.value.trim();
    const cat      = $('frase-cat').value;

    errEl.style.display = 'none';

    if (texto.length < 5) {
      errEl.textContent   = 'La frase es demasiado corta (mínimo 5 caracteres).';
      errEl.style.display = 'block';
      return;
    }

    const btn = document.querySelector('#screen-send .btn-primary');
    btn.disabled     = true;
    btn.textContent  = 'Enviando…';

    try {
      const res = await fetch('/api/sugerencias', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ texto, categoria: cat }),
        signal:  AbortSignal.timeout(8000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      textarea.value          = '';
      $('char-count').textContent = '0 / 200 caracteres';
      showScreen('screen-sent');
    } catch (err) {
      errEl.textContent   = err.message.includes('fetch') || err.name === 'TimeoutError'
        ? 'Sin conexión con el servidor. Inténtalo más tarde.'
        : err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled    = false;
      btn.textContent = '📨 ENVIAR';
    }
  }

  // ── Anuncios ────────────────────────────────────────────────────
  function initAds() {
    const slot = window.Ads && window.Ads.makeBanner('gameBanner');
    if (slot) $('ad-game').appendChild(slot);
  }

  // ── API pública ─────────────────────────────────────────────────
  window.YN = { goHome, goCategories, goSend, startGame, nextPhrase, restart, submitPhrase };

  // ── Inicialización ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initToggles();
    initSendForm();
    initAds();
  });

}());
