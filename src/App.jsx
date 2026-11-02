import React, { useState } from 'react';
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
import { CartDrawer } from './components/cart/CartDrawer';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { OrderSuccessModal } from './components/checkout/OrderSuccessModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import './App.css';

export function AppContent() {
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

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

  return (
    <div className="app" id="inicio">
      {/* 1. BARRA DE ANUNCIOS Y 2. BARRA DE NAVEGACIÓN (Sincronizada con Carrito y Favoritos) */}
      <header className="site-header">
        <AnnouncementBar />
        <Navbar
          favoritesCount={favoriteIds.length}
          favoriteItems={favoriteItems}
        />
      </header>

      {/* CUERPO PRINCIPAL DE LA TIENDA */}
      <main>
        {/* 3. PORTADA PRINCIPAL (HERO SECTION) */}
        <Hero />

        {/* 4. SECCIÓN VISUAL DE CATEGORÍAS */}
        <Categories />

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
      <Footer onOpenAdmin={() => setIsAdminOpen(true)} />

      {/* COMPONENTES DE COMERCIO ELECTRÓNICO (OVERLAYS Y MODALES) */}
      <CartDrawer />
      <CheckoutModal />
      <OrderSuccessModal />

      {/* PANEL ADMINISTRATIVO PROTEGIDO */}
      <AdminDashboard
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />
    </div>
  );
}

export function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}

export default App;
