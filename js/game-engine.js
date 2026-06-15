/* ================================================================
   GAME ENGINE — motor compartido para todos los juegos de cartas
   Requiere window.GAME_CONFIG definido antes de cargar este script.

   GAME_CONFIG = {
     title:             string  — título del juego (\n → <br>)
     bgColor:           string  — color de fondo CSS
     phraseLabel:       string  — texto sobre la frase (ej. "YO NUNCA HE...")
     intro:             string  — subtítulo en pantalla inicio (HTML permitido)
     endIcon:           string  — emoji en pantalla de fin
     endText:           string  — título pantalla de fin (\n → <br>)
     endSubtext:        string  — subtítulo pantalla de fin
     apiEndpoint:       string  — URL GET de frases (?categorias=...)
     submitEndpoint:    string? — URL POST de sugerencias; omitir para deshabilitar
     submitHint:        string? — aclaración junto al label del textarea
     submitPlaceholder: string? — placeholder del textarea
     categories: [{ id, name, emoji, desc }]
     fallback:   [{ texto, categoria }]  — frases offline
   }
   ================================================================ */
(function () {
  'use strict';

  const C = window.GAME_CONFIG;

  // ── Helpers ─────────────────────────────────────────────────────
  function $(id)    { return document.getElementById(id); }
  function nl(str)  { return (str || '').replace(/\n/g, '<br>'); }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Construir UI ────────────────────────────────────────────────
  function buildUI() {
    document.body.style.setProperty('--game-bg', C.bgColor || '#7c3aed');

    const hasSend = !!C.submitEndpoint;

    document.body.innerHTML = `
      <div id="screen-inicio" class="screen active">
        <a href="../../index.html" class="btn-hub">← Hub</a>
        <h1 class="game-title">${nl(C.title)}</h1>
        <p class="game-intro">${C.intro || ''}</p>
        <button class="btn btn-primary btn-full" id="btn-empezar">🍺 EMPEZAR</button>
        ${hasSend ? '<button class="btn btn-secondary btn-full" id="btn-ir-send">✏️ MANDA TUS FRASES</button>' : ''}
      </div>

      <div id="screen-cats" class="screen">
        <h2 class="section-title">¿Qué nivel?</h2>
        <p class="screen-sub">Activa los tipos de frases que queréis</p>
        <div class="toggles" id="toggles"></div>
        <button id="btn-jugar" class="btn btn-primary btn-full" disabled>🎲 ¡A JUGAR!</button>
        <button class="btn btn-ghost" id="btn-cats-back">← Volver</button>
      </div>

      <div id="screen-game" class="screen">
        <div class="progress-wrap" role="progressbar" aria-label="Progreso">
          <div class="progress-bar" id="progress-bar"></div>
        </div>
        <div class="card phrase-card">
          ${C.phraseLabel ? `<span class="phrase-label">${C.phraseLabel}</span>` : ''}
          <p class="phrase-text" id="phrase-text"></p>
        </div>
        <div class="offline-notice" id="offline-notice">⚠️ Modo sin conexión — usando frases de muestra</div>
        <button class="btn btn-primary btn-full" id="btn-siguiente">SIGUIENTE →</button>
        <button class="btn btn-ghost" id="btn-game-cats">↩ Cambiar categorías</button>
      </div>

      <div id="screen-fin" class="screen">
        <span class="end-icon">${C.endIcon || '🎉'}</span>
        <h2 class="section-title">${nl(C.endText || '¡Se acabaron las frases!')}</h2>
        ${C.endSubtext ? `<p class="screen-sub">${C.endSubtext}</p>` : ''}
        <button class="btn btn-primary btn-full" id="btn-otra-ronda">🔄 OTRA RONDA</button>
        <button class="btn btn-secondary btn-full" id="btn-fin-cats">↩ Cambiar categorías</button>
        <a href="../../index.html" class="btn btn-ghost">🏠 Volver al hub</a>
      </div>

      ${hasSend ? `
      <div id="screen-send" class="screen">
        <h2 class="section-title">Manda tu frase</h2>
        <div class="card">
          <div class="field">
            <label class="field-label" for="frase-texto">
              La frase ${C.submitHint ? `<span class="hint">(${C.submitHint})</span>` : ''}
            </label>
            <textarea id="frase-texto" placeholder="${C.submitPlaceholder || ''}" maxlength="200"></textarea>
            <p class="form-hint" id="char-count">0 / 200 caracteres</p>
          </div>
          <div class="field">
            <label class="field-label" for="frase-cat">Categoría</label>
            <select id="frase-cat">
              ${C.categories.map(cat => `<option value="${cat.id}">${cat.emoji} ${cat.name}</option>`).join('')}
            </select>
          </div>
          <p id="send-error" class="send-error" style="display:none"></p>
          <button class="btn btn-primary btn-full" id="btn-enviar">📨 ENVIAR</button>
        </div>
        <button class="btn btn-ghost" id="btn-send-back">← Volver</button>
      </div>

      <div id="screen-sent" class="screen">
        <span class="end-icon">🎉</span>
        <h2 class="section-title">¡Gracias!</h2>
        <p class="screen-sub">Tu frase ha sido enviada. Juan la revisará y la añadirá si mola.</p>
        <button class="btn btn-primary" id="btn-sent-home">🏠 Volver al inicio</button>
      </div>` : ''}

      <div id="ad-game"></div>
    `;
  }

  // ── Estado ──────────────────────────────────────────────────────
  let frases     = [];
  let currentIdx = 0;
  let activeCats = new Set();

  // ── Pantallas ───────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = $(id);
    el.classList.add('active');
    void el.offsetWidth;
    el.style.animation = 'none';
    requestAnimationFrame(() => { el.style.animation = ''; });
  }

  // ── Toggles de categoría ────────────────────────────────────────
  function buildToggles() {
    const container = $('toggles');
    C.categories.forEach(cat => {
      const label = document.createElement('label');
      label.className = 'cat-toggle';
      label.innerHTML = `
        <input type="checkbox" value="${cat.id}" />
        <span class="cat-emoji">${cat.emoji}</span>
        <span class="cat-info">
          <span class="cat-name">${cat.name}</span>
          <span class="cat-desc">${cat.desc}</span>
        </span>
      `;
      label.querySelector('input').addEventListener('change', e => {
        label.classList.toggle('on', e.target.checked);
        if (e.target.checked) activeCats.add(cat.id);
        else                   activeCats.delete(cat.id);
        $('btn-jugar').disabled = activeCats.size === 0;
      });
      container.appendChild(label);
    });
  }

  // ── Arranque del juego ──────────────────────────────────────────
  async function startGame() {
    const cats = [...activeCats];
    $('offline-notice').classList.remove('visible');
    frases = [];

    try {
      const res = await fetch(`${C.apiEndpoint}?categorias=${cats.join(',')}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      frases = await res.json();
    } catch (_) {
      frases = shuffle((C.fallback || []).filter(f => cats.includes(f.categoria)));
      $('offline-notice').classList.add('visible');
    }

    if (!frases.length) {
      frases = shuffle((C.fallback || []).filter(f => cats.includes(f.categoria)));
      $('offline-notice').classList.add('visible');
    }

    currentIdx = 0;
    renderPhrase();
    showScreen('screen-game');
  }

  function renderPhrase() {
    const total   = frases.length;
    const current = currentIdx + 1;
    $('phrase-text').textContent  = frases[currentIdx].texto;
    $('progress-bar').style.width = `${(current / total) * 100}%`;
  }

  function nextPhrase() {
    currentIdx++;
    if (currentIdx >= frases.length) { showScreen('screen-fin'); return; }
    renderPhrase();
  }

  function restart() {
    frases = shuffle(frases);
    currentIdx = 0;
    renderPhrase();
    showScreen('screen-game');
  }

  // ── Formulario de envío ─────────────────────────────────────────
  function initSendForm() {
    if (!C.submitEndpoint) return;

    const textarea = $('frase-texto');
    textarea.addEventListener('input', () => {
      $('char-count').textContent = `${textarea.value.length} / 200 caracteres`;
    });

    $('btn-enviar').addEventListener('click', async () => {
      const errEl = $('send-error');
      const texto = textarea.value.trim();
      const cat   = $('frase-cat').value;

      errEl.style.display = 'none';
      if (texto.length < 5) {
        errEl.textContent   = 'La frase es demasiado corta (mínimo 5 caracteres).';
        errEl.style.display = 'block';
        return;
      }

      const btn = $('btn-enviar');
      btn.disabled    = true;
      btn.textContent = 'Enviando…';

      try {
        const res = await fetch(C.submitEndpoint, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ texto, categoria: cat }),
          signal:  AbortSignal.timeout(8000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        textarea.value              = '';
        $('char-count').textContent = '0 / 200 caracteres';
        showScreen('screen-sent');
      } catch (err) {
        errEl.textContent   = err.name === 'TimeoutError' || err.message.includes('fetch')
          ? 'Sin conexión con el servidor. Inténtalo más tarde.'
          : err.message;
        errEl.style.display = 'block';
      } finally {
        btn.disabled    = false;
        btn.textContent = '📨 ENVIAR';
      }
    });
  }

  // ── Anuncios ────────────────────────────────────────────────────
  function initAds() {
    const slot = window.Ads && window.Ads.makeBanner('gameBanner');
    if (slot) $('ad-game').appendChild(slot);
  }

  // ── Eventos ─────────────────────────────────────────────────────
  function wireEvents() {
    $('btn-empezar').addEventListener('click',    () => showScreen('screen-cats'));
    $('btn-jugar').addEventListener('click',      startGame);
    $('btn-cats-back').addEventListener('click',  () => showScreen('screen-inicio'));
    $('btn-siguiente').addEventListener('click',  nextPhrase);
    $('btn-game-cats').addEventListener('click',  () => showScreen('screen-cats'));
    $('btn-otra-ronda').addEventListener('click', restart);
    $('btn-fin-cats').addEventListener('click',   () => showScreen('screen-cats'));

    if (C.submitEndpoint) {
      $('btn-ir-send').addEventListener('click',   () => showScreen('screen-send'));
      $('btn-send-back').addEventListener('click', () => showScreen('screen-inicio'));
      $('btn-sent-home').addEventListener('click', () => showScreen('screen-inicio'));
    }
  }

  // ── Init ────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    buildUI();
    buildToggles();
    wireEvents();
    initSendForm();
    initAds();
  });
}());
