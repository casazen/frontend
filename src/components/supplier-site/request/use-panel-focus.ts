import { useEffect, useRef } from 'react';

export function usePanelFocus() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
