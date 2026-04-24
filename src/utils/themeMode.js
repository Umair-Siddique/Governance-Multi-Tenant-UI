import { useEffect, useState } from 'react';

const STORAGE_KEY = 'governance-theme-mode';

function getPreferredTheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  if (typeof document === 'undefined') {
    return;
  }

  const rootElement = document.documentElement;
  const isDark = theme === 'dark';

  if (isDark) {
    rootElement.setAttribute('data-theme', 'dark');
    rootElement.classList.add('dark');
  } else {
    rootElement.removeAttribute('data-theme');
    rootElement.classList.remove('dark');
  }

  rootElement.style.colorScheme = isDark ? 'dark' : 'light';
}

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState(getPreferredTheme);

  useEffect(() => {
    applyTheme(themeMode);
    window.localStorage.setItem(STORAGE_KEY, themeMode);
  }, [themeMode]);

  return {
    themeMode,
    isDark: themeMode === 'dark',
    toggleTheme: () => setThemeMode((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark')),
  };
}
