import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

describe('hooks/useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes from localStorage or falls back to initial value', () => {
    localStorage.setItem('k', JSON.stringify(123));
    const { result: r1 } = renderHook(() => useLocalStorage<number>('k', 0));
    expect(r1.current[0]).toBe(123);

    const { result: r2 } = renderHook(() => useLocalStorage<number>('k2', 7));
    expect(r2.current[0]).toBe(7);
  });

  it('persists updates to localStorage and reacts to storage events', () => {
    const { result } = renderHook(() => useLocalStorage('key', 1));
    act(() => {
      result.current[1](2);
    });
    expect(JSON.parse(localStorage.getItem('key') as string)).toBe(2);

    // simulate external storage change
    const e = new StorageEvent('storage', { key: 'key', newValue: JSON.stringify(5) });
    act(() => {
      window.dispatchEvent(e);
    });
    expect(result.current[0]).toBe(5);
  });
});


