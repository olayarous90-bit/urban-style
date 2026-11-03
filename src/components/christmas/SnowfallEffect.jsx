import React, { useMemo } from 'react';
import { useChristmasTheme } from '../../context/ChristmasThemeContext';
import './SnowfallEffect.css';

/**
 * Efecto de nieve sutil y elegante para URBAN STYLE
 * No interfiere con clics ni bloquea la navegación (pointer-events: none)
 * Flotación suave y optimizada para no sobrecargar el rendimiento ni la CPU
 */
export const SnowfallEffect = () => {
  const { isChristmasMode } = useChristmasTheme();

  // Generamos un conjunto fijo de copos con variaciones orgánicas
  const flakes = useMemo(() => {
    const items = [];
    const count = 35; // Cantidad moderada y elegante
    for (let i = 0; i < count; i++) {
      const left = Math.random() * 100;
      const animationDuration = 7 + Math.random() * 10; // entre 7s y 17s
      const animationDelay = -(Math.random() * 15); // arranque distribuido
      const size = 3 + Math.random() * 5; // 3px a 8px
      const opacity = 0.25 + Math.random() * 0.55;
      const drift = -20 + Math.random() * 40; // oscilación horizontal en px

      items.push({
        id: i,
        left: `${left}%`,
        duration: `${animationDuration.toFixed(1)}s`,
        delay: `${animationDelay.toFixed(1)}s`,
        size: `${size.toFixed(1)}px`,
        opacity: opacity.toFixed(2),
        drift: `${drift.toFixed(0)}px`
      });
    }
    return items;
  }, []);

  if (!isChristmasMode) return null;

  return (
    <div className="snowfall-canvas-container" aria-hidden="true">
      {flakes.map((f) => (
        <span
          key={f.id}
          className="snowflake-particle"
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animationDuration: f.duration,
            animationDelay: f.delay,
            '--drift-x': f.drift
          }}
        />
      ))}
    </div>
  );
};

export default SnowfallEffect;
