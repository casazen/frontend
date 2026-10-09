import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

/** How long the user has to change their mind: long enough to read the toast, take in the word "Annulla" and reach it. */
export const UNDO_WINDOW_MS = 6000;

export interface ToastUndoOptions {
  /**
   * What takes the action back. **Required, and it has to be true.** Either the inverse of what was just done, which really
   * restores the state before (`activate` after a `pause`; not "hide the row on the screen"), or, for an action that was
   * held back (`commit`), what drops it. A toast that says "Annulla" and does not undo is worse than no toast: it makes a
   * promise to a person who is about to rely on it.
   */
  undo: () => void | Promise<void>;
  /**
   * For an action that has **not happened yet**: it is done, exactly once, when the window closes and the user did not
   * undo (the time ran out, or they closed or swiped the toast away). Then `undo` only has to drop it, e.g. put the row
   * back in the list. The catch: if the page is closed within the window the action is lost. For what must not be lost,
   * do it at once and give `undo` the inverse call instead.
   */
  commit?: () => void | Promise<void>;
  /** A second line under the message. */
  description?: string;
  /** The look of the toast: the action was done (default), or it is only a notice. */
  tone?: 'success' | 'info';
  /** Default {@link UNDO_WINDOW_MS}. */
  duration?: number;
  /** To replace or dismiss it later, or to avoid two of the same toast. */
  id?: string | number;
}

let counter = 0;

/** Tells the user that something failed in what runs behind the toast, with the message of the server if it sent one. */
function reportFailure(error: unknown, fallbackKey: 'toastUndo.undoFailed' | 'toastUndo.commitFailed') {
  toast.error(getProblemMessage(error, i18n.t) ?? i18n.t(fallbackKey));
}

/**
 * A toast with a word on it, "Annulla" (UI-07): for an action the user just did that can be taken back, instead of a
 * dialog that asks "are you sure?" before every one. The demo does the same: reversible actions get an undo toast,
 * destructive ones get `ConfirmationDialog`.
 *
 * The contract, because a false undo is a lie:
 * 1. `undo` is required. It does what it says, on the server too, not only on the screen.
 * 2. The window is {@link UNDO_WINDOW_MS} (about six seconds). The toast does not outlive it, and nobody can undo after it.
 * 3. Either the action is already done and `undo` is its inverse, or it has not happened and `commit` does it when the
 *    window closes (see {@link ToastUndoOptions.commit}). There is no third kind.
 * 4. If `undo` or `commit` fails, the user is told (an error toast with the message of the server): never silence.
 *
 * Where the toast appears is not its business: `AppToaster` puts it at the bottom, above the bar and the fixed action of
 * the page, on a phone. Returns the id of the toast.
 */
export function toastUndo(message: string, options: ToastUndoOptions): string | number {
  const { undo, commit, description, tone = 'success', duration = UNDO_WINDOW_MS } = options;
  const id = options.id ?? `toast-undo-${++counter}`;

  // `settled`: the question has been answered, one way or the other, and nothing else may run.
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const runUndo = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    void Promise.resolve()
      .then(undo)
      .catch((error: unknown) => reportFailure(error, 'toastUndo.undoFailed'));
  };

  const runCommit = () => {
    if (settled || !commit) return;
    settled = true;
    clearTimeout(timer);
    void Promise.resolve()
      .then(commit)
      .catch((error: unknown) => reportFailure(error, 'toastUndo.commitFailed'));
  };

  if (commit) {
    // The toast does not time itself out (nor wait while the pointer is over it): the window is exactly this timer, so
    // the toast never offers "Annulla" for an action that was already done. Closing or swiping the toast away is the
    // user saying "go on", which is what the end of the window says too.
    timer = setTimeout(() => {
      runCommit();
      toast.dismiss(id);
    }, duration);
  }

  const data = {
    id,
    description,
    duration: commit ? Number.POSITIVE_INFINITY : duration,
    action: { label: i18n.t('toastUndo.undo'), onClick: runUndo },
    onDismiss: commit ? runCommit : undefined,
  };
  return tone === 'success' ? toast.success(message, data) : toast.info(message, data);
}
