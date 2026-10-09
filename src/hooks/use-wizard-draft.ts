import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser } from "@/queries/use-users";
import {
  WIZARD_DRAFT_TTL_MS,
  clearWizardDraft,
  onWizardDraftsWiped,
  readWizardDraft,
  writeWizardDraft,
  type WizardDraft,
  type WizardDraftScope,
} from "@/lib/wizard-draft";

export interface UseWizardDraftOptions {
  /**
   * Fields that are never saved: whatever is sensitive (fiscal code, documents, IBAN, e-mail of third parties). Dotted
   * paths; `*` stands for any key or index (`guests.*.fiscalCode`). The person types them again after a reload.
   */
  exclude?: readonly string[];
  /** Raise it when the shape of the values changes: a draft written for the old shape is ignored. Default 1. */
  version?: number;
  /** How long a draft lives, in ms. Default: 24 hours. */
  ttlMs?: number;
  /** Wait after the last change before writing, in ms. Default: 350. */
  debounceMs?: number;
  /** `false` turns the draft off: nothing is read and nothing is written. */
  enabled?: boolean;
  /**
   * Asked when the flow opens, with the draft found: `false` throws it away (and deletes it). For a flow whose answers also
   * live on the server, where a draft older than what the server knows would put old answers over newer ones.
   */
  accept?: (draft: WizardDraft) => boolean;
}

export interface UseWizardDraft {
  /** The draft found when the flow opened, `null` if there is none. It does not change while the person works. */
  restored: WizardDraft | null;
  /** When the draft was last written (ms since the epoch), or the time of the restored one. */
  savedAt: number | null;
  /** Queues a write of the answers and the step; changes that follow each other are written once. */
  save: (input: { step: string; values: Record<string, unknown> }) => void;
  /** Writes now what is queued. */
  flush: () => void;
  /** Deletes the draft and cancels what is queued: the flow was confirmed, or left on purpose. */
  clear: () => void;
}

const NO_EXCLUDE: readonly string[] = [];

/**
 * The automatic draft of a guided flow: it saves the answers (a little after each change) for this user in this
 * organization and gives them back, with the step, when the flow opens again, even after a reload. See `lib/wizard-draft`
 * for what is kept and where. Without a signed-in user nothing is saved: a draft never goes under an anonymous key.
 *
 *     const draft = useWizardDraft("property-new", { exclude: ["fiscalCode"] });
 */
export function useWizardDraft(id: string, options: UseWizardDraftOptions = {}): UseWizardDraft {
  const { exclude = NO_EXCLUDE, version = 1, ttlMs = WIZARD_DRAFT_TTL_MS, debounceMs = 350, enabled = true, accept } = options;
  const { user, org } = useCurrentUser();
  const userId = user?.id ?? null;
  const orgId = org?.id ?? null;

  const scope = useMemo<WizardDraftScope | null>(() => (enabled && userId ? { userId, orgId } : null), [enabled, userId, orgId]);
  const excludeKey = exclude.join("|");

  // Read once, when the flow opens: the answers it starts from do not change under the person's hands.
  const [restored] = useState<WizardDraft | null>(() => {
    const found = scope ? readWizardDraft(id, scope, { ttlMs, version }) : null;
    if (!scope || !found || !accept || accept(found)) return found;
    clearWizardDraft(id, scope);
    return null;
  });
  const [savedAt, setSavedAt] = useState<number | null>(restored?.savedAt ?? null);

  const pending = useRef<{ step: string; values: Record<string, unknown> } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when the person signs out: every draft was wiped, and this flow, still open until the page goes, saves nothing more.
  const wiped = useRef(false);

  const config = useRef({ id, scope, version, exclude });
  useEffect(() => {
    config.current = { id, scope, version, exclude: excludeKey ? excludeKey.split("|") : NO_EXCLUDE };
  }, [id, scope, version, excludeKey]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const input = pending.current;
    pending.current = null;
    const { id: draftId, scope: draftScope, version: draftVersion, exclude: draftExclude } = config.current;
    if (!input || !draftScope) return;
    const written = writeWizardDraft(draftId, draftScope, input, { version: draftVersion, exclude: draftExclude });
    if (written) setSavedAt(written.savedAt);
  }, []);

  const save = useCallback(
    (input: { step: string; values: Record<string, unknown> }) => {
      if (!config.current.scope || wiped.current) return;
      pending.current = input;
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
    const { id: draftId, scope: draftScope } = config.current;
    if (draftScope) clearWizardDraft(draftId, draftScope);
    setSavedAt(null);
  }, []);

  // Signing out wipes every draft: what is still queued is forgotten too, or the page leaving (pagehide, unmount) would write it
  // back under the old user and the answers would outlive the session in this tab.
  useEffect(
    () =>
      onWizardDraftsWiped(() => {
        if (timer.current) {
          clearTimeout(timer.current);
          timer.current = null;
        }
        pending.current = null;
        wiped.current = true;
      }),
    [],
  );

  // A reload or a closed tab must not lose what was typed in the last moment: write what is queued as the page goes away.
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return { restored, savedAt, save, flush, clear };
}
