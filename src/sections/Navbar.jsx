import React, { useState, useEffect, useRef } from 'react';
import { BRAND_INFO } from '../data/brand';
import { NAV_LINKS } from '../data/navigation';
import {
  SearchIcon,
  HeartIcon,
  BagIcon,
  MenuIcon,
  CloseIcon,
  ChevronRightIcon
} from '../components/common/icons';
import { useCart } from '../context/CartContext';
import { useChristmasTheme } from '../context/ChristmasThemeContext';
import './Navbar.css';

/**
 * Barra de Navegación Principal de URBAN STYLE
 * Soporte de escritorio y cajón móvil interactivo y accesible.
 */
export const Navbar = ({ favoritesCount = 0, favoriteItems = [] }) => {
  const { cartCount, openCart, isCartOpen } = useCart();
  const { isChristmasMode, toggleChristmasTheme } = useChristmasTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchToast, setSearchToast] = useState(null);

  const searchInputRef = useRef(null);

  // Enfocar el input de búsqueda automáticamente al abrir
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Cerrar modales con la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setIsSearchOpen(false);
        setIsCartOpen(false);
        setIsWishlistOpen(false);
        setSearchToast(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Bloquear el scroll del body cuando el menú móvil está abierto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Manejo de navegación suave a secciones y filtros de catálogo
  const handleNavClick = (e, href) => {
    setIsMobileMenuOpen(false);
    setIsWishlistOpen(false);

    if (href.startsWith('#')) {
      const targetId = href.replace('#', '').toLowerCase();
      if (targetId === 'inicio') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Si es una categoría de producto, filtrar el catálogo y desplazarse a productos
      if (['zapatillas', 'tenis', 'calzado', 'hombre', 'mujer', 'accesorios'].includes(targetId)) {
        e.preventDefault();
        let catFilter = 'ALL';
        if (['zapatillas', 'tenis', 'calzado'].includes(targetId)) catFilter = 'TENIS';
        else if (targetId === 'hombre') catFilter = 'HOMBRE';
        else if (targetId === 'mujer') catFilter = 'MUJER';
        else if (targetId === 'accesorios') catFilter = 'ACCESORIOS';

        window.dispatchEvent(new CustomEvent('filter-products-category', { detail: catFilter }));
        const prodSec = document.getElementById('productos');
        if (prodSec) {
          prodSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      // Si es la sección de ofertas
      if (targetId === 'ofertas') {
        e.preventDefault();
        const ofertasSec = document.getElementById('ofertas-navidenas') || document.getElementById('productos');
        if (ofertasSec) {
          if (ofertasSec.id === 'productos') {
            window.dispatchEvent(new CustomEvent('filter-products-category', { detail: 'OFERTAS' }));
          }
          ofertasSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const toggleSearch = () => {
    setIsSearchOpen((prev) => !prev);
    setIsWishlistOpen(false);
  };

  const toggleCart = () => {
    openCart();
    setIsSearchOpen(false);
    setIsWishlistOpen(false);
  };

  const toggleWishlist = () => {
    setIsWishlistOpen((prev) => !prev);
    setIsSearchOpen(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // Disparar búsqueda interactiva en el catálogo de productos
    window.dispatchEvent(new CustomEvent('search-products', { detail: query }));
    setSearchQuery('');
    setIsSearchOpen(false);

    const prodSec = document.getElementById('productos');
    if (prodSec) {
      prodSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <nav className="navbar" role="navigation" aria-label="Navegación principal">
        <div className="container">
          <div className="navbar-inner">
            {/* LADO IZQUIERDO: LOGOTIPO TIPOGRÁFICO */}
            <a
              href="#inicio"
              className="navbar-brand"
              onClick={(e) => handleNavClick(e, '#inicio')}
              aria-label={`${BRAND_INFO.name} - Ir al inicio`}
            >
              <span className="brand-text">{BRAND_INFO.name}</span>
              <span className="brand-accent-dot" aria-hidden="true" />
              {isChristmasMode && (
                <span className="brand-christmas-ornament" title="Modo Navideño Activo" aria-hidden="true">
                  🎄
                </span>
              )}
            </a>

            {/* CENTRO: ENLACES DE NAVEGACIÓN EN ESCRITORIO */}
            <ul className="navbar-nav">
              {NAV_LINKS.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.href}
                    className={`nav-link ${link.isSpecial ? 'nav-link-special' : ''}`}
                    onClick={(e) => handleNavClick(e, link.href)}
                  >
                    {link.label}
                    {link.isSpecial && <span className="nav-tag-pulse" aria-hidden="true" />}
                  </a>
                </li>
              ))}
              {isChristmasMode && (
                <li>
                  <a
                    href="#ofertas-navidenas"
                    className="nav-link nav-link-christmas"
                    onClick={(e) => handleNavClick(e, '#ofertas-navidenas')}
                  >
                    <span className="nav-link-christmas-icon">🎁</span>
                    <span>Ofertas Navideñas</span>
                    <span className="nav-tag-christmas" aria-hidden="true">HOT</span>
                  </a>
                </li>
              )}
            </ul>

            {/* LADO DERECHO: ACCIONES E ICONOS */}
            <div className="navbar-actions">
              {/* Botón Conmutador Navideño / Clásico */}
              <button
                type="button"
                className={`action-btn nav-theme-toggle-btn ${isChristmasMode ? 'active-christmas' : ''}`}
                onClick={toggleChristmasTheme}
                title={isChristmasMode ? 'Cambiar a Estilo Clásico' : 'Activar Modo Navideño 🎄'}
                aria-label={isChristmasMode ? 'Cambiar a Estilo Clásico' : 'Activar Modo Navideño'}
              >
                <span className="theme-toggle-icon">{isChristmasMode ? '🎄' : '✨'}</span>
              </button>

              {/* Botón de Búsqueda */}
              <button
                type="button"
                className={`action-btn ${isSearchOpen ? 'active' : ''}`}
                onClick={toggleSearch}
                aria-label="Abrir panel de búsqueda"
                aria-expanded={isSearchOpen}
              >
                <SearchIcon size={20} />
              </button>

              {/* Botón de Favoritos */}
              <button
                type="button"
                className={`action-btn ${isWishlistOpen ? 'active' : ''}`}
                onClick={toggleWishlist}
                aria-label={`Ver lista de favoritos, ${favoritesCount} productos`}
                aria-expanded={isWishlistOpen}
              >
                <HeartIcon size={20} filled={favoritesCount > 0} />
                {favoritesCount > 0 && (
                  <span className="badge-count" aria-hidden="true">
                    {favoritesCount}
                  </span>
                )}
              </button>

              {/* Botón de Carrito con Contador */}
              <button
                type="button"
                className={`action-btn ${isCartOpen ? 'active' : ''}`}
                onClick={toggleCart}
                aria-label={`Carrito de compras, ${cartCount} productos`}
                aria-expanded={isCartOpen}
              >
                <BagIcon size={20} />
                <span className="badge-count" aria-hidden="true">
                  {cartCount}
                </span>
              </button>

              {/* Botón Hamburguesa para Móvil */}
              <button
                type="button"
                className="hamburger-btn"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Abrir menú de navegación"
                aria-expanded={isMobileMenuOpen}
              >
                <MenuIcon size={22} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* PANEL DE BÚSQUEDA INTEGRADO */}
      {isSearchOpen && (
        <section
          className="search-panel"
          aria-label="Barra de búsqueda de productos"
        >
          <div className="container">
            <form className="search-form" onSubmit={handleSearchSubmit}>
              <SearchIcon size={18} className="search-icon-inside" />
              <input
                ref={searchInputRef}
                type="search"
                className="search-input"
                placeholder="Buscar por prendas, zapatillas, estilo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Buscar en la tienda"
              />
              <button
                type="button"
                className="search-close-btn"
                onClick={() => setIsSearchOpen(false)}
                aria-label="Cerrar búsqueda"
              >
                <CloseIcon size={18} />
              </button>
            </form>
            <p className="search-feedback">
              Presiona Enter para buscar en el catálogo (disponible en la siguiente etapa).
            </p>
          </div>
        </section>
      )}

      {/* POPOVER DE FAVORITOS */}
      {isWishlistOpen && (
        <aside className="popover-card" role="dialog" aria-label="Lista de favoritos">
          <div className="popover-header">
            <span className="popover-title">
              <HeartIcon size={16} filled={favoritesCount > 0} /> Tus Favoritos ({favoritesCount})
            </span>
            <button
              type="button"
              className="popover-close"
              onClick={() => setIsWishlistOpen(false)}
              aria-label="Cerrar favoritos"
            >
              <CloseIcon size={16} />
            </button>
          </div>
          <div className="popover-body">
            {favoritesCount > 0 ? (
              <div style={{ textAlign: 'left' }}>
                <p className="popover-empty-text" style={{ marginBottom: '0.5rem', color: 'var(--color-accent)' }}>
                  {favoritesCount} {favoritesCount === 1 ? 'prenda guardada en sesión' : 'prendas guardadas en sesión'}:
                </p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {favoriteItems.map((item) => (
                    <li key={item.id} style={{ fontSize: '0.8rem', color: 'var(--color-white)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.3rem' }}>
                      • {item.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <span className="popover-icon-empty">
                  <HeartIcon size={32} />
                </span>
                <p className="popover-empty-text">Tu lista de deseos está vacía (0)</p>
                <p className="popover-desc">
                  Guarda tus prendas favoritas haciendo clic en el corazón de cada tarjeta de producto.
                </p>
              </>
            )}
          </div>
        </aside>
      )}

      {/* MENÚ MÓVIL DESPLEGABLE (DRAWER ACCESIBLE) */}
      {isMobileMenuOpen && (
        <>
          <div
            className="mobile-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación móvil"
          >
            <div className="mobile-drawer-header">
              <a
                href="#inicio"
                className="navbar-brand"
                onClick={(e) => handleNavClick(e, '#inicio')}
              >
                <span className="brand-text">{BRAND_INFO.name}</span>
                <span className="brand-accent-dot" aria-hidden="true" />
              </a>
              <button
                type="button"
                className="action-btn"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Cerrar menú móvil"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <nav aria-label="Categorías en menú móvil">
              <ul className="mobile-nav-list">
                {isChristmasMode && (
                  <li>
                    <a
                      href="#ofertas-navidenas"
                      className="mobile-nav-link mobile-nav-christmas"
                      onClick={(e) => handleNavClick(e, '#ofertas-navidenas')}
                    >
                      <span className="mobile-christmas-text">🎁 Ofertas Navideñas</span>
                      <span className="mobile-christmas-tag">HOT</span>
                    </a>
                  </li>
                )}
                {NAV_LINKS.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.href}
                      className={`mobile-nav-link ${link.isSpecial ? 'mobile-nav-special' : ''}`}
                      onClick={(e) => handleNavClick(e, link.href)}
                    >
                      <span>{link.label}</span>
                      <ChevronRightIcon size={16} />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mobile-drawer-footer">
              <button
                type="button"
                className="mobile-theme-toggle-btn"
                onClick={toggleChristmasTheme}
              >
                {isChristmasMode ? '✨ Volver a Estilo Clásico' : '🎄 Activar Modo Navideño'}
              </button>
              <p className="mobile-slogan">"{BRAND_INFO.slogan}"</p>
            </div>
          </aside>
        </>
      )}

      {/* TOAST NOTIFICACIÓN DE BÚSQUEDA */}
      {searchToast && (
        <div className="search-toast" role="status" aria-live="polite">
          <span className="search-toast-dot" aria-hidden="true" />
          <span className="search-toast-text">{searchToast}</span>
          <button
            type="button"
            className="search-toast-close"
            onClick={() => setSearchToast(null)}
            aria-label="Cerrar notificación"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}
    </>
  );
};

export default Navbar;
