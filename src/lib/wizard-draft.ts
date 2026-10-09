/**
 * Automatic draft of a guided flow (a wizard): what the person has typed so far and the step they were on, kept in
 * `sessionStorage` (this tab only, gone when it is closed) for one user in one organization, for a day.
 *
 * The draft is a convenience, never a copy of the record: it must not hold what is sensitive (fiscal code, documents,
 * IBAN, e-mail of third parties). The flow declares those fields in `exclude` and they are left out of what is written;
 * files cannot be stored and are left out too. Every access may throw (private mode, blocked storage, full quota): then
 * nothing is remembered and the flow works as if there were no draft.
 */

/** A draft older than this is ignored and deleted when the flow opens. */
export const WIZARD_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

const KEY_PREFIX = "casazen.wizardDraft";

/** Whose draft it is. A draft is never read by another user, nor by the same user in another organization. */
export interface WizardDraftScope {
  userId: string;
  orgId: string | null;
}

export interface WizardDraft {
  /** Id of the step the person was on. */
  step: string;
  values: Record<string, unknown>;
  /** When it was written, ms since the epoch. */
  savedAt: number;
}

interface StoredDraft extends WizardDraft {
  /** Shape of the values: a draft written for another version of the flow is ignored. */
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
  /** Fields that are never written: dotted paths, `*` stands for any key or index (`guests.*.fiscalCode`). */
  exclude?: readonly string[];
}

/** Where the draft of the flow `id` lives for `scope`. */
export function wizardDraftKey(id: string, scope: WizardDraftScope): string {
  return [KEY_PREFIX, scope.userId, scope.orgId ?? "-", id].map(encodeURIComponent).join(":");
}

/** Values that are not data: they are not written (a `File` becomes `{}` in JSON, a function disappears). */
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

/**
 * A copy of `values` that is safe to write: JSON data only, without the `exclude`d fields. `null` when the values
 * cannot be turned into JSON (a circular structure).
 */
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

/** The draft of the flow, or `null` when there is none, it is expired, it is of another version or it is unreadable. */
export function readWizardDraft(id: string, scope: WizardDraftScope, options: WizardDraftReadOptions = {}): WizardDraft | null {
  const { now = Date.now(), ttlMs = WIZARD_DRAFT_TTL_MS, version = 1 } = options;
  const key = wizardDraftKey(id, scope);
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = parseStoredDraft(raw);
    // An expired, foreign or unreadable draft is deleted, not kept around: it can never be used again.
    if (!entry || entry.version !== version || now - entry.savedAt > ttlMs || entry.savedAt > now + ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return { step: entry.step, values: entry.values, savedAt: entry.savedAt };
  } catch {
    return null;
  }
}

/** Writes the draft. Returns what was written, or `null` when nothing could be (the flow goes on without a draft). */
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

/** Deletes every draft of every flow of every user: the person signs out, and what they typed does not stay in the tab. */
export function clearAllWizardDrafts(): void {
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

/** Deletes the draft: the flow was confirmed, or the person left it on purpose. */
export function clearWizardDraft(id: string, scope: WizardDraftScope): void {
  try {
    sessionStorage.removeItem(wizardDraftKey(id, scope));
  } catch {
    // Nothing to forget.
  }
}
