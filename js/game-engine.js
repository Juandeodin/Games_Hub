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
     players:           object? — pide nombres antes de jugar; omitir para deshabilitar
       { min, max, title, hint, storageKey }
     categories: [{ id, name, emoji, desc }]
     fallback:   [{ texto, categoria }]  — frases offline
   }

   HUECOS DE NOMBRE: con `players` activo, las frases pueden llevar {1}, {2},
   {3}... El mismo número es siempre el mismo jugador dentro de una frase, y
   números distintos son jugadores necesariamente distintos.
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

  // ── Jugadores ───────────────────────────────────────────────────
  const PL          = C.players || null;
  const PLAYERS_KEY = PL ? (PL.storageKey || 'jj_jugadores') : null;
  const MIN_JUG     = PL ? (PL.min || 2)  : 0;
  const MAX_JUG     = PL ? (PL.max || 12) : 0;
  const NOMBRE_MAX  = 20;

  // {1}, {2}, {3}... — hueco donde el motor mete un nombre.
  const RE_HUECO = /\{(\d+)\}/g;

  /** Números de hueco distintos que usa una frase. Su tamaño es el número
   *  de jugadores DISTINTOS que hacen falta para poder mostrarla. */
  function huecosDe(texto) {
    const nums = new Set();
    let m;
    RE_HUECO.lastIndex = 0;
    while ((m = RE_HUECO.exec(texto)) !== null) nums.add(m[1]);
    return nums;
  }

  function loadJugadores() {
    try {
      const raw = localStorage.getItem(PLAYERS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.filter(n => typeof n === 'string' && n.trim()).slice(0, MAX_JUG);
    } catch (_) {
      return [];
    }
  }

  function saveJugadores(list) {
    try {
      localStorage.setItem(PLAYERS_KEY, JSON.stringify(list));
    } catch (_) { /* navegador sin almacenamiento: se juega igual */ }
  }

  /**
   * Reparto justo: en vez de sortear un nombre por hueco (que deja a alguien
   * fuera toda la partida por pura mala suerte), se va vaciando una bolsa
   * barajada y solo se rebaraja al agotarse. Así todos salen un número
   * parecido de veces.
   */
  let bolsa = [];

  function sacarJugadores(n, jugadores) {
    const elegidos = [];
    const apartados = [];          // ya usados EN ESTA frase; vuelven al final
    while (elegidos.length < n) {
      if (!bolsa.length) bolsa = shuffle(jugadores);
      const nombre = bolsa.pop();
      if (elegidos.includes(nombre)) apartados.push(nombre);
      else                           elegidos.push(nombre);
    }
    bolsa.push(...apartados);
    return elegidos;
  }

  /** Asigna un nombre a cada hueco de cada frase del mazo. */
  function repartirNombres(mazo, jugadores) {
    bolsa = [];
    mazo.forEach(f => {
      const huecos = [...huecosDe(f.texto)];
      if (!huecos.length) { f.asignacion = null; return; }
      const nombres = sacarJugadores(huecos.length, jugadores);
      f.asignacion = {};
      huecos.forEach((h, i) => { f.asignacion[h] = nombres[i]; });
    });
  }

  /** Texto de la frase con los huecos ya sustituidos, listo para innerHTML.
   *  Se escapa primero: esc() no toca ni las llaves ni los dígitos, así que
   *  la sustitución posterior sigue encontrando los huecos. */
  function textoConNombres(frase) {
    const seguro = esc(frase.texto);
    if (!frase.asignacion) return seguro;
    return seguro.replace(RE_HUECO, (hueco, num) => {
      const nombre = frase.asignacion[num];
      return nombre ? `<span class="jugador">${esc(nombre)}</span>` : hueco;
    });
  }

  // ── Construir UI ────────────────────────────────────────────────
  function buildUI() {
    document.body.style.setProperty('--game-bg', C.bgColor || '#7c3aed');

    const hasMine = !!UP;
    const hasPlayers = !!PL;

    document.body.innerHTML = `
      <div id="screen-inicio" class="screen active">
        <a href="../../index.html" class="btn-hub">← Hub</a>
        <h1 class="game-title">${nl(C.title)}</h1>
        <p class="game-intro">${C.intro || ''}</p>
        <button class="btn btn-primary btn-full" id="btn-empezar">🍺 EMPEZAR</button>
        ${hasMine ? '<button class="btn btn-secondary btn-full" id="btn-ir-mis">✏️ MIS FRASES</button>' : ''}
      </div>

      ${hasPlayers ? `
      <div id="screen-jugadores" class="screen">
        <h2 class="section-title">${PL.title || '¿Quiénes juegan?'}</h2>
        ${PL.hint ? `<p class="screen-sub">${PL.hint}</p>` : ''}
        <div class="card">
          <div id="player-list"></div>
          <p id="jug-error" class="send-error" style="display:none"></p>
          <button class="btn btn-secondary btn-full" id="btn-add-jugador">➕ AÑADIR JUGADOR</button>
        </div>
        <button class="btn btn-primary btn-full" id="btn-jugadores-next" disabled>SIGUIENTE →</button>
        <button class="btn btn-ghost" id="btn-jugadores-back">← Volver</button>
      </div>` : ''}

      <div id="screen-cats" class="screen">
        <h2 class="section-title">¿Qué nivel?</h2>
        <p class="screen-sub">Activa los tipos de frases que queréis</p>
        <div class="toggles" id="toggles"></div>
        <p id="cats-error" class="send-error" style="display:none"></p>
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
        ${hasPlayers ? '<button class="btn btn-ghost" id="btn-game-jugadores">👥 Cambiar jugadores</button>' : ''}
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
  let jugadores  = [];   // nombres validados de la pantalla de jugadores

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

    let mazo = shuffle([...remotas, ...mias]);

    if (PL) {
      // Una frase con {1} {2} {3} necesita tres personas distintas: con menos
      // jugadores no hay forma de mostrarla sin repetir a alguien, así que se
      // descarta. Se aplica también a "Mis frases", que van ya mezcladas.
      const cabe = mazo.filter(f => huecosDe(f.texto).size <= jugadores.length);
      if (!cabe.length && mazo.length) {
        mostrarErrorCats(
          `Con ${jugadores.length} jugador${jugadores.length === 1 ? '' : 'es'} no hay frases ` +
          `suficientes en estas categorías. Añade más gente o activa otra categoría.`
        );
        return;
      }
      mazo = cabe;
      repartirNombres(mazo, jugadores);
    }

    frases = mazo;
    currentIdx = 0;
    renderPhrase();
    showScreen('screen-game');
  }

  function renderPhrase() {
    if (!frases.length) { showScreen('screen-fin'); return; }
    const total   = frases.length;
    const current = currentIdx + 1;
    const frase   = frases[currentIdx];
    // innerHTML, no textContent: los nombres van envueltos en <span>. El texto
    // se escapa dentro de textoConNombres().
    $('phrase-text').innerHTML    = PL ? textoConNombres(frase) : esc(frase.texto);
    $('progress-bar').style.width = `${(current / total) * 100}%`;
  }

  function nextPhrase() {
    currentIdx++;
    if (currentIdx >= frases.length) { showScreen('screen-fin'); return; }
    renderPhrase();
  }

  function restart() {
    frases = shuffle(frases);
    // Se reparten los nombres otra vez: la segunda vuelta no debe repetir los
    // mismos emparejamientos que la primera.
    if (PL) repartirNombres(frases, jugadores);
    currentIdx = 0;
    renderPhrase();
    showScreen('screen-game');
  }

  // ── Jugadores — pantalla ─────────────────────────────────────────
  function mostrarErrorCats(msg) {
    const el = $('cats-error');
    if (!el) return;
    el.textContent   = msg;
    el.style.display = 'block';
  }

  function limpiarErrorCats() {
    const el = $('cats-error');
    if (el) el.style.display = 'none';
  }

  /** Nombres escritos ahora mismo: recortados, sin vacíos y sin repetidos
   *  (ignorando mayúsculas, para que "ana" y "Ana" no sean dos personas). */
  function nombresEscritos() {
    const vistos = new Set();
    const limpios = [];
    document.querySelectorAll('#player-list input').forEach(input => {
      const n = input.value.trim();
      if (!n) return;
      const clave = n.toLowerCase();
      if (vistos.has(clave)) return;
      vistos.add(clave);
      limpios.push(n);
    });
    return limpios;
  }

  function hayRepetidos() {
    const escritos = [];
    document.querySelectorAll('#player-list input').forEach(input => {
      const n = input.value.trim().toLowerCase();
      if (n) escritos.push(n);
    });
    return new Set(escritos).size !== escritos.length;
  }

  function refreshJugadores() {
    const nombres = nombresEscritos();
    const errEl   = $('jug-error');

    if (hayRepetidos()) {
      errEl.textContent   = 'Hay dos jugadores con el mismo nombre.';
      errEl.style.display = 'block';
    } else {
      errEl.style.display = 'none';
    }

    $('btn-add-jugador').disabled   = document.querySelectorAll('#player-list input').length >= MAX_JUG;
    $('btn-jugadores-next').disabled = nombres.length < MIN_JUG || hayRepetidos();
  }

  function filaJugador(nombre) {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <input type="text" maxlength="${NOMBRE_MAX}" placeholder="Nombre" aria-label="Nombre del jugador" />
      <button class="btn btn-mini btn-danger" type="button" data-quitar aria-label="Quitar jugador">✕</button>
    `;
    row.querySelector('input').value = nombre || '';
    return row;
  }

  function renderJugadores(nombres) {
    const cont = $('player-list');
    cont.innerHTML = '';
    // Sin nada guardado se pintan las filas mínimas, para que se vea qué hacer.
    const iniciales = nombres.length ? nombres : new Array(MIN_JUG).fill('');
    iniciales.slice(0, MAX_JUG).forEach(n => cont.appendChild(filaJugador(n)));
    refreshJugadores();
  }

  function initJugadores() {
    if (!PL) return;

    const cont = $('player-list');
    renderJugadores(loadJugadores());

    cont.addEventListener('input', refreshJugadores);

    cont.addEventListener('click', e => {
      const btn = e.target.closest('button[data-quitar]');
      if (!btn) return;
      // Nunca se baja de una fila: sin ninguna no habría dónde escribir.
      if (cont.querySelectorAll('.player-row').length > 1) btn.closest('.player-row').remove();
      else                                                 btn.closest('.player-row').querySelector('input').value = '';
      refreshJugadores();
    });

    $('btn-add-jugador').addEventListener('click', () => {
      if (cont.querySelectorAll('input').length >= MAX_JUG) return;
      const row = filaJugador('');
      cont.appendChild(row);
      row.querySelector('input').focus();
      refreshJugadores();
    });

    $('btn-jugadores-next').addEventListener('click', () => {
      jugadores = nombresEscritos();
      if (jugadores.length < MIN_JUG) return;
      saveJugadores(jugadores);
      goToCats();
    });

    $('btn-jugadores-back').addEventListener('click', () => showScreen('screen-inicio'));
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
    limpiarErrorCats();
    showScreen('screen-cats');
    await togglesListos;      // resuelto ya en la práctica: se lanza al cargar
    refreshMineToggle();
  }

  /** Con jugadores, el flujo es inicio → jugadores → categorías. */
  function goToStart() {
    if (PL) { showScreen('screen-jugadores'); refreshJugadores(); }
    else    { goToCats(); }
  }

  function wireEvents() {
    $('btn-empezar').addEventListener('click',    goToStart);
    $('btn-jugar').addEventListener('click',      startGame);
    $('btn-cats-back').addEventListener('click',  () => showScreen(PL ? 'screen-jugadores' : 'screen-inicio'));
    $('btn-siguiente').addEventListener('click',  nextPhrase);
    $('btn-game-cats').addEventListener('click',  goToCats);
    $('btn-otra-ronda').addEventListener('click', restart);
    $('btn-fin-cats').addEventListener('click',   goToCats);

    if (PL) {
      $('btn-game-jugadores').addEventListener('click', () => showScreen('screen-jugadores'));
    }

    if (UP) {
      $('btn-ir-mis').addEventListener('click',   () => showScreen('screen-mis'));
      $('btn-mis-back').addEventListener('click', () => showScreen('screen-inicio'));
    }
  }

  // ── Init ────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    buildUI();
    wireEvents();
    initJugadores();
    initMisFrases();
    initAds();
    // Se pide ya, mientras el jugador lee la pantalla de inicio, para que
    // los toggles estén listos cuando pulse EMPEZAR.
    togglesListos = cargarCategorias().then(buildToggles);
  });
}());
