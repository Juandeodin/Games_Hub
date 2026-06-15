# Juegos de Juan

Hub central de todos los juegos web de Juan. Estilo cómic/cartoon: colores planos y vivos, bordes negros gruesos, sombras duras y animaciones divertidas.

---

## Arrancar en local

Los juegos se cargan desde `data/games.json` con `fetch`, por lo que el navegador necesita servir los archivos por HTTP (no funciona con `file://`).

**Opción 1 — Python (sin instalar nada extra):**
```bash
python -m http.server 8000
```
Luego abre `http://localhost:8000` en el navegador.

**Opción 2 — VS Code Live Server:**
Instala la extensión [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) y pulsa "Go Live" en la barra inferior.

---

## Añadir un nuevo juego

1. Abre `data/games.json` y añade un objeto al array:

```json
{
  "id":          "mi-juego",
  "title":       "Mi Juego",
  "description": "Descripción breve del juego.",
  "image":       "assets/img/mi-juego.svg",
  "color":       "#ff3b3b",
  "type":        "internal",
  "link":        "games/mi-juego/index.html",
  "badge":       "NUEVO"
}
```

| Campo         | Descripción |
|---------------|-------------|
| `id`          | Identificador único (sin espacios) |
| `title`       | Nombre que se muestra en la tarjeta |
| `description` | Texto breve |
| `image`       | Ruta a la imagen de fondo (SVG, PNG…). Si no existe, usa `color` |
| `color`       | Color hexadecimal plano de fondo (fallback o decoración) |
| `type`        | `"internal"` (dentro de la app) o `"external"` (pestaña nueva) |
| `link`        | Ruta relativa o URL completa del juego |
| `badge`       | Etiqueta opcional ("NUEVO", "BETA", "PRONTO"…). Dejar `""` para ocultar |

2. Añade la imagen en `assets/img/mi-juego.svg` (o PNG/JPG).

3. Si es un juego **interno**, crea la carpeta `games/mi-juego/` con su `index.html`.  
   Puedes copiar `games/ejemplo-1/index.html` como punto de partida.

---

## Publicidad (Google AdSense)

### Pasos para activarla

1. **Crea una cuenta en [Google AdSense](https://adsense.google.com)** y añade tu sitio.
2. Cuando Google te apruebe, obtendrás un **ID de editor** (`ca-pub-XXXXXXXXXXXXXXXX`) y podrás crear **bloques de anuncio** (uno por slot).
3. Abre `js/ads.js` y rellena el objeto `ADS_CONFIG` al principio del archivo:

```js
const ADS_CONFIG = {
  client: 'ca-pub-XXXXXXXXXXXXXXXX',   // tu ID de editor
  slots: {
    topBanner:    '1234567890',          // bloque responsive hub (arriba)
    bottomBanner: '1234567891',          // bloque responsive hub (abajo)
    inFeed:       '1234567892',          // bloque in-feed del grid
    gameBanner:   '1234567893',          // bloque en juegos internos
  },
  inFeedEvery: 4,  // un nativo cada 4 tarjetas (ajusta a tu gusto)
};
```

4. Actualiza `ads.txt` en la raíz del proyecto con tu pub-id:
```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

5. **Despliega en tu dominio real** y solicita la revisión desde el panel de AdSense.

### Cómo funciona en local

En `localhost` (o con `file://`) el sistema entra en **modo placeholder**:
- Se muestran cajas a rayas con el texto "📢 ESPACIO PUBLICITARIO".
- **No se carga ningún script de Google** (sin tráfico inválido).
- No aparece el banner de consentimiento de cookies.

Al desplegar con tus IDs reales, los anuncios se activan automáticamente.

### Consentimiento RGPD

Al abrir el sitio en producción, los visitantes ven un banner de cookies. Los anuncios de AdSense solo se cargan si pulsan **Aceptar**. La preferencia se guarda en `localStorage` (`jj_ads_consent`).

---

## Estructura del proyecto

```
Games_Hub/
├── index.html              # Hub principal
├── css/
│   ├── styles.css          # Estilos cómic/cartoon
│   └── ads.css             # Estilos de publicidad y consentimiento
├── js/
│   ├── main.js             # Carga el JSON y genera tarjetas
│   └── ads.js              # Módulo de publicidad (config aquí)
├── data/games.json         # Lista de juegos (edita aquí)
├── assets/img/             # Imágenes de fondo de las tarjetas
├── games/
│   └── ejemplo-1/          # Plantilla de juego interno
├── privacy.html            # Política de privacidad
├── ads.txt                 # Verificación AdSense (actualiza con tu pub-id)
└── README.md
```
