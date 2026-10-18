import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

/** How far the card follows the finger, px. */
export const SWIPE_MAX_DISTANCE = 96;
/** The action runs when the card is let go this far along (a share of the distance above). */
export const SWIPE_FIRE_AT = 0.7;
/** A horizontal move of this many px makes it a swipe; a vertical one (before that) makes it a scroll of the page. */
const LOCK_AFTER = 6;
const GIVE_UP_AFTER = 8;
/** After a swipe the click that follows the lift of the finger is swallowed for this long, ms. */
const SWALLOW_CLICK_FOR = 400;

/** The side the finger goes to: `right` pulls the card to the right and shows what is at its left edge. */
export type SwipeSide = 'right' | 'left';

export interface UseSwipeOptions {
  /** `false` turns the gesture off (a list that is being selected from, a card with nothing to swipe to). */
  enabled: boolean;
  canRight: boolean;
  canLeft: boolean;
  /** The card was let go past the threshold. */
  onFire: (side: SwipeSide) => void;
}

export interface UseSwipe {
  /** The element that moves with the finger. */
  surfaceRef: RefObject<HTMLDivElement | null>;
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
}

interface Gesture {
  x: number;
  y: number;
  dx: number;
  locked: boolean;
}

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Pulling a card sideways with a finger (UI-14), the way a phone's mail list does: the card follows the finger up to
 * `SWIPE_MAX_DISTANCE` and shows the action under it; let go past `SWIPE_FIRE_AT` of the way and the action runs, let go before
 * and the card goes back. Nothing here is a library: pointer events and a `transform`.
 *
 * - Only a finger or a pen swipes (`pointerType`), never a mouse: on a computer there is the menu.
 * - A vertical move first is the page scrolling, and the gesture gives way to it (the surface has `touch-action: pan-y`, so
 *   the browser keeps the vertical pan and hands the horizontal one to us).
 * - A swipe is not a tap: the click that follows it is swallowed, so a link under the finger is not followed.
 * - The card moves by hand (its `style`), not through React state: it follows the finger at every move.
 * - **A gesture is never the only way** (WCAG 2.5.1): the list puts the swipe actions in the menu of the card too.
 */
export function useSwipe({ enabled, canRight, canLeft, onFire }: UseSwipeOptions): UseSwipe {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);

  const place = useCallback((dx: number, animate: boolean) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    surface.style.transition = animate && !reducedMotion() ? 'transform 160ms ease-out' : 'none';
    surface.style.transform = dx === 0 ? '' : `translateX(${dx}px)`;
  }, []);

  const swallowNextClick = useCallback(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const stop = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
    };
    surface.addEventListener('click', stop, { capture: true, once: true });
    window.setTimeout(() => surface.removeEventListener('click', stop, { capture: true }), SWALLOW_CLICK_FOR);
  }, []);

  const finish = useCallback(
    (cancelled: boolean) => {
      const current = gesture.current;
      gesture.current = null;
      if (!current) return;
      place(0, true);
      if (!current.locked) return;
      swallowNextClick();
      if (!cancelled && Math.abs(current.dx) >= SWIPE_MAX_DISTANCE * SWIPE_FIRE_AT) {
        const side: SwipeSide = current.dx > 0 ? 'right' : 'left';
        // A moment later, so that the card has started back before the action changes the page.
        window.setTimeout(() => onFire(side), 120);
      }
    },
    [onFire, place, swallowNextClick],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || !event.isPrimary || event.pointerType === 'mouse') return;
      // The buttons of the card keep their own press: a finger that starts on one is not starting a swipe.
      if ((event.target as HTMLElement).closest('[data-no-swipe]')) return;
      gesture.current = { x: event.clientX, y: event.clientY, dx: 0, locked: false };
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = gesture.current;
      if (!current) return;
      const moveX = event.clientX - current.x;
      const moveY = event.clientY - current.y;
      if (!current.locked) {
        if (Math.abs(moveY) > GIVE_UP_AFTER && Math.abs(moveY) > Math.abs(moveX)) {
          gesture.current = null;
          return;
        }
        if (Math.abs(moveX) <= LOCK_AFTER || Math.abs(moveX) < Math.abs(moveY)) return;
        current.locked = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      let dx = Math.max(-SWIPE_MAX_DISTANCE, Math.min(SWIPE_MAX_DISTANCE, moveX));
      if ((dx > 0 && !canRight) || (dx < 0 && !canLeft)) dx = 0;
      current.dx = dx;
      place(dx, false);
    },
    [canLeft, canRight, place],
  );

  const onPointerUp = useCallback(() => finish(false), [finish]);
  const onPointerCancel = useCallback(() => finish(true), [finish]);

  return { surfaceRef, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
