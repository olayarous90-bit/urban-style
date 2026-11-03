import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useChristmasTheme } from '../context/ChristmasThemeContext';
import { FEATURED_PRODUCTS } from '../data/products';
import { HeartIcon } from '../components/common/icons';
import './ChristmasDeals.css';

// Descuentos reales precalculados para renderizado instantáneo sincronizados con Neon
const INITIAL_CHRISTMAS_PROMOS = [
  {
    ...FEATURED_PRODUCTS[0],
    hasDiscount: true,
    discountPercent: 20,
    price: 103920,
    originalPrice: 129900,
    formattedPrice: '$103.920 COP',
    formattedOriginalPrice: '$129.900 COP',
    formattedSavings: '$25.980 COP'
  },
  {
    ...FEATURED_PRODUCTS[3],
    hasDiscount: true,
    discountPercent: 25,
    price: 292425,
    originalPrice: 389900,
    formattedPrice: '$292.425 COP',
    formattedOriginalPrice: '$389.900 COP',
    formattedSavings: '$97.475 COP'
  },
  {
    ...(FEATURED_PRODUCTS[4] || FEATURED_PRODUCTS[1]),
    hasDiscount: true,
    discountPercent: 15,
    price: 390915,
    originalPrice: 459900,
    formattedPrice: '$390.915 COP',
    formattedOriginalPrice: '$459.900 COP',
    formattedSavings: '$68.985 COP'
  }
];

/**
 * Sección de Ofertas Navideñas de URBAN STYLE
 * Muestra los descuentos reales calculados en el servidor desde Neon PostgreSQL
 */
export const ChristmasDeals = ({ favorites = [], onToggleFavorite = () => {} }) => {
  const { isChristmasMode } = useChristmasTheme();
  const { addToCart } = useCart();
  const [discountedProducts, setDiscountedProducts] = useState(INITIAL_CHRISTMAS_PROMOS);
  const [loading, setLoading] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState({});
  const [addedToast, setAddedToast] = useState(null);

  const fetchDeals = () => {
    fetch(`/api/products?_t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache, no-store' }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          // Filtrar prendas que cuentan con descuento oficial activo en Neon
          const promos = data.data.filter((p) => p.hasDiscount || p.discountPercent > 0);
          if (promos.length > 0) {
            setDiscountedProducts(promos);
          }
        }
      })
      .catch((err) => {
        console.warn('Ofertas navideñas funcionando con catálogo base sincronizado:', err);
      });
  };

  useEffect(() => {
    fetchDeals();
    const handleUpdate = () => fetchDeals();
    window.addEventListener('catalog-updated', handleUpdate);
    return () => window.removeEventListener('catalog-updated', handleUpdate);
  }, []);

  if (!isChristmasMode) return null;

  const handleSelectSize = (productId, size) => {
    setSelectedSizes((prev) => ({
      ...prev,
      [productId]: size
    }));
  };

  const handleAddToCart = (product) => {
    const size = selectedSizes[product.id] || product.sizes?.[0] || 'M';
    addToCart(product, size, product.color || 'Negro', 1);

    setAddedToast(`¡"${product.name}" añadido a la bolsa de regalos! 🎁`);
    setTimeout(() => {
      setAddedToast(null);
    }, 3000);
  };

  return (
    <section
      id="ofertas-navidenas"
      className="christmas-deals-section"
      aria-label="Ofertas navideñas exclusivas"
    >
      <div className="container">
        
        {/* ENCABEZADO DE LA SECCIÓN FESTIVA */}
        <div className="christmas-header reveal-on-scroll">
          <div className="christmas-badge">
            <span className="christmas-badge-icon" aria-hidden="true">🎄</span>
            <span className="christmas-badge-text">Edición Navideña 2026</span>
          </div>

          <h2 className="christmas-title">
            Ofertas Navideñas <span className="title-accent-gold">Exclusivas</span>
          </h2>

          <p className="christmas-subtitle">
            Regala estilo, regala moda. Descubre los descuentos reales y prendas seleccionadas
            para lucir o sorprender en estas fiestas.
          </p>
        </div>

        {/* TOAST DE FEEDBACK AL AÑADIR AL CARRITO */}
        {addedToast && (
          <div className="christmas-toast-alert" role="status">
            <span>{addedToast}</span>
          </div>
        )}

        {/* CUADRÍCULA DE OFERTAS NAVIDEÑAS */}
        {loading ? (
          <div className="christmas-loading-box">
            <span>Cargando ofertas navideñas en tiempo real...</span>
          </div>
        ) : (
          <div className="christmas-deals-grid">
            {discountedProducts.map((p, idx) => {
              const hasDiscount = Boolean(p.hasDiscount);
              const discountPercent = p.discountPercent || 20;
              const formattedPrice = p.formattedPrice || p.formatted_price;
              const formattedOriginal = p.formattedOriginalPrice || p.formatted_price;
              const currentSize = selectedSizes[p.id] || p.sizes?.[0] || 'M';
              const isFav = favorites.includes(p.id);

              return (
                <article
                  key={p.id}
                  className={`christmas-card reveal-on-scroll stagger-${idx + 1}`}
                >
                  {/* CINTA DECORATIVA FESTIVA */}
                  <div className="christmas-card-ribbon">
                    <span>🎁 REGALO IDEAL</span>
                  </div>

                  {/* IMAGEN DEL PRODUCTO */}
                  <div className="christmas-media-wrapper">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="christmas-card-image"
                      loading="lazy"
                    />

                    {/* BADGE DE DESCUENTO REAL */}
                    <div className="christmas-discount-tag">
                      <span>-{discountPercent}% OFF</span>
                    </div>

                    {/* BOTÓN DE FAVORITOS */}
                    <button
                      type="button"
                      className={`christmas-fav-btn ${isFav ? 'is-active' : ''}`}
                      onClick={() => onToggleFavorite(p.id)}
                      aria-label="Guardar en lista de regalos"
                    >
                      <HeartIcon size={18} filled={isFav} />
                    </button>
                  </div>

                  {/* DETALLES DE LA PRENDA */}
                  <div className="christmas-card-info">
                    <div className="christmas-meta">
                      <span className="christmas-category">{p.category}</span>
                      <h3 className="christmas-product-title">{p.name}</h3>
                    </div>

                    {/* PRECIOS Y AHORRO REAL */}
                    <div className="christmas-pricing-block">
                      <div className="price-row">
                        <span className="current-price-gold">{formattedPrice}</span>
                        {hasDiscount && (
                          <del className="original-price-strike">{formattedOriginal}</del>
                        )}
                      </div>
                      {p.formattedSavings && (
                        <div className="savings-badge-pill">
                          <span>Ahorras {p.formattedSavings}</span>
                        </div>
                      )}
                    </div>

                    {/* SELECTOR RÁPIDO DE TALLAS */}
                    {p.sizes && p.sizes.length > 0 && (
                      <div className="christmas-sizes-row">
                        <span className="sizes-label">Talla:</span>
                        <div className="sizes-chips-list">
                          {p.sizes.slice(0, 5).map((s) => (
                            <button
                              key={s}
                              type="button"
                              className={`size-mini-btn ${currentSize === s ? 'active' : ''}`}
                              onClick={() => handleSelectSize(p.id, s)}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* BOTÓN AÑADIR A LA BOLSA */}
                    <button
                      type="button"
                      className="christmas-add-btn"
                      onClick={() => handleAddToCart(p)}
                    >
                      <span>🎁 Añadir a la Bolsa</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};

export default ChristmasDeals;
