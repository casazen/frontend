import type { FiscalReportKind } from '@/api/fiscal.api';
import type { HostReportKind } from '@/api/reports.api';
import { isFeatureRuleEnabled, type FeatureFlagKey, type FeatureFlags } from '@/config/feature-flags';
import { PAYMENTS_PATH, previousMonthRange } from '@/features/payments/lib/payment-list';
import type { PeriodPresetId } from '@/features/reports/report-period';

export type ReportId =
  | 'revenue'
  | 'occupancy'
  | 'channels'
  | 'channelCosts'
  | 'collections'
  | 'touristTax'
  | 'touristTaxSummary'
  | 'touristTaxYearEnd'
  | 'annual'
  | 'withholding'
  | 'alloggiati'
  | 'payments';

export type ReportType = 'fiscal' | 'operational' | 'financial';

export type ReportFormat = 'csv' | 'pdf';

interface HostSource {
  kind: 'host';
  report: HostReportKind;
}

interface FiscalSource {
  kind: 'fiscal';
  report: FiscalReportKind;
}

interface PageSource {
  kind: 'page';
  href: (today: string) => string;
}

export type ReportSource = HostSource | FiscalSource | PageSource;

export interface ReportDefinition {
  id: ReportId;
  type: ReportType;
  suggested: PeriodPresetId | null;
  source: ReportSource;
  formats: readonly ReportFormat[];
  featureFlag?: FeatureFlagKey;
}

export type DownloadableReport = ReportDefinition & { source: HostSource | FiscalSource };

export function isDownloadable(report: ReportDefinition): report is DownloadableReport {
  return report.source.kind !== 'page';
}

const ALLOGGIATI_PATH = '/app/short-rent/alloggiati';
const TOURIST_TAX_SUMMARY_PATH = '/app/short-rent/reports/tourist-tax';
const TOURIST_TAX_YEAR_END_PATH = '/app/short-rent/reports/tourist-tax/year-end';
const COLLECTIONS_PATH = '/app/short-rent/reports/collections';
const CHANNEL_COSTS_PATH = '/app/short-rent/reports/channel-costs';

export const REPORTS: readonly ReportDefinition[] = [
  { id: 'revenue', type: 'financial', suggested: 'thisMonth', source: { kind: 'host', report: 'revenue-by-property' }, formats: ['csv'] },
  { id: 'occupancy', type: 'operational', suggested: 'thisMonth', source: { kind: 'host', report: 'occupancy-by-property' }, formats: ['csv'] },
  { id: 'channels', type: 'operational', suggested: 'last3Months', source: { kind: 'host', report: 'bookings-by-channel' }, formats: ['csv'] },
  { id: 'channelCosts', type: 'financial', suggested: null, source: { kind: 'page', href: () => CHANNEL_COSTS_PATH }, formats: [] },
  { id: 'collections', type: 'financial', suggested: null, source: { kind: 'page', href: () => COLLECTIONS_PATH }, formats: [] },
  { id: 'touristTax', type: 'fiscal', suggested: 'last3Months', source: { kind: 'fiscal', report: 'touristTax' }, formats: ['csv', 'pdf'] },
  { id: 'touristTaxSummary', type: 'fiscal', suggested: null, source: { kind: 'page', href: () => TOURIST_TAX_SUMMARY_PATH }, formats: [] },
  {
    id: 'touristTaxYearEnd',
    type: 'fiscal',
    suggested: null,
    source: { kind: 'page', href: () => TOURIST_TAX_YEAR_END_PATH },
    formats: [],
    featureFlag: 'taxReportingExports',
  },
  { id: 'annual', type: 'fiscal', suggested: 'thisYear', source: { kind: 'fiscal', report: 'annual' }, formats: ['csv', 'pdf'] },
  { id: 'withholding', type: 'fiscal', suggested: 'thisYear', source: { kind: 'fiscal', report: 'withholding' }, formats: ['csv', 'pdf'] },
  { id: 'alloggiati', type: 'operational', suggested: null, source: { kind: 'page', href: () => ALLOGGIATI_PATH }, formats: [] },
  {
    id: 'payments',
    type: 'financial',
    suggested: null,
    source: { kind: 'page', href: (today) => `${PAYMENTS_PATH}?chip=all&f_date=${previousMonthRange(today)}` },
    formats: [],
  },
];

/**
 * The rows of the list for the flags the backend reports: a row of a page behind a flag is there only while the flag is on (the page is not in the router otherwise, and its endpoints answer 404), so with every flag off
 * the list is the one it always was.
 */
export function reportsFor(flags: Partial<FeatureFlags> | undefined): readonly ReportDefinition[] {
  return REPORTS.filter((report) => isFeatureRuleEnabled(flags, report.featureFlag));
}
