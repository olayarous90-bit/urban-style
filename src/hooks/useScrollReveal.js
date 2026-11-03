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
            obs.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        threshold: 0.05,
        rootMargin: '40px 0px 40px 0px'
      }
    );

    const observeElement = (el) => {
      if (el && el instanceof HTMLElement) {
        if (el.classList.contains('is-revealed')) return;
        observer.observe(el);
      }
    };

    // Observar elementos estáticos iniciales
    const elements = document.querySelectorAll('.reveal-on-scroll');
    elements.forEach(observeElement);

    // MutationObserver: registrar automáticamente cualquier elemento .reveal-on-scroll
    // que se monte dinámicamente al cargar productos, cambiar filtros o buscar
    let mutationObserver = null;
    if ('MutationObserver' in window) {
      mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList?.contains('reveal-on-scroll')) {
                observeElement(node);
              }
              if (node.querySelectorAll) {
                node.querySelectorAll('.reveal-on-scroll').forEach(observeElement);
              }
            }
          }
        }
      });

      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    return () => {
      observer.disconnect();
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
    };
  }, []);
};

export default useScrollReveal;
