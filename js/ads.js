(function () {
  'use strict';

  /* ============================================================
     CONFIGURACIÓN — pega aquí tus IDs de AdSense cuando los tengas
     ============================================================ */
  const ADS_CONFIG = {
    client: 'ca-pub-XXXXXXXXXXXXXXXX',   // <-- tu ID de editor
    slots: {
      topBanner:    'XXXXXXXXXX',         // bloque responsive arriba del hub
      bottomBanner: 'XXXXXXXXXX',         // bloque responsive abajo del hub
      inFeed:       'XXXXXXXXXX',         // bloque in-feed dentro del grid
      gameBanner:   'XXXXXXXXXX',         // bloque en juegos internos
    },
    inFeedEvery: 4,  // insertar un nativo cada N tarjetas de juego
  };

  /* ============================================================
     DETECCIÓN DE MODO PLACEHOLDER
     Activo si: IDs sin configurar, localhost, file://
     ============================================================ */
  const isPlaceholder = (
    ADS_CONFIG.client.includes('XXX') ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.protocol === 'file:'
  );

  /* ============================================================
     CONSENTIMIENTO RGPD
     Solo se muestra en producción con IDs reales configurados.
     ============================================================ */
  const CONSENT_KEY = 'jj_ads_consent';

  function getConsent() {
    return localStorage.getItem(CONSENT_KEY); // 'accepted' | 'rejected' | null
  }

  function pendingSlots() {
    return Array.from(document.querySelectorAll('ins.adsbygoogle:not([data-ad-status])'));
  }

  function loadAdSenseScript() {
    if (document.querySelector('script[src*="pagead2.googlesyndication"]')) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CONFIG.client}`;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
    s.onload = () => {
      pendingSlots().forEach(ins => mountIns(ins));
    };
  }

  function mountIns(ins) {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) { /* ignorar errores de ads en dev */ }
  }

  function initConsent() {
    if (isPlaceholder) return;

    const stored = getConsent();
    if (stored === 'accepted') {
      loadAdSenseScript();
      return;
    }
    if (stored === 'rejected') return;

    // Mostrar banner de consentimiento
    const banner = document.createElement('div');
    banner.className = 'consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Aviso de cookies');
    banner.innerHTML = `
      <div class="consent-inner">
        <p class="consent-text">
          <strong>🍪 ¡Usamos cookies!</strong>
          Mostramos anuncios de Google AdSense para mantener este sitio gratuito.
          ¿Aceptas las cookies de publicidad?
          <a href="privacy.html" target="_blank" rel="noopener">Política de privacidad</a>
        </p>
        <div class="consent-buttons">
          <button class="consent-btn consent-accept">✅ Aceptar</button>
          <button class="consent-btn consent-reject">❌ Rechazar</button>
        </div>
      </div>`;

    document.body.appendChild(banner);

    banner.querySelector('.consent-accept').addEventListener('click', () => {
      localStorage.setItem(CONSENT_KEY, 'accepted');
      banner.remove();
      loadAdSenseScript();
    });

    banner.querySelector('.consent-reject').addEventListener('click', () => {
      localStorage.setItem(CONSENT_KEY, 'rejected');
      banner.remove();
    });
  }

  /* ============================================================
     HELPERS DE CONSTRUCCIÓN DE SLOTS
     ============================================================ */

  function makeLabel() {
    const lbl = document.createElement('span');
    lbl.className = 'ad-label';
    lbl.textContent = 'Publicidad';
    return lbl;
  }

  function makePlaceholderBox(extraClass) {
    const wrap = document.createElement('div');
    wrap.className = `ad-slot ad-placeholder ${extraClass || ''}`;
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `<span class="ad-placeholder-text">📢 ESPACIO PUBLICITARIO</span>`;
    return wrap;
  }

  function makeRealBannerIns(slotKey) {
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.dataset.adClient  = ADS_CONFIG.client;
    ins.dataset.adSlot    = ADS_CONFIG.slots[slotKey] || '';
    ins.dataset.adFormat  = 'auto';
    ins.dataset.fullWidthResponsive = 'true';
    return ins;
  }

  /**
   * Crea un nodo banner (para hub superior/inferior y para juegos).
   * Si está en modo placeholder devuelve una caja cómica.
   */
  function makeBanner(slotKey) {
    if (isPlaceholder) return makePlaceholderBox('ad-banner');

    const wrap = document.createElement('div');
    wrap.className = 'ad-slot ad-banner';
    wrap.appendChild(makeLabel());
    const ins = makeRealBannerIns(slotKey);
    wrap.appendChild(ins);

    // Si ya hay consentimiento, montar; si no, ads.js lo montará al aceptar
    if (getConsent() === 'accepted') {
      // Defer a after DOM insertion
      setTimeout(() => mountIns(ins), 0);
    }
    return wrap;
  }

  /**
   * Crea una tarjeta nativa in-feed para el grid del hub.
   * Visualmente ocupa una celda del grid con la etiqueta "Publicidad".
   */
  function makeNative() {
    if (isPlaceholder) return makePlaceholderBox('ad-native');

    const wrap = document.createElement('div');
    wrap.className = 'ad-slot ad-native';
    wrap.setAttribute('role', 'listitem');
    wrap.appendChild(makeLabel());

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.dataset.adClient    = ADS_CONFIG.client;
    ins.dataset.adSlot      = ADS_CONFIG.slots.inFeed || '';
    ins.dataset.adFormat    = 'fluid';
    ins.dataset.adLayoutKey = '-fb+5w+4e-db+86'; // valor típico in-feed; ajustar según bloque
    wrap.appendChild(ins);

    if (getConsent() === 'accepted') {
      setTimeout(() => mountIns(ins), 0);
    }
    return wrap;
  }

  /* ============================================================
     ARRANQUE AUTOMÁTICO DE BANNERS EN EL HUB
     Monta los banners superior e inferior si existen en el DOM.
     ============================================================ */
  function mountHubBanners() {
    const top    = document.getElementById('ad-top');
    const bottom = document.getElementById('ad-bottom');
    if (top)    top.appendChild(makeBanner('topBanner'));
    if (bottom) bottom.appendChild(makeBanner('bottomBanner'));
  }

  /* ============================================================
     API PÚBLICA
     ============================================================ */
  window.Ads = {
    config:        ADS_CONFIG,
    isPlaceholder: isPlaceholder,
    makeBanner:    makeBanner,
    makeNative:    makeNative,
  };

  /* ============================================================
     INIT
     ============================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mountHubBanners();
      initConsent();
    });
  } else {
    mountHubBanners();
    initConsent();
  }

}());
