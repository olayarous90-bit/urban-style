import React, { useState } from 'react';
import {
  InstagramIcon,
  TikTokIcon,
  FacebookIcon,
  CloseIcon,
  ChevronRightIcon
} from '../components/common/icons';
import './Footer.css';

/**
 * Pie de página (Footer) oficial de URBAN STYLE
 * Cuatro columnas organizadas:
 * Col 1: Logotipo y descripción breve.
 * Col 2: Inicio, Hombre, Mujer, Zapatillas, Accesorios (Enlaces funcionales).
 * Col 3: Contacto, Preguntas frecuentes, Información de compra (Identificados como provisionales).
 * Col 4: Instagram, TikTok, Facebook (Identificados como provisionales).
 * Franja inferior: Año actual, Derechos reservados, Aviso de privacidad y Términos (Provisionales).
 */
export const Footer = ({ onOpenAdmin = () => {} }) => {
  const [provisionalInfo, setProvisionalInfo] = useState(null);
  const currentYear = new Date().getFullYear();

  // Navegación fluida para enlaces de sección
  const handleNavClick = (e, targetId) => {
    e.preventDefault();
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.hash = targetId;
    }
  };

  // Manejador para enlaces demostrativos / provisionales
  const handleProvisionalClick = (e, name, category) => {
    e.preventDefault();
    setProvisionalInfo({
      title: name,
      category: category,
      message: `El enlace a "${name}" forma parte de la arquitectura visual de URBAN STYLE y está configurado como provisional. No se han establecido canales definitivos, números telefónicos ni perfiles externos en esta etapa del proyecto.`
    });
  };

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container">
        {/* CUADRÍCULA PRINCIPAL DE CUATRO COLUMNAS */}
        <div className="footer-grid">
          {/* COLUMNA 1: LOGOTIPO Y DESCRIPCIÓN */}
          <div className="footer-col footer-col-brand">
            <a
              href="#inicio"
              className="footer-logo"
              onClick={(e) => handleNavClick(e, 'inicio')}
              aria-label="URBAN STYLE - Ir al inicio"
            >
              URBAN <span className="logo-accent">STYLE</span>
            </a>
            <p className="footer-tagline">
              "TU ESTILO. TUS REGLAS."
            </p>
            <p className="footer-description">
              Tienda de moda urbana contemporánea para hombres y mujeres. Diseños
              que combinan comodidad, actitud y autenticidad sin límites.
            </p>
            <div className="footer-brand-badge">
              <span className="badge-dot" aria-hidden="true" />
              <span>Cultura Streetwear • Est. 2026</span>
            </div>
          </div>

          {/* COLUMNA 2: NAVEGACIÓN Y COLECCIONES */}
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
                  href="#hombre"
                  className="footer-link"
                  onClick={(e) => handleNavClick(e, 'hombre')}
                >
                  <ChevronRightIcon size={12} className="link-arrow" />
                  Hombre
                </a>
              </li>
              <li>
                <a
                  href="#mujer"
                  className="footer-link"
                  onClick={(e) => handleNavClick(e, 'mujer')}
                >
                  <ChevronRightIcon size={12} className="link-arrow" />
                  Mujer
                </a>
              </li>
              <li>
                <a
                  href="#zapatillas"
                  className="footer-link"
                  onClick={(e) => handleNavClick(e, 'zapatillas')}
                >
                  <ChevronRightIcon size={12} className="link-arrow" />
                  Zapatillas
                </a>
              </li>
              <li>
                <a
                  href="#accesorios"
                  className="footer-link"
                  onClick={(e) => handleNavClick(e, 'accesorios')}
                >
                  <ChevronRightIcon size={12} className="link-arrow" />
                  Accesorios
                </a>
              </li>
            </ul>
          </div>

          {/* COLUMNA 3: SOPORTE Y AYUDA (PROVISIONAL) */}
          <div className="footer-col">
            <h3 className="footer-col-title">AYUDA Y SOPORTE</h3>
            <ul className="footer-links-list">
              <li>
                <button
                  type="button"
                  className="footer-link footer-link-btn"
                  onClick={(e) => handleProvisionalClick(e, 'Contacto', 'Atención')}
                >
                  <ChevronRightIcon size={12} className="link-arrow" />
                  Contacto <span className="provisional-pill">Provisional</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link footer-link-btn"
                  onClick={(e) => handleProvisionalClick(e, 'Preguntas frecuentes', 'Soporte')}
                >
                  <ChevronRightIcon size={12} className="link-arrow" />
                  Preguntas frecuentes <span className="provisional-pill">Provisional</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link footer-link-btn"
                  onClick={(e) => handleProvisionalClick(e, 'Información de compra', 'Guía')}
                >
                  <ChevronRightIcon size={12} className="link-arrow" />
                  Información de compra <span className="provisional-pill">Provisional</span>
                </button>
              </li>
            </ul>
          </div>

          {/* COLUMNA 4: REDES SOCIALES (PROVISIONAL) */}
          <div className="footer-col">
            <h3 className="footer-col-title">COMUNIDAD</h3>
            <p className="footer-social-hint">
              Sigue nuestros drops y campañas urbanas en redes sociales:
            </p>
            <ul className="footer-social-list">
              <li>
                <button
                  type="button"
                  className="footer-social-btn"
                  onClick={(e) => handleProvisionalClick(e, 'Instagram (@urbanstyle.demo)', 'Redes Sociales')}
                  aria-label="Instagram de URBAN STYLE (Provisional)"
                >
                  <span className="social-icon-box">
                    <InstagramIcon size={18} />
                  </span>
                  <span>Instagram</span>
                  <span className="provisional-tag">Demo</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-social-btn"
                  onClick={(e) => handleProvisionalClick(e, 'TikTok (@urbanstyle.demo)', 'Redes Sociales')}
                  aria-label="TikTok de URBAN STYLE (Provisional)"
                >
                  <span className="social-icon-box">
                    <TikTokIcon size={18} />
                  </span>
                  <span>TikTok</span>
                  <span className="provisional-tag">Demo</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-social-btn"
                  onClick={(e) => handleProvisionalClick(e, 'Facebook (URBAN STYLE Demo)', 'Redes Sociales')}
                  aria-label="Facebook de URBAN STYLE (Provisional)"
                >
                  <span className="social-icon-box">
                    <FacebookIcon size={18} />
                  </span>
                  <span>Facebook</span>
                  <span className="provisional-tag">Demo</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* FRANJA INFERIOR (SUBFOOTER) */}
        <div className="footer-bottom-bar">
          <div className="footer-copyright">
            <span>© {currentYear} URBAN STYLE. Todos los derechos reservados.</span>
          </div>

          <div className="footer-legal-links">
            <button
              type="button"
              className="footer-legal-btn"
              onClick={(e) => handleProvisionalClick(e, 'Aviso de Privacidad', 'Políticas Legales')}
            >
              Aviso de privacidad <span className="legal-demo-badge">Provisional</span>
            </button>
            <span className="legal-separator" aria-hidden="true">•</span>
            <button
              type="button"
              className="footer-legal-btn"
              onClick={(e) => handleProvisionalClick(e, 'Términos y Condiciones', 'Políticas Legales')}
            >
              Términos y condiciones <span className="legal-demo-badge">Provisional</span>
            </button>
            <span className="legal-separator" aria-hidden="true">•</span>
            <button
              type="button"
              className="footer-legal-btn"
              style={{ color: 'var(--color-accent, #FF5A1F)', fontWeight: 700 }}
              onClick={onOpenAdmin}
            >
              🔒 Acceso Administrativo
            </button>
          </div>
        </div>
      </div>

      {/* MODAL INFORMATIVO PARA ENLACES PROVISIONALES */}
      {provisionalInfo && (
        <div
          className="footer-modal-overlay"
          onClick={() => setProvisionalInfo(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="footer-modal-title"
        >
          <div
            className="footer-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="footer-modal-close"
              onClick={() => setProvisionalInfo(null)}
              aria-label="Cerrar ventana"
            >
              <CloseIcon size={18} />
            </button>

            <div className="footer-modal-header">
              <span className="footer-modal-badge">{provisionalInfo.category}</span>
              <h3 id="footer-modal-title" className="footer-modal-title">
                {provisionalInfo.title}
              </h3>
            </div>

            <p className="footer-modal-body">
              {provisionalInfo.message}
            </p>

            <div className="footer-modal-notice">
              <span>ℹ Este sitio es un prototipo oficial en desarrollo progresivo.</span>
            </div>

            <div className="footer-modal-actions">
              <button
                type="button"
                className="footer-modal-btn"
                onClick={() => setProvisionalInfo(null)}
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
