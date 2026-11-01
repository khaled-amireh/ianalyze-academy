import { createContext } from 'react';
import type { Theme } from '@/types/preferences';

export const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);
