import React, { useState, useEffect } from 'react';
import { FEATURED_PRODUCTS } from '../data/products';
import { HeartIcon, CloseIcon } from '../components/common/icons';
import { Button } from '../components/common/Button';
import { useCart } from '../context/CartContext';
import './FeaturedProducts.css';

/**
 * Sección de Productos Destacados de URBAN STYLE
 * Muestra los ocho productos con precios en COP, selector de tallas,
 * favoritos interactivos de sesión y adición directa a la bolsa de compras.
 */
export const FeaturedProducts = ({
  favorites = [],
  onToggleFavorite = () => {}
}) => {
  const { addToCart } = useCart();
  const [products, setProducts] = useState(FEATURED_PRODUCTS);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [modalFeedback, setModalFeedback] = useState(null);

  // Sincronizar catálogo dinámico desde el backend
  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setProducts(data.data);
        }
      })
      .catch(() => {
        // En caso de desconexión mantiene el catálogo estático seguro
      });
  }, []);

  // Cerrar modal con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedProduct(null);
      }
    };

    if (selectedProduct) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedProduct]);

  // Al abrir el modal, seleccionar la primera talla por defecto y primera imagen
  const handleOpenModal = (product) => {
    setSelectedProduct(product);
    setActiveImageIndex(0);
    setSelectedSize(product.sizes?.[0] || null);
    setModalFeedback(null);
  };

  const isFavorite = (productId) => favorites.includes(productId);

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const size = selectedSize || selectedProduct.sizes?.[0] || 'M';
    addToCart(selectedProduct, size, selectedProduct.color, 1);
    setSelectedProduct(null);
  };

  return (
    <section className="featured-products-section" id="productos" aria-label="Productos destacados de la temporada">
      <div className="container">
        {/* CABECERA DE LA SECCIÓN */}
        <div className="products-header reveal-on-scroll">
          <div className="products-badge">
            <span className="products-badge-text">Colección 2026</span>
          </div>
          <h2 className="products-title">Los Favoritos de la Temporada</h2>
          <p className="products-subtitle">
            Piezas seleccionadas para transformar cualquier look.
          </p>
        </div>

        {/* CUADRÍCULA DE PRODUCTOS */}
        <div className="products-grid">
          {products.map((product, index) => {
            const favoriteActive = isFavorite(product.id);

            return (
              <article
                key={product.id}
                className={`product-card reveal-on-scroll stagger-${(index % 4) + 1}`}
              >
                {/* Imagen del producto con zoom sutil al hover */}
                <div className="product-image-wrapper">
                  {product.tag && (
                    <span className="product-tag">{product.tag}</span>
                  )}

                  {/* Botón de favoritos interactivo de sesión */}
                  <button
                    type="button"
                    className={`product-favorite-btn ${favoriteActive ? 'is-favorite' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(product.id);
                    }}
                    aria-label={
                      favoriteActive
                        ? `Quitar ${product.name} de favoritos`
                        : `Guardar ${product.name} en favoritos`
                    }
                  >
                    <HeartIcon size={18} filled={favoriteActive} />
                  </button>

                  <img
                    src={product.image}
                    alt={product.alt}
                    className="product-image"
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                {/* Información del producto */}
                <div className="product-info">
                  <div className="product-meta">
                    <span className="product-category">{product.category}</span>
                    <h3 className="product-name">{product.name}</h3>

                    <div className="product-price-wrapper">
                      {product.hasDiscount ? (
                        <div className="product-discounted-price-group">
                          <span className="product-price discount-highlight">{product.formattedPrice}</span>
                          <del className="product-original-price">{product.formattedOriginalPrice}</del>
                        </div>
                      ) : (
                        <span className="product-price">{product.formattedPrice || product.formatted_price}</span>
                      )}
                      <span className="product-demo-tag">DEMO</span>
                    </div>
                  </div>

                  {/* Botón VER PRODUCTO */}
                  <button
                    type="button"
                    className="product-view-btn"
                    onClick={() => handleOpenModal(product)}
                    aria-label={`Ver detalles de ${product.name}`}
                  >
                    Ver Producto
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* MODAL INFORMATIVO DE CONSULTA DE PRODUCTO */}
      {selectedProduct && (
        <div
          className="product-modal-backdrop"
          onClick={() => setSelectedProduct(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-product-title"
        >
          <div
            className="product-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón de Cierre */}
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setSelectedProduct(null)}
              aria-label="Cerrar ventana de producto"
            >
              <CloseIcon size={18} />
            </button>

            {/* Columna Izquierda: Galería de Imágenes */}
            {(() => {
              const gallery = (selectedProduct.images && selectedProduct.images.length > 0)
                ? selectedProduct.images
                : [selectedProduct.image || '/images/products/prod-tshirt.jpg'];
              const currentImg = gallery[activeImageIndex] || gallery[0];

              return (
                <div className="modal-media">
                  {selectedProduct.tag && (
                    <span className="product-tag">{selectedProduct.tag}</span>
                  )}

                  {/* Imagen Principal Activa */}
                  <div className="modal-main-image-container">
                    <img
                      src={currentImg}
                      alt={`${selectedProduct.name} - Vista ${activeImageIndex + 1}`}
                      className="modal-image"
                    />

                    {/* Botones de navegación anterior / siguiente */}
                    {gallery.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="modal-nav-arrow arrow-prev"
                          onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : gallery.length - 1))}
                          aria-label="Imagen anterior"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="modal-nav-arrow arrow-next"
                          onClick={() => setActiveImageIndex((prev) => (prev < gallery.length - 1 ? prev + 1 : 0))}
                          aria-label="Siguiente imagen"
                        >
                          ›
                        </button>
                        <span className="modal-gallery-counter">
                          {activeImageIndex + 1} / {gallery.length}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Tira de Miniaturas Interactivas */}
                  {gallery.length > 1 && (
                    <div className="modal-thumbnails-strip" role="tablist" aria-label="Vistas del producto">
                      {gallery.map((imgUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`modal-thumb-btn ${activeImageIndex === idx ? 'active' : ''}`}
                          onClick={() => setActiveImageIndex(idx)}
                          aria-label={`Ver vista ${idx + 1}`}
                          role="tab"
                          aria-selected={activeImageIndex === idx}
                        >
                          <img src={imgUrl} alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Columna Derecha: Detalles del Producto */}
            <div className="modal-details">
              <div className="modal-header">
                <span className="modal-category">{selectedProduct.category}</span>
                <h3 className="modal-title" id="modal-product-title">
                  {selectedProduct.name}
                </h3>

                <div className="modal-price-box">
                  {selectedProduct.hasDiscount ? (
                    <div className="modal-discount-pricing">
                      <div className="modal-price-row">
                        <span className="modal-price discount-highlight">{selectedProduct.formattedPrice}</span>
                        <del className="modal-original-price">{selectedProduct.formattedOriginalPrice}</del>
                        <span className="modal-discount-badge">-{selectedProduct.discountPercent}% OFF</span>
                      </div>
                      {selectedProduct.formattedSavings && (
                        <span className="modal-savings-text">Ahorras {selectedProduct.formattedSavings}</span>
                      )}
                    </div>
                  ) : (
                    <span className="modal-price">{selectedProduct.formattedPrice || selectedProduct.formatted_price}</span>
                  )}
                  <p className="modal-demo-notice">
                    * Precio oficial en pesos colombianos (COP).
                  </p>
                </div>

                <p className="modal-description">{selectedProduct.description}</p>
              </div>

              {/* Selector de Tallas */}
              {selectedProduct.sizes && (
                <div className="modal-sizes-box">
                  <span className="modal-sizes-title">Seleccionar Talla</span>
                  <div className="modal-sizes-list">
                    {selectedProduct.sizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`modal-size-pill ${selectedSize === size ? 'selected' : ''}`}
                        onClick={() => setSelectedSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Especificaciones Técnicas */}
              <div className="modal-specs">
                <div className="modal-spec-row">
                  <span className="modal-spec-label">Composición:</span>
                  <span>{selectedProduct.composition}</span>
                </div>
                <div className="modal-spec-row">
                  <span className="modal-spec-label">Color:</span>
                  <span>{selectedProduct.color}</span>
                </div>
              </div>

              {/* Feedback o Botones de Acción */}
              {modalFeedback && (
                <div className="badge badge-accent" style={{ width: '100%', justifyContent: 'center' }}>
                  {modalFeedback}
                </div>
              )}

              <div className="modal-actions">
                <Button
                  variant="primary"
                  className="modal-action-btn"
                  onClick={handleAddToCart}
                >
                  Añadir a la Bolsa
                </Button>

                <button
                  type="button"
                  className={`product-favorite-btn ${isFavorite(selectedProduct.id) ? 'is-favorite' : ''}`}
                  style={{ position: 'static', width: '46px', height: '46px', borderRadius: 'var(--radius-xs)' }}
                  onClick={() => onToggleFavorite(selectedProduct.id)}
                  aria-label="Alternar favoritos"
                >
                  <HeartIcon size={20} filled={isFavorite(selectedProduct.id)} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default FeaturedProducts;
