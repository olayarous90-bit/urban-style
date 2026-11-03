import React from 'react';
import { useChristmasTheme } from '../../context/ChristmasThemeContext';
import './ChristmasLights.css';

/**
 * Guirnalda de luces navideñas elegantes para URBAN STYLE
 * Colores: Rojo Navideño, Dorado Festivo, Verde Pino y Blanco Nieve
 */
export const ChristmasLights = () => {
  const { isChristmasMode } = useChristmasTheme();

  if (!isChristmasMode) return null;

  // 24 bombillos distribuidos a lo largo del encabezado
  const lightColors = ['red', 'gold', 'green', 'white', 'red', 'gold', 'green', 'white'];
  const lights = Array.from({ length: 24 }).map((_, idx) => ({
    id: idx,
    color: lightColors[idx % lightColors.length]
  }));

  return (
    <div className="christmas-lights-strand" aria-hidden="true">
      <div className="lights-wire" />
      <ul className="lights-list">
        {lights.map((l) => (
          <li key={l.id} className={`light-bulb bulb-${l.color}`} />
        ))}
      </ul>
    </div>
  );
};

export default ChristmasLights;
