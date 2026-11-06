import { useState } from 'react';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReportPeriod } from '@/api/reports.api';
import { touristTaxSummaryCsvFileName } from '@/api/tourist-tax-summary.api';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SkeletonLine } from '@/components/ui/skeleton';
import { FIRST_FISCAL_YEAR } from '@/features/fiscal/fiscal-format';
import { PERIOD_PRESETS, periodProblem, presetPeriod, type PeriodPresetId } from '@/features/reports/report-period';
import { useWorkspace } from '@/hooks/use-workspace';
import { saveBlobAs } from '@/lib/file-download';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import {
  useDeleteTouristTaxRemittance,
  useDownloadTouristTaxReceipt,
  useDownloadTouristTaxSummaryCsv,
  useTouristTaxSummary,
} from '@/queries/use-tourist-tax-summary';
import type { TouristTaxComuneSummary, TouristTaxRemittance } from '@/types';
import { ComuneSummaryTable } from './comune-summary-table';
import { RecordPaymentDialog } from './record-payment-dialog';
import { TOURIST_TAX_PERIOD_SOURCE, formatCents, receiptFileName } from './tourist-tax-model';

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/**
 * The tourist tax per comune and period (NF-100, REP-05): what the stays owe, what the host paid and the receipts, and where the
 * host records a payment with its receipt. Every figure is read from `GET /api/tourist-tax/summary`; the page works out nothing.
 * The days are the presets of the reports and the days to type, with the rule of the tourist tax report (a year at most). Recording
 * and deleting a payment are offered to who holds `payment.write` (the accountant reads, and cannot change what was paid); the server
 * decides again. A caller who reaches only some of the properties sees what is owed on them and no payment at all.
 */
export function TouristTaxSummaryPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canWrite = hasPermission('short-rent', 'payment.write');
  const today = todayInRome();

  const [preset, setPreset] = useState<PeriodPresetId>('thisYear');
  const [custom, setCustom] = useState<ReportPeriod>(() => presetPeriod('thisYear', today));
  // The comune the person chose, with the days of the summary its row belongs to: while another period loads the previous summary stays
  // on screen with its buttons, and a payment started from its row starts from those days, not from the ones just picked.
  const [recording, setRecording] = useState<{ row: TouristTaxComuneSummary; period: ReportPeriod } | null>(null);
  // The payment to delete stays set while the dialog closes, so its sentence does not empty during the animation.
  const [deleting, setDeleting] = useState<{ remittance: TouristTaxRemittance; open: boolean } | null>(null);

  const period = preset === 'custom' ? custom : presetPeriod(preset, today);
  const problem = periodProblem(period, TOURIST_TAX_PERIOD_SOURCE);
  const summary = useTouristTaxSummary(period, problem === null);
  const downloadCsv = useDownloadTouristTaxSummaryCsv();
  const downloadReceipt = useDownloadTouristTaxReceipt();
  const deleteRemittance = useDeleteTouristTaxRemittance();

  const choosePreset = (next: PeriodPresetId) => {
    // The days to type start from the ones the person was looking at.
    if (next === 'custom') setCustom(period);
    setPreset(next);
  };

  const onDownloadCsv = () => {
    if (problem === null) {
      downloadCsv.mutate(period, { onSuccess: (blob) => saveBlobAs(blob, touristTaxSummaryCsvFileName(period)) });
    }
  };
  const onDownloadReceipt = (remittance: TouristTaxRemittance) =>
    downloadReceipt.mutate(remittance.id, { onSuccess: (blob) => saveBlobAs(blob, receiptFileName(remittance, blob)) });

  const toDelete = deleting?.remittance;
  const data = problem === null ? summary.data : undefined;

  return (
    <AppShell>
      <div className="space-y-6" data-testid="tourist-tax-summary-page">
        <PageHeader
          title={t('reports.touristTax.title')}
          description={t('reports.touristTax.description')}
          crumbs="auto"
          action={
            <Button
              type="button"
              variant="outline"
              loading={downloadCsv.isPending}
              disabled={problem !== null}
              onClick={onDownloadCsv}
              data-testid="tourist-tax-csv"
            >
              <Download aria-hidden="true" className="size-4" />
              {t('reports.touristTax.csv.download')}
            </Button>
          }
        />

        <div role="group" aria-label={t('reports.dialog.period')} className="flex flex-wrap items-end gap-3" data-testid="tourist-tax-filters">
          <Field label={t('reports.dialog.period')} className="w-full sm:w-56">
            <Select value={preset} onChange={(event) => choosePreset(event.target.value as PeriodPresetId)} data-testid="tourist-tax-period">
              {PERIOD_PRESETS.map((id) => (
                <option key={id} value={id}>
                  {t(`reports.preset.${id}`)}
                </option>
              ))}
            </Select>
          </Field>

          {preset === 'custom' ? (
            <>
              <Field label={t('reports.dialog.customFrom')} className="w-full sm:w-44">
                <Input
                  type="date"
                  value={custom.from}
                  min="2000-01-01"
                  max="2100-12-31"
                  onChange={(event) => setCustom((current) => ({ ...current, from: event.target.value }))}
                  data-testid="tourist-tax-from"
                />
              </Field>
              <Field label={t('reports.dialog.customTo')} className="w-full sm:w-44">
                <Input
                  type="date"
                  value={custom.to}
                  min="2000-01-01"
                  max="2100-12-31"
                  onChange={(event) => setCustom((current) => ({ ...current, to: event.target.value }))}
                  data-testid="tourist-tax-to"
                />
              </Field>
            </>
          ) : (
            <p className="pb-2 text-sm text-foreground/70" data-testid="tourist-tax-range">
              {t('reports.dialog.range', {
                from: formatStayDate(period.from, i18n.language, SHORT_DATE),
                to: formatStayDate(period.to, i18n.language, SHORT_DATE),
              })}
            </p>
          )}
        </div>

        {problem ? (
          // The server is not asked for days it would refuse: the page says why, and shows nothing of an earlier choice.
          <p role="alert" className="text-sm text-destructive" data-testid="tourist-tax-problem">
            {t(`reports.error.${problem}`, { year: FIRST_FISCAL_YEAR })}
          </p>
        ) : data ? (
          <div
            className={cn('space-y-4', summary.isPlaceholderData && 'opacity-60')}
            aria-busy={summary.isPlaceholderData}
            data-testid="tourist-tax-results"
          >
            {data.paymentsHidden ? (
              <Alert variant="info" data-testid="tourist-tax-payments-hidden">
                {t('reports.touristTax.paymentsHidden')}
              </Alert>
            ) : null}

            {data.comuni.length === 0 ? (
              // A caller who cannot see the payments is told about the stays only: "no payment recorded" would be false or would give one away.
              <p className="text-sm text-foreground/70" data-testid="tourist-tax-empty">
                {data.paymentsHidden ? t('reports.touristTax.emptyHidden') : t('reports.touristTax.empty')}
              </p>
            ) : (
              <ComuneSummaryTable
                summary={data}
                canWrite={canWrite}
                downloadingId={downloadReceipt.isPending ? (downloadReceipt.variables ?? null) : null}
                onRecord={(row) => setRecording({ row, period: data.period })}
                onDownloadReceipt={onDownloadReceipt}
                onDeleteRemittance={(remittance) => setDeleting({ remittance, open: true })}
              />
            )}

            {data.total.staysWithoutAmount > 0 ? (
              <Alert variant="warning" data-testid="tourist-tax-incomplete-note">
                {t('reports.touristTax.incompleteNote', { count: data.total.staysWithoutAmount })}
              </Alert>
            ) : null}

            <p className="text-sm text-foreground/70" data-testid="tourist-tax-basis">
              {data.paymentsHidden ? t('reports.touristTax.basisHidden') : t('reports.touristTax.basis')}
            </p>
          </div>
        ) : summary.isError ? (
          <ErrorState
            title={t('reports.touristTax.error')}
            error={summary.error}
            onRetry={() => void summary.refetch()}
            testId="tourist-tax-error"
          />
        ) : (
          <SkeletonLine lines={4} />
        )}

        <RecordPaymentDialog comune={recording?.row ?? null} period={recording?.period ?? period} onClose={() => setRecording(null)} />

        <ConfirmationDialog
          open={deleting?.open ?? false}
          onOpenChange={(open) => setDeleting((current) => (current ? { ...current, open } : current))}
          title={t('reports.touristTax.remittances.delete.title')}
          description={
            toDelete
              ? t('reports.touristTax.remittances.delete.confirm', {
                  amount: formatCents(toDelete.amountCents, i18n.language),
                  comune: toDelete.comune,
                  date: formatStayDate(toDelete.paidOn, i18n.language, SHORT_DATE),
                })
              : ''
          }
          confirmLabel={t('reports.touristTax.remittances.delete.button')}
          variant="destructive"
          isLoading={deleteRemittance.isPending}
          onConfirm={async () => {
            if (toDelete) await deleteRemittance.mutateAsync(toDelete.id).catch(() => undefined);
          }}
        />
      </div>
    </AppShell>
  );
}
