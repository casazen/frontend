/**
 * The document archive (NF-99, REP-04, E07/F03/US03): every document the caller may read in one place, as `GET api/documents`,
 * `GET api/documents/types`, `GET api/documents/{type}/{id}/download` and `GET api/documents/export` of the backend send and take them.
 * The words of the wire are the ones of `ArchiveDocumentTypes.KeyOf` (camelCase keys, never a text to show: the screens translate them).
 */

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

export interface ArchiveDocument {
  type: ArchiveDocumentType;
  id: string;
  title: string;
  date: string;
  propertyId: string | null;
  propertyName: string | null;
  bookingId: string | null;
  bookingCode: string | null;
  contentType: string;
  sizeBytes: number | null;
}

export interface ArchiveDocumentPage {
  items: ArchiveDocument[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ArchiveTypeCount {
  type: ArchiveDocumentType;
  count: number;
}

export interface ArchiveTypesQuery {
  from?: string;
  to?: string;
  propertyId?: string;
  q?: string;
}

export interface ArchiveListQuery extends ArchiveTypesQuery {
  types?: readonly ArchiveDocumentType[];
  page: number;
  pageSize: number;
}

export interface ArchiveExportQuery {
  from: string;
  to: string;
  types?: readonly ArchiveDocumentType[];
  propertyId?: string;
}

export interface ArchiveDownload {
  blob: Blob;
  contentDisposition: string | null;
}

export type ArchiveExportTooLarge =
  | { limit: 'files'; fileCount: number; maxFiles: number }
  | { limit: 'size'; fileCount: number; maxFiles: number; maxBytes: number }
  | { limit: null };
