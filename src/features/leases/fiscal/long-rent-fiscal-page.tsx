import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { longRentFiscalFileName } from '@/api/long-rent-fiscal.api';
import { PageHeader } from '@/components/layout/page-header';
import { PlainSection, StatStrip, StatTile } from '@/components/shared/calm';
import { ListView } from '@/components/shared/list-view/list-view';
import { Alert } from '@/components/ui/alert';
import { Tabs } from '@/components/ui/tabs';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import { formatCurrency } from '@/lib/utils';
import { useDownloadLongRentFiscal, useLongRentFiscalReport } from '@/queries/use-long-rent-fiscal';
import {
  FISCAL_YEAR_PARAM,
  fiscalNotesOf,
  fiscalReportYears,
  fiscalYearOfAddress,
} from './long-rent-fiscal-format';
import { useLongRentFiscalList } from './long-rent-fiscal-list';

/**
 * The fiscal report of the long-term area (LR-11b): per lease, for the accountant, in a year. It is an estimate and opens by
 * saying so. Three numbers (the rent accrued, the rent collected as CasaZen has it, the cedolare secca), the leases with their
 * base under each number, what makes a figure uncertain, and the button that downloads the file of the same year. The year is the
 * tab (`?anno=`): this one, and the one before. Every figure comes from the server, the page works none out and writes none.
 *
 * A lease in the ordinary regime has no tax figure (it depends on the total income of the landlord): the row says so.
 */
export function LongRentFiscalPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const years = fiscalReportYears();
  const year = fiscalYearOfAddress(searchParams.get(FISCAL_YEAR_PARAM), years);

  const { data, isLoading, isError, error, refetch } = useLongRentFiscalReport(year);
  const download = useDownloadLongRentFiscal();
  const list = useLongRentFiscalList(year);

  const onDownload = () =>
    download.mutate(year, {
      onSuccess: (blob) => {
        saveBlobAs(blob, longRentFiscalFileName(year));
        toast.success(t('longRentFiscal.downloaded', { year }));
      },
      onError: (failure) => toast.error(getProblemMessage(failure, t) ?? t('longRentFiscal.downloadFailed')),
    });

  const totals = data?.totals;
  const notes = fiscalNotesOf(data?.rows ?? []);

  return (
    <div className="min-w-0 space-y-6" data-testid="long-rent-fiscal-page">
      <PageHeader
        title={t('longRentFiscal.title')}
        description={t('longRentFiscal.description')}
        crumbs="auto"
        primary={{
          label: t('longRentFiscal.download', { year }),
          icon: Download,
          onClick: onDownload,
          disabled: download.isPending,
          testId: 'long-rent-fiscal-download',
        }}
        mobilePrimary="none"
      />

      <Alert variant="info" title={t('longRentFiscal.estimate.title')} data-testid="long-rent-fiscal-estimate">
        {t('longRentFiscal.estimate.text')}
      </Alert>

      <Tabs
        label={t('longRentFiscal.yearsLabel')}
        param={FISCAL_YEAR_PARAM}
        value={String(year)}
        defaultValue={String(years.current)}
        items={[
          { value: String(years.current), label: String(years.current), testId: 'long-rent-fiscal-year-current' },
          { value: String(years.previous), label: String(years.previous), testId: 'long-rent-fiscal-year-previous' },
        ]}
        className="space-y-6"
      >
        <div className="min-w-0 space-y-6">
          {totals ? (
            <StatStrip label={t('longRentFiscal.stats.label')} data-testid="long-rent-fiscal-stats">
              <StatTile label={t('longRentFiscal.stats.accrual', { year })} value={formatCurrency(totals.accrualEur)} />
              <StatTile label={t('longRentFiscal.stats.collected')} value={formatCurrency(totals.collectedEur)} />
              <StatTile
                label={
                  totals.cedolareLeases > 0
                    ? t('longRentFiscal.stats.cedolare', { count: totals.cedolareLeases })
                    : t('longRentFiscal.stats.cedolareNone')
                }
                value={totals.cedolareLeases > 0 ? formatCurrency(totals.cedolareEur) : '—'}
              />
            </StatStrip>
          ) : null}

          <ListView
            list={list}
            rows={data?.rows ?? []}
            isLoading={isLoading}
            isError={isError && !isLoading}
            error={error}
            errorTitle={t('longRentFiscal.loadError')}
            onRetry={() => void refetch()}
            testId="long-rent-fiscal-list"
          />

          {notes.length > 0 ? (
            <PlainSection title={t('longRentFiscal.notesTitle')} data-testid="long-rent-fiscal-notes">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {notes.map((code) => (
                  <li key={code}>{t(`leases.rli.advisory.note.${code}`)}</li>
                ))}
              </ul>
            </PlainSection>
          ) : null}
        </div>
      </Tabs>
    </div>
  );
}
