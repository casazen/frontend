/**
 * The document archive (NF-99, REP-04, E07/F03/US03): every document the caller may read in one place, as `GET api/documents`,
 * `GET api/documents/types`, `GET api/documents/{type}/{id}/download` and `GET api/documents/export` of the backend send and take them.
 * The words of the wire are the ones of `ArchiveDocumentTypes.KeyOf` (camelCase keys, never a text to show: the screens translate them).
 */

/** The kinds of document the archive knows, by the key the API uses. The server offers only the ones its source exists for and the caller may read. */
export const ARCHIVE_DOCUMENT_TYPES = [
  'invoice',
  'receipt',
  'creditNote',
  'alloggiatiReceipt',
  'istatProof',
  'touristTax',
  'contract',
  'propertyDocument',
] as const;

export type ArchiveDocumentType = (typeof ARCHIVE_DOCUMENT_TYPES)[number];

/** One document of the list. The file is fetched by `type` and `id`; no address of the storage is ever in the answer. */
export interface ArchiveDocument {
  type: ArchiveDocumentType;
  id: string;
  /** The name of its file, or the comune a tourist tax payment was made to. */
  title: string;
  /** The Europe/Rome day of the document (`YYYY-MM-DD`): the day of an upload, the day of a payment. */
  date: string;
  propertyId: string | null;
  propertyName: string | null;
  bookingId: string | null;
  bookingCode: string | null;
  contentType: string;
  /** `null` when the source does not store it (every property document). */
  sizeBytes: number | null;
}

/** A page of the list: `totalCount` is all the documents that match the filters, whatever the page. */
export interface ArchiveDocumentPage {
  items: ArchiveDocument[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** A type the caller may read and how many documents of it match the filters (the type itself left out of them). */
export interface ArchiveTypeCount {
  type: ArchiveDocumentType;
  count: number;
}

/** What narrows the archive: the days (`YYYY-MM-DD`, both included, each one optional), one property, a text (title, property or booking code). */
export interface ArchiveTypesQuery {
  from?: string;
  to?: string;
  propertyId?: string;
  q?: string;
}

/** What `GET api/documents` takes: the filters, the types to show (none is every type the caller may read) and the page. */
export interface ArchiveListQuery extends ArchiveTypesQuery {
  types?: readonly ArchiveDocumentType[];
  page: number;
  pageSize: number;
}

/** What `GET api/documents/export` takes: both days (at most 24 months), the types and the property. */
export interface ArchiveExportQuery {
  from: string;
  to: string;
  types?: readonly ArchiveDocumentType[];
  propertyId?: string;
}

/** What the 422 `archive_export_too_large` says: how many files the period holds (`fileCount`), when the server tells it. */
export interface ArchiveExportTooLarge {
  fileCount: number | null;
}
