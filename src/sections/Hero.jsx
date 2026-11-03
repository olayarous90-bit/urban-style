import React, { useState } from 'react';
import { Button } from '../components/common/Button';
import { useChristmasTheme } from '../context/ChristmasThemeContext';
import './Hero.css';

/**
 * Portada Principal (Hero Section) de URBAN STYLE
 * Campaña editorial de moda urbana con soporte para campaña navideña elegante.
 */
export const Hero = () => {
  const [hasImageError, setHasImageError] = useState(false);
  const { isChristmasMode } = useChristmasTheme();

  // Manejador de navegación fluida para los botones de acción
  const handleScrollTo = (e, targetId) => {
    e.preventDefault();
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.hash = targetId;
    }
  };

  return (
    <section className={`hero-section ${isChristmasMode ? 'is-christmas-hero' : ''}`} aria-label="Portada de campaña principal">
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
      <div className={`hero-overlay ${isChristmasMode ? 'christmas-overlay' : ''}`} aria-hidden="true" />

      {/* 2. CONTENIDO EDITORIAL */}
      <div className="container hero-content-wrapper">
        <div className="hero-content">
          {/* Badge de campaña */}
          <div className={`hero-campaign-badge ${isChristmasMode ? 'christmas-campaign-badge' : ''}`}>
            <span className={isChristmasMode ? 'hero-badge-christmas-icon' : 'hero-badge-dot'} aria-hidden="true">
              {isChristmasMode ? '🎄' : ''}
            </span>
            <span className="hero-badge-text">
              {isChristmasMode ? 'Campaña Navideña 2026' : 'Colección Urbana 2026'}
            </span>
          </div>

          {/* Titular Principal */}
          {isChristmasMode ? (
            <>
              <h1 className="hero-headline christmas-hero-headline">
                ¡La Navidad llegó a{' '}
                <span className="hero-headline-accent christmas-accent-gold">URBAN STYLE!</span>
              </h1>
              <p className="hero-slogan-festive">
                Regala estilo, regala moda.
              </p>
              <p className="hero-description">
                Descubre ropa, zapatillas y accesorios con ofertas de temporada. El regalo perfecto
                para quienes visten con actitud y autenticidad sin límites.
              </p>
            </>
          ) : (
            <>
              <h1 className="hero-headline">
                El estilo no se explica.{' '}
                <span className="hero-headline-accent">Se demuestra.</span>
              </h1>
              <p className="hero-description">
                Descubre ropa, zapatillas y accesorios que hablan por ti. Encuentra tu
                próxima combinación y lleva tu estilo al siguiente nivel.
              </p>
            </>
          )}

          {/* 3. BOTONES DE LLAMADA A LA ACCIÓN */}
          <div className="hero-cta-group">
            <Button
              variant="primary"
              size="lg"
              className={`hero-btn-primary ${isChristmasMode ? 'christmas-primary-cta' : ''}`}
              onClick={(e) => handleScrollTo(e, isChristmasMode ? 'ofertas-navidenas' : 'coleccion')}
            >
              {isChristmasMode ? '🎁 Ver Ofertas Navideñas' : 'Explorar Colección'}
            </Button>

            <Button
              variant="outline"
              size="lg"
              className={`hero-btn-secondary ${isChristmasMode ? 'christmas-secondary-cta' : ''}`}
              onClick={(e) => handleScrollTo(e, 'productos')}
            >
              {isChristmasMode ? 'Explorar Catálogo' : 'Descubrir Zapatillas'}
            </Button>
          </div>

          {/* Atributos de Marca */}
          <div className="hero-features-bar">
            <div className="hero-feature-item">
              <span className="hero-feature-number">{isChristmasMode ? '🎁' : '01'}</span>
              <span className="hero-feature-label">
                {isChristmasMode ? 'Envíos Navideños a Todo el País' : 'Ediciones Limitadas'}
              </span>
            </div>
            <div className="hero-feature-item">
              <span className="hero-feature-number">{isChristmasMode ? '⭐' : '02'}</span>
              <span className="hero-feature-label">
                {isChristmasMode ? 'Empaques Exclusivos de Regalo' : 'Materiales Premium'}
              </span>
            </div>
            <div className="hero-feature-item">
              <span className="hero-feature-number">{isChristmasMode ? '🏷️' : '03'}</span>
              <span className="hero-feature-label">
                {isChristmasMode ? 'Descuentos Reales en Servidor' : 'Cultura Sneaker'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
