import { contentDispositionFileName } from '@/features/document-archive/document-file';
import type { ComplianceArchiveEntry } from '@/types';

/** What a proof is called in the name of its file, by kind (a kind this version does not know is just «prova»). */
const KIND_SLUGS: Readonly<Record<string, string>> = {
  AlloggiatiReceipt: 'ricevuta-alloggiati',
  IstatProof: 'prova-istat',
  TouristTaxDeclaration: 'dichiarazione-imposta-di-soggiorno',
  TouristTaxPayment: 'pagamento-imposta-di-soggiorno',
};

/** The extension of the files the archive holds, by their type: a PDF, a JPEG or a PNG (the server judges them on their content). */
const EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/**
 * The name a downloaded proof is saved under: the one the server gave it (`Content-Disposition`, when the page may read the header of the answer it
 * was redirected to) or, when it cannot, the one rebuilt from the row: what it proves and the day or month it is about
 * (`ricevuta-alloggiati_2026-08-15.pdf`, `prova-istat_2026-08.pdf`). A missing header is never an error. The extension comes from the type of the
 * file that arrived, then from the one of the row.
 */
export function proofFileName(
  entry: Pick<ComplianceArchiveEntry, 'kind' | 'day' | 'period' | 'contentType'>,
  receivedContentType: string,
  contentDisposition: string | null | undefined,
): string {
  const named = contentDispositionFileName(contentDisposition);
  if (named) return named;

  const type = (receivedContentType || entry.contentType).split(';')[0].trim().toLowerCase();
  return `${KIND_SLUGS[entry.kind] ?? 'prova'}_${entry.period ?? entry.day}${EXTENSIONS[type] ?? ''}`;
}

/** The name an export (the ZIP of the proofs, the report) is saved under: the one the server gave it, or `rebuilt` when the page cannot read it. */
export function exportFileName(contentDisposition: string | null | undefined, rebuilt: string): string {
  return contentDispositionFileName(contentDisposition) ?? rebuilt;
}
