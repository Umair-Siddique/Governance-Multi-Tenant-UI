import React from 'react';
import { useThemeMode } from '../../utils/themeMode';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useThemeMode();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="inline-flex items-center gap-2 rounded-md border border-border-default bg-background-surface px-3 py-2 text-sm font-medium text-text-primary shadow-sm transition-colors hover:bg-background-subtle"
    >
      <span aria-hidden="true">{isDark ? '☀' : '🌙'}</span>
      <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}
