import React, { useState, useEffect } from 'react';
import { PROMO_OFFERS, PROMO_SECTION_CONFIG } from '../data/promotions';
import { Button } from '../components/common/Button';
import { CloseIcon, HeartIcon, BagIcon } from '../components/common/icons';
import { useCart } from '../context/CartContext';
import './Offers.css';

/**
 * Sección DEMO Oficial de Prendas y Ofertas de URBAN STYLE
 * Título: "OFERTAS QUE MARCAN ESTILO"
 * Muestra prendas de demostración completas con fotografía, nombre, marca, modelo,
 * precio original, precio con descuento, tallas, colores y botones funcionales
 * de «Ver producto» y «Agregar al carrito».
 */
export const Offers = ({ favorites = [], onToggleFavorite = () => {} }) => {
  const { addToCart, openCart } = useCart();
  const [offers, setOffers] = useState(PROMO_OFFERS);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [selectedSizes, setSelectedSizes] = useState({});
  const [modalSize, setModalSize] = useState(null);
  const [cardToast, setCardToast] = useState(null);
  const [modalFeedback, setModalFeedback] = useState(null);

  // Sincronizar con catálogo de Neon si hay precios o descuentos dinámicos activos
  const fetchOffers = () => {
    fetch(`/api/products?_t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache, no-store' }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setOffers((prevOffers) =>
            prevOffers.map((promo) => {
              const matched = data.data.find(
                (p) => p.id === promo.productId || p.id === promo.id || p.name === promo.name
              );
              if (matched) {
                return {
                  ...promo,
                  price: matched.finalPrice || matched.price || promo.price,
                  promoPrice: matched.finalPrice || matched.price || promo.promoPrice,
                  originalPrice: matched.originalPrice || promo.originalPrice,
                  formattedPrice: matched.formattedPrice || promo.formattedPrice,
                  formattedPromoPrice: matched.formattedPrice || promo.formattedPromoPrice,
                  formattedOriginalPrice: matched.formattedOriginalPrice || promo.formattedOriginalPrice,
                  discountPercent: matched.discountPercent || promo.discountPercent,
                  discount: matched.hasDiscount ? `-${matched.discountPercent}% DEMO` : promo.discount,
                  formattedSavings: matched.formattedSavings || promo.formattedSavings,
                  sizes: matched.sizes && matched.sizes.length > 0 ? matched.sizes : promo.sizes,
                  color: matched.color || promo.color,
                  brand: matched.brand || promo.brand || 'URBAN STYLE',
                  model: matched.model || promo.model
                };
              }
              return promo;
            })
          );
        }
      })
      .catch(() => {
        // Mantiene datos completos iniciales seguros
      });
  };

  useEffect(() => {
    fetchOffers();
    const handleUpdate = () => fetchOffers();
    window.addEventListener('catalog-updated', handleUpdate);
    return () => window.removeEventListener('catalog-updated', handleUpdate);
  }, []);

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
    const initialSize = selectedSizes[offer.id] || offer.sizes?.[0] || 'M';
    setModalSize(initialSize);
    setModalFeedback(null);
  };

  const isFavorite = (id) => favorites.includes(id);

  // Seleccionar talla directamente en la tarjeta
  const handleSelectCardSize = (offerId, size, e) => {
    e.stopPropagation();
    setSelectedSizes((prev) => ({
      ...prev,
      [offerId]: size
    }));
  };

  // Agregar al carrito DIRECTAMENTE desde la tarjeta
  const handleDirectAddToCart = (offer, e) => {
    e.stopPropagation();
    const size = selectedSizes[offer.id] || offer.sizes?.[0] || 'M';
    
    // Normalizar objeto de producto para el carrito
    const cartProduct = {
      id: offer.productId || offer.id,
      name: offer.name,
      brand: offer.brand || 'URBAN STYLE',
      model: offer.model,
      category: offer.category,
      price: offer.promoPrice || offer.price,
      formattedPrice: offer.formattedPromoPrice || offer.formattedPrice,
      originalPrice: offer.originalPrice,
      formattedOriginalPrice: offer.formattedOriginalPrice,
      image: offer.image,
      color: offer.color || 'Negro'
    };

    addToCart(cartProduct, size, offer.color || 'Negro', 1);

    setCardToast({
      name: offer.name,
      size,
      price: offer.formattedPromoPrice || offer.formattedPrice
    });

    setTimeout(() => {
      setCardToast(null);
    }, 3500);
  };

  // Agregar al carrito desde el modal
  const handleModalAddToCart = () => {
    if (!selectedOffer) return;
    const size = modalSize || selectedOffer.sizes?.[0] || 'M';

    const cartProduct = {
      id: selectedOffer.productId || selectedOffer.id,
      name: selectedOffer.name,
      brand: selectedOffer.brand || 'URBAN STYLE',
      model: selectedOffer.model,
      category: selectedOffer.category,
      price: selectedOffer.promoPrice || selectedOffer.price,
      formattedPrice: selectedOffer.formattedPromoPrice || selectedOffer.formattedPrice,
      originalPrice: selectedOffer.originalPrice,
      formattedOriginalPrice: selectedOffer.formattedOriginalPrice,
      image: selectedOffer.image,
      color: selectedOffer.color || 'Negro'
    };

    addToCart(cartProduct, size, selectedOffer.color || 'Negro', 1);
    setModalFeedback(`¡"${selectedOffer.name}" (Talla ${size}) añadido a la bolsa!`);

    setTimeout(() => {
      setSelectedOffer(null);
      openCart();
    }, 600);
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
            <span className="offers-badge-text">SECCIÓN DEMO OFICIAL</span>
          </div>

          <h2 id="offers-main-title" className="offers-title">
            {PROMO_SECTION_CONFIG.title}
          </h2>

          <p className="offers-description">
            {PROMO_SECTION_CONFIG.description}
          </p>

          <div className="offers-demo-pill">
            <span className="demo-icon" aria-hidden="true">ℹ</span>
            <span>Prendas de demostración con precios y descuentos oficiales de URBAN STYLE</span>
          </div>
        </div>

        {/* CUADRÍCULA DE TARJETAS DEMO COMPLETAS */}
        <div className="offers-grid">
          {offers.map((offer, index) => {
            const isFav = isFavorite(offer.id) || isFavorite(offer.productId);
            const chosenSize = selectedSizes[offer.id] || offer.sizes?.[0] || 'M';
            const isFootwear = (offer.category || '').toLowerCase().includes('zapatilla') ||
                               (offer.name || '').toLowerCase().includes('sneaker');

            return (
              <article
                key={offer.id}
                className={`offer-card reveal-on-scroll stagger-${index + 1}`}
                aria-label={`Prenda DEMO: ${offer.name}`}
              >
                {/* CONTENEDOR DE IMAGEN */}
                <div
                  className="offer-image-box"
                  onClick={() => handleOpenOfferModal(offer)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenOfferModal(offer);
                    }
                  }}
                  aria-label={`Ver detalles de ${offer.name}`}
                >
                  <img
                    src={offer.image}
                    alt={offer.alt || offer.name}
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

                  {/* BOTÓN DE FAVORITOS */}
                  <button
                    type="button"
                    className={`offer-favorite-btn ${isFav ? 'is-favorite' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(offer.productId || offer.id);
                    }}
                    aria-label={isFav ? `Quitar ${offer.name} de favoritos` : `Guardar ${offer.name} en favoritos`}
                  >
                    <HeartIcon size={18} filled={isFav} />
                  </button>

                  {/* HINT DE VISTA RÁPIDA */}
                  <div className="offer-hover-hint">
                    <span>👁️ Ver Producto</span>
                  </div>
                </div>

                {/* INFORMACIÓN COMPLETA Y VISIBLE DEL PRODUCTO */}
                <div className="offer-content">
                  {/* Fila de Marca y Categoría */}
                  <div className="offer-brand-row">
                    <span className="offer-brand-tag">{offer.brand || 'URBAN STYLE'}</span>
                    <span className="offer-brand-dot">•</span>
                    <span className="offer-category-name">{offer.category}</span>
                  </div>

                  {/* Nombre completo */}
                  <h3
                    className="offer-product-name"
                    title={offer.name}
                    onClick={() => handleOpenOfferModal(offer)}
                  >
                    {offer.name}
                  </h3>

                  {/* Modelo */}
                  {offer.model && (
                    <div className="offer-model-badge">
                      <span className="model-label">{isFootwear ? '👟 Modelo:' : 'Diseño:'}</span>
                      <span className="model-value">{offer.model}</span>
                    </div>
                  )}

                  {/* Color */}
                  {offer.color && (
                    <div className="offer-color-row">
                      <span
                        className="color-dot"
                        style={{
                          backgroundColor: offer.color.toLowerCase().includes('blanco') ? '#e5e5e5' : '#111'
                        }}
                      />
                      <span className="color-text">{offer.color}</span>
                    </div>
                  )}

                  {/* Descripción Breve */}
                  <p className="offer-product-desc">{offer.description}</p>

                  {/* Selector de Tallas en Tarjeta */}
                  {offer.sizes && offer.sizes.length > 0 && (
                    <div className="offer-sizes-box">
                      <span className="sizes-title-mini">{isFootwear ? 'Tallas COL:' : 'Tallas:'}</span>
                      <div className="sizes-chip-list">
                        {offer.sizes.map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            className={`size-chip ${chosenSize === sz ? 'is-active' : ''}`}
                            onClick={(e) => handleSelectCardSize(offer.id, sz, e)}
                            title={`Seleccionar talla ${sz}`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PRECIOS: ANTERIOR TACHADO Y PROMOCIONAL REBAJADO */}
                  <div className="offer-pricing-row">
                    <div className="offer-pricing-group">
                      <span className="offer-price-label">Precio Anterior</span>
                      <span className="offer-price-original">
                        {offer.formattedOriginalPrice}
                      </span>
                    </div>

                    <div className="offer-pricing-group text-right">
                      <span className="offer-price-label">Precio DEMO</span>
                      <span className="offer-price-promo">
                        {offer.formattedPromoPrice || offer.formattedPrice}
                      </span>
                    </div>
                  </div>

                  {offer.formattedSavings && (
                    <div className="offer-savings-badge">
                      <span>Ahorras {offer.formattedSavings}</span>
                    </div>
                  )}

                  {/* BOTONES FUNCIONALES DUALES */}
                  <div className="offer-card-actions">
                    <button
                      type="button"
                      className="offer-btn-view"
                      onClick={() => handleOpenOfferModal(offer)}
                      aria-label={`Ver detalles completos de ${offer.name}`}
                    >
                      <span>👁️ Ver Producto</span>
                    </button>

                    <button
                      type="button"
                      className="offer-btn-add"
                      onClick={(e) => handleDirectAddToCart(offer, e)}
                      aria-label={`Agregar ${offer.name} (Talla ${chosenSize}) al carrito`}
                    >
                      <BagIcon size={16} />
                      <span>Agregar</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* NOTA ACLARATORIA DE DEMOSTRACIÓN */}
        <div className="offers-disclaimer-card reveal-on-scroll">
          <div className="disclaimer-content">
            <span className="disclaimer-badge">SECCIÓN DEMO</span>
            <p className="disclaimer-text">
              {PROMO_SECTION_CONFIG.disclaimer} Todos los artículos de muestra están totalmente integrados al carrito de compras, cálculo de envíos nacionales con Mi Paquete y panel administrativo de <strong>URBAN STYLE</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* TOAST FLOTANTE AL AGREGAR AL CARRITO */}
      {cardToast && (
        <aside className="offers-toast" role="status" aria-live="polite">
          <span className="toast-icon">🛍️</span>
          <div className="toast-body">
            <p className="toast-title">¡Prenda DEMO añadida a la bolsa!</p>
            <p className="toast-desc">
              {cardToast.name} <strong>(Talla {cardToast.size})</strong> • {cardToast.price}
            </p>
          </div>
          <button
            type="button"
            className="toast-btn-cart"
            onClick={() => {
              setCardToast(null);
              openCart();
            }}
          >
            Ver Bolsa
          </button>
        </aside>
      )}

      {/* MODAL INFORMATIVO Y COMPLETO DE LA OFERTA DEMO */}
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
                  alt={selectedOffer.alt || selectedOffer.name}
                  className="offer-modal-image"
                />
                <span className="offer-modal-discount-tag">
                  {selectedOffer.discount}
                </span>
              </div>

              {/* Detalle en modal */}
              <div className="offer-modal-body">
                <div className="modal-header-meta">
                  <span className="modal-brand-tag">{selectedOffer.brand || 'URBAN STYLE'}</span>
                  <span className="offer-modal-category">
                    {selectedOffer.category} • {selectedOffer.badge}
                  </span>
                </div>

                <h3 id="offer-modal-title" className="offer-modal-title">
                  {selectedOffer.name}
                </h3>

                {selectedOffer.model && (
                  <div className="modal-model-row">
                    <span className="model-label">Modelo:</span>
                    <strong className="model-name">{selectedOffer.model}</strong>
                  </div>
                )}

                {/* Comparación de precios */}
                <div className="offer-modal-pricing-box">
                  <div>
                    <span className="pricing-title">Precio Original</span>
                    <span className="pricing-before">
                      {selectedOffer.formattedOriginalPrice}
                    </span>
                  </div>
                  <div>
                    <span className="pricing-title">Precio Especial DEMO</span>
                    <span className="pricing-now">
                      {selectedOffer.formattedPromoPrice || selectedOffer.formattedPrice}
                    </span>
                  </div>
                </div>

                {selectedOffer.formattedSavings && (
                  <p className="modal-savings-highlight">
                    🎉 Ahorro garantizado de {selectedOffer.formattedSavings} (-{selectedOffer.discountPercent}%)
                  </p>
                )}

                <p className="offer-modal-description">
                  {selectedOffer.description}
                </p>

                {/* Selector de Tallas */}
                {selectedOffer.sizes && selectedOffer.sizes.length > 0 && (
                  <div className="modal-sizes-group">
                    <div className="modal-sizes-head">
                      <span className="modal-sizes-label">Seleccionar Talla:</span>
                      <strong className="modal-chosen-size">
                        {modalSize || selectedOffer.sizes[0]}
                      </strong>
                    </div>
                    <div className="modal-sizes-pills">
                      {selectedOffer.sizes.map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          className={`modal-size-btn ${modalSize === sz ? 'is-selected' : ''}`}
                          onClick={() => setModalSize(sz)}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="offer-modal-meta-box">
                  <span className="meta-tag">Color: {selectedOffer.color || 'Negro'}</span>
                  {selectedOffer.composition && (
                    <span className="meta-tag">Tejido: {selectedOffer.composition}</span>
                  )}
                  <span className="meta-tag">Disponibilidad: En Stock</span>
                </div>

                {modalFeedback && (
                  <div className="offer-modal-feedback" role="alert">
                    {modalFeedback}
                  </div>
                )}

                <div className="offer-modal-actions">
                  <Button
                    variant="primary"
                    size="lg"
                    className="offer-modal-cta"
                    onClick={handleModalAddToCart}
                  >
                    <BagIcon size={18} />
                    <span>Añadir a la Bolsa</span>
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
                  * Prenda con precio en COP calculada con validaciones seguras del servidor.
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
