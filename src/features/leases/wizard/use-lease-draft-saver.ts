import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { leasesApi } from '@/api/leases.api';
import { getProblemCode } from '@/lib/api-errors';
import type { LeaseDraftSaved, LeaseOrigin } from '@/types';
import { stepPayload, type DataStep, type SentParties, type WizardValues } from './wizard-model';

const SAVE_DELAY_MS = 350;

/**
 * Where the saving stands, for the person (`aria-live`): nothing yet, a change waiting or on its way, saved, not saved (it will be
 * tried again), or stopped for good because the draft changed somewhere else (`conflict`) or is not a draft any more (`gone`).
 */
export type DraftSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict' | 'gone';

export interface SavedStep {
  step: DataStep;
  saved: LeaseDraftSaved;
  parties?: SentParties;
}

interface SaverOptions {
  leaseId: string;
  version: number;
  origin: LeaseOrigin;
  getValues: () => WizardValues;
  onSaved: (result: SavedStep) => void;
}

function problemCodeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

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
  const sending = useRef(false);

  const stopOn = useCallback((error: unknown): boolean => {
    const code = problemCodeOf(error);
    if (code !== 'lease_draft_conflict' && code !== 'lease_not_draft') return false;
    stopped.current = true;
    setStatus(code === 'lease_draft_conflict' ? 'conflict' : 'gone');
    return true;
  }, []);

  const drain = useCallback(async (): Promise<boolean> => {
    if (stopped.current) return false;
    if (waiting.current.size === 0) return true;
    setStatus('saving');
    while (waiting.current.size > 0) {
      const step = Math.min(...waiting.current) as DataStep;
      waiting.current.delete(step);
      const { leaseId: id, origin: leaseOrigin, getValues: read, onSaved: done } = latest.current;
      const payload = stepPayload(step, read(), leaseOrigin);
      sending.current = true;
      try {
        const saved = await leasesApi.saveDraft(id, { version: versionRef.current, step, values: payload.values });
        versionRef.current = saved.version;
        done({ step, saved, parties: payload.parties });
      } catch (error) {
        waiting.current.add(step);
        if (!stopOn(error)) setStatus('error');
        return false;
      } finally {
        sending.current = false;
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

  const flush = useCallback((): Promise<boolean> => {
    clearTimeout(timer.current);
    return run();
  }, [run]);

  const adopt = useCallback((next: number) => {
    versionRef.current = next;
  }, []);

  const getVersion = useCallback(() => versionRef.current, []);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (waiting.current.size > 0 && !stopped.current) void run();
    },
    [run],
  );

  const unsaved = status === 'pending' || status === 'saving' || status === 'error';
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const hasPending = useCallback(() => sending.current || waiting.current.size > 0, []);
  const discard = useCallback(() => {
    clearTimeout(timer.current);
    waiting.current.clear();
  }, []);

  return { status, savedAt, queue, flush, adopt, getVersion, stopOn, hasPending, discard };
}
