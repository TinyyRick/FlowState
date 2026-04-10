import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T | (() => T), debounceMs: number = 500) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        return JSON.parse(item);
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
    return initialValue instanceof Function ? initialValue() : initialValue;
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [key, value, debounceMs]);

  return [value, setValue] as const;
}