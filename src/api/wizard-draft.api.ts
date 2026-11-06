import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError, getHttpStatus, getProblemCode } from '@/lib/api-errors';
import type { SaveWizardDraftResult, ServerWizardDraft, WizardType } from '@/types/wizard';

/** The first part of the key of every query about the drafts of the wizards: whoever changes a draft invalidates by it (ADR-024-R8). */
export const WIZARD_DRAFTS_KEY = ['wizard-drafts'] as const;

/** `code` of the 409 of a save that is behind the server (another device or tab saved first); nothing was written. */
const DRAFT_CONFLICT_CODE = 'draft_conflict';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/** Where the draft of a wizard lives; relative to the API base URL, which already ends in `/api`. */
function draftUrl(type: WizardType): string {
  return `/wizards/${encodeURIComponent(type)}/draft`;
}

/** `entityId` is the query of a read and of a delete (a member of the body of a save); none is the draft of a new entity. */
function entityParams(entityId: string | null | undefined): { entityId: string } | undefined {
  return entityId ? { entityId } : undefined;
}

/** A draft of the server from its JSON, or `null` when the body is not one. */
function draftOf(value: unknown, type: WizardType): ServerWizardDraft | null {
  if (!isRecord(value) || typeof value.version !== 'number' || !isRecord(value.data) || !isInstant(value.lastSavedAt)) return null;
  return {
    type,
    entityId: typeof value.entityId === 'string' ? value.entityId : null,
    version: value.version,
    data: value.data,
    lastSavedAt: value.lastSavedAt,
  };
}

/** The 409 `draft_conflict` as a result: the problem carries `serverDraft` and `serverVersion`. `null` for any other error. */
function conflictOf(error: unknown, type: WizardType): SaveWizardDraftResult | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null;
  const body: unknown = error.response.data;
  if (!isRecord(body) || getProblemCode(body) !== DRAFT_CONFLICT_CODE) return null;
  const serverDraft = draftOf(body.serverDraft, type);
  const serverVersion = typeof body.serverVersion === 'number' ? body.serverVersion : serverDraft?.version;
  if (serverVersion === undefined) return null;
  return { status: 'conflict', serverDraft, serverVersion };
}

/**
 * The draft that the server keeps of a wizard for the signed-in person (ADR-024, `api/wizards/{type}/draft`). It is always the
 * caller's own: the person is the subject of the token, never a parameter.
 *
 * It goes through the configured axios instance and not through `ApiClient`: `ApiClient` hands back `body.data` for any body that has a
 * `data` member, and in a draft that member is what the person typed, not the draft.
 */
export const wizardDraftApi = {
  /** The draft, or `null` when there is none (404: none saved, it expired, or the caller has no organization). */
  get: async (type: WizardType, entityId?: string | null): Promise<ServerWizardDraft | null> => {
    const url = draftUrl(type);
    let body: unknown;
    try {
      body = (await axios.get<unknown>(url, { params: entityParams(entityId) })).data;
    } catch (error) {
      if (getHttpStatus(error) === 404) return null;
      throw error;
    }
    const draft = draftOf(body, type);
    if (!draft) throw new UnexpectedApiResponseError(url);
    return draft;
  },

  /**
   * Saves the draft (the first save creates it). `clientVersion` is the `version` the client last saw, 0 when it has none. A 409
   * `draft_conflict` is not an error: it comes back as the `conflict` result; any other error is thrown.
   */
  save: async (
    type: WizardType,
    save: { entityId?: string | null; clientVersion: number; data: Record<string, unknown> },
  ): Promise<SaveWizardDraftResult> => {
    const url = draftUrl(type);
    let body: unknown;
    try {
      body = (await axios.post<unknown>(url, { entityId: save.entityId ?? null, clientVersion: save.clientVersion, data: save.data })).data;
    } catch (error) {
      const conflict = conflictOf(error, type);
      if (conflict) return conflict;
      throw error;
    }
    if (!isRecord(body) || typeof body.version !== 'number' || !isInstant(body.lastSavedAt)) throw new UnexpectedApiResponseError(url);
    return { status: 'saved', version: body.version, lastSavedAt: body.lastSavedAt };
  },

  /** Discards the draft (idempotent: none is not an error). */
  remove: async (type: WizardType, entityId?: string | null): Promise<void> => {
    await axios.delete(draftUrl(type), { params: entityParams(entityId) });
  },
};
