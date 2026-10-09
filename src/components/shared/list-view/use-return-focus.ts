import { useCallback, useRef } from 'react';

/**
 * Where the focus goes when a panel of the list closes. Most panels are opened from a menu whose item has just left the page,
 * so "the button that opened it" is the button of the menu, which the caller says (`remember`). Give `onCloseAutoFocus` to the
 * content of the dialog or the sheet: when the element is still there the focus goes back to it, and when it is not the
 * dialog does what it does by itself.
 */
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
