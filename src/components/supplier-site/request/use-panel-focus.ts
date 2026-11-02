import { useEffect, useRef } from 'react';

/** A panel that opens in the page takes the focus on its title, so a keyboard or a screen reader lands on it. */
export function usePanelFocus() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
