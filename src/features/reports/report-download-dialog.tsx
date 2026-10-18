import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { hostReportFileName, type ReportPeriod } from '@/api/reports.api';
import { FIRST_FISCAL_YEAR, fiscalReportFileName } from '@/features/fiscal/fiscal-format';
import type { DownloadableReport, ReportFormat } from '@/features/reports/report-catalog';
import { PERIOD_PRESETS, periodProblem, presetPeriod, type PeriodPresetId } from '@/features/reports/report-period';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { useDownloadFiscalReport } from '@/queries/use-fiscal';
import { useDownloadHostReport } from '@/queries/use-host-reports';

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

interface ReportDownloadDialogProps {
  /** The report to download, or null while the dialog is closed. */
  report: DownloadableReport | null;
  onClose: () => void;
}

/**
 * Asks for the days and the format of a report and downloads it (SR-10). The three reports of short rent come from
 * `GET /api/reports/*` as a CSV; the fiscal ones go through the download code of the fiscal reports page
 * (`useDownloadFiscalReport`, `saveBlobAs`), with the same parameters. A period the backend would refuse (more than 24 months,
 * days in disorder, a fiscal report across two years) is told before the call; when the call fails the dialog says why and the
 * button becomes "Riprova".
 */
export function ReportDownloadDialog({ report, onClose }: ReportDownloadDialogProps) {
  return (
    <Dialog
      open={report !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {report ? <DownloadForm key={report.id} report={report} onClose={onClose} /> : null}
    </Dialog>
  );
}

function DownloadForm({ report, onClose }: { report: DownloadableReport; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const today = todayInRome();
  const name = t(`reports.items.${report.id}.name`);

  // The period the report suggests; the days to type start from it.
  const suggested: Exclude<PeriodPresetId, 'custom'> =
    report.suggested && report.suggested !== 'custom' ? report.suggested : 'thisMonth';
  const [preset, setPreset] = useState<PeriodPresetId>(suggested);
  const [custom, setCustom] = useState<ReportPeriod>(() => presetPeriod(suggested, today));
  const [format, setFormat] = useState<ReportFormat>(report.formats[0] ?? 'csv');
  const [failure, setFailure] = useState<string | null>(null);
  const hostDownload = useDownloadHostReport();
  const fiscalDownload = useDownloadFiscalReport();

  const period = preset === 'custom' ? custom : presetPeriod(preset, today);
  const problem = periodProblem(period, report.source);
  const pending = hostDownload.isPending || fiscalDownload.isPending;

  const choosePreset = (next: PeriodPresetId) => {
    // The days to type start from the ones the person was looking at.
    if (next === 'custom') setCustom(period);
    setFailure(null);
    setPreset(next);
  };
  const changeCustom = (change: Partial<ReportPeriod>) => {
    setFailure(null);
    setCustom((current) => ({ ...current, ...change }));
  };

  const onSuccess = (blob: Blob, fileName: string) => {
    saveBlobAs(blob, fileName);
    toast.success(t('reports.downloaded', { name }));
    onClose();
  };
  const onError = (error: unknown) => setFailure(getProblemMessage(error, t) ?? t('reports.downloadFailed'));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (problem || pending) return;

    setFailure(null);
    const { source } = report;
    if (source.kind === 'host') {
      hostDownload.mutate(
        { kind: source.report, period },
        { onSuccess: (blob) => onSuccess(blob, hostReportFileName(source.report, period)), onError },
      );
    } else {
      fiscalDownload.mutate(
        { kind: source.report, taxYear: Number(period.from.slice(0, 4)), period, format },
        { onSuccess: (blob) => onSuccess(blob, fiscalReportFileName(source.report, period, format)), onError },
      );
    }
  };

  const from = formatStayDate(period.from, i18n.language, SHORT_DATE);
  const to = formatStayDate(period.to, i18n.language, SHORT_DATE);

  return (
    <DialogContent data-testid="report-download-dialog">
      <DialogHeader>
        <DialogTitle>{t('reports.dialog.title', { name })}</DialogTitle>
        <DialogDescription>{t('reports.dialog.description')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label={t('reports.dialog.period')}>
          <Select value={preset} onChange={(event) => choosePreset(event.target.value as PeriodPresetId)} data-testid="report-period">
            {PERIOD_PRESETS.map((id) => (
              <option key={id} value={id}>
                {t(`reports.preset.${id}`)}
              </option>
            ))}
          </Select>
        </Field>

        {preset === 'custom' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('reports.dialog.customFrom')}>
              <Input
                type="date"
                value={custom.from}
                min="2000-01-01"
                max="2100-12-31"
                onChange={(event) => changeCustom({ from: event.target.value })}
                data-testid="report-from"
              />
            </Field>
            <Field label={t('reports.dialog.customTo')}>
              <Input
                type="date"
                value={custom.to}
                min="2000-01-01"
                max="2100-12-31"
                onChange={(event) => changeCustom({ to: event.target.value })}
                data-testid="report-to"
              />
            </Field>
          </div>
        ) : from && to ? (
          <p className="text-sm text-foreground/70" data-testid="report-range">
            {t('reports.dialog.range', { from, to })}
          </p>
        ) : null}

        {report.formats.length > 1 ? (
          <Segmented<ReportFormat>
            label={t('reports.dialog.format')}
            options={report.formats.map((id) => ({ value: id, label: t(`reports.format.${id}`), testId: `report-format-${id}` }))}
            value={format}
            onValueChange={(next) => {
              setFailure(null);
              setFormat(next);
            }}
          />
        ) : (
          <p className="text-sm text-foreground/70">{t('reports.dialog.csvOnly')}</p>
        )}

        {problem ? (
          <p role="alert" className="text-sm text-destructive" data-testid="report-problem">
            {t(`reports.error.${problem}`, { year: FIRST_FISCAL_YEAR })}
          </p>
        ) : null}
        {failure ? (
          <p role="alert" className="text-sm text-destructive" data-testid="report-failure">
            {failure}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('shared.cancel')}
          </Button>
          <Button type="submit" loading={pending} disabled={problem !== null} data-testid="report-submit">
            {failure ? t('reports.retry') : t('reports.download')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
