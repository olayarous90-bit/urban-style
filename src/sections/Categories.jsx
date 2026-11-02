import React, { useState } from 'react';
import { CATEGORIES_DATA } from '../data/categories';
import { ChevronRightIcon } from '../components/common/icons';
import './Categories.css';

/**
 * Sección Visual de Categorías de URBAN STYLE
 * Presenta 4 tarjetas visuales de alto impacto editorial para
 * Moda para Hombre, Moda para Mujer, Zapatillas y Accesorios.
 */
export const Categories = () => {
  const [activeFeedback, setActiveFeedback] = useState(null);

  const handleCategoryClick = (category) => {
    // Si la tarjeta tiene un id, aseguramos scroll suave a la sección
    const element = document.getElementById(category.id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Feedback visual provisional de navegación activa
    setActiveFeedback({
      title: category.title,
      message: `Catálogo de ${category.title.toLowerCase()} preparado. La selección de productos se conectará en la siguiente etapa.`
    });

    // Auto-ocultar el toast después de 3.5 segundos
    setTimeout(() => {
      setActiveFeedback((current) => (current?.title === category.title ? null : current));
    }, 3500);
  };

  return (
    <section className="categories-section" id="categorias" aria-label="Categorías de la tienda">
      <div className="container">
        {/* CABECERA DE LA SECCIÓN */}
        <div className="categories-header reveal-on-scroll">
          <div className="categories-badge">
            <span className="categories-badge-text">Colección Principal</span>
          </div>
          <h2 className="categories-title">Encuentra Tu Estilo</h2>
          <p className="categories-subtitle">
            Explora nuestras categorías y descubre nuevas formas de expresar tu personalidad.
          </p>
        </div>

        {/* CUADRÍCULA DE 4 TARJETAS VISUALES */}
        <div className="categories-grid">
          {CATEGORIES_DATA.map((cat, index) => (
            <article
              key={cat.id}
              id={cat.id}
              className={`category-card reveal-on-scroll stagger-${(index % 4) + 1}`}
              onClick={() => handleCategoryClick(cat)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCategoryClick(cat);
                }
              }}
              aria-label={`Explorar categoría ${cat.title}`}
            >
              {/* Imagen de fondo con recorte consistente */}
              <div className="category-image-wrapper">
                <img
                  src={cat.image}
                  alt={cat.alt}
                  className="category-image"
                  loading="lazy"
                  decoding="async"
                />
              </div>

              {/* Capa de contraste y gradiente */}
              <div className="category-overlay" aria-hidden="true" />

              {/* Contenido textual y acción */}
              <div className="category-card-content">
                <span className="category-tag">{cat.tag}</span>
                <h3 className="category-card-title">{cat.title}</h3>
                <p className="category-card-desc">{cat.description}</p>

                <div className="category-btn-action">
                  <span>Explorar</span>
                  <ChevronRightIcon size={16} className="category-btn-arrow" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* FEEDBACK INFORMATIVO AL EXPLORAR UNA CATEGORÍA */}
      {activeFeedback && (
        <aside className="category-toast" role="status" aria-live="polite">
          <p className="toast-header">Categoría Seleccionada</p>
          <p className="toast-message">{activeFeedback.message}</p>
        </aside>
      )}
    </section>
  );
};

export default Categories;
