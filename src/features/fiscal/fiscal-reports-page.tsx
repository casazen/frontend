import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useDownloadFiscalReport,
  useFiscalAnnualReport,
  useFiscalWithholdingReport,
  useTouristTaxReport,
} from '@/queries/use-fiscal';
import { FiscalDisclaimer } from '@/features/fiscal/components/fiscal-disclaimer';
import {
  FISCAL_PERIOD_PRESETS,
  fiscalYears,
  formatMonth,
  formatMoney,
  formatRate,
  periodOf,
  type FiscalPeriodPreset,
} from '@/features/fiscal/fiscal-format';
import { getProblemMessage } from '@/lib/api-errors';
import { getBookingSourceLabel } from '@/lib/i18n-labels';
import { saveBlobAs } from '@/lib/file-download';
import { formatStayDate } from '@/lib/stay-dates';
import type {
  AnnualIncomeReport,
  FiscalExportFormat,
  FiscalReportKind,
  FiscalTaxNote,
  TouristTaxReport,
  WithholdingReport,
} from '@/api/fiscal.api';

/** Short reason shown in the "estimated tax" cell when the backend does not estimate it. */
const ESTIMATE_NOTE_KEYS: Record<FiscalTaxNote, string> = {
  irpef_ordinaria_not_computed: 'fiscal.reports.estimateNote.irpef',
  impresa_not_computed: 'fiscal.reports.estimateNote.impresa',
  regime_not_assigned: 'fiscal.reports.estimateNote.noRegime',
  short_stay_threshold_exceeded: 'fiscal.reports.estimateNote.threshold',
};

const FILE_NAMES: Record<FiscalReportKind, string> = {
  annual: 'casazen-redditi',
  withholding: 'casazen-ritenute',
  touristTax: 'casazen-tassa-soggiorno',
};

/** Test id prefix of the download buttons (the summary keeps the historical `fiscal-export-*`). */
const EXPORT_TEST_IDS: Record<FiscalReportKind, string> = {
  annual: 'fiscal-export',
  withholding: 'fiscal-withholding-export',
  touristTax: 'fiscal-tourist-tax-export',
};

const SHORT_DATE: Intl.DateTimeFormatOptions = { dateStyle: 'short' };

const th = 'pb-2 pr-3 font-medium';
const thNum = `${th} text-right`;
const td = 'py-1.5 pr-3 align-top';
const tdNum = `${td} text-right tabular-nums`;

export function FiscalReportsPage() {
  const { t } = useTranslation();
  const years = useMemo(() => fiscalYears(), []);
  const [year, setYear] = useState(years[0]);
  const [preset, setPreset] = useState<FiscalPeriodPreset>('year');
  const period = periodOf(year, preset);
  const annual = useFiscalAnnualReport(year, period);
  const withholding = useFiscalWithholdingReport(year, period);
  const touristTax = useTouristTaxReport(period);
  const download = useDownloadFiscalReport();

  const onDownload = (kind: FiscalReportKind, format: FiscalExportFormat) =>
    download.mutate(
      { kind, taxYear: year, period, format },
      {
        onSuccess: (blob) => saveBlobAs(blob, `${FILE_NAMES[kind]}-${period.from}-${period.to}.${format}`),
        onError: (err) => toast.error(getProblemMessage(err, t) ?? t('fiscal.reports.downloadFailed')),
      },
    );

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto" data-testid="fiscal-reports-page">
        <PageHeader title={t('fiscal.reports.title')} description={t('fiscal.reports.description')} />
        <FiscalDisclaimer />
        <p data-testid="fiscal-pack-label" className="text-sm font-medium">
          {t('fiscal.reports.packLabel')}
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label htmlFor="fiscal-report-year" className="text-sm font-medium">
              {t('fiscal.reports.year')}
            </label>
            <select
              id="fiscal-report-year"
              data-testid="fiscal-report-year"
              className="block rounded-md border bg-background px-3 py-2 text-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="fiscal-report-period" className="text-sm font-medium">
              {t('fiscal.reports.period')}
            </label>
            <select
              id="fiscal-report-period"
              data-testid="fiscal-report-period"
              className="block rounded-md border bg-background px-3 py-2 text-sm"
              value={preset}
              onChange={(e) => setPreset(e.target.value as FiscalPeriodPreset)}
            >
              {FISCAL_PERIOD_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {t(`fiscal.reports.periods.${p}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ReportSection
          kind="annual"
          title={t('fiscal.reports.annual.title')}
          description={t('fiscal.reports.annual.description')}
          query={annual}
          isEmpty={(d) => d.properties.length === 0}
          emptyText={t('fiscal.reports.annual.empty')}
          downloading={download.isPending}
          onDownload={onDownload}
        >
          {(d) => <AnnualTable report={d} />}
        </ReportSection>

        <ReportSection
          kind="withholding"
          title={t('fiscal.reports.withholding.title')}
          description={t('fiscal.reports.withholding.description')}
          query={withholding}
          isEmpty={(d) => d.lines.length === 0}
          emptyText={t('fiscal.reports.withholding.empty')}
          downloading={download.isPending}
          onDownload={onDownload}
        >
          {(d) => <WithholdingTables report={d} />}
        </ReportSection>

        <ReportSection
          kind="touristTax"
          title={t('fiscal.reports.touristTax.title')}
          description={t('fiscal.reports.touristTax.description')}
          query={touristTax}
          isEmpty={(d) => d.rows.length === 0}
          emptyText={t('fiscal.reports.touristTax.empty')}
          downloading={download.isPending}
          onDownload={onDownload}
        >
          {(d) => <TouristTaxTable report={d} />}
        </ReportSection>
      </div>
    </AppShell>
  );
}

interface ReportQuery<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => unknown;
}

interface ReportSectionProps<T> {
  kind: FiscalReportKind;
  title: string;
  description: string;
  query: ReportQuery<T>;
  isEmpty: (data: T) => boolean;
  emptyText: string;
  downloading: boolean;
  onDownload: (kind: FiscalReportKind, format: FiscalExportFormat) => void;
  children: (data: T) => ReactNode;
}

/** A report with its loading, error (never shown as empty) and empty states, and the CSV/PDF downloads. */
function ReportSection<T>({
  kind,
  title,
  description,
  query,
  isEmpty,
  emptyText,
  downloading,
  onDownload,
  children,
}: ReportSectionProps<T>) {
  const { t } = useTranslation();
  const testId = EXPORT_TEST_IDS[kind];
  return (
    <Card data-testid={`fiscal-report-${kind}`}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading && <p data-testid={`fiscal-report-${kind}-loading`}>{t('fiscal.loading')}</p>}
        {query.isError && (
          <div className="space-y-2" data-testid={`fiscal-report-${kind}-error`}>
            <p className="text-sm text-destructive">{getProblemMessage(query.error, t) ?? t('fiscal.reports.loadError')}</p>
            <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
              {t('fiscal.retry')}
            </Button>
          </div>
        )}
        {query.data &&
          (isEmpty(query.data) ? (
            <p className="text-sm text-muted-foreground" data-testid={`fiscal-report-${kind}-empty`}>
              {emptyText}
            </p>
          ) : (
            children(query.data)
          ))}
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid={`${testId}-csv`}
            variant="outline"
            size="sm"
            disabled={downloading}
            onClick={() => onDownload(kind, 'csv')}
          >
            {t('fiscal.reports.downloadCsv')}
          </Button>
          <Button
            data-testid={`${testId}-pdf`}
            variant="outline"
            size="sm"
            disabled={downloading}
            onClick={() => onDownload(kind, 'pdf')}
          >
            {t('fiscal.reports.downloadPdf')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnnualTable({ report }: { report: AnnualIncomeReport }) {
  const { t, i18n } = useTranslation();
  const money = (v: number) => formatMoney(v, i18n.language);
  const regime = (r: AnnualIncomeReport['properties'][number]['regime']) =>
    r ? t(`fiscal.regime.${r}`) : t('fiscal.notAssigned');
  const { totals, rules } = report;
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="fiscal-annual-table">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className={th}>{t('fiscal.reports.col.property')}</th>
              <th className={th}>{t('fiscal.reports.col.regime')}</th>
              <th className={thNum}>{t('fiscal.reports.col.gross')}</th>
              <th className={thNum}>{t('fiscal.reports.col.touristTax')}</th>
              <th className={thNum}>{t('fiscal.reports.col.commissions')}</th>
              <th className={thNum}>{t('fiscal.reports.col.withholding')}</th>
              <th className={thNum}>{t('fiscal.reports.col.taxable')}</th>
              <th className={thNum}>{t('fiscal.reports.col.estimatedTax')}</th>
            </tr>
          </thead>
          <tbody>
            {report.properties.map((l) => (
              <tr key={l.propertyId} className="border-b" data-testid={`fiscal-annual-row-${l.propertyId}`}>
                <td className={td}>{l.name}</td>
                <td className={td}>{regime(l.regime)}</td>
                <td className={tdNum}>{money(l.grossIncome)}</td>
                <td className={tdNum}>{money(l.touristTax)}</td>
                <td className={tdNum}>{l.commissions == null ? t('fiscal.reports.notAvailable') : money(l.commissions)}</td>
                <td className={tdNum}>{money(l.withholding)}</td>
                <td className={tdNum}>{l.taxableIncome == null ? '—' : money(l.taxableIncome)}</td>
                <td className={tdNum}>
                  {l.estimatedTax != null ? (
                    <>
                      {money(l.estimatedTax)}
                      {l.taxRate != null && (
                        <span className="block text-xs text-muted-foreground">{formatRate(l.taxRate, i18n.language)}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {l.taxNote ? t(ESTIMATE_NOTE_KEYS[l.taxNote]) : '—'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-medium" data-testid="fiscal-annual-total">
              <td className={td}>{t('fiscal.reports.total')}</td>
              <td className={td} />
              <td className={tdNum}>{money(totals.grossIncome)}</td>
              <td className={tdNum}>{money(totals.touristTax)}</td>
              <td className={tdNum}>{t('fiscal.reports.notAvailable')}</td>
              <td className={tdNum}>{money(totals.withholding)}</td>
              <td className={tdNum}>{money(totals.taxableIncome)}</td>
              <td className={tdNum}>{money(totals.estimatedTax)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {report.taxpayers.length > 1 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="fiscal-annual-taxpayers">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className={th}>{t('fiscal.reports.col.taxpayer')}</th>
                <th className={thNum}>{t('fiscal.reports.col.properties')}</th>
                <th className={thNum}>{t('fiscal.reports.col.rental')}</th>
                <th className={thNum}>{t('fiscal.reports.col.withholding')}</th>
                <th className={thNum}>{t('fiscal.reports.col.estimatedTax')}</th>
              </tr>
            </thead>
            <tbody>
              {report.taxpayers.map((tp) => (
                <tr key={tp.index} className="border-b">
                  <td className={td}>
                    {tp.isOrgTaxProfile
                      ? t('fiscal.taxpayer.org')
                      : t('fiscal.taxpayer.code', { code: tp.fiscalCodeMasked ?? '' })}
                    {tp.thresholdExceeded && (
                      <span className="block text-xs text-destructive">{t('fiscal.reports.overThreshold')}</span>
                    )}
                  </td>
                  <td className={tdNum}>{tp.properties}</td>
                  <td className={tdNum}>{money(tp.rentalIncome)}</td>
                  <td className={tdNum}>{money(tp.withholding)}</td>
                  <td className={tdNum}>{money(tp.estimatedTax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground" data-testid="fiscal-annual-notes">
        <li>{t('fiscal.reports.notes.gross')}</li>
        <li>{t('fiscal.reports.notes.commissions')}</li>
        <li>
          {t('fiscal.reports.notes.estimate', {
            rate: formatRate(rules.cedolareRate, i18n.language),
            reducedRate: formatRate(rules.cedolareReducedRate, i18n.language),
            source: rules.cedolareSource,
          })}
        </li>
        <li>{t('fiscal.reports.notes.notEstimated', { max: rules.maxApartmentsPerTaxpayer, source: rules.thresholdSource })}</li>
      </ul>
    </div>
  );
}

function WithholdingTables({ report }: { report: WithholdingReport }) {
  const { t, i18n } = useTranslation();
  const money = (v: number) => formatMoney(v, i18n.language);
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="fiscal-withholding-by-ota">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className={th}>{t('fiscal.reports.col.channel')}</th>
              <th className={thNum}>{t('fiscal.reports.col.payments')}</th>
              <th className={thNum}>{t('fiscal.reports.col.gross')}</th>
              <th className={thNum}>{t('fiscal.reports.col.withholding')}</th>
              <th className={thNum}>{t('fiscal.reports.col.net')}</th>
            </tr>
          </thead>
          <tbody>
            {report.byOta.map((b) => (
              <tr key={b.source} className="border-b">
                <td className={td}>{getBookingSourceLabel(b.source, t)}</td>
                <td className={tdNum}>{b.payoutCount}</td>
                <td className={tdNum}>{money(b.gross)}</td>
                <td className={tdNum}>{money(b.withholding)}</td>
                <td className={tdNum}>{money(b.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-medium" data-testid="fiscal-withholding-total">
              <td className={td}>{t('fiscal.reports.total')}</td>
              <td className={tdNum}>{report.totals.payoutCount}</td>
              <td className={tdNum}>{money(report.totals.gross)}</td>
              <td className={tdNum}>{money(report.totals.withholding)}</td>
              <td className={tdNum}>{money(report.totals.net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="fiscal-withholding-lines">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className={th}>{t('fiscal.reports.col.date')}</th>
              <th className={th}>{t('fiscal.reports.col.property')}</th>
              <th className={th}>{t('fiscal.reports.col.booking')}</th>
              <th className={th}>{t('fiscal.reports.col.channel')}</th>
              <th className={thNum}>{t('fiscal.reports.col.gross')}</th>
              <th className={thNum}>{t('fiscal.reports.col.withholding')}</th>
              <th className={thNum}>{t('fiscal.reports.col.net')}</th>
            </tr>
          </thead>
          <tbody>
            {report.lines.map((l) => (
              <tr key={l.paymentId} className="border-b">
                <td className={td}>{formatStayDate(l.paidOn, i18n.language, SHORT_DATE)}</td>
                <td className={td}>{l.propertyName}</td>
                <td className={td}>{l.bookingCode}</td>
                <td className={td}>{getBookingSourceLabel(l.source, t)}</td>
                <td className={tdNum}>{money(l.gross)}</td>
                <td className={tdNum}>{money(l.withholding)}</td>
                <td className={tdNum}>{money(l.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('fiscal.reports.notes.withholding', {
          rate: formatRate(report.rules.otaWithholdingRate, i18n.language),
          source: report.rules.otaWithholdingSource,
        })}
      </p>
    </div>
  );
}

function TouristTaxTable({ report }: { report: TouristTaxReport }) {
  const { t, i18n } = useTranslation();
  const money = (v: number) => formatMoney(v, i18n.language);
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="fiscal-tourist-tax-table">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className={th}>{t('fiscal.reports.col.comune')}</th>
              <th className={th}>{t('fiscal.reports.col.month')}</th>
              <th className={thNum}>{t('fiscal.reports.col.stays')}</th>
              <th className={thNum}>{t('fiscal.reports.col.nights')}</th>
              <th className={thNum}>{t('fiscal.reports.col.guests')}</th>
              <th className={thNum}>{t('fiscal.reports.col.recordedTax')}</th>
              <th className={thNum}>{t('fiscal.reports.col.withoutAmount')}</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={`${r.comune}-${r.year}-${r.month}`} className="border-b">
                <td className={td}>{r.comune}</td>
                <td className={td}>{formatMonth(r.year, r.month, i18n.language)}</td>
                <td className={tdNum}>{r.stays}</td>
                <td className={tdNum}>{r.nights}</td>
                <td className={tdNum}>{r.guests}</td>
                <td className={tdNum}>{money(r.amount)}</td>
                <td className={tdNum}>{r.staysWithoutAmount}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-medium" data-testid="fiscal-tourist-tax-total">
              <td className={td}>{t('fiscal.reports.total')}</td>
              <td className={td} />
              <td className={tdNum}>{report.totals.stays}</td>
              <td className={tdNum}>{report.totals.nights}</td>
              <td className={tdNum}>{report.totals.guests}</td>
              <td className={tdNum}>{money(report.totals.amount)}</td>
              <td className={tdNum}>{report.totals.staysWithoutAmount}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {report.totals.staysWithoutAmount > 0 && (
        <p className="text-sm text-muted-foreground" data-testid="fiscal-tourist-tax-without-amount">
          {t('fiscal.reports.touristTax.withoutAmount', { count: report.totals.staysWithoutAmount })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('fiscal.reports.touristTax.note')}</p>
    </div>
  );
}

