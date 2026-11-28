import type { ArchiveDocument } from '@/types';

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
const UNSAFE_IN_NAME = /[\\/:*?"<>|\p{Cc}]+/gu;
const MAX_NAME_LENGTH = 100;

/** The key of a row of the archive: the type goes with the id, so that two kinds of document can never be taken for each other. */
export function archiveDocumentKey(document: Pick<ArchiveDocument, 'type' | 'id'>): string {
  return `${document.type}:${document.id}`;
}

export function isEmptyDocument(document: Pick<ArchiveDocument, 'sizeBytes'>): boolean {
  return document.sizeBytes === 0;
}

const EXTENDED_NAME = /(?:^|;)\s*filename\*\s*=\s*([^;]+)/i;
const EXTENDED_VALUE = /^\s*([^'\s]+)'[^']*'(.*?)\s*$/;
const PLAIN_NAME = /(?:^|;)\s*filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]*))/i;

/**
 * A name safe to save under: none of the characters a file system refuses (a path included) and no leading dot, hyphen or space, so that `../x.pdf`
 * stays inside the folder it is saved to and no file is made hidden.
 */
function cleanName(name: string): string {
  return name.replace(UNSAFE_IN_NAME, '-').replace(/\s+/g, ' ').replace(/^[\s.-]+/, '').trim();
}

function extendedFileName(header: string): string | null {
  const value = EXTENDED_NAME.exec(header)?.[1];
  const parts = value === undefined ? null : EXTENDED_VALUE.exec(value);
  if (parts === null || parts[1].toLowerCase() !== 'utf-8') return null;
  try {
    return decodeURIComponent(parts[2]);
  } catch {
    return null;
  }
}

function plainFileName(header: string): string | null {
  const parts = PLAIN_NAME.exec(header);
  if (parts === null) return null;
  return parts[1] === undefined ? parts[2].trim() : parts[1].replace(/\\(.)/g, '$1');
}

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
