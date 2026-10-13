import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { toastUndo, UNDO_WINDOW_MS } from '../toast-undo';

vi.mock('sonner', () => {
  const show = vi.fn(() => 'shown');
  return {
    toast: Object.assign(vi.fn(), { success: show, info: vi.fn(() => 'shown'), error: vi.fn(), dismiss: vi.fn() }),
  };
});

type ToastData = {
  id: string | number;
  description?: string;
  duration: number;
  action: { label: string; onClick: () => void };
  classNames?: { actionButton?: string };
  onDismiss?: () => void;
};

/** What the last call to `toast.success` / `toast.info` was given. */
function lastCall(kind: 'success' | 'info' = 'success') {
  const calls = vi.mocked(toast[kind]).mock.calls;
  const [message, data] = calls[calls.length - 1] as unknown as [string, ToastData];
  return { message, data };
}

/** Lets the promises that the toast starts finish. */
const settle = () => vi.advanceTimersByTimeAsync(0);

function problem(status: number, detail: string): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { status, title: 'Errore', detail },
  } as AxiosResponse);
}

describe('toastUndo (UI-07)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('the toast', () => {
    it('toastUndo_Default_ShowsTheMessageWithAnAnnullaActionForSixSeconds', () => {
      toastUndo('Immobile messo in pausa', { undo: vi.fn() });

      const { message, data } = lastCall();
      expect(message).toBe('Immobile messo in pausa');
      expect(data.action.label).toBe('Annulla');
      expect(data.duration).toBe(UNDO_WINDOW_MS);
      expect(UNDO_WINDOW_MS).toBe(6000);
    });

    it('toastUndo_Default_TheButtonOfTheLibraryGetsAnInvisibleTargetOf44Px', () => {
      toastUndo('Fatto', { undo: vi.fn() });

      // 24 px of button and 10 px of box above and below it.
      expect(lastCall().data.classNames?.actionButton).toContain('after:-inset-y-2.5');
    });

    it('toastUndo_InEnglish_TheActionIsUndo', async () => {
      await i18n.changeLanguage('en');

      toastUndo('Property paused', { undo: vi.fn() });

      expect(lastCall().data.action.label).toBe('Undo');
    });

    it('toastUndo_Tone_Info_ShowsAnInfoToast', () => {
      toastUndo('Archiviato', { undo: vi.fn(), tone: 'info' });

      expect(lastCall('info').message).toBe('Archiviato');
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('toastUndo_DescriptionDurationAndId_ArePassedOn', () => {
      const id = toastUndo('Fatto', { undo: vi.fn(), description: 'Lo ritrovi in archivio', duration: 3000, id: 'mine' });

      const { data } = lastCall();
      expect(data.description).toBe('Lo ritrovi in archivio');
      expect(data.duration).toBe(3000);
      expect(data.id).toBe('mine');
      expect(id).toBe('shown');
    });

    it('toastUndo_NoId_EachToastGetsItsOwn', () => {
      toastUndo('Uno', { undo: vi.fn() });
      const first = lastCall().data.id;
      toastUndo('Due', { undo: vi.fn() });

      expect(lastCall().data.id).not.toBe(first);
    });
  });

  describe('Annulla', () => {
    it('toastUndo_ClickOnAnnulla_RunsTheInverseActionOnce', async () => {
      const undo = vi.fn();
      toastUndo('Fatto', { undo });

      lastCall().data.action.onClick();
      lastCall().data.action.onClick();
      await settle();

      expect(undo).toHaveBeenCalledTimes(1);
    });

    it('toastUndo_AsyncUndo_IsWaitedForAndNothingIsShownWhenItWorks', async () => {
      const undo = vi.fn().mockResolvedValue(undefined);
      toastUndo('Fatto', { undo });

      lastCall().data.action.onClick();
      await settle();

      expect(undo).toHaveBeenCalledTimes(1);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('toastUndo_UndoThatFails_TellsTheUserWithTheMessageOfTheServer', async () => {
      toastUndo('Fatto', { undo: vi.fn().mockRejectedValue(problem(409, 'Esiste già una prenotazione per quelle date.')) });

      lastCall().data.action.onClick();
      await settle();

      expect(toast.error).toHaveBeenCalledWith('Esiste già una prenotazione per quelle date.');
    });

    it('toastUndo_UndoThatFailsWithoutAMessage_SaysItCouldNotUndo', async () => {
      toastUndo('Fatto', { undo: vi.fn().mockRejectedValue(new Error('boom')) });

      lastCall().data.action.onClick();
      await settle();

      expect(toast.error).toHaveBeenCalledWith('Non è stato possibile annullare.');
    });

    it('toastUndo_UndoThatThrowsSynchronously_IsAlsoReported', async () => {
      toastUndo('Fatto', {
        undo: () => {
          throw new Error('sync boom');
        },
      });

      lastCall().data.action.onClick();
      await settle();

      expect(toast.error).toHaveBeenCalledWith('Non è stato possibile annullare.');
    });

    it('toastUndo_WithoutCommit_TheToastKeepsItsOwnTimerAndDoesNothingOnDismiss', async () => {
      toastUndo('Fatto', { undo: vi.fn() });

      expect(lastCall().data.onDismiss).toBeUndefined();
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
      expect(toast.dismiss).not.toHaveBeenCalled();
    });
  });

  describe('an action held back (commit)', () => {
    it('toastUndo_Commit_TheToastDoesNotTimeItselfOutBecauseTheWindowIsItsOwnTimer', () => {
      toastUndo('Archiviata', { undo: vi.fn(), commit: vi.fn() });

      expect(lastCall().data.duration).toBe(Number.POSITIVE_INFINITY);
    });

    it('toastUndo_Commit_IsDoneWhenTheWindowClosesAndTheToastIsDismissed', async () => {
      const commit = vi.fn();
      const undo = vi.fn();
      const id = 'held';
      toastUndo('Archiviata', { undo, commit, id });

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 1);
      expect(commit).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);

      expect(commit).toHaveBeenCalledTimes(1);
      expect(undo).not.toHaveBeenCalled();
      expect(toast.dismiss).toHaveBeenCalledWith(id);
    });

    it('toastUndo_Commit_UndoneInTime_ItIsNeverDone', async () => {
      const commit = vi.fn();
      const undo = vi.fn();
      toastUndo('Archiviata', { undo, commit });

      await vi.advanceTimersByTimeAsync(2000);
      lastCall().data.action.onClick();
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);

      expect(undo).toHaveBeenCalledTimes(1);
      expect(commit).not.toHaveBeenCalled();
    });

    it('toastUndo_Commit_ClosedOrSwipedAway_IsDoneAtOnceAndOnlyOnce', async () => {
      const commit = vi.fn();
      toastUndo('Archiviata', { undo: vi.fn(), commit });

      lastCall().data.onDismiss?.();
      lastCall().data.onDismiss?.();
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);

      expect(commit).toHaveBeenCalledTimes(1);
    });

    it('toastUndo_Commit_UndoAfterTheWindow_DoesNothing', async () => {
      const commit = vi.fn();
      const undo = vi.fn();
      toastUndo('Archiviata', { undo, commit });
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

      lastCall().data.action.onClick();
      await settle();

      expect(commit).toHaveBeenCalledTimes(1);
      expect(undo).not.toHaveBeenCalled();
    });

    it('toastUndo_Commit_CustomWindow_IsRespected', async () => {
      const commit = vi.fn();
      toastUndo('Archiviata', { undo: vi.fn(), commit, duration: 2000 });

      await vi.advanceTimersByTimeAsync(1999);
      expect(commit).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(commit).toHaveBeenCalledTimes(1);
    });

    it('toastUndo_CommitThatFails_TellsTheUser', async () => {
      toastUndo('Archiviata', { undo: vi.fn(), commit: vi.fn().mockRejectedValue(new Error('boom')) });

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

      expect(toast.error).toHaveBeenCalledWith("Non è stato possibile completare l'operazione.");
    });
  });
});
