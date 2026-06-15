const CARD_COLORS = [
  '#ff3b3b', '#1e90ff', '#00c853', '#ff4fa3',
  '#7c3aed', '#ff7200', '#00d4e8', '#ffe135'
];

const BTN_COLORS = [
  '#00c853', '#ff3b3b', '#7c3aed', '#ff7200',
  '#1e90ff', '#ff4fa3', '#00d4e8', '#ffe135'
];

async function loadGames() {
  const grid = document.getElementById('grid');

  try {
    const res = await fetch('data/games.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const games = await res.json();
    renderGames(games, grid);
    buildCategoryBar(games);
  } catch (err) {
    if (err instanceof TypeError || err.message.includes('Failed to fetch')) {
      showError(grid, 'file://');
    } else {
      showError(grid, 'generic');
    }
  }
}

function renderGames(games, grid) {
  if (!games.length) {
    grid.innerHTML = `<div class="grid-message"><h2>¡Aún no hay juegos!</h2><p>Añade entradas en <code>data/games.json</code> para que aparezcan aquí.</p></div>`;
    return;
  }

  games.forEach((game, i) => {
    grid.appendChild(buildCard(game, i));
    const n = window.Ads?.config.inFeedEvery;
    if (n && (i + 1) % n === 0 && i < games.length - 1) {
      grid.appendChild(window.Ads.makeNative());
    }
  });
}

function buildCard(game, index) {
  const bgColor = game.color || CARD_COLORS[index % CARD_COLORS.length];
  const btnColor = BTN_COLORS[index % BTN_COLORS.length];

  const card = document.createElement('article');
  card.className = 'game-card';
  card.setAttribute('role', 'listitem');
  card.style.setProperty('animation-delay', `${index * 0.1}s`);
  if (game.category) card.dataset.category = game.category;

  /* Zona de imagen */
  const imgDiv = document.createElement('div');
  imgDiv.className = 'card-image';
  imgDiv.style.backgroundColor = bgColor;

  if (game.image) {
    const testImg = new Image();
    testImg.onload  = () => { imgDiv.style.backgroundImage = `url('${game.image}')`; };
    testImg.onerror = () => { /* mantiene el color plano */ };
    testImg.src = game.image;
  }

  /* Badge (NUEVO, BETA…) */
  if (game.badge) {
    const badge = document.createElement('span');
    badge.className = 'card-badge';
    badge.textContent = game.badge;
    imgDiv.appendChild(badge);
  }

  /* Indicador externo */
  if (game.type === 'external') {
    const extBadge = document.createElement('span');
    extBadge.className = 'card-ext-badge';
    extBadge.textContent = '↗ Externo';
    imgDiv.appendChild(extBadge);
  }

  card.appendChild(imgDiv);

  /* Cuerpo */
  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = game.title;

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  desc.textContent = game.description;

  /* Botón */
  const btn = document.createElement('a');
  btn.className = 'card-btn';
  btn.href = game.link;
  btn.style.backgroundColor = btnColor;

  if (game.type === 'external') {
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.setAttribute('aria-label', `Jugar ${game.title} (abre en nueva pestaña)`);
  } else {
    btn.setAttribute('aria-label', `Jugar ${game.title}`);
  }

  const icon = document.createElement('span');
  icon.className = 'btn-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = game.type === 'external' ? '↗' : '▶';

  btn.appendChild(icon);
  btn.appendChild(document.createTextNode('JUGAR'));

  body.appendChild(title);
  body.appendChild(desc);
  body.appendChild(btn);
  card.appendChild(body);

  return card;
}

/* ── Barra de categorías ── */

function buildCategoryBar(games) {
  const bar = document.getElementById('category-bar');
  if (!bar) return;

  const categories = ['Todos', ...new Set(games.map(g => g.category).filter(Boolean))];

  categories.forEach((cat, i) => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (i === 0 ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = cat;
    btn.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    btn.addEventListener('click', () => filterByCategory(cat, bar));
    bar.appendChild(btn);
  });
}

function filterByCategory(cat, bar) {
  /* Actualizar botones activos */
  bar.querySelectorAll('.cat-btn').forEach(btn => {
    const isActive = btn.dataset.cat === cat;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  const grid = document.getElementById('grid');
  const cards = grid.querySelectorAll('.game-card');
  const adSlots = grid.querySelectorAll('.ad-slot');
  let visible = 0;

  cards.forEach(card => {
    const match = cat === 'Todos' || card.dataset.category === cat;
    card.classList.toggle('hidden', !match);
    if (match) visible++;
  });

  /* Ocultar anuncios nativos cuando hay filtro activo */
  adSlots.forEach(slot => slot.classList.toggle('hidden', cat !== 'Todos'));

  /* Mensaje si ningún juego coincide */
  const existing = grid.querySelector('.no-results');
  if (existing) existing.remove();
  if (visible === 0) {
    const msg = document.createElement('p');
    msg.className = 'no-results';
    msg.textContent = `No hay juegos en "${cat}" todavía... ¡Próximamente!`;
    grid.appendChild(msg);
  }
}

/* ── Error ── */

function showError(grid, type) {
  const isFileProt = type === 'file://';
  grid.innerHTML = `
    <div class="grid-message">
      <h2>${isFileProt ? '⚠️ Necesitas un servidor local' : '❌ Error al cargar juegos'}</h2>
      <p>
        ${isFileProt
          ? `Los juegos se cargan desde <code>data/games.json</code> y el navegador bloquea esto al abrir con <code>file://</code>.
             <br><br>
             Lanza un servidor rápido en la carpeta del proyecto:<br>
             <code>python -m http.server 8000</code><br>
             y abre <code>http://localhost:8000</code><br>
             <br>
             O usa la extensión <strong>Live Server</strong> de VS Code.`
          : 'No se pudo cargar <code>data/games.json</code>. Comprueba que el archivo existe y tiene formato JSON válido.'}
      </p>
    </div>`;
}

loadGames();
