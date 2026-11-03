import React, { useState, useEffect } from 'react';
import { FEATURED_PRODUCTS } from '../data/products';
import { HeartIcon, CloseIcon, BagIcon, SearchIcon } from '../components/common/icons';
import { Button } from '../components/common/Button';
import { useCart } from '../context/CartContext';
import './FeaturedProducts.css';

/**
 * Filtro de categorías flexible que relaciona departamentos, categorías
 * y tipos de productos para calzado, ropa de hombre, mujer y accesorios.
 */
function matchesCategory(product, filter) {
  if (!filter || filter === 'ALL') return true;

  if (filter === 'OFERTAS') {
    return Boolean(product.hasDiscount || product.hasActiveDiscount);
  }

  const pCat = (product.category || '').toLowerCase();
  const pDep = (product.department || '').toLowerCase();
  const pName = (product.name || '').toLowerCase();
  const pModel = (product.model || '').toLowerCase();
  const pDesc = (product.description || '').toLowerCase();

  if (filter === 'TENIS' || filter === 'ZAPATILLAS' || filter === 'CALZADO') {
    return (
      pCat.includes('zapatilla') ||
      pCat.includes('calzado') ||
      pCat.includes('tenis') ||
      pCat.includes('sneaker') ||
      pCat.includes('zapato') ||
      pDep.includes('tenis') ||
      pDep.includes('calzado') ||
      pDep.includes('zapatilla') ||
      pName.includes('sneaker') ||
      pName.includes('tenis') ||
      pName.includes('zapatilla') ||
      pName.includes('air force') ||
      pName.includes('jordan') ||
      pName.includes('dunk') ||
      pName.includes('bota') ||
      pModel.includes('apex') ||
      pModel.includes('force') ||
      pDesc.includes('calzado') ||
      pDesc.includes('suela') ||
      pDesc.includes('sneaker')
    );
  }

  if (filter === 'HOMBRE') {
    return (
      pDep.includes('hombre') ||
      pDep.includes('unisex') ||
      pCat.includes('camiseta') ||
      pCat.includes('sudadera') ||
      pCat.includes('pantalon') ||
      pCat.includes('chaqueta') ||
      (!pDep.includes('mujer') && (pCat.includes('zapatilla') || pCat.includes('calzado')))
    );
  }

  if (filter === 'MUJER') {
    return (
      pDep.includes('mujer') ||
      pDep.includes('unisex') ||
      pCat.includes('chaqueta') ||
      pCat.includes('sudadera') ||
      pCat.includes('camiseta') ||
      pName.includes('bomber') ||
      pName.includes('hoodie')
    );
  }

  if (filter === 'ACCESORIOS') {
    return (
      pCat.includes('accesorio') ||
      pCat.includes('bolso') ||
      pCat.includes('gorra') ||
      pCat.includes('cadena') ||
      pCat.includes('collar') ||
      pCat.includes('reloj') ||
      pDep.includes('accesorio')
    );
  }

  return pCat.includes(filter.toLowerCase()) || pDep.includes(filter.toLowerCase()) || pName.includes(filter.toLowerCase());
}

/**
 * Sección de Productos de URBAN STYLE
 * Muestra catálogo completo con filtros por categoría (Tenis, Ropa Hombre, Ropa Mujer, Accesorios),
 * búsqueda interactiva, información completa de producto, modelo, tallas, precios con descuentos reales
 * y botones funcionales de «Ver producto» y «Agregar al carrito».
 */
export const FeaturedProducts = ({
  favorites = [],
  onToggleFavorite = () => {}
}) => {
  const { addToCart, openCart } = useCart();
  const [products, setProducts] = useState(FEATURED_PRODUCTS);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [modalFeedback, setModalFeedback] = useState(null);

  // Filtros de navegación y búsqueda interactiva
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardSizes, setSelectedCardSizes] = useState({});
  const [cardToast, setCardToast] = useState(null);

  // Sincronizar catálogo dinámico desde el backend (Neon PostgreSQL) sin caché obsoleto
  const fetchProducts = () => {
    fetch(`/api/products?_t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store'
      }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setProducts(data.data);
        }
      })
      .catch(() => {
        // En caso de desconexión mantiene el catálogo estático seguro
      });
  };

  useEffect(() => {
    fetchProducts();

    // Reaccionar inmediatamente cuando el admin crea, edita o elimina productos
    const handleCatalogUpdate = () => {
      fetchProducts();
    };

    // Al regresar a la pestaña de la tienda, sincronizar catálogo
    const handleWindowFocus = () => {
      fetchProducts();
    };

    window.addEventListener('catalog-updated', handleCatalogUpdate);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('catalog-updated', handleCatalogUpdate);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  // Escuchar eventos globales de filtrado (desde Navbar o Categories) y cambios de hash en la URL
  useEffect(() => {
    const handleCategoryFilterEvent = (e) => {
      const cat = e.detail;
      if (cat) {
        setActiveCategory(cat.toUpperCase());
        const section = document.getElementById('productos');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    const handleSearchEvent = (e) => {
      const q = e.detail;
      if (typeof q === 'string') {
        // Al buscar desde el Navbar, buscar en TODO el catálogo para no limitar por categoría previa
        setActiveCategory('ALL');
        setSearchQuery(q);
        const section = document.getElementById('productos');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    const handleHashSync = () => {
      const hash = window.location.hash.toLowerCase().replace('#', '');
      if (hash === 'zapatillas' || hash === 'tenis' || hash === 'calzado') {
        setActiveCategory('TENIS');
      } else if (hash === 'hombre') {
        setActiveCategory('HOMBRE');
      } else if (hash === 'mujer') {
        setActiveCategory('MUJER');
      } else if (hash === 'accesorios') {
        setActiveCategory('ACCESORIOS');
      } else if (hash === 'ofertas') {
        setActiveCategory('OFERTAS');
      }
    };

    window.addEventListener('filter-products-category', handleCategoryFilterEvent);
    window.addEventListener('search-products', handleSearchEvent);
    window.addEventListener('hashchange', handleHashSync);

    // Revisar hash al cargar la página
    handleHashSync();

    return () => {
      window.removeEventListener('filter-products-category', handleCategoryFilterEvent);
      window.removeEventListener('search-products', handleSearchEvent);
      window.removeEventListener('hashchange', handleHashSync);
    };
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
    const chosenSize = selectedCardSizes[product.id] || product.sizes?.[0] || 'M';
    setSelectedSize(chosenSize);
    setModalFeedback(null);
  };

  const isFavorite = (productId) => favorites.includes(productId);

  // Agregar al carrito desde el Modal
  const handleModalAddToCart = () => {
    if (!selectedProduct) return;
    const size = selectedSize || selectedProduct.sizes?.[0] || 'M';
    addToCart(selectedProduct, size, selectedProduct.color, 1);
    setModalFeedback(`¡"${selectedProduct.name}" (Talla ${size}) añadido a la bolsa!`);
    setTimeout(() => {
      setSelectedProduct(null);
      openCart();
    }, 700);
  };

  // Agregar al carrito DIRECTAMENTE desde la tarjeta
  const handleDirectAddToCart = (product, e) => {
    e.stopPropagation();
    const size = selectedCardSizes[product.id] || product.sizes?.[0] || 'M';
    addToCart(product, size, product.color, 1);
    setCardToast({
      productName: product.name,
      size,
      price: product.formattedPrice || product.formatted_price
    });
    setTimeout(() => setCardToast(null), 3500);
  };

  // Seleccionar talla en la tarjeta previa al clic en agregar
  const handleSelectCardSize = (productId, size, e) => {
    e.stopPropagation();
    setSelectedCardSizes((prev) => ({ ...prev, [productId]: size }));
  };

  // Conteo dinámico de productos por categoría
  const countAll = products.length;
  const countTenis = products.filter((p) => matchesCategory(p, 'TENIS')).length;
  const countHombre = products.filter((p) => matchesCategory(p, 'HOMBRE')).length;
  const countMujer = products.filter((p) => matchesCategory(p, 'MUJER')).length;
  const countAccesorios = products.filter((p) => matchesCategory(p, 'ACCESORIOS')).length;
  const countOfertas = products.filter((p) => matchesCategory(p, 'OFERTAS')).length;

  // Conteo de coincidencias globales para búsqueda
  const cleanQuery = searchQuery.toLowerCase().trim();
  const globalMatchesCount = cleanQuery
    ? products.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const brand = (p.brand || '').toLowerCase();
        const model = (p.model || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        const dep = (p.department || '').toLowerCase();
        const col = (p.color || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return (
          name.includes(cleanQuery) ||
          brand.includes(cleanQuery) ||
          model.includes(cleanQuery) ||
          cat.includes(cleanQuery) ||
          dep.includes(cleanQuery) ||
          col.includes(cleanQuery) ||
          desc.includes(cleanQuery)
        );
      }).length
    : 0;

  // Filtrado reactivo de productos según categoría y término de búsqueda
  const filteredProducts = products.filter((p) => {
    const matchCat = matchesCategory(p, activeCategory);
    if (!matchCat) return false;

    if (!cleanQuery) return true;

    const name = (p.name || '').toLowerCase();
    const brand = (p.brand || '').toLowerCase();
    const model = (p.model || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const dep = (p.department || '').toLowerCase();
    const col = (p.color || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();

    return (
      name.includes(cleanQuery) ||
      brand.includes(cleanQuery) ||
      model.includes(cleanQuery) ||
      cat.includes(cleanQuery) ||
      dep.includes(cleanQuery) ||
      col.includes(cleanQuery) ||
      desc.includes(cleanQuery)
    );
  });

  return (
    <section className="featured-products-section" id="productos" aria-label="Catálogo de productos oficial de URBAN STYLE">
      <div className="container">
        {/* CABECERA DE LA SECCIÓN */}
        <div className="products-header reveal-on-scroll">
          <div className="products-badge">
            <span className="products-badge-text">Colección Oficial 2026</span>
          </div>
          <h2 className="products-title">Catálogo de Productos</h2>
          <p className="products-subtitle">
            Diseño urbano contemporáneo, tenis de alta gama, prendas esenciales y accesorios con precios oficiales en pesos colombianos.
          </p>
        </div>

        {/* BARRA DE HERRAMIENTAS: PESTAÑAS DE CATEGORÍA Y BUSCADOR INTERACTIVO */}
        <div className="products-filter-toolbar reveal-on-scroll">
          <div className="category-filter-tabs" role="tablist" aria-label="Filtrar por categoría">
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'ALL'}
              className={`category-filter-pill ${activeCategory === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveCategory('ALL')}
            >
              <span>Todos</span>
              <span className="filter-pill-count">{countAll}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'TENIS'}
              className={`category-filter-pill ${activeCategory === 'TENIS' ? 'active' : ''}`}
              onClick={() => setActiveCategory('TENIS')}
            >
              <span>👟 Tenis / Calzado</span>
              <span className="filter-pill-count">{countTenis}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'HOMBRE'}
              className={`category-filter-pill ${activeCategory === 'HOMBRE' ? 'active' : ''}`}
              onClick={() => setActiveCategory('HOMBRE')}
            >
              <span>👕 Ropa de Hombre</span>
              <span className="filter-pill-count">{countHombre}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'MUJER'}
              className={`category-filter-pill ${activeCategory === 'MUJER' ? 'active' : ''}`}
              onClick={() => setActiveCategory('MUJER')}
            >
              <span>👗 Ropa de Mujer</span>
              <span className="filter-pill-count">{countMujer}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'ACCESORIOS'}
              className={`category-filter-pill ${activeCategory === 'ACCESORIOS' ? 'active' : ''}`}
              onClick={() => setActiveCategory('ACCESORIOS')}
            >
              <span>🎒 Accesorios</span>
              <span className="filter-pill-count">{countAccesorios}</span>
            </button>

            {countOfertas > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === 'OFERTAS'}
                className={`category-filter-pill pill-promotions ${activeCategory === 'OFERTAS' ? 'active' : ''}`}
                onClick={() => setActiveCategory('OFERTAS')}
              >
                <span>🔥 En Oferta</span>
                <span className="filter-pill-count">{countOfertas}</span>
              </button>
            )}
          </div>

          {/* BUSCADOR INTERACTIVO EN TIEMPO REAL */}
          <div className="products-search-box">
            <span className="search-box-icon" aria-hidden="true">
              <SearchIcon size={18} />
            </span>
            <input
              type="text"
              className="products-search-input"
              placeholder="Buscar por tenis, modelo, prenda, color o descripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar en el catálogo"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          {/* ESTADO DE RESULTADOS */}
          <div className="products-results-info">
            <span>
              Mostrando <strong>{filteredProducts.length}</strong> de {products.length} productos
              {activeCategory !== 'ALL' && ` en ${activeCategory}`}
              {searchQuery && ` para "${searchQuery}"`}
            </span>
            {(activeCategory !== 'ALL' || searchQuery) && (
              <button
                type="button"
                className="reset-filters-btn"
                onClick={() => {
                  setActiveCategory('ALL');
                  setSearchQuery('');
                }}
              >
                Restablecer filtros
              </button>
            )}
          </div>
        </div>

        {/* CUADRÍCULA UNIFORME DE PRODUCTOS */}
        {filteredProducts.length === 0 ? (
          <div className="products-empty-state">
            <div className="empty-state-icon">👟</div>
            <h3 className="empty-state-title">
              {globalMatchesCount > 0
                ? `Encontramos ${globalMatchesCount} producto(s) en otras categorías`
                : 'No encontramos productos coincidentes'}
            </h3>
            <p className="empty-state-text">
              {globalMatchesCount > 0
                ? `Hay ${globalMatchesCount} producto(s) que coinciden con "${searchQuery}" en el catálogo general pero no están en la categoría seleccionada (${activeCategory}).`
                : 'Intenta cambiar la categoría o buscar con otra palabra clave como "tenis", "air force", "hoodie", "cargo" o "cadena".'}
            </p>
            <button
              type="button"
              className="empty-state-btn"
              onClick={() => {
                setActiveCategory('ALL');
              }}
            >
              {globalMatchesCount > 0
                ? `Ver los ${globalMatchesCount} resultados en Todo el Catálogo`
                : 'Ver Todo el Catálogo'}
            </button>
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product, index) => {
              const favoriteActive = isFavorite(product.id);
              const pCat = (product.category || '').toLowerCase();
              const pDep = (product.department || '').toLowerCase();
              const pName = (product.name || '').toLowerCase();
              const isFootwear = pCat.includes('zapatilla') ||
                                 pCat.includes('calzado') ||
                                 pCat.includes('tenis') ||
                                 pDep.includes('calzado') ||
                                 pDep.includes('tenis') ||
                                 pName.includes('sneaker') ||
                                 pName.includes('air force') ||
                                 pName.includes('jordan') ||
                                 pName.includes('tenis') ||
                                 pName.includes('zapatilla');
              const chosenSize = selectedCardSizes[product.id] || product.sizes?.[0] || (isFootwear ? '40' : 'M');

              return (
                <article
                  key={product.id}
                  className={`product-card reveal-on-scroll stagger-${(index % 4) + 1} ${isFootwear ? 'is-footwear-card' : ''}`}
                >
                  {/* IMAGEN DEL PRODUCTO CON ZOOM SUTIL */}
                  <div
                    className="product-image-wrapper"
                    onClick={() => handleOpenModal(product)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenModal(product);
                      }
                    }}
                    aria-label={`Ver detalles de ${product.name}`}
                  >
                    {/* Badge de Novedad o Descuento Real */}
                    {product.hasDiscount ? (
                      <span className="product-tag tag-discount">-{product.discountPercent}% OFF</span>
                    ) : product.tag ? (
                      <span className="product-tag">{product.tag}</span>
                    ) : null}

                    {/* Botón de favoritos interactivo */}
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
                      alt={product.alt || product.name}
                      className="product-image"
                      loading="lazy"
                      decoding="async"
                    />

                    {/* Overlay al hover indicando vista rápida */}
                    <div className="product-hover-hint">
                      <span>👁️ Vista Rápida</span>
                    </div>
                  </div>

                  {/* INFORMACIÓN COMPLETA Y UNIFORME */}
                  <div className="product-info">
                    <div className="product-meta">
                      {/* Marca y Categoría */}
                      <div className="product-brand-row">
                        <span className="product-brand-tag">{product.brand || 'URBAN STYLE'}</span>
                        <span className="product-category-dot">•</span>
                        <span className="product-category">{product.category}</span>
                      </div>

                      {/* Nombre Completo de la Prenda o Tenis */}
                      <h3
                        className="product-name"
                        title={product.name}
                        onClick={() => handleOpenModal(product)}
                      >
                        {product.name}
                      </h3>

                      {/* Para tenis / zapatillas: Marca, Modelo y Color destacado */}
                      {product.model && (
                        <div className="product-model-badge">
                          <span className="model-label">{isFootwear ? '👟 Modelo:' : 'Diseño:'}</span>
                          <span className="model-value">{product.model}</span>
                        </div>
                      )}

                      {/* Color */}
                      {product.color && (
                        <div className="product-color-line">
                          <span className="color-swatch-dot" style={{ backgroundColor: product.color.toLowerCase().includes('blanco') ? '#eee' : '#111' }} />
                          <span className="product-color-text">{product.color}</span>
                        </div>
                      )}

                      {/* Breve descripción del artículo */}
                      <p className="product-desc-snippet">
                        {product.description}
                      </p>

                      {/* Tallas disponibles interactivas */}
                      {product.sizes && product.sizes.length > 0 && (
                        <div className="product-quick-sizes" aria-label="Tallas disponibles">
                          <span className="sizes-title-tiny">{isFootwear ? 'Tallas COL:' : 'Tallas:'}</span>
                          <div className="sizes-pills-row">
                            {product.sizes.map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                className={`size-chip-btn ${chosenSize === sz ? 'is-selected' : ''}`}
                                onClick={(e) => handleSelectCardSize(product.id, sz, e)}
                                title={`Seleccionar talla ${sz}`}
                              >
                                {sz}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Precios oficiales en COP y descuentos */}
                      <div className="product-price-wrapper">
                        {product.hasDiscount ? (
                          <div className="product-discounted-price-group">
                            <span className="product-price discount-highlight">{product.formattedPrice}</span>
                            <del className="product-original-price">{product.formattedOriginalPrice}</del>
                          </div>
                        ) : (
                          <span className="product-price">{product.formattedPrice || product.formatted_price}</span>
                        )}
                        <span className="product-currency-tag">COP</span>
                      </div>
                    </div>

                    {/* BOTONES FUNCIONALES DUALES: «VER PRODUCTO» Y «AGREGAR AL CARRITO» */}
                    <div className="product-card-actions">
                      <button
                        type="button"
                        className="product-view-btn"
                        onClick={() => handleOpenModal(product)}
                        aria-label={`Ver detalles completos de ${product.name}`}
                      >
                        <span>👁️ Ver Producto</span>
                      </button>

                      <button
                        type="button"
                        className="product-quick-add-btn"
                        onClick={(e) => handleDirectAddToCart(product, e)}
                        aria-label={`Agregar ${product.name} (Talla ${chosenSize}) al carrito`}
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
        )}
      </div>

      {/* TOAST FLOTANTE AL AGREGAR DIRECTAMENTE DESDE LA TARJETA */}
      {cardToast && (
        <aside className="product-card-toast" role="status" aria-live="polite">
          <span className="toast-icon">🛍️</span>
          <div className="toast-content">
            <p className="toast-title">¡Producto añadido a la bolsa!</p>
            <p className="toast-subtitle">
              {cardToast.productName} <strong>(Talla {cardToast.size})</strong> • {cardToast.price}
            </p>
          </div>
          <button
            type="button"
            className="toast-action-btn"
            onClick={() => {
              setCardToast(null);
              openCart();
            }}
          >
            Ver Bolsa
          </button>
        </aside>
      )}

      {/* MODAL INFORMATIVO Y COMPLETO DE DETALLE DE PRODUCTO */}
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
                  {selectedProduct.hasDiscount ? (
                    <span className="product-tag tag-discount">-{selectedProduct.discountPercent}% OFF</span>
                  ) : selectedProduct.tag ? (
                    <span className="product-tag">{selectedProduct.tag}</span>
                  ) : null}

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
                <div className="modal-category-row">
                  <span className="modal-brand-badge">{selectedProduct.brand || 'URBAN STYLE'}</span>
                  <span className="modal-category">{selectedProduct.category}</span>
                  {selectedProduct.model && (
                    <span className="modal-model-badge">Modelo: {selectedProduct.model}</span>
                  )}
                </div>

                <h3 className="modal-title" id="modal-product-title">
                  {selectedProduct.name}
                </h3>

                {/* Precios oficiales con descuento real */}
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
                    * Precio oficial garantizado en pesos colombianos (COP).
                  </p>
                </div>

                <p className="modal-description">{selectedProduct.description}</p>
              </div>

              {/* Selector de Tallas */}
              {selectedProduct.sizes && selectedProduct.sizes.length > 0 && (
                <div className="modal-sizes-box">
                  <div className="modal-sizes-header">
                    <span className="modal-sizes-title">Seleccionar Talla</span>
                    <span className="modal-selected-size-label">
                      Elegida: <strong>{selectedSize || selectedProduct.sizes[0]}</strong>
                    </span>
                  </div>
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
                {selectedProduct.brand && (
                  <div className="modal-spec-row">
                    <span className="modal-spec-label">Marca:</span>
                    <span>{selectedProduct.brand}</span>
                  </div>
                )}
                {selectedProduct.model && (
                  <div className="modal-spec-row">
                    <span className="modal-spec-label">Modelo:</span>
                    <span>{selectedProduct.model}</span>
                  </div>
                )}
                {selectedProduct.color && (
                  <div className="modal-spec-row">
                    <span className="modal-spec-label">Color:</span>
                    <span>{selectedProduct.color}</span>
                  </div>
                )}
                {selectedProduct.composition && (
                  <div className="modal-spec-row">
                    <span className="modal-spec-label">Composición:</span>
                    <span>{selectedProduct.composition}</span>
                  </div>
                )}
              </div>

              {/* Feedback */}
              {modalFeedback && (
                <div className="badge badge-accent" style={{ width: '100%', justifyContent: 'center' }}>
                  {modalFeedback}
                </div>
              )}

              {/* Acciones del Modal */}
              <div className="modal-actions">
                <Button
                  variant="primary"
                  className="modal-action-btn"
                  onClick={handleModalAddToCart}
                >
                  <BagIcon size={18} />
                  <span>Añadir a la Bolsa</span>
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
