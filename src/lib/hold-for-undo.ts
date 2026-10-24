import { useSyncExternalStore } from 'react';
import { toastUndo } from '@/lib/toast-undo';

/**
 * An action held back for the six seconds of «Annulla» (`toastUndo` with `commit`): for what cannot be taken back once it is
 * done, such as an e-mail to a tenant or a payment the landlord declares. `toastUndo` leaves two things to the page, done here once:
 *
 * - while an action waits, leaving the page for good (closing the tab, reloading) asks first, so what the person asked for is
 *   not lost in silence;
 * - what waits is known (`useHeldKeys`), so the same action is not started twice before the first one has gone.
 */

let held: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

const askBeforeLeaving = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  // Older browsers only ask when the event carries a value.
  event.returnValue = '';
};

function setHeld(next: ReadonlySet<string>) {
  const wasWaiting = held.size > 0;
  held = next;
  if (!wasWaiting && next.size > 0) window.addEventListener('beforeunload', askBeforeLeaving);
  if (wasWaiting && next.size === 0) window.removeEventListener('beforeunload', askBeforeLeaving);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getHeld = () => held;

/** The keys of the actions that wait for their six seconds to pass. */
export function useHeldKeys(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getHeld, getHeld);
}

export interface HoldForUndoOptions {
  /** What is held, as the page names it (`reminder:<id>`): the same key cannot wait twice. */
  key: string;
  /** What the toast says while it waits, already translated: it does not say the thing is done. */
  message: string;
  description?: string;
  /** What is done when the six seconds pass without «Annulla». A failure is told by the toast (`toastUndo` reports it). */
  commit: () => Promise<void>;
}

/** Holds `commit` back with a toast offering «Annulla». `false` (and nothing started) when the same key is already waiting. */
export function holdForUndo({ key, message, description, commit }: HoldForUndoOptions): boolean {
  if (held.has(key)) return false;
  setHeld(new Set(held).add(key));

  const release = () => {
    const next = new Set(held);
    next.delete(key);
    setHeld(next);
  };

  toastUndo(message, {
    description,
    // «Annulla» drops it: nothing was done, so there is nothing to take back.
    undo: release,
    commit: async () => {
      try {
        await commit();
      } finally {
        release();
      }
    },
  });
  return true;
}
