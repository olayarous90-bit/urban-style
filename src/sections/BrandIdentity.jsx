import React, { useState } from 'react';
import { Button } from '../components/common/Button';
import { ChevronRightIcon } from '../components/common/icons';
import './BrandIdentity.css';

/**
 * Sección Presentación e Identidad de Marca (Brand Identity / About)
 * Título: "MÁS QUE ROPA. UNA FORMA DE EXPRESARTE."
 * Descripción: "URBAN STYLE nace de la pasión por la moda urbana, la creatividad y la libertad de construir un estilo propio. Descubre prendas y accesorios que se adaptan a tu personalidad."
 * Botón: "DESCUBRE TU ESTILO" -> Conduce a las categorías (#categorias).
 */
export const BrandIdentity = () => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Manejador de navegación fluida hacia la sección de categorías
  const handleScrollToCategories = (e) => {
    e.preventDefault();
    const target = document.getElementById('categorias') || document.getElementById('productos');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.hash = 'categorias';
    }
  };

  return (
    <section
      id="identidad"
      className="brand-identity-section"
      aria-labelledby="identity-title"
    >
      <div className="container">
        <div className="identity-grid">
          {/* COLUMNA 1: CONTENIDO Y MANIFIESTO DE MARCA */}
          <div className="identity-content-col reveal-on-scroll">
            <div className="identity-badge">
              <span className="identity-badge-dot" aria-hidden="true" />
              <span className="identity-badge-text">IDENTIDAD DE MARCA</span>
            </div>

            <h2 id="identity-title" className="identity-title">
              MÁS QUE ROPA.{' '}
              <span className="identity-title-accent">UNA FORMA DE EXPRESARTE.</span>
            </h2>

            <p className="identity-description">
              URBAN STYLE nace de la pasión por la moda urbana, la creatividad y la
              libertad de construir un estilo propio. Descubre prendas y accesorios
              que se adaptan a tu personalidad.
            </p>

            {/* Manifiesto y pilares de identidad */}
            <div className="identity-pillars">
              <div className="identity-pillar-item">
                <span className="pillar-bullet" aria-hidden="true">—</span>
                <div>
                  <h3 className="pillar-heading">Tu estilo. Tus reglas.</h3>
                  <p className="pillar-subtext">Creemos en la moda como un canal de autenticidad sin etiquetas impuestas.</p>
                </div>
              </div>

              <div className="identity-pillar-item">
                <span className="pillar-bullet" aria-hidden="true">—</span>
                <div>
                  <h3 className="pillar-heading">Creatividad Urbana</h3>
                  <p className="pillar-subtext">Diseños que dialogan con la arquitectura, el arte callejero y la vida cotidiana.</p>
                </div>
              </div>
            </div>

            {/* Botón de llamada a la acción */}
            <div className="identity-actions">
              <Button
                variant="primary"
                size="lg"
                className="identity-btn"
                onClick={handleScrollToCategories}
              >
                DESCUBRE TU ESTILO
                <ChevronRightIcon size={16} className="identity-btn-icon" />
              </Button>
            </div>
          </div>

          {/* COLUMNA 2: FOTOGRAFÍA EDITORIAL */}
          <div className="identity-media-col reveal-on-scroll stagger-2">
            <div className="identity-image-card">
              <img
                src="/images/brand-story.jpg"
                alt="Presentación editorial URBAN STYLE: Modelo vistiendo atuendo urbano contemporáneo de corte relajado"
                className={`identity-image ${imageLoaded ? 'is-loaded' : ''}`}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
              />
              <div className="identity-image-overlay" aria-hidden="true" />

              {/* Tag flotante de autenticidad */}
              <div className="identity-stamp">
                <span className="stamp-title">URBAN STYLE</span>
                <span className="stamp-sub">AUTENTICIDAD URBANA</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BrandIdentity;
