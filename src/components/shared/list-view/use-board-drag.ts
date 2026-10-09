import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

/** A card that has moved less than this many px since the press has not been picked up: it was a click. */
const PICK_UP_AFTER = 5;
/** Near the edge of the board, within this many px, it scrolls by itself so that a card can reach the columns beyond. */
const EDGE = 56;
const EDGE_SPEED = 14;
/** Whatever is interactive inside a card is not a handle to drag it by. */
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="menuitem"], [data-no-drag]';

export interface UseBoardDragOptions {
  /** `false` turns dragging off; the cards can still be moved with their menu. */
  enabled: boolean;
  /** The element that scrolls sideways (the board), to scroll it when a card is held near its edge. */
  boardRef: RefObject<HTMLElement | null>;
  /** A card (its key) was let go over a column other than the one it came from. */
  onDrop: (rowKey: string, toColumn: string, fromColumn: string | undefined) => void;
}

export interface UseBoardDrag {
  /** The key of the card being dragged, `null` when none is. */
  dragging: string | null;
  /** The column the card is over now. */
  over: string | null;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

interface Hold {
  key: string;
  card: HTMLElement;
  fromColumn: string | undefined;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  ghost: HTMLElement | null;
}

function columnAt(x: number, y: number): string | null {
  // jsdom has no layout, hence no elementFromPoint: there is nothing under a pointer there.
  const element = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null;
  return element?.closest<HTMLElement>('[data-board-column]')?.dataset.boardColumn ?? null;
}

/**
 * Dragging a card from a column to another with the mouse or a pen (UI-14), in pointer events and nothing else: a ghost of
 * the card follows the pointer, the column it is over is lit, and letting go there moves it. It needs no library.
 *
 * - A finger does not drag: on a phone the board scrolls sideways and the page scrolls down, and a drag would take both away.
 *   There the card has its menu, "Sposta in…", which is also what a keyboard and a screen reader use.
 * - A press on a link, a button or a box inside the card is theirs, not a drag.
 * - Escape puts the card back; so does letting go outside a column.
 * - The click that follows a drag is swallowed, so a card dropped on its own title does not open.
 */
export function useBoardDrag({ enabled, boardRef, onDrop }: UseBoardDragOptions): UseBoardDrag {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const drop = useRef(onDrop);
  useEffect(() => {
    drop.current = onDrop;
  });
  // Whatever is running when the board goes away (a page left in the middle of a drag) is put away.
  const abort = useCallback(() => cleanup.current?.(), []);
  useEffect(() => abort, [abort]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0 || (event.pointerType !== 'mouse' && event.pointerType !== 'pen')) return;
      const target = event.target as HTMLElement;
      const card = target.closest<HTMLElement>('[data-board-card]');
      if (!card || target.closest(INTERACTIVE)) return;
      cleanup.current?.();

      const box = card.getBoundingClientRect();
      const hold: Hold = {
        key: card.dataset.boardCard ?? '',
        card,
        fromColumn: card.closest<HTMLElement>('[data-board-column]')?.dataset.boardColumn,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - box.left,
        offsetY: event.clientY - box.top,
        ghost: null,
      };

      const move = (moveEvent: PointerEvent) => {
        if (!hold.ghost) {
          if (Math.hypot(moveEvent.clientX - hold.startX, moveEvent.clientY - hold.startY) < PICK_UP_AFTER) return;
          const ghost = hold.card.cloneNode(true) as HTMLElement;
          ghost.removeAttribute('data-board-card');
          ghost.setAttribute('data-board-ghost', '');
          ghost.setAttribute('aria-hidden', 'true');
          // Two elements with the same id would be a mistake on the page, and the ghost is only a picture: it has no ids, no test ids.
          for (const element of [ghost, ...ghost.querySelectorAll('[id], [data-testid]')]) {
            element.removeAttribute('id');
            element.removeAttribute('data-testid');
          }
          Object.assign(ghost.style, {
            position: 'fixed',
            left: '0',
            top: '0',
            width: `${box.width}px`,
            zIndex: '60',
            pointerEvents: 'none',
            opacity: '0.92',
            boxShadow: '0 10px 30px rgb(0 0 0 / 0.25)',
            cursor: 'grabbing',
          });
          document.body.appendChild(ghost);
          document.body.style.userSelect = 'none';
          hold.ghost = ghost;
          setDragging(hold.key);
        }
        if (hold.ghost) hold.ghost.style.transform = `translate(${moveEvent.clientX - hold.offsetX}px, ${moveEvent.clientY - hold.offsetY}px)`;
        setOver(columnAt(moveEvent.clientX, moveEvent.clientY));

        const board = boardRef.current;
        if (board) {
          const edges = board.getBoundingClientRect();
          if (moveEvent.clientX < edges.left + EDGE) board.scrollLeft -= EDGE_SPEED;
          else if (moveEvent.clientX > edges.right - EDGE) board.scrollLeft += EDGE_SPEED;
        }
      };

      const stop = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('keydown', onKey);
        hold.ghost?.remove();
        document.body.style.userSelect = '';
        setDragging(null);
        setOver(null);
        cleanup.current = null;
      };

      const swallowClick = () => {
        const swallow = (clickEvent: Event) => {
          clickEvent.stopPropagation();
          clickEvent.preventDefault();
        };
        window.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 300);
      };

      const up = (upEvent: PointerEvent) => {
        const picked = hold.ghost !== null;
        const column = picked ? columnAt(upEvent.clientX, upEvent.clientY) : null;
        stop();
        if (!picked) return;
        swallowClick();
        if (column && column !== hold.fromColumn) drop.current(hold.key, column, hold.fromColumn);
      };
      const cancel = () => stop();
      const onKey = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === 'Escape') stop();
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('keydown', onKey);
      cleanup.current = stop;
    },
    [boardRef, enabled],
  );

  return { dragging, over, onPointerDown };
}
