/**
 * The motion of the app (UX round of 2026-11, `styles/motion.css`).
 *
 * Feedback (the press of a button or of a tile, the lift of a card) is plain Tailwind and runs whenever the user allows
 * motion. Entrances (a page that arrives, a wizard step, the one highlighted block) start transparent, so they need a yes
 * from here: the user allows motion and the page is not driven by a browser automation (the end-to-end tests check the
 * contrast with axe and take screenshots; a half transparent page in the middle of a fade would fail them at random).
 */

/** Press feedback for a button: it sinks a little under the finger and comes back (not while it is disabled or busy). */
export const PRESS_FEEDBACK =
  'motion-safe:active:scale-[0.97] aria-disabled:active:scale-100 disabled:active:scale-100';

/** Press feedback for a tile or a card that is chosen or opened: less than a button, it is bigger. */
export const TILE_PRESS_FEEDBACK = 'motion-safe:active:scale-[0.985]';

/** A card that opens something: it lifts under the pointer (a mouse; on a phone the press is enough). */
export const CARD_LIFT =
  'transition-[box-shadow,scale,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] [@media(hover:hover)]:hover:shadow-[var(--cz-shadow-hover)] motion-safe:active:scale-[0.99]';

/** Whether the entrances may run: the user allows motion and no automation drives the page. */
export function entranceMotionAllowed(win: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (!win) return false;
  if (win.navigator?.webdriver) return false;
  if (typeof win.matchMedia !== 'function') return false;
  return win.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

/** At start: says to the style sheet that the entrances may run (`html[data-motion]`). */
export function enableEntranceMotion(win: Window | undefined = typeof window === 'undefined' ? undefined : window): void {
  if (!win || !entranceMotionAllowed(win)) return;
  win.document.documentElement.dataset.motion = 'on';
}

/**
 * The page that has just opened fades in (a page change of the shell, `RouteFocus`). Opacity only: a transform on the content
 * region would move, for the time of the fade, what is fixed inside it (the primary action of a phone, above the bottom bar).
 */
export function fadeInPage(element: HTMLElement | null): void {
  if (!element || typeof element.animate !== 'function') return;
  if (element.ownerDocument.documentElement.dataset.motion !== 'on') return;
  element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
}
