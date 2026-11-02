import { useEffect, useRef, useState, type RefObject } from 'react';

export interface Size {
  w: number;
  h: number;
}

/** The size of an element, kept up to date (it is 0 × 0 until the browser has laid the element out). */
export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, Size] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((old) => (Math.abs(old.w - width) < 1 && Math.abs(old.h - height) < 1 ? old : { w: Math.round(width), h: Math.round(height) }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}
