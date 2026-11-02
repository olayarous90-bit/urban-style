import { useEffect } from 'react';

/**
 * Hook para revelado suave de elementos al desplazarse (Scroll Reveal)
 * Utiliza IntersectionObserver nativo del navegador sin dependencias pesadas.
 * Respeta automáticamente la preferencia 'prefers-reduced-motion'.
 */
export const useScrollReveal = () => {
  useEffect(() => {
    // Si el usuario prefiere movimiento reducido, no activamos animaciones de entrada
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      // Revelar todos los elementos de inmediato
      const elements = document.querySelectorAll('.reveal-on-scroll');
      elements.forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    if (!('IntersectionObserver' in window)) {
      // Fallback para navegadores antiguos
      const elements = document.querySelectorAll('.reveal-on-scroll');
      elements.forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            // Dejar de observar para liberar memoria una vez revelado
            obs.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    const elements = document.querySelectorAll('.reveal-on-scroll');
    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);
};

export default useScrollReveal;
