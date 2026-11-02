import React, { useState } from 'react';
import { Button } from '../components/common/Button';
import './Hero.css';

/**
 * Portada Principal (Hero Section) de URBAN STYLE
 * Campaña editorial de moda urbana con fotografía de alta calidad,
 * titulares contundentes, botones de llamada a la acción y diseño responsivo.
 */
export const Hero = () => {
  const [hasImageError, setHasImageError] = useState(false);

  // Manejador de navegación fluida para los botones de acción
  const handleScrollTo = (e, targetId) => {
    e.preventDefault();
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Si la sección aún está en preparación para futuras etapas
      window.location.hash = targetId;
    }
  };

  return (
    <section className="hero-section" aria-label="Portada de campaña principal">
      {/* 1. IMAGEN PROTAGONISTA EDITORIAL DE ALTA CALIDAD */}
      <div className="hero-media-wrapper">
        {!hasImageError ? (
          <picture>
            <source
              media="(max-width: 768px)"
              srcSet="/images/hero-campaign-mobile.jpg"
            />
            <img
              src="/images/hero-campaign.jpg"
              alt="Campaña editorial URBAN STYLE: Modelos adultos vistiendo ropa urbana contemporánea y zapatillas de diseño"
              className="hero-image"
              loading="eager"
              decoding="async"
              onError={() => setHasImageError(true)}
            />
          </picture>
        ) : (
          <div className="hero-media-fallback" aria-hidden="true" />
        )}
      </div>

      {/* Capa de contraste y gradiente para garantizar máxima legibilidad */}
      <div className="hero-overlay" aria-hidden="true" />

      {/* 2. CONTENIDO EDITORIAL */}
      <div className="container hero-content-wrapper">
        <div className="hero-content">
          {/* Badge de campaña */}
          <div className="hero-campaign-badge">
            <span className="hero-badge-dot" aria-hidden="true" />
            <span className="hero-badge-text">Colección Urbana 2026</span>
          </div>

          {/* Titular Principal */}
          <h1 className="hero-headline">
            El estilo no se explica.{' '}
            <span className="hero-headline-accent">Se demuestra.</span>
          </h1>

          {/* Texto Secundario */}
          <p className="hero-description">
            Descubre ropa, zapatillas y accesorios que hablan por ti. Encuentra tu
            próxima combinación y lleva tu estilo al siguiente nivel.
          </p>

          {/* 3. BOTONES DE LLAMADA A LA ACCIÓN */}
          <div className="hero-cta-group">
            <Button
              variant="primary"
              size="lg"
              className="hero-btn-primary"
              onClick={(e) => handleScrollTo(e, 'coleccion')}
            >
              Explorar Colección
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="hero-btn-secondary"
              onClick={(e) => handleScrollTo(e, 'zapatillas')}
            >
              Descubrir Zapatillas
            </Button>
          </div>

          {/* Atributos de Marca */}
          <div className="hero-features-bar">
            <div className="hero-feature-item">
              <span className="hero-feature-number">01</span>
              <span className="hero-feature-label">Ediciones Limitadas</span>
            </div>
            <div className="hero-feature-item">
              <span className="hero-feature-number">02</span>
              <span className="hero-feature-label">Materiales Premium</span>
            </div>
            <div className="hero-feature-item">
              <span className="hero-feature-number">03</span>
              <span className="hero-feature-label">Cultura Sneaker</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
