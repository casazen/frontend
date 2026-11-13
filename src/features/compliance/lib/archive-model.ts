import { addMonths } from '@/features/reports/report-period';
import { endOfMonth, formatStayDate, isStayDate, startOfMonth } from '@/lib/stay-dates';
import { COMPLIANCE_PROOF_KINDS, type ComplianceProofKind, type CoverageEvidenceClass, type CoverageKind, type CoverageReport, type CoverageRow } from '@/types';

/** The two tabs of the page: what is expected and what CasaZen holds. */
export type ArchiveTab = 'summary' | 'proofs';

/** The names of the parameters of the address of the page: the first four are the ones the cockpit links write (`complianceActionRoute`). */
export const ARCHIVE_PARAMS = { kind: 'kind', property: 'property', period: 'period', day: 'day', tab: 'tab', page: 'page' } as const;

/** The months before the current one that the default period reaches back to: the three whole months before it, and the current one. */
const RECENT_MONTHS = 3;

/** The months the period list offers, counting the current one. */
const LISTED_MONTHS = 12;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const YEAR = /^\d{4}$/;
/** An id of a property as the API writes it (a GUID): anything else in the address is not a property. */
const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** The years the backend knows (`HostDashboardPeriod`): a period outside them is a mistake of the address. */
const FIRST_YEAR = 2000;
const LAST_YEAR = 2100;

/** What the address of the page asks for. Every field is already valid: anything the address says wrong is left out, never guessed. */
export interface ArchiveAddress {
  tab: ArchiveTab;
  kind?: ComplianceProofKind;
  propertyId?: string;
  /** A month (`2026-08`) or a year (`2026`): the period of the filter. */
  period?: string;
  /** One day (`2026-08-15`): narrower than a period, so when it is there it is the only one. */
  day?: string;
  page: number;
}

function inSupportedYears(year: number): boolean {
  return year >= FIRST_YEAR && year <= LAST_YEAR;
}

/** `value` when it is a month of the supported years (`yyyy-MM`) or a year (`yyyy`), otherwise `undefined`. */
function validPeriod(value: string | null): string | undefined {
  if (value === null) return undefined;
  const month = MONTH.exec(value);
  if (month) return inSupportedYears(Number(month[1])) ? value : undefined;
  return YEAR.test(value) && inSupportedYears(Number(value)) ? value : undefined;
}

/** `value` when it is a real day of the supported years, otherwise `undefined`. */
function validDay(value: string | null): string | undefined {
  return value !== null && isStayDate(value) && inSupportedYears(Number(value.slice(0, 4))) ? value : undefined;
}

/**
 * The filters and the tab the address of the page asks for (`?kind=IstatProof&property=<id>&period=2026-08&day=…&tab=proofs&page=2`). It is what a link
 * of the cockpit opens the page with: the page then shows the proofs of that kind, that property and that month, and the summary (when it has one)
 * narrowed in the same way. A parameter that is not valid (a kind that is not one of the four, an id that is not an id, a month that is not a month, a
 * day that is not a day) is left out: the page then shows more than the link meant, never another thing. The tab is the proofs (`?tab=proofs`) or, when
 * the page has a summary (`hasSummary`) and no tab is asked, the summary: without a summary every address opens the proofs.
 */
export function readArchiveAddress(params: URLSearchParams, hasSummary: boolean): ArchiveAddress {
  const kind = params.get(ARCHIVE_PARAMS.kind);
  const property = params.get(ARCHIVE_PARAMS.property);
  const day = validDay(params.get(ARCHIVE_PARAMS.day));
  const page = Number(params.get(ARCHIVE_PARAMS.page));
  const asked = params.get(ARCHIVE_PARAMS.tab);

  return {
    // The summary is the page when no tab is asked (the plain address of the page); the proofs are `?tab=proofs`. Without a summary every address is the proofs.
    tab: hasSummary && asked !== 'proofs' ? 'summary' : 'proofs',
    kind: COMPLIANCE_PROOF_KINDS.find((candidate) => candidate === kind),
    propertyId: property !== null && GUID.test(property) ? property : undefined,
    period: day === undefined ? validPeriod(params.get(ARCHIVE_PARAMS.period)) : undefined,
    day,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** The days of the period the page looks at, both included: the day, the month, the year, or by default the recent months. */
export function archiveWindow(address: Pick<ArchiveAddress, 'period' | 'day'>, today: string): { from: string; to: string } {
  if (address.day) return { from: address.day, to: address.day };
  const { period } = address;
  if (period && YEAR.test(period)) return { from: `${period}-01-01`, to: `${period}-12-31` };
  if (period) return { from: `${period}-01`, to: endOfMonth(`${period}-01`) };
  return { from: addMonths(startOfMonth(today), -RECENT_MONTHS), to: endOfMonth(today) };
}

/** The months the period list offers: this one and the eleven before it (`yyyy-MM`), newest first. */
export function listedMonths(today: string): string[] {
  const thisMonth = startOfMonth(today);
  return Array.from({ length: LISTED_MONTHS }, (_, index) => addMonths(thisMonth, -index).slice(0, 7));
}

/** The year of `today` and the one before, for the periods of a whole year. */
export function listedYears(today: string): string[] {
  const year = Number(today.slice(0, 4));
  return [String(year), String(year - 1)].filter((value) => inSupportedYears(Number(value)));
}

/** A month (`yyyy-MM`), a year (`yyyy`) or a day (`yyyy-MM-dd`) as a person reads it, in the language of the page: «agosto 2026», «2026», «15 agosto 2026». */
export function formatPeriod(period: string, language: string): string {
  if (isStayDate(period)) return formatStayDate(period, language) || period;
  const month = MONTH.exec(period);
  if (!month) return period;
  return new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1)));
}

/** The kind of proof a row of the report is about, to start an upload from it: the receipt, the ISTAT proof, the declaration (the payment is chosen in the dialog). */
export function proofKindOfRow(kind: CoverageKind): ComplianceProofKind {
  switch (kind) {
    case 'Alloggiati':
      return 'AlloggiatiReceipt';
    case 'Istat':
      return 'IstatProof';
    case 'TouristTax':
      return 'TouristTaxDeclaration';
  }
}

/** Whether a row of the report is about what the proofs are filtered to (the tourist tax holds two kinds of proof: its declaration and its payment). */
export function rowMatchesKind(row: Pick<CoverageRow, 'kind'>, kind: ComplianceProofKind | undefined): boolean {
  return kind === undefined || proofKindOfRow(row.kind) === kind || (row.kind === 'TouristTax' && kind === 'TouristTaxPayment');
}

/** The proofs that make money (the receipt of a tax declaration or payment): they are read with `payment.read` and written with `payment.write`. */
export function isTaxKind(kind: ComplianceProofKind): boolean {
  return kind === 'TouristTaxDeclaration' || kind === 'TouristTaxPayment';
}

/** Whether a proof is about a month (ISTAT and tourist tax: the day the API sends is the first of the month) or about a day (an Alloggiati receipt). */
export function isMonthKind(kind: ComplianceProofKind): boolean {
  return kind !== 'AlloggiatiReceipt';
}

/** The groups of the report, in the order they are told: what is missing first, then what only the channel manager can tell, then what is proven. */
export const COVERAGE_GROUPS: readonly CoverageEvidenceClass[] = ['Missing', 'ExternalVerificationRequired', 'OfficialProof', 'NotApplicable'];

/** The rows of one state, in the order the API sent them (by day, most recent first). A state this version does not know is a row to verify, never a proof. */
export function rowsOf(rows: readonly CoverageRow[], state: CoverageEvidenceClass): CoverageRow[] {
  return rows.filter((row) => (COVERAGE_GROUPS.includes(row.evidenceClass) ? row.evidenceClass : 'ExternalVerificationRequired') === state);
}

/** How the headline of the summary weighs: what is missing is the host's, what is to verify is in hand, `success` only when the API says everything is proven. */
export type SummaryTone = 'danger' | 'warning' | 'success' | 'neutral';

export interface CoverageSummary {
  tone: SummaryTone;
  /** The key of the headline; the counts are its variables. */
  key: 'missing' | 'toVerify' | 'allProven' | 'nothingOwed' | 'unknown';
  missing: number;
  toVerify: number;
  proven: number;
}

/**
 * The headline of the summary of a period, from the counts of the report. Never «all compliant» while something is missing or only the channel
 * manager can tell (AC 8): `allProven` needs the API to say `complete`, nothing missing, nothing to verify and at least one proof. A report that
 * says nothing is owed is told so; one with no counts that does not say it is complete is «da verificare», never green: green is never inferred
 * from the absence of data.
 */
export function summarizeCoverage(report: Pick<CoverageReport, 'complete' | 'officialProof' | 'externalVerificationRequired' | 'missing' | 'rows'>): CoverageSummary {
  // The counts of the API and the rows are both read, and the larger wins: whichever says something is missing or to verify is believed.
  const missing = Math.max(report.missing, rowsOf(report.rows, 'Missing').length);
  const toVerify = Math.max(report.externalVerificationRequired, rowsOf(report.rows, 'ExternalVerificationRequired').length);
  const proven = report.officialProof;
  const counts = { missing, toVerify, proven };

  if (missing > 0) return { tone: 'danger', key: 'missing', ...counts };
  if (toVerify > 0) return { tone: 'warning', key: 'toVerify', ...counts };
  if (report.complete && proven > 0) return { tone: 'success', key: 'allProven', ...counts };
  if (report.complete && report.rows.every((row) => row.evidenceClass === 'NotApplicable')) return { tone: 'neutral', key: 'nothingOwed', ...counts };
  return { tone: 'warning', key: 'unknown', ...counts };
}
