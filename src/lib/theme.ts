export type ThemeVariant = 'default' | 'kids' | 'contrast';

const THEME_KEY = 'app-theme-variant';
const REDUCE_MOTION_KEY = 'app-reduce-motion';

export function applyTheme(variant: ThemeVariant) {
  const root = document.documentElement;
  if (variant === 'default') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', variant);
  }
  try { localStorage.setItem(THEME_KEY, variant); } catch {}
}

export function getSavedTheme(): ThemeVariant {
  try {
    const v = localStorage.getItem(THEME_KEY) as ThemeVariant | null;
    return v ?? 'default';
  } catch {
    return 'default';
  }
}

export function applyReduceMotion(enabled: boolean) {
  const root = document.documentElement;
  if (enabled) root.setAttribute('data-reduce-motion', 'true');
  else root.removeAttribute('data-reduce-motion');
  try { localStorage.setItem(REDUCE_MOTION_KEY, enabled ? '1' : '0'); } catch {}
}

export function getSavedReduceMotion(): boolean {
  try {
    return localStorage.getItem(REDUCE_MOTION_KEY) === '1';
  } catch {
    return false;
  }
}

export function initThemeFromStorage() {
  const theme = getSavedTheme();
  const reduce = getSavedReduceMotion();
  applyTheme(theme);
  applyReduceMotion(reduce);
}


