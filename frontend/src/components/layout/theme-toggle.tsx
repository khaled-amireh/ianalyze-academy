import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const label = t(theme === 'light' ? 'common.switchDark' : 'common.switchLight');
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="theme-toggle"
      data-theme-state={theme}
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label={label}
      title={label}
    >
      <Moon className="theme-icon theme-icon-moon" aria-hidden="true" />
      <Sun className="theme-icon theme-icon-sun" aria-hidden="true" />
    </Button>
  );
}
