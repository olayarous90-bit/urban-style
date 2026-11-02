import React from 'react';
import { ANNOUNCEMENT_CONFIG } from '../data/navigation';
import './AnnouncementBar.css';

/**
 * Barra de anuncios superior de URBAN STYLE.
 * Totalmente configurable, compacta y responsiva.
 * 
 * @param {Object} props
 * @param {string} [props.prefix] - Texto inicial destacado
 * @param {string} [props.separator] - Separador estilizado
 * @param {string} [props.suffix] - Texto secundario
 * @param {string} [props.message] - Texto completo configurable alternativo
 */
export const AnnouncementBar = ({
  prefix = ANNOUNCEMENT_CONFIG.prefix,
  separator = ANNOUNCEMENT_CONFIG.separator,
  suffix = ANNOUNCEMENT_CONFIG.suffix,
  message
}) => {
  // Si se pasa un mensaje directo que contenga un separador '|', se formatea automáticamente
  let displayPrefix = prefix;
  let displaySuffix = suffix;

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
