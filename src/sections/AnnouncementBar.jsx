import React, { useState, useEffect } from 'react';
import { useChristmasTheme } from '../context/ChristmasThemeContext';
import './AnnouncementBar.css';

const DEFAULT_ANNOUNCEMENTS = [
  { id: 'ann_1', text: '¡Envíos a todo Colombia!', link: '#beneficios' },
  { id: 'ann_2', text: '¡Ofertas especiales por tiempo limitado!', link: '#ofertas' },
  { id: 'ann_3', text: '¡Nuevas colecciones disponibles!', link: '#coleccion' },
  { id: 'ann_4', text: '¡Descuentos especiales en productos seleccionados!', link: '#productos' }
];

/**
 * Barra de anuncios superior interactiva y configurable de URBAN STYLE.
 * Soporta rotación automática, pausa al pasar el mouse, programación y cambios dinámicos desde el admin.
 */
export const AnnouncementBar = () => {
  const { isChristmasMode } = useChristmasTheme();
  const [announcements, setAnnouncements] = useState(DEFAULT_ANNOUNCEMENTS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isBarEnabled, setIsBarEnabled] = useState(true);
  const [rotationSeconds, setRotationSeconds] = useState(4);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Cargar anuncios desde el backend
  const fetchAnnouncements = () => {
    fetch(`/api/announcements?_t=${Date.now()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setIsBarEnabled(json.data.enabled !== false);
          if (Array.isArray(json.data.announcements) && json.data.announcements.length > 0) {
            setAnnouncements(json.data.announcements);
          }
          if (json.data.rotationSeconds) {
            setRotationSeconds(json.data.rotationSeconds);
          }
        }
      })
      .catch(() => {
        // Fallback seguro
      });
  };

  useEffect(() => {
    fetchAnnouncements();

    const handleUpdate = () => {
      fetchAnnouncements();
    };

    window.addEventListener('announcements-updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    return () => {
      window.removeEventListener('announcements-updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, []);

  // Rotación automática con pausa en hover
  useEffect(() => {
    if (!isBarEnabled || announcements.length <= 1 || isPaused) return;

    const intervalTime = Math.max(2, rotationSeconds) * 1000;
    const timer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % announcements.length);
        setIsTransitioning(false);
      }, 250);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isBarEnabled, announcements.length, isPaused, rotationSeconds]);

  if (!isBarEnabled || announcements.length === 0) {
    return null;
  }

  const currentAnn = announcements[currentIndex] || announcements[0];

  const handlePrev = (e) => {
    e.stopPropagation();
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
      setIsTransitioning(false);
    }, 200);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
      setIsTransitioning(false);
    }, 200);
  };

  const handleClickLink = (e, link) => {
    if (!link) return;
    if (link.startsWith('#')) {
      e.preventDefault();
      const targetId = link.replace('#', '').toLowerCase();

      if (['ofertas', 'ofertas-navidenas'].includes(targetId)) {
        const el = document.getElementById('ofertas-navidenas') || document.getElementById('productos');
        if (el) {
          window.dispatchEvent(new CustomEvent('filter-products-category', { detail: 'OFERTAS' }));
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      if (['productos', 'tenis', 'zapatillas', 'calzado', 'hombre', 'mujer', 'accesorios'].includes(targetId)) {
        let cat = 'ALL';
        if (['tenis', 'zapatillas', 'calzado'].includes(targetId)) cat = 'TENIS';
        else if (targetId === 'hombre') cat = 'HOMBRE';
        else if (targetId === 'mujer') cat = 'MUJER';
        else if (targetId === 'accesorios') cat = 'ACCESORIOS';

        window.dispatchEvent(new CustomEvent('filter-products-category', { detail: cat }));
        const el = document.getElementById('productos');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <aside
      className={`announcement-bar ${isChristmasMode ? 'announcement-christmas' : ''}`}
      role="region"
      aria-label="Barra de anuncios promocionales"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="announcement-inner">
        {/* Botón previo */}
        {announcements.length > 1 && (
          <button
            type="button"
            className="announcement-nav-btn prev"
            onClick={handlePrev}
            aria-label="Anuncio anterior"
          >
            ‹
          </button>
        )}

        <div className={`announcement-slide ${isTransitioning ? 'transitioning' : ''}`}>
          <span className="announcement-bullet" aria-hidden="true">
            {isChristmasMode ? '🎄' : '✨'}
          </span>

          {currentAnn.link ? (
            <a
              href={currentAnn.link}
              className="announcement-link"
              onClick={(e) => handleClickLink(e, currentAnn.link)}
            >
              <span className="announcement-text">{currentAnn.text}</span>
              <span className="announcement-cta" aria-hidden="true">
                Ver más →
              </span>
            </a>
          ) : (
            <span className="announcement-text">{currentAnn.text}</span>
          )}
        </div>

        {/* Botón siguiente */}
        {announcements.length > 1 && (
          <button
            type="button"
            className="announcement-nav-btn next"
            onClick={handleNext}
            aria-label="Siguiente anuncio"
          >
            ›
          </button>
        )}

        {/* Puntos indicadores si hay múltiples anuncios */}
        {announcements.length > 1 && (
          <div className="announcement-dots" aria-hidden="true">
            {announcements.map((ann, idx) => (
              <span
                key={ann.id || idx}
                className={`announcement-dot-item ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => {
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setCurrentIndex(idx);
                    setIsTransitioning(false);
                  }, 150);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

export default AnnouncementBar;
