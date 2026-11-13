import type { ArchiveDocument } from '@/types';

/** The extension of the files the archive holds, by their MIME type: a file saved from a title that has none still opens with the right program. */
const EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/zip': '.zip',
  'text/csv': '.csv',
};

const HAS_EXTENSION = /\.[A-Za-z0-9]{1,5}$/;
/** What a file name cannot hold on the systems people use, and the control characters. */
const UNSAFE_IN_NAME = /[\\/:*?"<>|\p{Cc}]+/gu;
/** The longest name the archive gives a file, extension apart: the export cuts the titles at the same length. */
const MAX_NAME_LENGTH = 100;

/** The key of a row of the archive: the type goes with the id, so that two kinds of document can never be taken for each other. */
export function archiveDocumentKey(document: Pick<ArchiveDocument, 'type' | 'id'>): string {
  return `${document.type}:${document.id}`;
}

/**
 * A document that the list already knows to be an empty file (the source declares 0 bytes): there is nothing to download, and the row says
 * so. A file that is gone from the storage is told by the server at the download (404 `archive_document_has_no_file`); the page remembers
 * those rows by their key.
 */
export function isEmptyDocument(document: Pick<ArchiveDocument, 'sizeBytes'>): boolean {
  return document.sizeBytes === 0;
}

/**
 * The name a downloaded document is saved under. The server sends the original name in a header that the browser does not let a page read
 * (the API is on another origin), so it is rebuilt from the row: a title that is a file name (`APE.pdf`) is kept; any other title (the
 * comune of a tourist tax payment) becomes `2026-10-12-Siracusa.pdf`, as the files of the export are named. The extension of that one
 * comes from the type of the file that arrived (`receivedContentType`), then from the one of the row.
 */
export function archiveDocumentFileName(
  document: Pick<ArchiveDocument, 'type' | 'title' | 'date' | 'contentType'>,
  receivedContentType = '',
): string {
  // No leading dot, hyphen or space is left: `../x.pdf` stays inside the folder it is saved to, and no file is made hidden.
  const title = document.title.replace(UNSAFE_IN_NAME, '-').replace(/\s+/g, ' ').replace(/^[\s.-]+/, '').trim();
  if (HAS_EXTENSION.test(title)) {
    const dot = title.lastIndexOf('.');
    return `${title.slice(0, Math.min(dot, MAX_NAME_LENGTH))}${title.slice(dot)}`;
  }

  const kind = (receivedContentType || document.contentType).split(';')[0].trim().toLowerCase();
  const name = title.slice(0, MAX_NAME_LENGTH).trim() || document.type;
  return `${document.date}-${name}${EXTENSIONS[kind] ?? ''}`;
}

/** The size of a file as a person reads it ("1,2 MB", "340 kB"), in the language of the page; under a kilobyte, the bytes. */
export function formatFileSize(bytes: number, locale: string): string {
  const kilobyte = 1024;
  const megabyte = kilobyte * 1024;
  const unit = bytes >= megabyte ? 'megabyte' : bytes >= kilobyte ? 'kilobyte' : 'byte';
  const value = unit === 'megabyte' ? bytes / megabyte : unit === 'kilobyte' ? bytes / kilobyte : bytes;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: unit === 'megabyte' ? 1 : 0,
  }).format(value);
}
