import { useCallback, useRef } from 'react';

export function useReturnFocus() {
  const target = useRef<HTMLElement | null>(null);
  const remember = useCallback((element: HTMLElement | null) => {
    target.current = element;
  }, []);
  const onCloseAutoFocus = useCallback((event: Event) => {
    const element = target.current;
    if (element?.isConnected) {
      event.preventDefault();
      element.focus();
    }
  }, []);
  return { remember, onCloseAutoFocus };
}
