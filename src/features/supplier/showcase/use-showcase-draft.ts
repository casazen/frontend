import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { supplierShowcaseApi } from '@/api/supplier-showcase.api';
import { getProblemCode } from '@/lib/api-errors';
import { useStoreShowcaseContent } from '@/queries/supplier/use-showcase';
import type { ShowcaseContent, ShowcaseDocument } from '@/types/supplier-showcase';

const SAVE_DELAY_MS = 800;

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'invalid' | 'offline' | 'conflict' | 'error';

export type DraftPatch = { [K in keyof ShowcaseDocument]?: ShowcaseDocument[K] | null };

export interface InvalidDraft {
  fields: string[];
  suggestedColor: string | null;
}

const NOT_INVALID: InvalidDraft = { fields: [], suggestedColor: null };

const rootOf = (path: string) => path.split(/[.[]/)[0];

function applyPatch(doc: ShowcaseDocument, patch: DraftPatch): ShowcaseDocument {
  const next: Record<string, unknown> = { ...doc };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next as ShowcaseDocument;
}

function invalidOf(error: unknown): InvalidDraft | null {
  if (!isAxiosError(error) || error.response?.status !== 422 || getProblemCode(error.response.data) !== 'showcase_content_invalid') return null;
  const data = error.response.data as { fields?: unknown; suggestedColor?: unknown };
  return {
    fields: Array.isArray(data.fields) ? data.fields.filter((field): field is string => typeof field === 'string') : [],
    suggestedColor: typeof data.suggestedColor === 'string' ? data.suggestedColor : null,
  };
}

const isConflict = (error: unknown) => isAxiosError(error) && error.response?.status === 409 && getProblemCode(error.response.data) === 'showcase_version_conflict';
const isOffline = (error: unknown) => isAxiosError(error) && !error.response;

export function useShowcaseDraft(initial: ShowcaseContent) {
  const store = useStoreShowcaseContent();
  const [doc, setDoc] = useState<ShowcaseDocument>(initial.draft);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [savedAt, setSavedAt] = useState<string | null>(initial.savedAt);
  const [invalid, setInvalid] = useState<InvalidDraft>(NOT_INVALID);

  const version = useRef(initial.version);
  const refusal = useRef<InvalidDraft>(NOT_INVALID);
  const pending = useRef<DraftPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const loop = useCallback(async () => {
    while (Object.keys(pending.current).length > 0) {
      const patch = pending.current;
      pending.current = {};
      setStatus('saving');
      try {
        const saved = await supplierShowcaseApi.saveDraft(version.current, patch);
        version.current = saved.version;
        store(saved);
        setSavedAt(saved.savedAt);
      } catch (error) {
        const refused = invalidOf(error);
        if (refused) {
          const bad = new Set(refused.fields.map(rootOf));
          const rest = Object.fromEntries(Object.entries(patch).filter(([key]) => !bad.has(key))) as DraftPatch;
          refusal.current = refused;
          setInvalid(refused);
          setStatus('invalid');
          if (Object.keys(rest).length === Object.keys(patch).length) {
            pending.current = { ...patch, ...pending.current };
            return;
          }
          pending.current = { ...rest, ...pending.current };
          continue;
        }
        pending.current = { ...patch, ...pending.current };
        setStatus(isConflict(error) ? 'conflict' : isOffline(error) ? 'offline' : 'error');
        return;
      }
    }
    setStatus(refusal.current === NOT_INVALID ? 'saved' : 'invalid');
  }, [store]);

  const drain = useCallback(() => {
    if (!inFlight.current) {
      inFlight.current = loop().finally(() => {
        inFlight.current = null;
      });
    }
    return inFlight.current;
  }, [loop]);

  const flush = useCallback(async () => {
    clearTimer();
    await drain();
    return Object.keys(pending.current).length === 0 && refusal.current === NOT_INVALID;
  }, [clearTimer, drain]);

  const change = useCallback(
    (patch: DraftPatch) => {
      const roots = Object.keys(patch);
      setDoc((current) => applyPatch(current, patch));
      // A member that was refused is being written again (or the server did not say which one): its error goes away until the server says otherwise.
      if (refusal.current !== NOT_INVALID && (refusal.current.fields.length === 0 || refusal.current.fields.some((field) => roots.includes(rootOf(field))))) {
        refusal.current = NOT_INVALID;
        setInvalid(NOT_INVALID);
      }
      pending.current = { ...pending.current, ...patch };
      setStatus((current) => (current === 'conflict' ? current : 'dirty'));
      clearTimer();
      timer.current = setTimeout(() => void drain(), SAVE_DELAY_MS);
    },
    [clearTimer, drain],
  );

  const adopt = useCallback((content: ShowcaseContent) => {
    version.current = content.version;
  }, []);

  const reload = useCallback(async () => {
    clearTimer();
    const fresh = await supplierShowcaseApi.getContent();
    version.current = fresh.version;
    pending.current = {};
    store(fresh);
    setDoc(fresh.draft);
    setSavedAt(fresh.savedAt);
    refusal.current = NOT_INVALID;
    setInvalid(NOT_INVALID);
    setStatus('saved');
  }, [clearTimer, store]);

  useEffect(() => {
    const online = () => void drain();
    const leaving = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length > 0) event.preventDefault();
    };
    window.addEventListener('online', online);
    window.addEventListener('beforeunload', leaving);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('beforeunload', leaving);
      if (timer.current) clearTimeout(timer.current);
      void drain();
    };
  }, [drain]);

  return { doc, change, status, savedAt, invalid, flush, adopt, reload, getVersion: () => version.current };
}
