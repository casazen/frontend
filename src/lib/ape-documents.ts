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
