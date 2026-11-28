import type { PropertyDocumentDto } from '@/types';

export function latestApeDocument(documents: readonly PropertyDocumentDto[] | undefined): PropertyDocumentDto | undefined {
  return documents
    ?.filter((document) => document.documentType === 'Ape')
    .reduce<PropertyDocumentDto | undefined>(
      (latest, document) => (!latest || document.uploadedAt > latest.uploadedAt ? document : latest),
      undefined,
    );
}

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

export const apeReadFoundNothing = (documentId: string): boolean => readFoundNothing().includes(documentId);

export function rememberApeReadFoundNothing(documentId: string): void {
  const ids = [documentId, ...readFoundNothing().filter((id) => id !== documentId)].slice(0, READ_FOUND_NOTHING_MAX);
  try {
    localStorage.setItem(READ_FOUND_NOTHING_KEY, JSON.stringify(ids));
  } catch {
    // Storage full or turned off: the page reads the file again next time, nothing else changes.
  }
}
