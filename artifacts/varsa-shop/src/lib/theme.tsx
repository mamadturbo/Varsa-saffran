import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// The previous default was automatically saved as light, even without a choice.
const STORAGE_KEY = 'varsa-theme-v2';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* Keep the default when browser storage is unavailable. */ }
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(getInitialTheme()), []);

  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Private storage can be unavailable. */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F3E8D2' : '#15171C');
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme: theme ?? 'dark', toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
