import React, { useState, useEffect, useCallback } from 'react';
import './AnnouncementPopup.css';

/**
 * Tipos de insignias y metadatos visuales
 */
const TYPE_CONFIG = {
  discount: {
    badge: '🏷️ % DESCUENTO EXCLUSIVO',
    accentClass: 'popup-theme-discount',
    fallbackBadge: 'DESCUENTO ESPECIAL'
  },
  news: {
    badge: '✦ NUEVA COLECCIÓN',
    accentClass: 'popup-theme-news',
    fallbackBadge: 'NUEVA COLECCIÓN'
  },
  promotion: {
    badge: '🔥 OFERTA POR TIEMPO LIMITADO',
    accentClass: 'popup-theme-promotion',
    fallbackBadge: 'PROMOCIÓN'
  },
  launch: {
    badge: '⚡ LANZAMIENTO EXCLUSIVO',
    accentClass: 'popup-theme-launch',
    fallbackBadge: 'LANZAMIENTO'
  },
  custom: {
    badge: '★ URBAN STYLE',
    accentClass: 'popup-theme-custom',
    fallbackBadge: 'DESTACADO'
  }
};

/**
 * Componente de Ventana Emergente Automática (POPUP) para la tienda pública
 */
export const AnnouncementPopup = ({ isPreview = false, previewData = null, onClosePreview = null }) => {
  const [popup, setPopup] = useState(previewData);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Si estamos en modo vista previa del administrador
  useEffect(() => {
    if (isPreview && previewData) {
      setPopup(previewData);
      setIsVisible(true);
      setIsClosing(false);
    }
  }, [isPreview, previewData]);

  // Si es modo tienda pública, consultar anuncio activo
  useEffect(() => {
    if (isPreview) return;

    let isMounted = true;

    async function fetchActivePopup() {
      try {
        const res = await fetch('/api/popups/active');
        if (!res.ok) return;
        const json = await res.json();

        if (!isMounted) return;

        if (json.success && json.data?.enabled && json.data?.popup) {
          const activePopup = json.data.popup;

          // Verificar regla de frecuencia en el cliente
          const frequency = activePopup.frequency || 'always';
          const popupId = activePopup.id;

          if (frequency === 'once_per_session') {
            const seen = sessionStorage.getItem(`urban_popup_seen_${popupId}`);
            if (seen) return;
          } else if (frequency === 'once_per_day') {
            const lastSeenStr = localStorage.getItem(`urban_popup_date_${popupId}`);
            if (lastSeenStr) {
              const lastSeen = parseInt(lastSeenStr, 10);
              const oneDayMs = 24 * 60 * 60 * 1000;
              if (Date.now() - lastSeen < oneDayMs) {
                return;
              }
            }
          } else if (frequency === 'once_ever') {
            const seen = localStorage.getItem(`urban_popup_ever_${popupId}`);
            if (seen) return;
          }

          setPopup(activePopup);

          // Pequeña pausa natural (650ms) para que la página cargue suavemente antes de abrir
          const timer = setTimeout(() => {
            if (isMounted) {
              setIsVisible(true);
            }
          }, 650);

          return () => clearTimeout(timer);
        }
      } catch (err) {
        console.warn('[AnnouncementPopup Notice]:', err.message);
      }
    }

    fetchActivePopup();

    return () => {
      isMounted = false;
    };
  }, [isPreview]);

  // Cerrar y registrar frecuencia
  const handleClose = useCallback(() => {
    setIsClosing(true);

    if (!isPreview && popup?.id) {
      const frequency = popup.frequency || 'always';
      const popupId = popup.id;

      try {
        if (frequency === 'once_per_session') {
          sessionStorage.setItem(`urban_popup_seen_${popupId}`, 'true');
        } else if (frequency === 'once_per_day') {
          localStorage.setItem(`urban_popup_date_${popupId}`, String(Date.now()));
        } else if (frequency === 'once_ever') {
          localStorage.setItem(`urban_popup_ever_${popupId}`, 'true');
        }
      } catch {}
    }

    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      if (isPreview && onClosePreview) {
        onClosePreview();
      }
    }, 280);
  }, [isPreview, popup, onClosePreview]);

  // Manejar click en el botón de acción
  const handleActionClick = (e) => {
    const link = popup?.button_link || '#ofertas';

    // Si es un ancla interna de la página, hacer scroll suave
    if (link.startsWith('#')) {
      e.preventDefault();
      handleClose();

      setTimeout(() => {
        const targetElement = document.querySelector(link);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
      return;
    }

    // Si es enlace externo o ruta interna, cerrar popup y permitir navegación
    handleClose();
  };

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isVisible) {
        handleClose();
      }
    };
    if (isVisible) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, handleClose]);

  if (!isVisible || !popup) {
    return null;
  }

  const typeConfig = TYPE_CONFIG[popup.type] || TYPE_CONFIG.custom;
  const badgeText = popup.badge_text || typeConfig.badge;
  const imageUrl = popup.image_url || '/images/hero-campaign.jpg';

  return (
    <div
      className={`announcement-popup-overlay ${isClosing ? 'popup-fade-out' : 'popup-fade-in'}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-title"
    >
      <div
        className={`announcement-popup-modal ${typeConfig.accentClass} ${isClosing ? 'popup-scale-out' : 'popup-scale-in'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO EXCLUSIVO DE MODO VISTA PREVIA */}
        {isPreview && (
          <div className="popup-preview-banner">
            <span>👁️ MODO VISTA PREVIA ADMINISTRATIVA — ASÍ LO VERÁN TUS CLIENTES</span>
          </div>
        )}

        {/* BOTÓN VISIBLE DE CERRAR */}
        <button
          type="button"
          className="popup-close-btn"
          onClick={handleClose}
          aria-label="Cerrar anuncio emergente"
          title="Cerrar ventana"
        >
          ✕
        </button>

        <div className="popup-grid">
          {/* COLUMNA 1: IMAGEN DESTACADA */}
          <div className="popup-media-container">
            <img
              src={imageUrl}
              alt={popup.title}
              className="popup-image"
              loading="eager"
            />
            <div className="popup-image-gradient"></div>
            <span className="popup-image-brand-tag">URBAN STYLE</span>
          </div>

          {/* COLUMNA 2: CONTENIDO Y LLAMADO A LA ACCIÓN */}
          <div className="popup-content-container">
            {/* INSIGNIA DEL TIPO DE ANUNCIO */}
            <div className="popup-badge-wrapper">
              <span className="popup-type-badge">
                {badgeText}
              </span>
            </div>

            {/* TÍTULO PRINCIPAL */}
            <h2 id="popup-title" className="popup-title">
              {popup.title}
            </h2>

            {/* DESCRIPCIÓN O DETALLE COMERCIAL */}
            {popup.description && (
              <p className="popup-description">
                {popup.description}
              </p>
            )}

            {/* ACCIONES COMERCIALES */}
            <div className="popup-actions-wrapper">
              <a
                href={popup.button_link || '#ofertas'}
                className="popup-cta-btn"
                onClick={handleActionClick}
              >
                <span>{popup.button_text || 'Ver Ofertas Ahora'}</span>
                <span className="popup-cta-arrow">→</span>
              </a>

              <button
                type="button"
                className="popup-dismiss-link"
                onClick={handleClose}
              >
                {popup.secondary_button_text || 'Continuar a la tienda'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
