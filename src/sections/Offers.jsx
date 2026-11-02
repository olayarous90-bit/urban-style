import React, { useState, useEffect } from 'react';
import { PROMO_OFFERS, PROMO_SECTION_CONFIG } from '../data/promotions';
import { Button } from '../components/common/Button';
import { CloseIcon } from '../components/common/icons';
import './Offers.css';

/**
 * Sección Ofertas de Demostración (Demo Offers Section)
 * Título: "OFERTAS QUE MARCAN ESTILO"
 * Descripción: "Descubre una selección de productos destacados."
 * Tres tarjetas promocionales con precios ficticios en COP, descuentos y etiquetas demo.
 */
export const Offers = () => {
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Cerrar modal al presionar la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedOffer(null);
      }
    };

    if (selectedOffer) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedOffer]);

  const handleOpenOfferModal = (offer) => {
    setSelectedOffer(offer);
    setFeedbackMsg(null);
  };

  const handleSimulateAction = () => {
    setFeedbackMsg('Promoción demostrativa: En las próximas fases se integrará la pasarela de pedidos.');
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  return (
    <section
      id="ofertas"
      className="offers-section"
      aria-labelledby="offers-main-title"
    >
      <div className="container">
        {/* CABECERA DE LA SECCIÓN */}
        <div className="offers-header reveal-on-scroll">
          <div className="offers-header-badge">
            <span className="offers-badge-dot" aria-hidden="true" />
            <span className="offers-badge-text">DROPS SELECCIONADOS</span>
          </div>

          <h2 id="offers-main-title" className="offers-title">
            {PROMO_SECTION_CONFIG.title}
          </h2>

          <p className="offers-description">
            {PROMO_SECTION_CONFIG.description}
          </p>

          <div className="offers-demo-pill">
            <span className="demo-icon" aria-hidden="true">ℹ</span>
            <span>Precios y promociones con fines estrictamente demostrativos</span>
          </div>
        </div>

        {/* CUADRÍCULA DE TRES TARJETAS PROMOCIONALES */}
        <div className="offers-grid">
          {PROMO_OFFERS.map((offer, index) => (
            <article
              key={offer.id}
              className={`offer-card reveal-on-scroll stagger-${index + 1}`}
              aria-label={`Oferta: ${offer.name}`}
            >
              {/* CONTENEDOR DE IMAGEN */}
              <div className="offer-image-box">
                <img
                  src={offer.image}
                  alt={offer.alt}
                  className="offer-image"
                  loading="lazy"
                  decoding="async"
                />

                {/* ETIQUETA DE DESCUENTO DEMO */}
                <div className="offer-discount-badge" aria-label={`Descuento de ${offer.discount}`}>
                  <span>{offer.discount}</span>
                </div>

                {/* ETIQUETA DE CATEGORÍA / BADGE */}
                <span className="offer-category-badge">{offer.badge}</span>
              </div>

              {/* INFORMACIÓN DEL PRODUCTO */}
              <div className="offer-content">
                <span className="offer-category-name">{offer.category}</span>
                <h3 className="offer-product-name">{offer.name}</h3>
                <p className="offer-product-desc">{offer.description}</p>

                {/* PRECIOS ANTERIOR Y PROMOCIONAL */}
                <div className="offer-pricing-row">
                  <div className="offer-pricing-group">
                    <span className="offer-price-label">Precio Anterior:</span>
                    <span className="offer-price-original">
                      {offer.formattedOriginalPrice}
                    </span>
                  </div>
                  <div className="offer-pricing-group">
                    <span className="offer-price-label">Precio Promocional:</span>
                    <span className="offer-price-promo">
                      {offer.formattedPromoPrice}
                    </span>
                  </div>
                </div>

                {/* BOTÓN DE ACCIÓN */}
                <div className="offer-action-box">
                  <Button
                    variant="primary"
                    size="md"
                    className="offer-action-btn"
                    onClick={() => handleOpenOfferModal(offer)}
                    aria-label={`Ver oferta de demostración de ${offer.name}`}
                  >
                    VER OFERTA
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* NOTA ACLARATORIA DE DEMOSTRACIÓN */}
        <div className="offers-disclaimer-card reveal-on-scroll">
          <div className="disclaimer-content">
            <span className="disclaimer-badge">AVISO DEMOSTRATIVO</span>
            <p className="disclaimer-text">
              {PROMO_SECTION_CONFIG.disclaimer} Todos los productos y valores mostrados
              forman parte del prototipo visual de <strong>URBAN STYLE</strong> y no
              representan transacciones financieras activas.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL INFORMATIVO DE LA OFERTA */}
      {selectedOffer && (
        <div
          className="offer-modal-overlay"
          onClick={() => setSelectedOffer(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="offer-modal-title"
        >
          <div
            className="offer-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón cerrar */}
            <button
              type="button"
              className="offer-modal-close"
              onClick={() => setSelectedOffer(null)}
              aria-label="Cerrar ventana de oferta"
            >
              <CloseIcon size={20} />
            </button>

            <div className="offer-modal-grid">
              {/* Imagen en modal */}
              <div className="offer-modal-media">
                <img
                  src={selectedOffer.image}
                  alt={selectedOffer.alt}
                  className="offer-modal-image"
                />
                <span className="offer-modal-discount-tag">
                  {selectedOffer.discount}
                </span>
              </div>

              {/* Detalle en modal */}
              <div className="offer-modal-body">
                <span className="offer-modal-category">
                  {selectedOffer.category} • {selectedOffer.badge}
                </span>
                <h3 id="offer-modal-title" className="offer-modal-title">
                  {selectedOffer.name}
                </h3>

                <p className="offer-modal-description">
                  {selectedOffer.description}
                </p>

                {/* Comparación de precios */}
                <div className="offer-modal-pricing-box">
                  <div>
                    <span className="pricing-title">Antes (ficticio)</span>
                    <span className="pricing-before">
                      {selectedOffer.formattedOriginalPrice}
                    </span>
                  </div>
                  <div>
                    <span className="pricing-title">Ahora (promoción demo)</span>
                    <span className="pricing-now">
                      {selectedOffer.formattedPromoPrice}
                    </span>
                  </div>
                </div>

                <div className="offer-modal-meta-box">
                  <span className="meta-tag">Stock Simulado: Disponible</span>
                  <span className="meta-tag">Envío Demo: Nacional</span>
                </div>

                {feedbackMsg && (
                  <div className="offer-modal-feedback" role="alert">
                    {feedbackMsg}
                  </div>
                )}

                <div className="offer-modal-actions">
                  <Button
                    variant="primary"
                    size="lg"
                    className="offer-modal-cta"
                    onClick={handleSimulateAction}
                  >
                    SIMULAR COMPRA
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setSelectedOffer(null)}
                  >
                    CERRAR
                  </Button>
                </div>

                <p className="offer-modal-note">
                  * Este producto es de muestra. No se requiere tarjeta de crédito ni pago real.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Offers;
