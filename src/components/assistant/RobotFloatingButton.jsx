import React from 'react';
import './RobotFloatingButton.css';

/**
 * RobotFloatingButton
 * Botón flotante que muestra EXCLUSIVAMENTE la figura de un robot estilizado
 * sin nombres ni letras. Ubicado inmediatamente encima del botón de WhatsApp.
 */
export function RobotFloatingButton({ isOpen, onClick, isEnabled = true }) {
  if (!isEnabled) return null;

  return (
    <div className="robot-floating-container" aria-label="Asistente Virtual Robot">
      <button
        type="button"
        className={`robot-floating-btn ${isOpen ? 'is-active' : ''}`}
        onClick={onClick}
        aria-label="Abrir asistente virtual de compras"
        aria-expanded={isOpen}
      >
        {/* Tooltip visible exclusivamente en hover desde computador */}
        <span className="robot-desktop-tooltip">
          <span>🤖</span> Asistente IA
        </span>

        {/* Punto verde de conexión activa en tiempo real */}
        <span className="robot-status-dot" aria-hidden="true" />

        {/* Iconografía SVG Exclusiva del Robot Futurista */}
        <svg
          viewBox="0 0 48 48"
          className="robot-svg-icon"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Antena central con orbe de energía */}
          <line x1="24" y1="11" x2="24" y2="4" stroke="#FF5A1F" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="24" cy="4" r="3" className="robot-antenna-orb" />

          {/* Oídos / Sensores acústicos laterales */}
          <rect x="5" y="20" width="3" height="10" rx="1.5" fill="#FF5A1F" />
          <rect x="40" y="20" width="3" height="10" rx="1.5" fill="#FF5A1F" />

          {/* Cabeza principal del Robot (Carrocería aerodinámica) */}
          <rect
            x="8"
            y="11"
            width="32"
            height="26"
            rx="6"
            fill="#1E1E1E"
            stroke="#FFFFFF"
            strokeWidth="1.8"
          />

          {/* Visor digital oscuro */}
          <rect
            x="12"
            y="16"
            width="24"
            height="11"
            rx="3"
            fill="#0A0A0A"
            stroke="#FF5A1F"
            strokeWidth="1"
          />

          {/* Ojos digitales iluminados (con animación de parpadeo) */}
          <g className="robot-eye">
            <rect x="15" y="19" width="5" height="5" rx="1.5" fill="#FF5A1F" />
            <rect x="28" y="19" width="5" height="5" rx="1.5" fill="#FF5A1F" />
          </g>

          {/* Rejilla de audio / Sonrisa tecnológica */}
          <line x1="17" y1="31" x2="31" y2="31" stroke="#FF5A1F" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="20" cy="31" r="0.75" fill="#FFFFFF" />
          <circle cx="24" cy="31" r="0.75" fill="#FFFFFF" />
          <circle cx="28" cy="31" r="0.75" fill="#FFFFFF" />

          {/* Cuello y soporte inferior */}
          <rect x="19" y="37" width="10" height="4" rx="1.5" fill="#333333" />
        </svg>
      </button>
    </div>
  );
}

export default RobotFloatingButton;
