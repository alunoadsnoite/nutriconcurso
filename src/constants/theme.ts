/**
 * Tokens visuais. Contraste conferido contra WCAG AA em ambos os temas:
 * texto principal 15.4:1 (claro) e 15.9:1 (escuro); secundário 6.2:1 e 8.6:1;
 * texto sobre a cor de destaque 5.5:1 e 5.8:1.
 */

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentText: string;
  error: string;
  errorSurface: string;
}

export const lightTheme: ThemeColors = {
  background: "#F4F7F7",
  surface: "#FFFFFF",
  surfaceAlt: "#E8F0EF",
  border: "#CFDCDB",
  text: "#12211F",
  textSecondary: "#4C605D",
  accent: "#0F766E",
  accentText: "#FFFFFF",
  error: "#9B2226",
  errorSurface: "#FCE9E9",
};

export const darkTheme: ThemeColors = {
  background: "#0E1513",
  surface: "#16211F",
  surfaceAlt: "#1E2C29",
  border: "#2C3D3A",
  text: "#E7F0EE",
  textSecondary: "#A3B5B2",
  accent: "#3FA79C",
  accentText: "#06211E",
  error: "#F2A0A0",
  errorSurface: "#2A1616",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
