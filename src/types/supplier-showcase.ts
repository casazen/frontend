import type { PublicShowcaseContent } from '@/api/public-supplier.api';

/**
 * The editor of the showcase "Il mio sito vetrina" (SP-13a contract, backend `docs/runbooks/suppliers.md` section 33): the draft the
 * supplier writes, what is published, what a publication would change and whether it can be done.
 */

/** Derived by the server: nothing published (`Draft`), `Online`, published with changes in the draft (`ChangesReady`), `Paused`. */
export type ShowcaseState = 'Draft' | 'Online' | 'ChangesReady' | 'Paused';

/** The members of the content (schemaVersion 1), plus the order of the services to show (slugs, only active ones). */
export type ShowcaseDocument = PublicShowcaseContent & { serviceOrder?: string[] };

/** `ok` done · `warn` advised, the showcase can be published without it · `todo` required: it cannot. */
export type ShowcaseReadinessLevel = 'ok' | 'warn' | 'todo';

export interface ShowcaseReadinessItem {
  /** `services`, `zones`, `color` (required) and `hours`, `presentation`, `photos`, `faq`, `verified` (advised). */
  code: string;
  level: ShowcaseReadinessLevel;
  required: boolean;
  /** The page of the web app where the supplier fixes it: a path, with `?step=` for the editor's own steps. */
  target: string;
}

/** Why the bookings are closed, in the order the server lists them. */
export type ShowcaseBlockedBy = 'not_published' | 'paused' | 'payments_off' | 'payments_account_not_ready' | 'bookings_off';

export interface ShowcaseContent {
  schemaVersion: number;
  state: ShowcaseState;
  /** Sent back with the next save; 0 while the supplier never saved. */
  version: number;
  draft: ShowcaseDocument;
  /** What the customers read; null until the first publication. */
  published: ShowcaseDocument | null;
  /** The members of the contract in which the draft differs from what is published ("cosa cambia pubblicando"). */
  changes: string[];
  savedAt: string | null;
  publishedAt: string | null;
  pausedAt: string | null;
  /** Until when the last publication can be undone; null when it cannot. */
  undoUntil: string | null;
  readiness: { canPublish: boolean; items: ShowcaseReadinessItem[] };
  bookings: { open: boolean; blockedBy: ShowcaseBlockedBy[] };
  /** `/fornitori/{slug}`; null while the supplier has no address (never activated). */
  publicPath: string | null;
  /** The absolute address; null when there is no path or the public URL is not configured. */
  publicUrl: string | null;
}

/** What an image of the showcase is for: the logo, the cover, the photo of a job, the "before" photo of a job (SP-13b). */
export type ShowcaseMediaKind = 'logo' | 'cover' | 'work' | 'before';

/** An image the server stored for the showcase (SP-13b): its `url` goes into the content as it is. */
export interface ShowcaseMedia {
  id: string;
  kind: ShowcaseMediaKind;
  /** The absolute public address, in the supplier's own folder of the storage (the only place the content may point to). */
  url: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** The size of the stored file, after its metadata (EXIF, GPS position...) was removed. */
  bytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

/** The two true numbers of the editor: the requests that came from the showcase in the last 30 days and how many still wait. */
export interface ShowcaseStats {
  days: number;
  requests: number;
  pending: number;
}
