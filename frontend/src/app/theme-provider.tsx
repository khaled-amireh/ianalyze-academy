import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
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
  const transitionTimer = useRef<number | undefined>(undefined);
  const [theme, updateTheme] = useState<Theme>(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : DEFAULT_THEME;
    const initial = readPreference(THEME_KEY, ['light', 'dark'] as const, systemTheme);
    apply(initial);
    return initial;
  });
  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const syncPreference = () => {
      const next = readPreference(
        THEME_KEY,
        ['light', 'dark'] as const,
        system.matches ? 'dark' : DEFAULT_THEME,
      );
      apply(next);
      updateTheme(next);
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) syncPreference();
    };
    system.addEventListener('change', syncPreference);
    window.addEventListener('storage', syncStorage);
    return () => {
      system.removeEventListener('change', syncPreference);
      window.removeEventListener('storage', syncStorage);
      window.clearTimeout(transitionTimer.current);
      document.documentElement.classList.remove('theme-changing');
    };
  }, []);
  const setTheme = (next: Theme) => {
    window.clearTimeout(transitionTimer.current);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('theme-changing');
      transitionTimer.current = window.setTimeout(() => {
        document.documentElement.classList.remove('theme-changing');
      }, 220);
    }
    apply(next);
    savePreference(THEME_KEY, next);
    updateTheme(next);
  };
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
