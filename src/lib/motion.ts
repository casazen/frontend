export const PRESS_FEEDBACK =
  'motion-safe:active:scale-[0.97] aria-disabled:active:scale-100 disabled:active:scale-100';

export const TILE_PRESS_FEEDBACK = 'motion-safe:active:scale-[0.985]';

/**
 * A card that opens something: it lifts under the pointer (a mouse; on a phone the press is enough). The lift is a shadow that
 * fades, so the focus of the card must not be a shadow too (`ring-*`): a focus ring that fades in is late for the keyboard.
 * Give the card `focus-visible:outline-2 focus-visible:outline-ring`.
 */
export const CARD_LIFT =
  'transition-[box-shadow,scale,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] [@media(hover:hover)]:hover:shadow-[var(--cz-shadow-hover)] motion-safe:active:scale-[0.99]';

export function entranceMotionAllowed(win: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (!win) return false;
  if (win.navigator?.webdriver) return false;
  if (typeof win.matchMedia !== 'function') return false;
  return win.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

export function enableEntranceMotion(win: Window | undefined = typeof window === 'undefined' ? undefined : window): void {
  if (!win || !entranceMotionAllowed(win)) return;
  win.document.documentElement.dataset.motion = 'on';
}

export function fadeInPage(element: HTMLElement | null): void {
  if (!element || typeof element.animate !== 'function') return;
  if (element.ownerDocument.documentElement.dataset.motion !== 'on') return;
  element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
}
