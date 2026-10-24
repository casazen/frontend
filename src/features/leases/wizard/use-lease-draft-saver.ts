import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { leasesApi } from '@/api/leases.api';
import { getProblemCode } from '@/lib/api-errors';
import type { LeaseDraftSaved, LeaseOrigin } from '@/types';
import { stepPayload, type DataStep, type SentParties, type WizardValues } from './wizard-model';

/** A change is sent this long after the last one, so a word typed letter by letter is one save. */
const SAVE_DELAY_MS = 350;

/**
 * Where the saving stands, for the person (`aria-live`): nothing yet, a change waiting or on its way, saved, not saved (it will be
 * tried again), or stopped for good because the draft changed somewhere else (`conflict`) or is not a draft any more (`gone`).
 */
export type DraftSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict' | 'gone';

export interface SavedStep {
  step: DataStep;
  saved: LeaseDraftSaved;
  /** The rows sent, for the step of the parties. */
  parties?: SentParties;
}

interface SaverOptions {
  leaseId: string;
  /** The version the draft was read on. */
  version: number;
  origin: LeaseOrigin;
  /** The form as it is now: the saver sends what the form holds when it sends, not what it held when the change was queued. */
  getValues: () => WizardValues;
  onSaved: (result: SavedStep) => void;
}

function problemCodeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

/**
 * Saves the draft of a lease on the server while it is typed (`PATCH /leases/:id/draft`): a change is queued by step, sent after a
 * short pause, one request at a time, and the last value typed wins. Every request carries the version of the draft; the answer gives
 * the next one. A value that is wrong is saved all the same (the server says what is missing). When the version is stale (another
 * tab or device saved first, `lease_draft_conflict`) nothing is written, saving stops and `status` says `conflict`: the person
 * reloads the draft, nothing is overwritten. Leaving the page sends what is still waiting.
 */
export function useLeaseDraftSaver({ leaseId, version, origin, getValues, onSaved }: SaverOptions) {
  const [status, setStatus] = useState<DraftSaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const latest = useRef({ leaseId, origin, getValues, onSaved });
  useEffect(() => {
    latest.current = { leaseId, origin, getValues, onSaved };
  });

  const versionRef = useRef(version);
  const waiting = useRef(new Set<DataStep>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const stopped = useRef(false);

  /**
   * A stale version or a lease that is not a draft any more stops the saving for good (and says so in `status`): true for those two.
   * Any other error is a save that will be tried again.
   */
  const stopOn = useCallback((error: unknown): boolean => {
    const code = problemCodeOf(error);
    if (code !== 'lease_draft_conflict' && code !== 'lease_not_draft') return false;
    stopped.current = true;
    setStatus(code === 'lease_draft_conflict' ? 'conflict' : 'gone');
    return true;
  }, []);

  /** Sends every step that is waiting, lowest first, until none is; false at the first request that fails (it stays waiting). */
  const drain = useCallback(async (): Promise<boolean> => {
    if (stopped.current) return false;
    if (waiting.current.size === 0) return true;
    setStatus('saving');
    while (waiting.current.size > 0) {
      const step = Math.min(...waiting.current) as DataStep;
      waiting.current.delete(step);
      const { leaseId: id, origin: leaseOrigin, getValues: read, onSaved: done } = latest.current;
      const payload = stepPayload(step, read(), leaseOrigin);
      try {
        const saved = await leasesApi.saveDraft(id, { version: versionRef.current, step, values: payload.values });
        versionRef.current = saved.version;
        done({ step, saved, parties: payload.parties });
      } catch (error) {
        waiting.current.add(step);
        if (!stopOn(error)) setStatus('error');
        return false;
      }
    }
    setStatus('saved');
    setSavedAt(Date.now());
    return true;
  }, [stopOn]);

  const run = useCallback(() => {
    chain.current = chain.current.then(drain, drain);
    return chain.current;
  }, [drain]);

  /** A change in `step`: it is sent after the pause. */
  const queue = useCallback(
    (step: DataStep) => {
      if (stopped.current) return;
      waiting.current.add(step);
      setStatus('pending');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(), SAVE_DELAY_MS);
    },
    [run],
  );

  /** Sends what is waiting now and says whether everything is saved. */
  const flush = useCallback((): Promise<boolean> => {
    clearTimeout(timer.current);
    return run();
  }, [run]);

  /** The version after a change made outside the saver (the confirmation of the review): the next save is made on it. */
  const adopt = useCallback((next: number) => {
    versionRef.current = next;
  }, []);

  /** The version the next save, or the confirmation of the review, is made on. */
  const getVersion = useCallback(() => versionRef.current, []);

  // Leaving the page (or the step of another draft) sends what is waiting; nothing typed is lost.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (waiting.current.size > 0 && !stopped.current) void run();
    },
    [run],
  );

  // A change that is not saved yet is not lost silently when the tab is closed.
  const unsaved = status === 'pending' || status === 'saving' || status === 'error';
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  return { status, savedAt, queue, flush, adopt, getVersion, stopOn };
}
