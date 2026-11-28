import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientContext, useQuery } from "@tanstack/react-query";
import { WIZARD_DRAFTS_KEY, wizardDraftApi } from "@/api/wizard-draft.api";
import { useCurrentUser } from "@/queries/use-users";
import {
  WIZARD_DRAFT_TTL_MS,
  clearWizardDraft,
  onWizardDraftsWiped,
  readWizardDraft,
  storableValues,
  writeWizardDraft,
  type WizardDraft,
  type WizardDraftScope,
} from "@/lib/wizard-draft";
import type { ServerWizardDraft, WizardSaveStatus, WizardType } from "@/types/wizard";

export interface WizardDraftServer {
  type: WizardType;
  entityId?: string | null;
}

export interface UseWizardDraftOptions {
  /**
   * Fields that are never saved: whatever is sensitive (fiscal code, documents, IBAN, e-mail of third parties). Dotted
   * paths; `*` stands for any key or index (`guests.*.fiscalCode`). The person types them again after a reload. With `server`
   * they are left out of the copy on the server too, and are sent nowhere.
   */
  exclude?: readonly string[];
  version?: number;
  ttlMs?: number;
  debounceMs?: number;
  enabled?: boolean;
  accept?: (draft: WizardDraft) => boolean;
  /**
   * Also keeps the draft on the server, so that the person resumes it on another device (ADR-024). Without it nothing changes: the
   * draft lives in this browser tab. The flow waits for the read of the server's draft (`ready`), then every write of the draft is
   * sent to the server too (one request at a time, the last value wins), at the latest every 30 seconds while something is unsaved, and
   * at once on `flush` / `onBlur`. A field the flow declares in `exclude` is sent nowhere; the server encrypts the fields it knows to
   * be personal (`WizardDraftPiiFields`, at any depth) and keeps every other value in clear, so a flow that wants a personal field
   * resumed on another device names it as the server does and leaves it out of `exclude`.
   */
  server?: WizardDraftServer;
}

export interface WizardDraftConflict {
  serverDraft: ServerWizardDraft | null;
  serverVersion: number;
}

export interface UseWizardDraft {
  restored: WizardDraft | null;
  /** When the draft was last written in the browser (ms since the epoch), or the time of the restored one. */
  savedAt: number | null;
  save: (input: { step: string; values: Record<string, unknown> }) => void;
  flush: () => void;
  clear: () => void;
  onBlur: () => void;
  ready: boolean;
  status: WizardSaveStatus;
  /** When the server saved the draft last (ms since the epoch): the time to show as «saved at». */
  serverSavedAt: number | null;
  conflict: WizardDraftConflict | null;
  keepMine: () => void;
  takeTheirs: () => WizardDraft | null;
  retry: () => void;
}

const NO_EXCLUDE: readonly string[] = [];

const SERVER_SAVE_INTERVAL_MS = 30_000;

/**
 * A client that never fetches. A flow without `server` needs no cache, but the hook calls `useQuery` all the same (hooks cannot be
 * conditional): where no `QueryClientProvider` is mounted (the unit test of a plain flow) it borrows this one, with the query off.
 * A flow with `server` always uses the client of the provider, and fails loudly where there is none.
 */
const IDLE_CLIENT = new QueryClient();

interface Opening {
  restored: WizardDraft | null;
  serverVersion: number;
}

function timeOf(instant: string): number | null {
  const at = Date.parse(instant);
  return Number.isFinite(at) ? at : null;
}

function draftOfServer(draft: ServerWizardDraft, shape: number): WizardDraft | null {
  const { shape: written, step, values } = draft.data;
  if (written !== shape || typeof values !== "object" || values === null || Array.isArray(values)) return null;
  return { step: typeof step === "string" ? step : "", values: values as Record<string, unknown>, savedAt: timeOf(draft.lastSavedAt) ?? 0 };
}

/**
 * The automatic draft of a guided flow: it saves the answers (a little after each change) for this user in this
 * organization and gives them back, with the step, when the flow opens again, even after a reload. See `lib/wizard-draft`
 * for what is kept and where. Without a signed-in user nothing is saved: a draft never goes under an anonymous key.
 *
 *     const draft = useWizardDraft("property-new", { exclude: ["fiscalCode"] });
 *
 * With `server` the draft also lives on the server (ADR-024), so it can be resumed on another device, and two devices that save the
 * same draft are told: the save that loses is not written, `status` says `conflict` and `conflict` holds the server's version until
 * the person keeps theirs (`keepMine`) or takes the other (`takeTheirs`). Signing out does not delete the draft of the server: it is
 * the person's.
 *
 *     const draft = useWizardDraft("booking-new", { server: { type: "BookingCreate" } });
 *     if (!draft.ready) return <Spinner />;
 */
export function useWizardDraft(id: string, options: UseWizardDraftOptions = {}): UseWizardDraft {
  const { exclude = NO_EXCLUDE, version = 1, ttlMs = WIZARD_DRAFT_TTL_MS, debounceMs = 350, enabled = true, accept, server } = options;
  const { user, org } = useCurrentUser();
  const userId = user?.id ?? null;
  const orgId = org?.id ?? null;
  const serverType = server?.type ?? null;
  const serverEntityId = server?.entityId ?? null;

  const scope = useMemo<WizardDraftScope | null>(() => (enabled && userId ? { userId, orgId } : null), [enabled, userId, orgId]);
  const excludeKey = exclude.join("|");
  const queryClientOfProvider = useContext(QueryClientContext);
  const queryClient = queryClientOfProvider ?? IDLE_CLIENT;

  const [restoredBrowser] = useState<WizardDraft | null>(() => {
    const found = scope ? readWizardDraft(id, scope, { ttlMs, version }) : null;
    if (!scope || !found || !accept || accept(found)) return found;
    clearWizardDraft(id, scope);
    return null;
  });
  const [savedAt, setSavedAt] = useState<number | null>(restoredBrowser?.savedAt ?? null);

  const serverWanted = Boolean(scope && serverType);
  const [opening, setOpening] = useState<Opening | null>(() => (serverWanted ? null : { restored: restoredBrowser, serverVersion: 0 }));
  const [status, setStatus] = useState<WizardSaveStatus>("idle");
  const [serverSavedAt, setServerSavedAt] = useState<number | null>(null);
  const [conflict, setConflict] = useState<WizardDraftConflict | null>(null);

  const reading = serverWanted && opening === null;
  const read = useQuery(
    {
      queryKey: [...WIZARD_DRAFTS_KEY, serverType, serverEntityId],
      queryFn: () => (serverType ? wizardDraftApi.get(serverType, serverEntityId) : Promise.resolve(null)),
      enabled: reading,
      staleTime: Infinity,
      gcTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      networkMode: "always",
    },
    queryClientOfProvider ?? (serverType ? undefined : IDLE_CLIENT),
  );
  if (reading && !read.isFetching && (read.isSuccess || read.isError)) {
    const serverDraft = read.data ?? null;
    const theirs = serverDraft ? draftOfServer(serverDraft, version) : null;
    const useTheirs = theirs !== null && (accept === undefined || accept(theirs)) && (restoredBrowser === null || theirs.savedAt >= restoredBrowser.savedAt);
    const chosen = useTheirs ? theirs : restoredBrowser;
    setOpening({ restored: chosen, serverVersion: serverDraft?.version ?? 0 });
    setSavedAt(chosen?.savedAt ?? null);
    setServerSavedAt(serverDraft ? timeOf(serverDraft.lastSavedAt) : null);
    if (useTheirs) setStatus("saved");
  }
  const ready = opening !== null || !serverWanted;
  const restored = opening ? opening.restored : serverWanted ? null : restoredBrowser;

  const pending = useRef<{ step: string; values: Record<string, unknown> } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wiped = useRef(false);
  const waiting = useRef<{ step: string; values: Record<string, unknown> } | null>(null);
  const versionRef = useRef(0);
  const conflictRef = useRef<WizardDraftConflict | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);

  const config = useRef({
    id,
    scope,
    version,
    exclude,
    server: serverType ? { type: serverType, entityId: serverEntityId } : null,
    queryClient,
  });
  useEffect(() => {
    config.current = {
      id,
      scope,
      version,
      exclude: excludeKey ? excludeKey.split("|") : NO_EXCLUDE,
      server: serverType ? { type: serverType, entityId: serverEntityId } : null,
      queryClient,
    };
  }, [id, scope, version, excludeKey, serverType, serverEntityId, queryClient]);

  useEffect(() => {
    if (opening) versionRef.current = opening.serverVersion;
  }, [opening]);

  const drain = useCallback(async (): Promise<void> => {
    const input = waiting.current;
    const { scope: draftScope, server: target, exclude: draftExclude, version: shape, queryClient: client } = config.current;
    if (!input || !target || !draftScope || wiped.current || conflictRef.current) return;
    waiting.current = null;
    const values = storableValues(input.values, draftExclude);
    if (!values) return;
    const started = generation.current;
    setStatus("saving");
    try {
      const result = await wizardDraftApi.save(target.type, {
        entityId: target.entityId,
        clientVersion: versionRef.current,
        data: { shape, step: input.step, values },
      });
      if (generation.current !== started || wiped.current) return;
      if (result.status === "saved") {
        versionRef.current = result.version;
        setServerSavedAt(timeOf(result.lastSavedAt));
        setStatus(waiting.current ? "pending" : "saved");
        void client.invalidateQueries({ queryKey: WIZARD_DRAFTS_KEY });
      } else {
        // Nothing was written. What was typed here stays in line (unless something newer is), for `keepMine`.
        waiting.current ??= input;
        const open = { serverDraft: result.serverDraft, serverVersion: result.serverVersion };
        conflictRef.current = open;
        setConflict(open);
        setStatus("conflict");
      }
    } catch {
      if (generation.current !== started || wiped.current) return;
      waiting.current ??= input;
      setStatus("error");
    }
  }, []);

  const run = useCallback((): void => {
    chain.current = chain.current.then(drain);
  }, [drain]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const input = pending.current;
    pending.current = null;
    const { id: draftId, scope: draftScope, version: draftVersion, exclude: draftExclude, server: target } = config.current;
    if (draftScope && input) {
      const written = writeWizardDraft(draftId, draftScope, input, { version: draftVersion, exclude: draftExclude });
      if (written) setSavedAt(written.savedAt);
    }
    if (target && waiting.current) run();
  }, [run]);

  const save = useCallback(
    (input: { step: string; values: Record<string, unknown> }) => {
      if (!config.current.scope || wiped.current) return;
      pending.current = input;
      if (config.current.server) {
        waiting.current = input;
        if (!conflictRef.current) setStatus("pending");
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, debounceMs);
    },
    [debounceMs, flush],
  );

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    pending.current = null;
    waiting.current = null;
    const { id: draftId, scope: draftScope, server: target, queryClient: client } = config.current;
    if (draftScope) clearWizardDraft(draftId, draftScope);
    setSavedAt(null);
    if (!target || !draftScope || wiped.current) return;
    generation.current += 1;
    versionRef.current = 0;
    conflictRef.current = null;
    setConflict(null);
    setStatus("idle");
    setServerSavedAt(null);
    chain.current = chain.current.then(async () => {
      try {
        await wizardDraftApi.remove(target.type, target.entityId);
        void client.invalidateQueries({ queryKey: WIZARD_DRAFTS_KEY });
      } catch {
        // The draft stays on the server until it is replaced or it expires; the flow is over all the same.
      }
    });
  }, []);

  const keepMine = useCallback(() => {
    const open = conflictRef.current;
    if (!open) return;
    conflictRef.current = null;
    versionRef.current = open.serverVersion;
    setConflict(null);
    setStatus("pending");
    run();
  }, [run]);

  const takeTheirs = useCallback((): WizardDraft | null => {
    const open = conflictRef.current;
    if (!open) return null;
    if (!open.serverDraft) {
      keepMine();
      return null;
    }
    const { id: draftId, scope: draftScope, version: shape, exclude: draftExclude } = config.current;
    const theirs = draftOfServer(open.serverDraft, shape);
    if (!theirs) return null;
    conflictRef.current = null;
    versionRef.current = open.serverVersion;
    waiting.current = null;
    pending.current = null;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (draftScope) {
      const written = writeWizardDraft(draftId, draftScope, theirs, { version: shape, exclude: draftExclude });
      if (written) setSavedAt(written.savedAt);
    }
    setConflict(null);
    setServerSavedAt(timeOf(open.serverDraft.lastSavedAt));
    setStatus("saved");
    return theirs;
  }, [keepMine]);

  useEffect(
    () =>
      onWizardDraftsWiped(() => {
        if (timer.current) {
          clearTimeout(timer.current);
          timer.current = null;
        }
        pending.current = null;
        waiting.current = null;
        wiped.current = true;
      }),
    [],
  );

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  // While something is unsaved on the server (waiting, or not sent because the last try failed), a save is made every 30 seconds
  // even if the person never pauses, and a failed one is tried again (ADR-024-R11).
  const unsaved = status === "pending" || status === "error";
  useEffect(() => {
    if (!unsaved) return undefined;
    const interval = setInterval(flush, SERVER_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [unsaved, flush]);

  return { restored, savedAt, save, flush, clear, onBlur: flush, ready, status, serverSavedAt, conflict, keepMine, takeTheirs, retry: flush };
}
