import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isArchiveCallCancelled } from '@/api/document-archive.api';
import { AppShell } from '@/components/layout/app-shell';
import { FinanceSectionLinks } from '@/components/finance/finance-section-links';
import { BedDouble, Files, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { FocusBlock } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { SkeletonCard } from '@/components/ui/skeleton';
import { isFeatureEnabled } from '@/config/feature-flags';
import { formatFileSize } from '@/features/document-archive/document-file';
import { reportView, type ReportView } from '@/features/reports/money-reports/money-model';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { todayInRome } from '@/lib/stay-dates';
import { useAgencySummary, useDownloadAccountantPackage } from '@/queries/use-accountant-package';
import type { AgencySummary } from '@/types';
import { defaultPackagePeriod, downloadProblem, parsePackagePeriod, periodChoices, periodKey, type PackagePeriod } from './accountant-package-model';
import { DocumentsSection, OwnersSection, StaysSection } from './summary-sections';
import { useSummaryFormat } from './use-summary-format';

const NOTE = 'break-words text-sm text-foreground/70';

/**
 * «Commercialista» (E15/F02/US01/T01, NF-101, NF-115): the agency sees the summary of a month or a year and downloads the package of the accountant from one page. A tab of Incassi next to
 * Report. One highlighted block, the package, with the period it is made for and its button; under it the summary of the agency as compact tables, in three sections, each row in its own
 * currency and nothing added across currencies. A line says what the accountant receives and that CasaZen issues every document: the accountant issues nothing and gets only these files.
 *
 * The period is in the address (`?period=2026-10` or `?period=2026`) and nowhere else: not in the browser's storage, and whatever the address says is what the page shows. The summary is the
 * server's, the very one of `riepilogo-agenzia/` in the ZIP, and the page works out nothing. For a caller who may not read the owner accounting (the server says so) the owner figures are not
 * drawn at all and the page says that those folders are not in the package either.
 *
 * The page is behind the flag `accountantPackage` and for who may read payments (`payment.read`; the route asks for both, and without either nothing is asked of the server). A read that
 * failed is a failed read with a retry, never an empty summary; a 404 is the module being off at the server, whatever the cache still holds; a 403 is told in words in the page.
 */
export function AccountantPackagePage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const canRead = hasPermission('short-rent', 'payment.read');
  const active = isFeatureEnabled(flags, 'accountantPackage');

  return (
    <AppShell>
      <div className="space-y-6" data-testid="accountant-package-page">
        <PageHeader title={t('accountantPackage.title')} description={t('accountantPackage.description')} crumbs="auto" />
        {!canRead ? (
          <p className={NOTE} data-testid="accountant-package-no-access">
            {t('accountantPackage.noAccess')}
          </p>
        ) : !active ? (
          <p className={NOTE} data-testid="accountant-package-unavailable">
            {t('accountantPackage.unavailable')}
          </p>
        ) : (
          <PackageBody />
        )}
      </div>
    </AppShell>
  );
}

function PackageBody() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const today = todayInRome();
  // The address is the choice: a period that is not a month or a year (what the server would refuse) is no period, and the month that is over applies.
  const period = parsePackagePeriod(params.get('period')) ?? defaultPackagePeriod(today);
  const key = periodKey(period);
  const summary = useAgencySummary(key);
  const view = reportView(summary);

  if (view.kind === 'notFound') {
    // A 404 is the module being off at the server, whatever the cache still holds: said, never the figures of an earlier read.
    return (
      <p className={NOTE} data-testid="accountant-package-unavailable">
        {t('accountantPackage.unavailable')}
      </p>
    );
  }
  if (view.kind === 'forbidden') {
    return (
      <p className={NOTE} data-testid="accountant-package-no-access">
        {t('accountantPackage.noAccess')}
      </p>
    );
  }

  const choose = (value: string) => {
    const next = new URLSearchParams(params);
    next.set('period', value);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PackageBlock period={period} today={today} ownerAccounting={view.kind === 'ready' ? view.data.ownerAccountingIncluded : null} onPeriod={choose} />
      <SummaryArea view={view} onRetry={() => void summary.refetch()} />
    </>
  );
}

interface PackageBlockProps {
  period: PackagePeriod;
  today: string;
  /** What the summary says about the owner accounting, or `null` while it is not known (the summary is on its way, or it failed). */
  ownerAccounting: boolean | null;
  onPeriod: (value: string) => void;
}

/**
 * The period and the package: the one highlighted block of the page. Everything that moves while the ZIP comes (the bytes that arrived, the answer) lives here and not in the page, so the
 * tables under it are not drawn again for every chunk. While the download is on the period cannot be changed (the file is the one of the period it was asked for), and a second click is
 * ignored; the person can stop it, which is not a failure. Whatever way the page goes away the download goes with it.
 */
function PackageBlock({ period, today, ownerAccounting, onPeriod }: PackageBlockProps) {
  const { t, i18n } = useTranslation();
  const format = useSummaryFormat();
  const download = useDownloadAccountantPackage();
  const key = periodKey(period);
  const [received, setReceived] = useState(0);
  // The failure belongs to the period it came from: another period shows none of it, and no effect has to forget it.
  const [problem, setProblem] = useState<{ period: string; text: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );

  const pending = download.isPending;
  const label = period.kind === 'year' ? t('accountantPackage.period.year', { year: period.year }) : format.month(period.year, period.month);
  const choices = periodChoices(today, period);

  const start = () => {
    setProblem(null);
    setReceived(0);
    const controller = new AbortController();
    request.current = controller;
    download.mutate(
      { period: key, signal: controller.signal, onProgress: setReceived },
      {
        onSuccess: () => toast.success(t('accountantPackage.download.done')),
        onError: (error) => {
          // A call the person stopped is not a failure to tell.
          if (isArchiveCallCancelled(error)) return;
          setProblem({ period: key, text: downloadProblem(error, t) });
        },
      },
    );
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(14rem,1fr)_2fr]" data-testid="accountant-package-block">
      <div className="rounded-2xl border bg-card p-5">
        <Field label={t('accountantPackage.period.label')}>
          <Select value={key} onChange={(event) => onPeriod(event.target.value)} disabled={pending} data-testid="accountant-period">
            <optgroup label={t('accountantPackage.period.months')}>
              {choices.months.map((value) => {
                const month = parsePackagePeriod(value);
                return (
                  <option key={value} value={value}>
                    {month?.kind === 'month' ? format.month(month.year, month.month) : value}
                  </option>
                );
              })}
            </optgroup>
            <optgroup label={t('accountantPackage.period.years')}>
              {choices.years.map((value) => (
                <option key={value} value={value}>
                  {t('accountantPackage.period.year', { year: value })}
                </option>
              ))}
            </optgroup>
          </Select>
        </Field>
      </div>

      <FocusBlock
        kicker={t('accountantPackage.focus.kicker', { period: label })}
        title={t('accountantPackage.focus.title')}
        body={
          <div className="space-y-2">
            <p data-testid="accountant-package-contents">{t('accountantPackage.focus.contents')}</p>
            <p data-testid="accountant-package-issuer">{t('accountantPackage.focus.issuer')}</p>
            {ownerAccounting === false ? <p data-testid="accountant-owner-omitted">{t('accountantPackage.focus.ownerOmitted')}</p> : null}
            {pending ? (
              <p role="status" className="text-foreground/70" data-testid="accountant-download-progress">
                {received > 0 ? t('accountantPackage.download.received', { size: formatFileSize(received, i18n.language) }) : t('accountantPackage.download.preparing')}
              </p>
            ) : null}
          </div>
        }
        primary={{ label: t('accountantPackage.focus.download'), onClick: start, loading: pending, testId: 'accountant-download' }}
        secondary={pending ? { label: t('accountantPackage.focus.cancel'), onClick: () => request.current?.abort(), testId: 'accountant-download-cancel' } : undefined}
        data-testid="accountant-package-focus"
      />

      {problem?.period === key ? (
        <p role="alert" className="break-words text-sm text-destructive" data-testid="accountant-download-problem">
          {problem.text}
        </p>
      ) : null}
    </div>
  );
}

interface SummaryAreaProps {
  view: ReportView<AgencySummary>;
  onRetry: () => void;
}

/** The summary of the period, or what stands in its place while it has none to show: the read on its way, or a failed read with a retry (never an empty summary). */
function SummaryArea({ view, onRetry }: SummaryAreaProps) {
  const { t } = useTranslation();
  const format = useSummaryFormat();

  if (view.kind === 'loading') return <SkeletonCard lines={4} label={t('accountantPackage.loading')} />;
  if (view.kind === 'error') return <ErrorState title={t('accountantPackage.loadError')} error={view.error} onRetry={onRetry} testId="accountant-summary-error" />;
  if (view.kind !== 'ready') return null;

  const summary = view.data;
  return (
    <section aria-label={t('accountantPackage.summary.title')} className="space-y-8" data-testid="accountant-summary">
      <p className={NOTE} data-testid="accountant-summary-range">
        {t('accountantPackage.summary.range', { from: format.date(summary.from), to: format.date(summary.to), generated: format.date(summary.generatedOn) })}
        {summary.periodKind === 'year' ? ` ${t('accountantPackage.summary.yearNote')}` : ''}
      </p>
      <FinanceSectionLinks label={t('accountantPackage.summary.title')} links={[
        { id: 'accountant-documents', label: t('accountantPackage.documents.title'), icon: Files },
        ...(summary.ownerAccountingIncluded ? [{ id: 'accountant-owners', label: t('accountantPackage.owners.title'), icon: Users }] : []),
        { id: 'accountant-stays', label: t('accountantPackage.stays.title'), icon: BedDouble },
      ]} />
      <DocumentsSection summary={summary} />
      {summary.ownerAccountingIncluded ? <OwnersSection summary={summary} /> : null}
      <StaysSection summary={summary} />
    </section>
  );
}
