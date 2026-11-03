import React, { useState, useEffect } from 'react';
import { AnnouncementBar } from './sections/AnnouncementBar';
import { Navbar } from './sections/Navbar';
import { Hero } from './sections/Hero';
import { Categories } from './sections/Categories';
import { FeaturedProducts } from './sections/FeaturedProducts';
import { FeaturedCollection } from './sections/FeaturedCollection';
import { Offers } from './sections/Offers';
import { BrandBenefits } from './sections/BrandBenefits';
import { BrandIdentity } from './sections/BrandIdentity';
import { Newsletter } from './sections/Newsletter';
import { Footer } from './sections/Footer';
import { FEATURED_PRODUCTS } from './data/products';
import { useScrollReveal } from './hooks/useScrollReveal';
import { CartProvider } from './context/CartContext';
import { ChristmasThemeProvider, useChristmasTheme } from './context/ChristmasThemeContext';
import { SnowfallEffect } from './components/christmas/SnowfallEffect';
import { ChristmasLights } from './components/christmas/ChristmasLights';
import { ChristmasTogglePill } from './components/christmas/ChristmasTogglePill';
import { ChristmasDeals } from './sections/ChristmasDeals';
import { CartDrawer } from './components/cart/CartDrawer';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { OrderSuccessModal } from './components/checkout/OrderSuccessModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLoginPage } from './components/admin/AdminLoginPage';
import './styles/christmas.css';
import './App.css';

export function AppContent() {
  const { isChristmasMode } = useChristmasTheme();
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  // Escuchar cambios de ruta en el navegador (back / forward / pushState)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Activar animaciones suaves al desplazarse
  useScrollReveal();

  // Alternar favoritos interactivos en tiempo real durante la sesión
  const handleToggleFavorite = (productId) => {
    setFavoriteIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const favoriteItems = FEATURED_PRODUCTS.filter((p) => favoriteIds.includes(p.id));

  // 1. RUTA DEDICADA: /admin/login
  if (currentPath === '/admin/login') {
    return (
      <AdminLoginPage
        onLoginSuccess={() => {
          navigateTo('/admin');
        }}
        onReturnToStore={() => {
          navigateTo('/');
        }}
      />
    );
  }

  // 2. RUTA DEDICADA: /admin
  if (currentPath === '/admin') {
    return (
      <AdminDashboard
        isOpen={true}
        onClose={() => {
          navigateTo('/');
        }}
      />
    );
  }

  // 3. TIENDA VIRTUAL PÚBLICA
  return (
    <>
      {/* EFECTO DE NIEVE ANIMADA ELEGANTE (LIGERO, SIN BLOQUEAR INTERACCIÓN) */}
      <SnowfallEffect />

      <div className="app" id="inicio">
        {/* 1. BARRA DE ANUNCIOS, LUCES FESTIVAS Y BARRA DE NAVEGACIÓN */}
        <header className="site-header">
          <AnnouncementBar />
          <ChristmasLights />
          <Navbar
            favoritesCount={favoriteIds.length}
            favoriteItems={favoriteItems}
          />
        </header>

        {/* CUERPO PRINCIPAL DE LA TIENDA */}
        <main>
          {/* 3. PORTADA PRINCIPAL (HERO SECTION CON TEMÁTICA NAVIDEÑA) */}
          <Hero />

          {/* 4. SECCIÓN VISUAL DE CATEGORÍAS */}
          <Categories />

          {/* SECCIÓN ESPECIAL: OFERTAS NAVIDEÑAS CON DESCUENTOS REALES CONFIGURADOS */}
          {isChristmasMode && (
            <ChristmasDeals
              favorites={favoriteIds}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {/* 5. SECCIÓN DE PRODUCTOS DESTACADOS (CONEXIÓN CON CARRITO Y TALLAS) */}
          <FeaturedProducts
            favorites={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
          />

          {/* 6. COLECCIÓN DESTACADA (STREETWEAR SIN LÍMITES) */}
          <FeaturedCollection />

          {/* 7. OFERTAS DE DEMOSTRACIÓN (OFERTAS QUE MARCAN ESTILO) */}
          <Offers />

          {/* 8. BENEFICIOS DE LA MARCA (FRANJA DE VALOR) */}
          <BrandBenefits />

          {/* 9. PRESENTACIÓN E IDENTIDAD DE MARCA */}
          <BrandIdentity />

          {/* 10. FORMULARIO DE NOVEDADES (NEWSLETTER) */}
          <Newsletter />
        </main>

        {/* 11. PIE DE PÁGINA (FOOTER OFICIAL) */}
        <Footer onOpenAdmin={() => navigateTo('/admin/login')} />

        {/* COMPONENTES DE COMERCIO ELECTRÓNICO (OVERLAYS Y MODALES) */}
        <CartDrawer />
        <CheckoutModal />
        <OrderSuccessModal />

        {/* BOTÓN FLOTANTE: CONMUTADOR MODO NAVIDEÑO / ESTILO CLÁSICO */}
        <ChristmasTogglePill />

        {/* PANEL ADMINISTRATIVO OVERLAY */}
        <AdminDashboard
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
        />
      </div>
    </>
  );
}

export function App() {
  return (
    <ChristmasThemeProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </ChristmasThemeProvider>
  );
}

export default App;
