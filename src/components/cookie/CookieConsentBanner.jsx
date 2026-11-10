import React, { useState, useEffect } from 'react';
import './CookieConsentBanner.css';

const COOKIE_STORAGE_KEY = 'urban_cookie_consent';
const CURRENT_POLICY_VERSION = '1.0';

/**
 * Obtiene el consentimiento guardado o null
 */
export function getSavedCookieConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Sistema de Consentimiento de Cookies (Banner no invasivo y Gestor de Preferencias)
 */
export const CookieConsentBanner = ({ onOpenCookiesPolicy = () => {} }) => {
  const [consent, setConsent] = useState(() => getSavedCookieConsent());
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  // Opciones de preferencias (sin casillas premarcadas para no esenciales)
  const [preferences, setPreferences] = useState({
    necessary: true, // Siempre activa
    preferences: false,
    analytics: false,
    marketing: false
  });

  // Mostrar aviso en la primera visita
  useEffect(() => {
    const saved = getSavedCookieConsent();
    if (!saved) {
      // Retardo suave para no invadir al entrar
      const timer = setTimeout(() => {
        setIsBannerVisible(true);
      }, 1200);
      return () => clearTimeout(timer);
    } else {
      setConsent(saved);
      setPreferences({
        necessary: true,
        preferences: Boolean(saved.preferences),
        analytics: Boolean(saved.analytics),
        marketing: Boolean(saved.marketing)
      });
    }
  }, []);

  // Escuchar evento global para abrir preferencias desde el footer ("Configuración de cookies")
  useEffect(() => {
    const handleOpenEvent = () => {
      const saved = getSavedCookieConsent();
      if (saved) {
        setPreferences({
          necessary: true,
          preferences: Boolean(saved.preferences),
          analytics: Boolean(saved.analytics),
          marketing: Boolean(saved.marketing)
        });
      }
      setIsPreferencesOpen(true);
    };

    window.addEventListener('urban:open-cookie-preferences', handleOpenEvent);
    return () => window.removeEventListener('urban:open-cookie-preferences', handleOpenEvent);
  }, []);

  // Guardar consentimiento en localStorage
  const saveConsent = (preferencesData) => {
    const consentPayload = {
      version: CURRENT_POLICY_VERSION,
      timestamp: new Date().toISOString(),
      ...preferencesData,
      necessary: true // Obligatoriamente verdadera
    };

    try {
      localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(consentPayload));
    } catch {}

    setConsent(consentPayload);
    setIsBannerVisible(false);
    setIsPreferencesOpen(false);

    // Disparar evento para que otras herramientas respeten las opciones
    window.dispatchEvent(new CustomEvent('urban:cookie-consent-updated', { detail: consentPayload }));
  };

  // 1. Aceptar todas las cookies
  const handleAcceptAll = () => {
    saveConsent({
      preferences: true,
      analytics: true,
      marketing: true
    });
  };

  // 2. Rechazar no esenciales
  const handleRejectNonEssential = () => {
    saveConsent({
      preferences: false,
      analytics: false,
      marketing: false
    });
  };

  // 3. Guardar preferencias configuradas por el usuario
  const handleSavePreferences = () => {
    saveConsent(preferences);
  };

  // Si ya hay consentimiento y los modales están cerrados, no renderizar nada en DOM
  if (!isBannerVisible && !isPreferencesOpen) {
    return null;
  }

  return (
    <>
      {/* 1. BANNER FLOTANTE DISCRETO (NO BLOQUEA LA NAVEGACIÓN) */}
      {isBannerVisible && !isPreferencesOpen && (
        <aside
          className="cookie-consent-banner"
          role="region"
          aria-label="Aviso de cookies y consentimiento"
        >
          <div className="cookie-banner-container">
            <div className="cookie-banner-content">
              <div className="cookie-banner-icon" aria-hidden="true">
                🍪
              </div>
              <div className="cookie-banner-text-box">
                <h4 className="cookie-banner-title">
                  Tu privacidad es importante en URBAN STYLE
                </h4>
                <p className="cookie-banner-desc">
                  Utilizamos cookies necesarias para el funcionamiento del carrito y la sesión de compra. También empleamos cookies analíticas y de personalización para mejorar tu experiencia. Puedes aceptarlas todas, rechazarlas o configurar tus preferencias en cualquier momento.
                  {' '}
                  <button
                    type="button"
                    className="cookie-policy-inline-link"
                    onClick={onOpenCookiesPolicy}
                  >
                    Ver política de cookies
                  </button>.
                </p>
              </div>
            </div>

            <div className="cookie-banner-actions">
              <button
                type="button"
                className="cookie-btn cookie-btn-primary"
                onClick={handleAcceptAll}
              >
                Aceptar todas
              </button>

              <button
                type="button"
                className="cookie-btn cookie-btn-secondary"
                onClick={handleRejectNonEssential}
              >
                Rechazar no esenciales
              </button>

              <button
                type="button"
                className="cookie-btn cookie-btn-outline"
                onClick={() => setIsPreferencesOpen(true)}
              >
                Configurar preferencias
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 2. MODAL DE CONFIGURACIÓN DE PREFERENCIAS DE COOKIES */}
      {isPreferencesOpen && (
        <div
          className="cookie-preferences-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-preferences-title"
          onClick={() => setIsPreferencesOpen(false)}
        >
          <div
            className="cookie-preferences-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cookie-modal-header">
              <div>
                <h3 id="cookie-preferences-title" className="cookie-modal-title">
                  Configuración de Preferencias de Cookies
                </h3>
                <p className="cookie-modal-subtitle">
                  Elige qué categorías de cookies autorizas almacenar en tu navegador. Puedes cambiar o retirar tu consentimiento cuando lo desees.
                </p>
              </div>
              <button
                type="button"
                className="cookie-modal-close-btn"
                onClick={() => setIsPreferencesOpen(false)}
                aria-label="Cerrar configuración de cookies"
              >
                ✕
              </button>
            </div>

            <div className="cookie-modal-body">
              {/* CATEGORÍA 1: NECESARIAS */}
              <div className="cookie-category-card">
                <div className="cookie-category-header">
                  <div className="cookie-category-titles">
                    <span className="cookie-cat-name">1. Cookies Estrictamente Necesarias</span>
                    <span className="cookie-cat-badge always-active">Siempre Activas</span>
                  </div>
                  <span className="cookie-status-text">Requeridas</span>
                </div>
                <p className="cookie-cat-description">
                  Son indispensables para que la tienda funcione correctamente: mantienen los productos de tu carrito de compras, protegen la seguridad contra fraudes y procesan los pedidos. No pueden desactivarse.
                </p>
              </div>

              {/* CATEGORÍA 2: PREFERENCIAS */}
              <div className="cookie-category-card">
                <div className="cookie-category-header">
                  <div className="cookie-category-titles">
                    <span className="cookie-cat-name">2. Cookies de Preferencias</span>
                    <span className="cookie-cat-badge optional">Opcional</span>
                  </div>
                  <label className="cookie-toggle-switch">
                    <input
                      type="checkbox"
                      checked={preferences.preferences}
                      onChange={(e) =>
                        setPreferences({ ...preferences, preferences: e.target.checked })
                      }
                    />
                    <span className="cookie-slider" />
                  </label>
                </div>
                <p className="cookie-cat-description">
                  Permiten recordar tus configuraciones favoritas, como el modo de visualización y personalización de la experiencia de compra en URBAN STYLE.
                </p>
              </div>

              {/* CATEGORÍA 3: ESTADÍSTICAS / ANALÍTICAS */}
              <div className="cookie-category-card">
                <div className="cookie-category-header">
                  <div className="cookie-category-titles">
                    <span className="cookie-cat-name">3. Cookies Estadísticas y Analíticas</span>
                    <span className="cookie-cat-badge optional">Opcional</span>
                  </div>
                  <label className="cookie-toggle-switch">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) =>
                        setPreferences({ ...preferences, analytics: e.target.checked })
                      }
                    />
                    <span className="cookie-slider" />
                  </label>
                </div>
                <p className="cookie-cat-description">
                  Nos ayudan a entender cómo interactúan los visitantes con el catálogo, qué productos son los más populares y qué páginas cargan con mayor lentitud, todo de forma totalmente anónima.
                </p>
              </div>

              {/* CATEGORÍA 4: MARKETING Y PUBLICIDAD */}
              <div className="cookie-category-card">
                <div className="cookie-category-header">
                  <div className="cookie-category-titles">
                    <span className="cookie-cat-name">4. Cookies de Marketing y Publicidad</span>
                    <span className="cookie-cat-badge optional">Opcional</span>
                  </div>
                  <label className="cookie-toggle-switch">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) =>
                        setPreferences({ ...preferences, marketing: e.target.checked })
                      }
                    />
                    <span className="cookie-slider" />
                  </label>
                </div>
                <p className="cookie-cat-description">
                  Se utilizan para mostrarte promociones y campañas acordes a tu estilo e intereses, evitando saturarte con anuncios repetitivos.
                </p>
              </div>

              <div className="cookie-modal-info-box">
                <span>
                  🛡️ Versión de la política: <strong>v{CURRENT_POLICY_VERSION}</strong>.
                  {consent?.timestamp && (
                    <> Consentimiento registrado el: {new Date(consent.timestamp).toLocaleDateString()}.</>
                  )}
                  {' '}Sin casillas premarcadas para garantizar tu libre elección.
                </span>
              </div>
            </div>

            <div className="cookie-modal-footer">
              <button
                type="button"
                className="cookie-btn cookie-btn-secondary"
                onClick={handleRejectNonEssential}
              >
                Rechazar no esenciales
              </button>

              <button
                type="button"
                className="cookie-btn cookie-btn-primary"
                onClick={handleSavePreferences}
              >
                Guardar mis preferencias
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
