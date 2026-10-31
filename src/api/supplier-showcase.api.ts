import { ApiClient } from '@/api/client';
import axios from '@/lib/axios';
import type { ShowcaseContent, ShowcaseMedia, ShowcaseMediaKind, ShowcaseStats } from '@/types/supplier-showcase';

/** A photo of 10 MB on a slow connection takes more than the default 30 seconds. */
const UPLOAD_TIMEOUT_MS = 120_000;

/** What a caller of the upload can follow and stop. */
export interface UploadMediaOptions {
  /** Told how much of the file has gone, from 0 to 100. */
  onProgress?: (percent: number) => void;
  /** Stops the upload (the person cancels or leaves the picker). */
  signal?: AbortSignal;
}

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

  /**
   * Uploads an image of the showcase (SP-13b, multipart `kind` and `file`): the logo (200 KB at most), the cover, the photo of a job or its
   * "before" (10 MB). The server reads the type from the content (PNG, JPEG, WebP) and stores the file without its metadata; the answer
   * carries the `url` to put into the content. Errors: 413 `showcase_media_too_large`, 415 `showcase_media_unsupported_type`, 422
   * `showcase_media_invalid_image` / `_dimensions` / `_limit_reached`, 429 when the editor sends too many.
   */
  async uploadMedia(kind: ShowcaseMediaKind, file: File, options: UploadMediaOptions = {}): Promise<ShowcaseMedia> {
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file, file.name);
    const response = await axios.post<ShowcaseMedia>('/supplier/showcase/media', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
      signal: options.signal,
      onUploadProgress: (event) => {
        if (event.total) options.onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      },
    });
    return response.data;
  },
};
