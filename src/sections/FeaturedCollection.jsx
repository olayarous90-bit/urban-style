import React, { useState } from 'react';
import { Button } from '../components/common/Button';
import './FeaturedCollection.css';

/**
 * Sección Colección Destacada (Featured Collection)
 * "STREETWEAR SIN LÍMITES - PIEZAS QUE DEFINEN TU IDENTIDAD"
 * Editorial contemporáneo con fotografía de gran escala y jerarquía visual impecable.
 */
export const FeaturedCollection = () => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Manejo de navegación fluida al catálogo de productos
  const handleScrollToProducts = (e) => {
    e.preventDefault();
    const target = document.getElementById('productos');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.hash = 'productos';
    }
  };

  return (
    <section
      id="coleccion"
      className="collection-section"
      aria-labelledby="collection-headline"
    >
      <div className="container">
        <div className="collection-card reveal-on-scroll">
          {/* COLUMNA 1: IMAGEN EDITORIAL PROTAGONISTA DE GRAN FORMATO */}
          <div className="collection-media-col">
            <div className="collection-image-wrapper">
              <img
                src="/images/collection-streetwear.jpg"
                alt="Editorial de moda urbana: Modelos vistiendo la colección streetwear contemporánea de URBAN STYLE"
                className={`collection-image ${imageLoaded ? 'is-loaded' : ''}`}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
              />
              <div className="collection-image-overlay" aria-hidden="true" />

              {/* Etiqueta flotante de editorial */}
              <div className="collection-badge-floating">
                <span className="collection-badge-dot" aria-hidden="true" />
                <span className="collection-badge-label">EDITORIAL 2026</span>
              </div>
            </div>
          </div>

          {/* COLUMNA 2: CONTENIDO EDITORIAL Y LLAMADA A LA ACCIÓN */}
          <div className="collection-content-col">
            {/* Título de sección / overline oficial */}
            <div className="collection-header-tag">
              <span className="collection-tag-line" aria-hidden="true" />
              <span className="collection-tag-text">STREETWEAR SIN LÍMITES</span>
            </div>

            {/* Titular principal oficial */}
            <h2 id="collection-headline" className="collection-headline">
              PIEZAS QUE DEFINEN <br />
              <span className="collection-headline-accent">TU IDENTIDAD</span>
            </h2>

            {/* Descripción oficial */}
            <p className="collection-description">
              Combina comodidad, actitud y diseño con una selección inspirada en las
              tendencias urbanas contemporáneas.
            </p>

            {/* Puntos destacados de confección */}
            <div className="collection-highlights">
              <div className="collection-highlight-item">
                <span className="highlight-bullet">01</span>
                <div>
                  <h3 className="highlight-title">Cortes Boxy & Oversize</h3>
                  <p className="highlight-detail">Caída relajada diseñada para siluetas actuales.</p>
                </div>
              </div>
              <div className="collection-highlight-item">
                <span className="highlight-bullet">02</span>
                <div>
                  <h3 className="highlight-title">Textiles de Alto Gramaje</h3>
                  <p className="highlight-detail">Algodón pesado y nylon técnico de máxima durabilidad.</p>
                </div>
              </div>
              <div className="collection-highlight-item">
                <span className="highlight-bullet">03</span>
                <div>
                  <h3 className="highlight-title">Estética Atemporal</h3>
                  <p className="highlight-detail">Paleta monocromática versátil para cualquier ocasión.</p>
                </div>
              </div>
            </div>

            {/* Botón oficial de llamada a la acción */}
            <div className="collection-actions">
              <Button
                variant="primary"
                size="lg"
                className="collection-btn"
                onClick={handleScrollToProducts}
              >
                DESCUBRIR LA COLECCIÓN
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedCollection;
