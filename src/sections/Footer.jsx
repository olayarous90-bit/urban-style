import React, { useState, useEffect } from 'react';
import {
  InstagramIcon,
  TikTokIcon,
  FacebookIcon,
  ChevronRightIcon
} from '../components/common/icons';
import { SiteInfoModal } from '../components/common/SiteInfoModal';
import './Footer.css';

/**
 * Pie de página oficial y profesional de URBAN STYLE
 * Totalmente responsivo, adaptable y conectado con la configuración del sitio.
 */
export const Footer = ({ onOpenAdmin = () => {} }) => {
  const currentYear = new Date().getFullYear();
  const [siteSettings, setSiteSettings] = useState({
    storeName: 'URBAN STYLE',
    tagline: 'TU ESTILO. TUS REGLAS.',
    description: 'Tienda de moda urbana contemporánea para hombres y mujeres. Diseños que combinan comodidad, actitud y autenticidad sin límites.',
    contactEmail: 'contacto@urbanstyle.com.co',
    contactWhatsapp: '',
    whatsappMessage: '¡Hola URBAN STYLE! Me gustaría recibir información sobre sus prendas y colecciones.',
    social: {}
  });

  // Estado para el modal de información legal y soporte
  const [modalSection, setModalSection] = useState(null);

  // Cargar configuración del sitio desde el backend
  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      try {
        const res = await fetch('/api/site-settings');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && isMounted) {
            setSiteSettings(json.data);
          }
        }
      } catch (e) {
        // Fallback a valores predeterminados
      }
    }
    loadSettings();
    return () => { isMounted = false; };
  }, []);

  // Navegación fluida a secciones existentes
  const handleNavClick = (e, targetId) => {
    e.preventDefault();
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.hash = targetId;
    }
  };

  // Abrir modal de información legal o soporte
  const openInfoModal = (sectionId) => {
    setModalSection(sectionId);
  };

  // Abrir gestor de preferencias de cookies
  const handleOpenCookiePreferences = () => {
    window.dispatchEvent(new CustomEvent('urban:open-cookie-preferences'));
  };

  // Redes sociales configuradas (no renderiza enlaces vacíos)
  const socialLinks = siteSettings.social || {};
  const hasInstagram = Boolean(socialLinks.instagram && socialLinks.instagram.trim());
  const hasFacebook = Boolean(socialLinks.facebook && socialLinks.facebook.trim());
  const hasTiktok = Boolean(socialLinks.tiktok && socialLinks.tiktok.trim());
  const hasWhatsapp = Boolean(siteSettings.contactWhatsapp && siteSettings.contactWhatsapp.trim());

  const whatsappCleanNumber = (siteSettings.contactWhatsapp || '').replace(/\D/g, '');
  const whatsappUrl = whatsappCleanNumber
    ? `https://wa.me/${whatsappCleanNumber}?text=${encodeURIComponent(siteSettings.whatsappMessage || 'Hola URBAN STYLE')}`
    : null;

  return (
    <>
      <footer className="site-footer" role="contentinfo">
        <div className="container">
          {/* CUADRÍCULA PRINCIPAL DE CUATRO COLUMNAS */}
          <div className="footer-grid">
            {/* =========================================================
               COLUMNA A: INFORMACIÓN DE LA TIENDA
               ========================================================= */}
            <div className="footer-col footer-col-brand">
              <a
                href="#inicio"
                className="footer-logo"
                onClick={(e) => handleNavClick(e, 'inicio')}
                aria-label={`${siteSettings.storeName || 'URBAN STYLE'} - Ir al inicio`}
              >
                URBAN <span className="logo-accent">STYLE</span>
              </a>

              <p className="footer-tagline">
                "{siteSettings.tagline || 'TU ESTILO. TUS REGLAS.'}"
              </p>

              <p className="footer-description">
                {siteSettings.description ||
                  'Tienda de moda urbana contemporánea para hombres y mujeres. Diseños que combinan comodidad, actitud y autenticidad sin límites.'}
              </p>

              <div className="footer-trust-chips">
                <span className="trust-chip">🇨🇴 Envíos a toda Colombia</span>
                <span className="trust-chip">🛡️ Pagos 100% Seguros</span>
              </div>
            </div>

            {/* =========================================================
               COLUMNA B: NAVEGACIÓN
               ========================================================= */}
            <div className="footer-col">
              <h3 className="footer-col-title">NAVEGACIÓN</h3>
              <ul className="footer-links-list">
                <li>
                  <a
                    href="#inicio"
                    className="footer-link"
                    onClick={(e) => handleNavClick(e, 'inicio')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Inicio
                  </a>
                </li>
                <li>
                  <a
                    href="#productos"
                    className="footer-link"
                    onClick={(e) => handleNavClick(e, 'productos')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Tienda / Catálogo
                  </a>
                </li>
                <li>
                  <a
                    href="#productos"
                    className="footer-link"
                    onClick={(e) => handleNavClick(e, 'productos')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Hombres
                  </a>
                </li>
                <li>
                  <a
                    href="#productos"
                    className="footer-link"
                    onClick={(e) => handleNavClick(e, 'productos')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Mujeres
                  </a>
                </li>
                <li>
                  <a
                    href="#coleccion"
                    className="footer-link"
                    onClick={(e) => handleNavClick(e, 'coleccion')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Novedades & Drops
                  </a>
                </li>
                <li>
                  <a
                    href="#ofertas"
                    className="footer-link"
                    onClick={(e) => handleNavClick(e, 'ofertas')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Ofertas Especiales
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-btn"
                    onClick={() => openInfoModal('contact')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Contacto
                  </button>
                </li>
              </ul>
            </div>

            {/* =========================================================
               COLUMNA C: ATENCIÓN AL CLIENTE
               ========================================================= */}
            <div className="footer-col">
              <h3 className="footer-col-title">ATENCIÓN AL CLIENTE</h3>
              <ul className="footer-links-list">
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-btn"
                    onClick={() => openInfoModal('contact')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Contacto & Horarios
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-btn"
                    onClick={() => openInfoModal('faqs')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Preguntas Frecuentes
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-btn"
                    onClick={() => openInfoModal('shipping')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Información de Envíos
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-btn"
                    onClick={() => openInfoModal('returns')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Cambios y Devoluciones
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-btn highlight"
                    onClick={() => openInfoModal('order-tracking')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    📦 Estado de Pedidos
                  </button>
                </li>
                {whatsappUrl && (
                  <li>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-link whatsapp-link"
                    >
                      <ChevronRightIcon size={12} className="link-arrow" />
                      💬 Chat de WhatsApp ↗
                    </a>
                  </li>
                )}
              </ul>
            </div>

            {/* =========================================================
               COLUMNA D: INFORMACIÓN LEGAL Y COMUNIDAD
               ========================================================= */}
            <div className="footer-col">
              <h3 className="footer-col-title">INFORMACIÓN LEGAL</h3>
              <ul className="footer-links-list">
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-btn"
                    onClick={() => openInfoModal('privacy')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Política de Privacidad
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-btn"
                    onClick={() => openInfoModal('cookies')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Política de Cookies
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-btn"
                    onClick={() => openInfoModal('terms')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Términos y Condiciones
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-btn"
                    onClick={() => openInfoModal('returns')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Garantías y Retracto
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link footer-link-btn"
                    onClick={() => openInfoModal('payments')}
                  >
                    <ChevronRightIcon size={12} className="link-arrow" />
                    Medios de Pago
                  </button>
                </li>
              </ul>

              {/* REDES SOCIALES (SOLO SI TIENEN URL CONFIGURADA) */}
              {(hasInstagram || hasFacebook || hasTiktok || whatsappUrl) && (
                <div className="footer-social-section">
                  <h4 className="footer-social-title">SÍGUENOS EN REDES</h4>
                  <div className="footer-social-row">
                    {hasInstagram && (
                      <a
                        href={socialLinks.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-icon-btn"
                        aria-label="Instagram de URBAN STYLE"
                        title="Instagram"
                      >
                        <InstagramIcon size={18} />
                      </a>
                    )}
                    {hasTiktok && (
                      <a
                        href={socialLinks.tiktok}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-icon-btn"
                        aria-label="TikTok de URBAN STYLE"
                        title="TikTok"
                      >
                        <TikTokIcon size={18} />
                      </a>
                    )}
                    {hasFacebook && (
                      <a
                        href={socialLinks.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-icon-btn"
                        aria-label="Facebook de URBAN STYLE"
                        title="Facebook"
                      >
                        <FacebookIcon size={18} />
                      </a>
                    )}
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-icon-btn whatsapp-icon"
                        aria-label="WhatsApp oficial de URBAN STYLE"
                        title="WhatsApp"
                      >
                        💬
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* =========================================================
             FRANJA INFERIOR (COPYRIGHT & PROPIEDAD INTELECTUAL)
             ========================================================= */}
          <div className="footer-bottom-bar">
            <div className="footer-copyright-block">
              <p className="copyright-primary font-numeric">
                © {currentYear} {siteSettings.storeName || 'URBAN STYLE'}. Todos los derechos reservados.
              </p>
              <p className="copyright-notice">
                El contenido de este sitio web, incluyendo textos, imágenes, diseños, logotipos y elementos gráficos, está protegido por las normas aplicables de propiedad intelectual. Queda prohibida su reproducción o utilización no autorizada.
              </p>
            </div>

            <div className="footer-bottom-actions">
              <button
                type="button"
                className="footer-action-link"
                onClick={handleOpenCookiePreferences}
              >
                🍪 Configuración de cookies
              </button>

              <span className="action-separator" aria-hidden="true">•</span>

              <button
                type="button"
                className="footer-action-link admin-access"
                onClick={onOpenAdmin}
                title="Acceso al panel administrativo"
              >
                🔒 Acceso Administrativo
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL DE INFORMACIÓN LEGAL Y ATENCIÓN AL CLIENTE */}
      <SiteInfoModal
        isOpen={Boolean(modalSection)}
        activeSection={modalSection || 'privacy'}
        onClose={() => setModalSection(null)}
        siteSettings={siteSettings}
        onOpenCookiePreferences={handleOpenCookiePreferences}
      />
    </>
  );
};

export default Footer;
