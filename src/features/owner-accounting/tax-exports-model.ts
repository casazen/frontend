import type { ReportFileFormat } from '@/api/report-files';

/**
 * The files of the Italian withholding that the agency hands to its accountant (E18/F01/US01/T02, E18/F01/US02, NF-117): the data of an F24, the Certificazione Unica of a year (a file for every recipient and a draft
 * «prospetto» for each owner), the 770 and the communication of the short-let contracts. CasaZen prepares the data and files nothing: each request names the file and what it is made for, never an amount.
 */
export type TaxExportRequest =
  | { kind: 'f24'; year: number; month: number; format: ReportFileFormat }
  | { kind: 'cu'; year: number; format: ReportFileFormat }
  | { kind: 'cuProspect'; year: number; ownerId: string }
  | { kind: 'tax770'; year: number; format: ReportFileFormat }
  | { kind: 'contracts'; year: number; format: ReportFileFormat };

const two = (value: number) => String(value).padStart(2, '0');

/**
 * The name a file is saved under when the page cannot read the one the server gives it (`Content-Disposition`): the kind of file and its period, never an owner, a property or a guest.
 * The extension is the format asked, and `.pdf` for the prospect.
 */
export function taxExportFallbackName(request: TaxExportRequest): string {
  switch (request.kind) {
    case 'f24':
      return `f24-${request.year}-${two(request.month)}-dati.${request.format}`;
    case 'cu':
      return `certificazione-unica-${request.year}.${request.format}`;
    case 'cuProspect':
      return `prospetto-cu-${request.year}.pdf`;
    case 'tax770':
      return `modello-770-${request.year}.${request.format}`;
    case 'contracts':
      return `comunicazione-contratti-${request.year}.${request.format}`;
  }
}

/**
 * The owners the annual data of a year has a record for (the `payloadJson` of `GET api/withholding/annual/{year}`): the totals of each record and nothing else, as the API answers them (`ownerId`, `grossBase`,
 * `withheld`, `evidence`; the recipients are read by the exports only), each owner once. `null` for a payload that is not that list, which the page tells instead of an empty list: a list of owners
 * that silently misses one could be read as complete.
 */
export function cuOwnerIdsOf(payloadJson: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const ids: string[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) return null;
    const { ownerId } = item as Record<string, unknown>;
    if (typeof ownerId !== 'string' || ownerId === '') return null;
    if (!ids.includes(ownerId)) ids.push(ownerId);
  }
  return ids;
}
