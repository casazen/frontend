import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { supplierShowcaseApi } from '@/api/supplier-showcase.api';
import { getProblemCode } from '@/lib/api-errors';
import { useStoreShowcaseContent } from '@/queries/supplier/use-showcase';
import type { ShowcaseContent, ShowcaseDocument } from '@/types/supplier-showcase';

/** Pause after the last keystroke before the draft is saved: one request per thought, not per letter (the server allows 120 a minute). */
const SAVE_DELAY_MS = 800;

/**
 * Where the draft stands: `saved` (the server has it), `dirty` (a change waits for its turn), `saving`, `invalid` (the server refused a
 * value: it says which), `offline` (kept here and sent when the network is back), `conflict` (it was changed elsewhere: reload) or
 * `error` (the server failed: kept, tried again with the next change).
 */
export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'invalid' | 'offline' | 'conflict' | 'error';

/** A change of the draft: each member replaces the stored one (a list replaces the whole list), `null` clears it. */
export type DraftPatch = { [K in keyof ShowcaseDocument]?: ShowcaseDocument[K] | null };

export interface InvalidDraft {
  /** The paths the server refused (`tagline`, `faq[2].a`, `color`). */
  fields: string[];
  /** The same hue, darker, when the color cannot be read with white text. */
  suggestedColor: string | null;
}

const NOT_INVALID: InvalidDraft = { fields: [], suggestedColor: null };

/** The member of the content a path points into: `faq[2].a` is `faq`. */
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

/**
 * The draft of the showcase as the editor writes it, saved by itself (SP-13d): the local copy is what the panels and the preview read;
 * what changes is sent as a JSON merge patch with the version last read, after a short pause, one request at a time (what is written
 * while one is on its way goes in the next). A stale version is a 409 and nothing is lost silently: the status says `conflict` and
 * the person reloads. A value the server refuses (422) is shown with the paths at fault, the members that are not at fault go again at
 * once and the one at fault waits until the person changes it; while the network is down the changes wait here and go out when it is
 * back. What is still to be sent leaves when the editor is left, and before a publication (`flush`).
 */
export function useShowcaseDraft(initial: ShowcaseContent) {
  const store = useStoreShowcaseContent();
  const [doc, setDoc] = useState<ShowcaseDocument>(initial.draft);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [savedAt, setSavedAt] = useState<string | null>(initial.savedAt);
  const [invalid, setInvalid] = useState<InvalidDraft>(NOT_INVALID);

  const version = useRef(initial.version);
  // The refusal on screen, also kept here: the loop and `change` decide on it without waiting for a render.
  const refusal = useRef<InvalidDraft>(NOT_INVALID);
  const pending = useRef<DraftPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  /** Sends what is waiting, again and again until nothing is, or until the server or the network says stop. */
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
          // The server cannot tell which member: the patch stays to be sent and nothing goes until the person changes something.
          if (Object.keys(rest).length === Object.keys(patch).length) {
            pending.current = { ...patch, ...pending.current };
            return;
          }
          // What is not at fault goes again at once; the member at fault waits for the person to change it.
          pending.current = { ...rest, ...pending.current };
          continue;
        }
        // Not saved: put it back, the newer value of a member wins over the one that failed.
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

  /**
   * Sends everything that waits, now, and returns when it is done (before publishing, when leaving). True when the server has the draft
   * as it is on screen: nothing waits and no value was refused.
   */
  const flush = useCallback(async () => {
    clearTimer();
    await drain();
    return Object.keys(pending.current).length === 0 && refusal.current === NOT_INVALID;
  }, [clearTimer, drain]);

  /** The person wrote something: the local copy changes at once, the server hears of it after a pause. */
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

  /**
   * A command of this page (a publication, its undo) changed the row on the server: the version to send next is the one it answered
   * with, or the next save would be taken for a stale one. (The draft is not touched: a publication makes the published document the
   * draft, an undo leaves it alone.)
   */
  const adopt = useCallback((content: ShowcaseContent) => {
    version.current = content.version;
  }, []);

  /** After a conflict: take what the server has (the draft and the version) and drop what was not saved. */
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
    // The network is back: what waited goes out. A change that waits when the page closes is warned about.
    const online = () => void drain();
    const leaving = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length > 0) event.preventDefault();
    };
    window.addEventListener('online', online);
    window.addEventListener('beforeunload', leaving);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('beforeunload', leaving);
      // Leaving the editor sends what is left.
      if (timer.current) clearTimeout(timer.current);
      void drain();
    };
  }, [drain]);

  return { doc, change, status, savedAt, invalid, flush, adopt, reload, getVersion: () => version.current };
}
