/**
 * Automatic draft of a guided flow (a wizard): what the person has typed so far and the step they were on, kept in
 * `sessionStorage` (this tab only, gone when it is closed) for one user in one organization, for a day.
 *
 * The draft is a convenience, never a copy of the record: it must not hold what is sensitive (fiscal code, documents,
 * IBAN, e-mail of third parties). The flow declares those fields in `exclude` and they are left out of what is written;
 * files cannot be stored and are left out too. Every access may throw (private mode, blocked storage, full quota): then
 * nothing is remembered and the flow works as if there were no draft.
 */

export const WIZARD_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

const KEY_PREFIX = "casazen.wizardDraft";

export interface WizardDraftScope {
  userId: string;
  orgId: string | null;
}

export interface WizardDraft {
  step: string;
  values: Record<string, unknown>;
  /** When it was written, ms since the epoch. */
  savedAt: number;
}

interface StoredDraft extends WizardDraft {
  version: number;
}

export interface WizardDraftReadOptions {
  /** Current time, ms since the epoch (tests). */
  now?: number;
  ttlMs?: number;
  version?: number;
}

export interface WizardDraftWriteOptions {
  now?: number;
  version?: number;
  exclude?: readonly string[];
}

export function wizardDraftKey(id: string, scope: WizardDraftScope): string {
  return [KEY_PREFIX, scope.userId, scope.orgId ?? "-", id].map(encodeURIComponent).join(":");
}

function dropNonData(_key: string, value: unknown): unknown {
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (typeof File !== "undefined" && value instanceof File) return undefined;
  if (typeof Blob !== "undefined" && value instanceof Blob) return undefined;
  if (typeof FileList !== "undefined" && value instanceof FileList) return undefined;
  return value;
}

function removePath(node: unknown, segments: readonly string[]): void {
  if (node === null || typeof node !== "object") return;
  const [head, ...rest] = segments;
  const record = node as Record<string, unknown>;
  const keys = head === "*" ? Object.keys(record) : Object.prototype.hasOwnProperty.call(record, head) ? [head] : [];
  for (const key of keys) {
    if (rest.length === 0) delete record[key];
    else removePath(record[key], rest);
  }
}

export function storableValues(values: Record<string, unknown>, exclude: readonly string[] = []): Record<string, unknown> | null {
  try {
    const copy = JSON.parse(JSON.stringify(values, dropNonData)) as Record<string, unknown>;
    for (const path of exclude) removePath(copy, path.split("."));
    return copy;
  } catch {
    return null;
  }
}

function isStoredDraft(value: unknown): value is StoredDraft {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.step === "string" &&
    typeof entry.savedAt === "number" &&
    Number.isFinite(entry.savedAt) &&
    typeof entry.version === "number" &&
    typeof entry.values === "object" &&
    entry.values !== null &&
    !Array.isArray(entry.values)
  );
}

function parseStoredDraft(raw: string): StoredDraft | null {
  try {
    const entry: unknown = JSON.parse(raw);
    return isStoredDraft(entry) ? entry : null;
  } catch {
    return null;
  }
}

export function readWizardDraft(id: string, scope: WizardDraftScope, options: WizardDraftReadOptions = {}): WizardDraft | null {
  const { now = Date.now(), ttlMs = WIZARD_DRAFT_TTL_MS, version = 1 } = options;
  const key = wizardDraftKey(id, scope);
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = parseStoredDraft(raw);
    if (!entry || entry.version !== version || now - entry.savedAt > ttlMs || entry.savedAt > now + ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return { step: entry.step, values: entry.values, savedAt: entry.savedAt };
  } catch {
    return null;
  }
}

export function writeWizardDraft(
  id: string,
  scope: WizardDraftScope,
  input: { step: string; values: Record<string, unknown> },
  options: WizardDraftWriteOptions = {},
): WizardDraft | null {
  const { now = Date.now(), version = 1, exclude = [] } = options;
  const values = storableValues(input.values, exclude);
  if (!values) return null;
  const draft: WizardDraft = { step: input.step, values, savedAt: now };
  try {
    sessionStorage.setItem(wizardDraftKey(id, scope), JSON.stringify({ ...draft, version } satisfies StoredDraft));
    return draft;
  } catch {
    return null;
  }
}

const wipeListeners = new Set<() => void>();

export function onWizardDraftsWiped(listener: () => void): () => void {
  wipeListeners.add(listener);
  return () => {
    wipeListeners.delete(listener);
  };
}

export function clearAllWizardDrafts(): void {
  for (const listener of wipeListeners) {
    try {
      listener();
    } catch {
      // A flow that cannot forget must not stop the others from forgetting.
    }
  }
  try {
    const mine: string[] = [];
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(`${KEY_PREFIX}:`)) mine.push(key);
    }
    for (const key of mine) sessionStorage.removeItem(key);
  } catch {
    // Nothing to forget.
  }
}

export function clearWizardDraft(id: string, scope: WizardDraftScope): void {
  try {
    sessionStorage.removeItem(wizardDraftKey(id, scope));
  } catch {
    // Nothing to forget.
  }
}
