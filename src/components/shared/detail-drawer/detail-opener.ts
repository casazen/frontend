/**
 * Who opened the drawer, so that the focus goes back to it when the drawer closes (UI-15). The element cannot travel in the
 * address, and the hook that opens the drawer and the host that closes it are not the same component, so it is kept here.
 * There is one drawer at a time, so one element.
 */
let opener: HTMLElement | null = null;

/** The element that has the focus now, unless it is the page itself. */
export function focusedElement(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

export function rememberOpener(element: HTMLElement | null) {
  opener = element;
}

/** The element to give the focus back to, and forget it: only if it is still on the page. */
export function takeOpener(): HTMLElement | null {
  const element = opener;
  opener = null;
  return element?.isConnected ? element : null;
}
