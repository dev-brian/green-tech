import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

/** Botón sol/luna de 48 px para cambiar entre modo claro y oscuro. */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
    >
      {isDark ? (
        <Sun size={20} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Moon size={20} strokeWidth={1.75} aria-hidden="true" />
      )}
    </button>
  );
}
