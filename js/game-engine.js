/* ================================================================
   GAME ENGINE — motor compartido para todos los juegos de cartas
   Requiere window.GAME_CONFIG definido antes de cargar este script.

   GAME_CONFIG = {
     id:                string  — identificador del juego (clave de localStorage)
     title:             string  — título del juego (\n → <br>)
     bgColor:           string  — color de fondo CSS
     phraseLabel:       string  — texto sobre la frase (ej. "YO NUNCA HE...")
     intro:             string  — subtítulo en pantalla inicio (HTML permitido)
     endIcon:           string  — emoji en pantalla de fin
     endText:           string  — título pantalla de fin (\n → <br>)
     endSubtext:        string  — subtítulo pantalla de fin
     apiEndpoint:       string  — URL GET de frases (?categorias=...)
     userPhrases:       object? — categoría local "Mis frases"; omitir para deshabilitar
       { id, name, emoji, desc, hint, placeholder }
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
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── "Mis frases" — almacenamiento local ────────────────────────
  const UP          = C.userPhrases || null;
  const MINE_ID     = UP ? UP.id : null;
  const STORAGE_KEY = `jj_misfrases_${C.id}`;

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function loadMine() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.filter(f => f && typeof f.texto === 'string');
    } catch (_) {
      return [];
    }
  }

  function saveMine(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (_) {
      return false;
    }
  }

  function addMine(texto) {
    const trimmed = texto.trim();
    if (trimmed.length < 5 || trimmed.length > 200) {
      return 'La frase debe tener entre 5 y 200 caracteres.';
    }
    const list = loadMine();
    if (list.some(f => f.texto.toLowerCase() === trimmed.toLowerCase())) {
      return 'Ya has añadido esa frase.';
    }
    list.unshift({ id: uid(), texto: trimmed, creada: new Date().toISOString() });
    if (!saveMine(list)) {
      return 'No se ha podido guardar la frase en este navegador.';
    }
    return null;
  }

  function removeMine(id) {
    saveMine(loadMine().filter(f => f.id !== id));
  }

  // ── Construir UI ────────────────────────────────────────────────
  function buildUI() {
    document.body.style.setProperty('--game-bg', C.bgColor || '#7c3aed');

    const hasMine = !!UP;

    document.body.innerHTML = `
      <div id="screen-inicio" class="screen active">
        <a href="../../index.html" class="btn-hub">← Hub</a>
        <h1 class="game-title">${nl(C.title)}</h1>
        <p class="game-intro">${C.intro || ''}</p>
        <button class="btn btn-primary btn-full" id="btn-empezar">🍺 EMPEZAR</button>
        ${hasMine ? '<button class="btn btn-secondary btn-full" id="btn-ir-mis">✏️ MIS FRASES</button>' : ''}
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

      ${hasMine ? `
      <div id="screen-mis" class="screen">
        <h2 class="section-title">Mis frases</h2>
        <div class="card">
          <div class="field">
            <label class="field-label" for="frase-texto">
              La frase ${UP.hint ? `<span class="hint">(${UP.hint})</span>` : ''}
            </label>
            <textarea id="frase-texto" placeholder="${UP.placeholder || ''}" maxlength="200"></textarea>
            <p class="form-hint" id="char-count">0 / 200 caracteres</p>
          </div>
          <p id="mis-error" class="send-error" style="display:none"></p>
          <button class="btn btn-primary btn-full" id="btn-add">➕ AÑADIR</button>
        </div>
        <div class="card" id="mis-lista"></div>
        <button class="btn btn-ghost" id="btn-mis-back">← Volver</button>
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
  function makeToggle(cat) {
    const label = document.createElement('label');
    label.className = 'cat-toggle';
    label.dataset.catId = cat.id;
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
    return label;
  }

  /**
   * Las categorías las manda el servidor (se editan desde /admin), de modo
   * que crear una no requiere tocar código. C.categories del HTML queda
   * como respaldo si la API no responde — misma degradación que C.fallback
   * hace con las frases.
   */
  async function cargarCategorias() {
    if (!C.configEndpoint) return C.categories;
    try {
      const res = await fetch(C.configEndpoint, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      return (Array.isArray(d.categorias) && d.categorias.length) ? d.categorias : C.categories;
    } catch (_) {
      return C.categories;
    }
  }

  let togglesListos = null;

  function buildToggles(categorias) {
    const container = $('toggles');
    container.innerHTML = '';
    activeCats.clear();
    categorias.forEach(cat => container.appendChild(makeToggle(cat)));
    if (UP) container.appendChild(makeToggle(UP));
    $('btn-jugar').disabled = true;
  }

  function refreshMineToggle() {
    if (!UP) return;
    const label = document.querySelector(`.cat-toggle[data-cat-id="${MINE_ID}"]`);
    if (!label) return;
    const count   = loadMine().length;
    const input   = label.querySelector('input');
    const descEl  = label.querySelector('.cat-desc');

    descEl.textContent = count > 0
      ? `${count} frase${count === 1 ? '' : 's'} guardada${count === 1 ? '' : 's'}`
      : 'Aún no has creado ninguna';

    input.disabled = count === 0;
    label.classList.toggle('disabled', count === 0);

    if (count === 0 && input.checked) {
      input.checked = false;
      label.classList.remove('on');
      activeCats.delete(MINE_ID);
      $('btn-jugar').disabled = activeCats.size === 0;
    }
  }

  // ── Arranque del juego ──────────────────────────────────────────
  async function startGame() {
    const cats    = [...activeCats];
    const apiCats = cats.filter(c => c !== MINE_ID);
    const mias    = (UP && cats.includes(MINE_ID))
      ? loadMine().map(f => ({ texto: f.texto, categoria: MINE_ID }))
      : [];

    $('offline-notice').classList.remove('visible');
    let remotas = [];

    if (apiCats.length) {
      if (C.apiEndpoint) {
        try {
          // El endpoint puede traer ya su propia query (p. ej. ?juego=...)
          const sep = C.apiEndpoint.includes('?') ? '&' : '?';
          const res = await fetch(`${C.apiEndpoint}${sep}categorias=${apiCats.join(',')}`, {
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          remotas = await res.json();
        } catch (_) { /* se resuelve con el fallback de abajo */ }
      }

      if (!remotas.length) {
        remotas = shuffle((C.fallback || []).filter(f => apiCats.includes(f.categoria)));
        $('offline-notice').classList.add('visible');
      }
    }

    frases = shuffle([...remotas, ...mias]);
    currentIdx = 0;
    renderPhrase();
    showScreen('screen-game');
  }

  function renderPhrase() {
    if (!frases.length) { showScreen('screen-fin'); return; }
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

  // ── "Mis frases" — pantalla ──────────────────────────────────────
  function renderMisLista() {
    const container = $('mis-lista');
    const list = loadMine();

    container.innerHTML = list.length
      ? `<div class="phrase-list">${list.map(f => `
          <div class="phrase-item">
            <span>${esc(f.texto)}</span>
            <button class="btn btn-mini btn-danger" data-id="${esc(f.id)}" aria-label="Borrar frase">✕</button>
          </div>
        `).join('')}</div>`
      : '<p class="empty-state">Aún no has creado ninguna frase.</p>';
  }

  function initMisFrases() {
    if (!UP) return;

    const textarea = $('frase-texto');
    textarea.addEventListener('input', () => {
      $('char-count').textContent = `${textarea.value.length} / 200 caracteres`;
    });

    $('btn-add').addEventListener('click', () => {
      const errEl = $('mis-error');
      errEl.style.display = 'none';

      const error = addMine(textarea.value);
      if (error) {
        errEl.textContent   = error;
        errEl.style.display = 'block';
        return;
      }

      textarea.value              = '';
      $('char-count').textContent = '0 / 200 caracteres';
      renderMisLista();
      refreshMineToggle();
    });

    $('mis-lista').addEventListener('click', e => {
      const btn = e.target.closest('button[data-id]');
      if (!btn) return;
      removeMine(btn.dataset.id);
      renderMisLista();
      refreshMineToggle();
    });

    renderMisLista();
  }

  // ── Anuncios ────────────────────────────────────────────────────
  function initAds() {
    const slot = window.Ads && window.Ads.makeBanner('gameBanner');
    if (slot) $('ad-game').appendChild(slot);
  }

  // ── Eventos ─────────────────────────────────────────────────────
  async function goToCats() {
    showScreen('screen-cats');
    await togglesListos;      // resuelto ya en la práctica: se lanza al cargar
    refreshMineToggle();
  }

  function wireEvents() {
    $('btn-empezar').addEventListener('click',    goToCats);
    $('btn-jugar').addEventListener('click',      startGame);
    $('btn-cats-back').addEventListener('click',  () => showScreen('screen-inicio'));
    $('btn-siguiente').addEventListener('click',  nextPhrase);
    $('btn-game-cats').addEventListener('click',  goToCats);
    $('btn-otra-ronda').addEventListener('click', restart);
    $('btn-fin-cats').addEventListener('click',   goToCats);

    if (UP) {
      $('btn-ir-mis').addEventListener('click',   () => showScreen('screen-mis'));
      $('btn-mis-back').addEventListener('click', () => showScreen('screen-inicio'));
    }
  }

  // ── Init ────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    buildUI();
    wireEvents();
    initMisFrases();
    initAds();
    // Se pide ya, mientras el jugador lee la pantalla de inicio, para que
    // los toggles estén listos cuando pulse EMPEZAR.
    togglesListos = cargarCategorias().then(buildToggles);
  });
}());
