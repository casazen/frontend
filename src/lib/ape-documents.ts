import type { PropertyDocumentDto } from '@/types';

/** The APE a contract states: the last one uploaded (the contract prints its code and energy class, LT-10). */
export function latestApeDocument(documents: readonly PropertyDocumentDto[] | undefined): PropertyDocumentDto | undefined {
  return documents
    ?.filter((document) => document.documentType === 'Ape')
    .reduce<PropertyDocumentDto | undefined>(
      (latest, document) => (!latest || document.uploadedAt > latest.uploadedAt ? document : latest),
      undefined,
    );
}

/** Code and energy class are both written: the contract can state them, and they confirm a certificate not read whole. */
export const hasApeIdentification = (document: PropertyDocumentDto | undefined): boolean =>
  !!document?.apeCode?.trim() && !!document.apeEnergyClass?.trim();

const READ_FOUND_NOTHING_KEY = 'casazen.apeReadFoundNothing';
const READ_FOUND_NOTHING_MAX = 50;

function readFoundNothing(): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(READ_FOUND_NOTHING_KEY) ?? '[]');
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * The reading of this APE (its upload, or a reading again) found no code and class, in this browser: a page opened again does not
 * run the OCR of the same file again, a minute of the server each time ("Leggi dall'APE" still reads it again on request).
 */
export const apeReadFoundNothing = (documentId: string): boolean => readFoundNothing().includes(documentId);

export function rememberApeReadFoundNothing(documentId: string): void {
  const ids = [documentId, ...readFoundNothing().filter((id) => id !== documentId)].slice(0, READ_FOUND_NOTHING_MAX);
  try {
    localStorage.setItem(READ_FOUND_NOTHING_KEY, JSON.stringify(ids));
  } catch {
    // Storage full or turned off: the page reads the file again next time, nothing else changes.
  }
}
