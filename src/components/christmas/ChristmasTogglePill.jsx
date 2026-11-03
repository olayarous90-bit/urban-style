import React from 'react';
import { useChristmasTheme } from '../../context/ChristmasThemeContext';
import './ChristmasTogglePill.css';

/**
 * Control flotante para alternar entre el Modo Navideño y el Estilo Original
 * Permite a cualquier usuario o administrador regresar a la apariencia clásica en cualquier momento.
 */
export const ChristmasTogglePill = () => {
  const { isChristmasMode, toggleChristmasMode } = useChristmasTheme();

  return (
    <aside className="christmas-toggle-dock" aria-label="Selector de temática de la tienda">
      <button
        type="button"
        className={`theme-switch-btn ${isChristmasMode ? 'is-christmas' : 'is-classic'}`}
        onClick={toggleChristmasMode}
        title={
          isChristmasMode
            ? 'Haz clic para desactivar la temática navideña y volver al estilo original'
            : 'Haz clic para activar la temática festiva navideña'
        }
        aria-pressed={isChristmasMode}
      >
        <span className="theme-switch-icon" aria-hidden="true">
          {isChristmasMode ? '🎄' : '✨'}
        </span>
        <span className="theme-switch-text">
          {isChristmasMode ? 'Navidad Activa' : 'Estilo Clásico'}
        </span>
        <span className="theme-switch-action">
          {isChristmasMode ? 'Cambiar a Original' : 'Activar Navidad'}
        </span>
      </button>
    </aside>
  );
};

export default ChristmasTogglePill;
