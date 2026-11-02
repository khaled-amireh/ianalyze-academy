import { useState, type PropsWithChildren } from 'react';
import { ThemeContext } from '@/lib/theme-context';
import { readPreference, savePreference } from '@/lib/preferences';
import { DEFAULT_THEME, THEME_KEY } from '@/app/config';
import type { Theme } from '@/types/preferences';

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, updateTheme] = useState<Theme>(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : DEFAULT_THEME;
    const initial = readPreference(THEME_KEY, ['light', 'dark'] as const, systemTheme);
    apply(initial);
    return initial;
  });
  const setTheme = (next: Theme) => {
    apply(next);
    savePreference(THEME_KEY, next);
    updateTheme(next);
  };
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
