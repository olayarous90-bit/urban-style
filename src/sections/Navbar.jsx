import React, { useState, useEffect, useRef } from 'react';
import { BRAND_INFO } from '../data/brand';
import { NAV_LINKS } from '../data/navigation';
import {
  SearchIcon,
  HeartIcon,
  BagIcon,
  MenuIcon,
  CloseIcon,
  ChevronRightIcon,
  UserIcon
} from '../components/common/icons';
import { useCart } from '../context/CartContext';
import { useChristmasTheme } from '../context/ChristmasThemeContext';
import './Navbar.css';

/**
 * Barra de Navegación Principal de URBAN STYLE
 * Soporte completo de escritorio y menú móvil interactivo con todas las categorías,
 * buscador interactivo, carrito dinámico y acceso a cuenta/administración.
 */
export const Navbar = ({
  favoritesCount = 0,
  favoriteItems = [],
  onOpenAccount = () => { window.location.href = '/admin/login'; }
}) => {
  const { cartCount, openCart, isCartOpen } = useCart();
  const { isChristmasMode, toggleChristmasTheme } = useChristmasTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [searchToast, setSearchToast] = useState(null);

  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);

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
        setIsAccountOpen(false);
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
    setIsAccountOpen(false);

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
    setIsAccountOpen(false);
  };

  const toggleCart = () => {
    openCart();
    setIsSearchOpen(false);
    setIsWishlistOpen(false);
    setIsAccountOpen(false);
  };

  const toggleWishlist = () => {
    setIsWishlistOpen((prev) => !prev);
    setIsSearchOpen(false);
    setIsAccountOpen(false);
  };

  const toggleAccount = () => {
    setIsAccountOpen((prev) => !prev);
    setIsSearchOpen(false);
    setIsWishlistOpen(false);
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

  const handleMobileSearchSubmit = (e) => {
    e.preventDefault();
    const query = mobileSearchQuery.trim();
    if (!query) return;

    window.dispatchEvent(new CustomEvent('search-products', { detail: query }));
    setMobileSearchQuery('');
    setIsMobileMenuOpen(false);

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
            {/* LADO IZQUIERDO: LOGOTIPO TIPOGRÁFICO DE URBAN STYLE */}
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
                title="Buscar productos"
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
                title="Favoritos"
                aria-expanded={isWishlistOpen}
              >
                <HeartIcon size={20} filled={favoritesCount > 0} />
                {favoritesCount > 0 && (
                  <span className="badge-count" aria-hidden="true">
                    {favoritesCount}
                  </span>
                )}
              </button>

              {/* Botón de Carrito con Contador Dinámico */}
              <button
                type="button"
                className={`action-btn ${isCartOpen ? 'active' : ''}`}
                onClick={toggleCart}
                aria-label={`Carrito de compras, ${cartCount} productos`}
                title="Carrito de compras"
                aria-expanded={isCartOpen}
              >
                <BagIcon size={20} />
                <span className="badge-count" aria-hidden="true">
                  {cartCount}
                </span>
              </button>

              {/* Botón de Mi Cuenta / Acceso */}
              <button
                type="button"
                className={`action-btn ${isAccountOpen ? 'active' : ''}`}
                onClick={toggleAccount}
                aria-label="Mi Cuenta y Acceso"
                title="Mi Cuenta / Administración"
                aria-expanded={isAccountOpen}
              >
                <UserIcon size={20} />
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
                placeholder="Buscar por zapatillas, camisetas, gorras, chaquetas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Buscar en la tienda"
              />
              <button
                type="submit"
                className="search-submit-btn"
                aria-label="Ejecutar búsqueda"
              >
                Buscar
              </button>
              <button
                type="button"
                className="search-close-btn"
                onClick={() => setIsSearchOpen(false)}
                aria-label="Cerrar búsqueda"
              >
                <CloseIcon size={18} />
              </button>
            </form>
          </div>
        </section>
      )}

      {/* POPOVER DE MI CUENTA / ACCESO */}
      {isAccountOpen && (
        <aside className="popover-card account-popover" role="dialog" aria-label="Opciones de cuenta">
          <div className="popover-header">
            <span className="popover-title">
              <UserIcon size={16} /> Mi Cuenta & Acceso
            </span>
            <button
              type="button"
              className="popover-close"
              onClick={() => setIsAccountOpen(false)}
              aria-label="Cerrar menú de cuenta"
            >
              <CloseIcon size={16} />
            </button>
          </div>
          <div className="popover-body account-body">
            <div className="account-welcome">
              <span className="account-welcome-badge">URBAN STYLE</span>
              <p className="account-welcome-text">
                Gestión de pedidos, rastreo de envíos y panel administrativo oficial.
              </p>
            </div>

            <div className="account-actions-list">
              <button
                type="button"
                className="account-action-btn primary"
                onClick={() => {
                  setIsAccountOpen(false);
                  onOpenAccount();
                }}
              >
                <span className="account-btn-icon">🔐</span>
                <span className="account-btn-text">
                  <strong>Panel Administrativo</strong>
                  <small>Gestionar productos, ofertas y pedidos</small>
                </span>
                <ChevronRightIcon size={16} />
              </button>

              <button
                type="button"
                className="account-action-btn secondary"
                onClick={(e) => {
                  setIsAccountOpen(false);
                  handleNavClick(e, '#beneficios');
                }}
              >
                <span className="account-btn-icon">📦</span>
                <span className="account-btn-text">
                  <strong>Rastrear Envíos Mi Paquete</strong>
                  <small>Guías y cobertura nacional</small>
                </span>
                <ChevronRightIcon size={16} />
              </button>

              <a
                href="https://wa.me/573009030747?text=Hola%20URBAN%20STYLE,%20tengo%20una%20consulta%20sobre%20mi%20pedido"
                target="_blank"
                rel="noopener noreferrer"
                className="account-action-btn secondary"
                onClick={() => setIsAccountOpen(false)}
              >
                <span className="account-btn-icon">💬</span>
                <span className="account-btn-text">
                  <strong>Atención por WhatsApp</strong>
                  <small>Soporte personalizado al cliente</small>
                </span>
                <ChevronRightIcon size={16} />
              </a>
            </div>
          </div>
        </aside>
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

            {/* Buscador dentro del Drawer Móvil */}
            <div className="mobile-search-container">
              <form onSubmit={handleMobileSearchSubmit} className="mobile-search-form">
                <input
                  ref={mobileSearchInputRef}
                  type="search"
                  className="mobile-search-input"
                  placeholder="Buscar prendas, tenis..."
                  value={mobileSearchQuery}
                  onChange={(e) => setMobileSearchQuery(e.target.value)}
                  aria-label="Buscar productos en móvil"
                />
                <button type="submit" className="mobile-search-btn" aria-label="Buscar">
                  <SearchIcon size={16} />
                </button>
              </form>
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
                      <span className="mobile-link-inner">
                        <span className="mobile-link-icon">{link.icon || '•'}</span>
                        <span>{link.label}</span>
                      </span>
                      <ChevronRightIcon size={16} />
                    </a>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    className="mobile-nav-link mobile-account-link"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenAccount();
                    }}
                  >
                    <span className="mobile-link-inner">
                      <span className="mobile-link-icon">👤</span>
                      <span>Mi Cuenta / Panel Admin</span>
                    </span>
                    <ChevronRightIcon size={16} />
                  </button>
                </li>
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
