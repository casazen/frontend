import { ApiClient } from '@/api/client';
import type { ShowcaseContent, ShowcaseStats } from '@/types/supplier-showcase';

/**
 * The content of the supplier's showcase (SP-13a). Every route is of the caller's own supplier org; every answer, but the stats, is the
 * same document: the state, the draft, what is published, what a publication would change, the readiness and the bookings.
 * Errors: 409 `showcase_version_conflict` (reload), 422 `showcase_content_invalid` (with `fields`, and `suggestedColor` for a color),
 * 422 `showcase_not_publishable` (with `fields`: the codes of what is missing), 409 `showcase_undo_unavailable`.
 */
export const supplierShowcaseApi = {
  getContent: () => ApiClient.get<ShowcaseContent>('/supplier/showcase/content'),

  /** The autosave: the `version` read and the members to change, as a JSON merge patch (a list replaces the list, `null` clears). */
  saveDraft: (version: number, patch: Record<string, unknown>) =>
    ApiClient.patch<ShowcaseContent>('/supplier/showcase/content', { version, ...patch }),

  /** The draft goes back to what is published. With a `version` it must be the current one. */
  discard: (version?: number) =>
    ApiClient.post<ShowcaseContent>('/supplier/showcase/discard', version === undefined ? undefined : { version }),

  /** Publishes the draft (the server judges the readiness again). With a `version` it must be the current one. */
  publish: (version?: number) =>
    ApiClient.post<ShowcaseContent>('/supplier/showcase/publish', version === undefined ? undefined : { version }),

  /** "Annulla" after a publication, until `undoUntil`. */
  undoPublish: () => ApiClient.post<ShowcaseContent>('/supplier/showcase/publish/undo'),

  pause: () => ApiClient.post<ShowcaseContent>('/supplier/showcase/pause'),

  /** "Riattiva": reopens a paused showcase and judges the bookings again. */
  resume: () => ApiClient.post<ShowcaseContent>('/supplier/showcase/resume'),

  getStats: () => ApiClient.get<ShowcaseStats>('/supplier/showcase/stats'),
};
