import { useEffect, useState } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const readValue = (): T => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  };

  const [value, setValue] = useState<T>(readValue);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore write errors (private mode, quota, etc.)
    }
  }, [key, value]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        setValue(e.newValue ? (JSON.parse(e.newValue) as T) : initialValue);
      } catch {
        // Ignore parse errors from external changes
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [value, setValue] as const;
}


