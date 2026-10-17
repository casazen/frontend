import type { FiscalReportKind } from '@/api/fiscal.api';
import type { HostReportKind } from '@/api/reports.api';
import { PAYMENTS_PATH, previousMonthRange } from '@/features/payments/lib/payment-list';
import type { PeriodPresetId } from '@/features/reports/report-period';

export type ReportId =
  | 'revenue'
  | 'occupancy'
  | 'channels'
  | 'touristTax'
  | 'annual'
  | 'withholding'
  | 'alloggiati'
  | 'payments';

/** The kind of a report, for the quick filters: what the accountant asks for, what runs the house, what moves money. */
export type ReportType = 'fiscal' | 'operational' | 'financial';

export type ReportFormat = 'csv' | 'pdf';

/** The three reads of `GET /api/reports/*`: CSV only, the file says its base in its title. */
interface HostSource {
  kind: 'host';
  report: HostReportKind;
}

/** The reports of the fiscal area (`GET /api/fiscal/reports/*`), as the page of today asks for them: CSV and PDF. */
interface FiscalSource {
  kind: 'fiscal';
  report: FiscalReportKind;
}

/** A report that already has its page: the row leads there (CasaZen does not copy what the page does). */
interface PageSource {
  kind: 'page';
  href: (today: string) => string;
}

export type ReportSource = HostSource | FiscalSource | PageSource;

/** One row of the page "Report": fixed configuration, eight of them. The words of each are `reports.items.<id>.*`. */
export interface ReportDefinition {
  id: ReportId;
  type: ReportType;
  /** The period the download starts from; none for a row that leads to a page. */
  suggested: PeriodPresetId | null;
  source: ReportSource;
  /** The formats of the file, none for a row that leads to a page. */
  formats: readonly ReportFormat[];
}

/** A report the page can download (the dialog asks for the days and the format). */
export type DownloadableReport = ReportDefinition & { source: HostSource | FiscalSource };

export function isDownloadable(report: ReportDefinition): report is DownloadableReport {
  return report.source.kind !== 'page';
}

const ALLOGGIATI_PATH = '/app/short-rent/alloggiati';

export const REPORTS: readonly ReportDefinition[] = [
  { id: 'revenue', type: 'financial', suggested: 'thisMonth', source: { kind: 'host', report: 'revenue-by-property' }, formats: ['csv'] },
  { id: 'occupancy', type: 'operational', suggested: 'thisMonth', source: { kind: 'host', report: 'occupancy-by-property' }, formats: ['csv'] },
  { id: 'channels', type: 'operational', suggested: 'last3Months', source: { kind: 'host', report: 'bookings-by-channel' }, formats: ['csv'] },
  { id: 'touristTax', type: 'fiscal', suggested: 'last3Months', source: { kind: 'fiscal', report: 'touristTax' }, formats: ['csv', 'pdf'] },
  { id: 'annual', type: 'fiscal', suggested: 'thisYear', source: { kind: 'fiscal', report: 'annual' }, formats: ['csv', 'pdf'] },
  { id: 'withholding', type: 'fiscal', suggested: 'thisYear', source: { kind: 'fiscal', report: 'withholding' }, formats: ['csv', 'pdf'] },
  { id: 'alloggiati', type: 'operational', suggested: null, source: { kind: 'page', href: () => ALLOGGIATI_PATH }, formats: [] },
  // The statement is the list of the payments of last month, which the page can download.
  {
    id: 'payments',
    type: 'financial',
    suggested: null,
    source: { kind: 'page', href: (today) => `${PAYMENTS_PATH}?f_date=${previousMonthRange(today)}` },
    formats: [],
  },
];
