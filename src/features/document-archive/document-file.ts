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

/** `filename*=UTF-8''Ricevuta%20%C3%A8.pdf` (RFC 5987): the charset, the language (empty here) and the name written in percent-encoded bytes. */
const EXTENDED_NAME = /(?:^|;)\s*filename\*\s*=\s*([^;]+)/i;
const EXTENDED_VALUE = /^\s*([^'\s]+)'[^']*'(.*?)\s*$/;
/** `filename="Ricevuta _.pdf"` (a quoted string, where a quote and a backslash are written with a backslash before them) or `filename=ricevuta.pdf`. */
const PLAIN_NAME = /(?:^|;)\s*filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]*))/i;

/**
 * A name safe to save under: none of the characters a file system refuses (a path included) and no leading dot, hyphen or space, so that `../x.pdf`
 * stays inside the folder it is saved to and no file is made hidden.
 */
function cleanName(name: string): string {
  return name.replace(UNSAFE_IN_NAME, '-').replace(/\s+/g, ' ').replace(/^[\s.-]+/, '').trim();
}

/** The name of `filename*=` (UTF-8, the charset the API writes), or `null`: there is none, it is in another charset or it is not well written. */
function extendedFileName(header: string): string | null {
  const value = EXTENDED_NAME.exec(header)?.[1];
  const parts = value === undefined ? null : EXTENDED_VALUE.exec(value);
  if (parts === null || parts[1].toLowerCase() !== 'utf-8') return null;
  try {
    return decodeURIComponent(parts[2]);
  } catch {
    // A percent sign that is not followed by the bytes of a letter: the plain name is there for that.
    return null;
  }
}

/** The name of `filename=`, quoted or not, or `null` when there is none. */
function plainFileName(header: string): string | null {
  const parts = PLAIN_NAME.exec(header);
  if (parts === null) return null;
  return parts[1] === undefined ? parts[2].trim() : parts[1].replace(/\\(.)/g, '$1');
}

/**
 * The name the server gave the file in `Content-Disposition`, made safe to save under, or `null` when there is no header or it holds no name. The name
 * with its charset (`filename*`) wins over the plain one (`filename`, where the API puts an ASCII stand-in for a name with letters like è):
 * `attachment; filename="Ricevuta _.pdf"; filename*=UTF-8''Ricevuta%20%C3%A8.pdf` is `Ricevuta è.pdf`.
 */
export function contentDispositionFileName(header: string | null | undefined): string | null {
  if (!header) return null;
  const name = extendedFileName(header) ?? plainFileName(header);
  const clean = name === null ? '' : cleanName(name);
  return clean === '' ? null : clean;
}

/**
 * The name a downloaded document is saved under: the one the server gave it (`Content-Disposition`: the original name of the file, the one of a
 * tourist tax receipt included) or, when the page cannot read the header (an API that does not expose it to this origin) or it holds no name, the
 * one rebuilt from the row (`archiveDocumentFileName`). A missing header is never an error.
 */
export function archiveDownloadFileName(
  document: Pick<ArchiveDocument, 'type' | 'title' | 'date' | 'contentType'>,
  receivedContentType: string,
  contentDisposition: string | null | undefined,
): string {
  return contentDispositionFileName(contentDisposition) ?? archiveDocumentFileName(document, receivedContentType);
}

/**
 * The name of a downloaded document rebuilt from its row, for when the server's own name is not at hand (`archiveDownloadFileName`): a title that
 * is a file name (`APE.pdf`) is kept; any other title (the comune of a tourist tax payment) becomes `2026-10-12-Siracusa.pdf`, as the files of the
 * export are named. The extension of that one comes from the type of the file that arrived (`receivedContentType`), then from the one of the row.
 */
export function archiveDocumentFileName(
  document: Pick<ArchiveDocument, 'type' | 'title' | 'date' | 'contentType'>,
  receivedContentType = '',
): string {
  const title = cleanName(document.title);
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
