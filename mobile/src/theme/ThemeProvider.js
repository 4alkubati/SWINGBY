import React, { createContext, useContext } from 'react';
import { colors, spacing, radius, shadows, motion } from './tokens';
import { typeScale } from './typography';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const theme = { colors, spacing, radius, shadows, motion, typeScale };
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
