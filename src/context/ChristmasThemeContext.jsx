import React, { createContext, useContext, useState, useEffect } from 'react';

const ChristmasThemeContext = createContext();

const STORAGE_KEY = 'urban_style_christmas_theme';

export const ChristmasThemeProvider = ({ children }) => {
  // Por defecto el modo navideño está activo; respeta si el usuario lo desactivó explícitamente
  const [isChristmasMode, setIsChristmasMode] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        return stored === 'true';
      }
    } catch {
      // Fallback
    }
    return true; // Activado por defecto para la temporada festiva
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isChristmasMode));
    } catch {
      // Fallback
    }

    if (isChristmasMode) {
      document.body.classList.add('theme-christmas');
    } else {
      document.body.classList.remove('theme-christmas');
    }

    return () => {
      document.body.classList.remove('theme-christmas');
    };
  }, [isChristmasMode]);

  const toggleChristmasMode = () => {
    setIsChristmasMode((prev) => !prev);
  };

  const enableChristmasMode = () => setIsChristmasMode(true);
  const disableChristmasMode = () => setIsChristmasMode(false);

  return (
    <ChristmasThemeContext.Provider
      value={{
        isChristmasMode,
        toggleChristmasMode,
        enableChristmasMode,
        disableChristmasMode
      }}
    >
      {children}
    </ChristmasThemeContext.Provider>
  );
};

export const useChristmasTheme = () => {
  const context = useContext(ChristmasThemeContext);
  if (!context) {
    throw new Error('useChristmasTheme debe usarse dentro de un ChristmasThemeProvider');
  }
  return context;
};

export default ChristmasThemeContext;
