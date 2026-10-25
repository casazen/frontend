import type { TFunction } from 'i18next';
import type { LeaseDocumentSection, LeaseReading, LeaseReadingDocument, LeaseReadingWarning } from '@/types';

/** The words of the warnings the reading can find in a contract file; any other code says the general sentence. */
const WARNING_CODES: ReadonlySet<string> = new Set([
  'attestation_comune_differs',
  'attestation_dates_differ',
  'attestation_not_conform',
  'attestation_parties_differ',
  'attestation_rent_differs',
  'attestation_rent_out_of_range',
  'attestation_sheet_differ',
  'fiscal_code_invalid',
  'pages_out_of_order',
  'pages_unreadable',
  'sheet_not_conform',
  'sheet_rent_differs',
  'term_too_short',
]);

/** The contract document the screen speaks about: the one the import will use, else the first that was read into sections. */
export function readContractDocument(reading: LeaseReading): LeaseReadingDocument | undefined {
  return reading.documents.find((document) => document.id === reading.contractDocumentId) ?? reading.documents.find((document) => (document.sections?.length ?? 0) > 0);
}

/** «pp. 1–6», or «p. 3» for a section of a single page. */
function pagesOf(t: TFunction, section: Pick<LeaseDocumentSection, 'firstPage' | 'lastPage'>): string {
  return section.firstPage === section.lastPage
    ? t('leaseDocs.page', { first: section.firstPage })
    : t('leaseDocs.pages', { first: section.firstPage, last: section.lastPage });
}

/** «Contratto (pp. 1–6), attestazione (pp. 7–10), scheda di calcolo (pp. 11–14)»: what the reading recognized in the file, in page order. */
export function recognizedParts(t: TFunction, sections: readonly LeaseDocumentSection[]): string {
  return sections
    .map((section, index) => {
      const name = t(`leaseDocs.section.${section.kind}`);
      return `${index === 0 ? name.charAt(0).toLocaleUpperCase() + name.slice(1) : name} (${pagesOf(t, section)})`;
    })
    .join(', ');
}

/** The sentence of a warning: the pages are named for the ones that are about pages. */
export function warningText(t: TFunction, warning: LeaseReadingWarning): string {
  const code = WARNING_CODES.has(warning.code) ? warning.code : 'default';
  return t(`leaseDocs.warnings.${code}`, { pages: (warning.pages ?? []).join(', ') });
}
