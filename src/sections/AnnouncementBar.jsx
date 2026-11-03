import React from 'react';
import { ANNOUNCEMENT_CONFIG } from '../data/navigation';
import { useChristmasTheme } from '../context/ChristmasThemeContext';
import './AnnouncementBar.css';

/**
 * Barra de anuncios superior de URBAN STYLE.
 * Totalmente configurable, compacta y responsiva con temática navideña.
 */
export const AnnouncementBar = ({
  prefix,
  separator = ANNOUNCEMENT_CONFIG.separator,
  suffix,
  message
}) => {
  const { isChristmasMode } = useChristmasTheme();

  // Si no se pasaron props explícitas, alternar dinámicamente entre festivo y clásico
  const defaultPrefix = isChristmasMode
    ? '🎄 ¡LA NAVIDAD LLEGÓ A URBAN STYLE!'
    : ANNOUNCEMENT_CONFIG.prefix;

  const defaultSuffix = isChristmasMode
    ? 'REGALA ESTILO, REGALA MODA — ENVÍOS A TODA COLOMBIA'
    : ANNOUNCEMENT_CONFIG.suffix;

  let displayPrefix = prefix || defaultPrefix;
  let displaySuffix = suffix || defaultSuffix;

  if (message) {
    if (message.includes('|')) {
      const parts = message.split('|');
      displayPrefix = parts[0]?.trim();
      displaySuffix = parts.slice(1).join('|').trim();
    } else {
      displayPrefix = message;
      displaySuffix = '';
    }
  }

  return (
    <aside
      className="announcement-bar"
      role="region"
      aria-label="Anuncio de novedades"
    >
      <div className="announcement-content">
        <span className="announcement-highlight">
          <span className="announcement-dot" aria-hidden="true" />
          {displayPrefix}
        </span>
        {displaySuffix && (
          <>
            <span className="announcement-divider" aria-hidden="true">
              {separator}
            </span>
            <span className="announcement-detail">{displaySuffix}</span>
          </>
        )}
      </div>
    </aside>
  );
};

export default AnnouncementBar;
