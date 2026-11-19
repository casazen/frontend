import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import type { YearEndAccountCut } from '@/api/tourist-tax-summary.api';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { StaleReadNotice } from '@/components/finance/stale-read-notice';
import { PlainSection, StatStrip, StatTile } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { useTouristTaxYearSummary } from '@/queries/use-tourist-tax-year-end';
import type { TouristTaxSummary } from '@/types';
import { YearEndDetails } from './year-end-details';
import { YearEndFiles } from './year-end-files';
import { hasYearEndCurrency, yearEndMoney, yearEndYears } from './tourist-tax-year-end-model';

/** The page of the figures by comune, where the host also records a payment: «Apri il riepilogo per comune» leads there (it opens on the current year: it is the page of any period, not of this year). */
const TOURIST_TAX_PATH = '/app/short-rent/reports/tourist-tax';

interface FiguresProps {
  year: number;
  summary: TouristTaxSummary;
}

/**
 * The Italian tourist tax of the year in four numbers, as the server sends them (the page adds nothing up): the nights, what the stays record as due, what was remitted to the comuni and the difference, in the currency
 * the answer names. These are the figures the declaration to the comuni is made of. A stay with no tax recorded is never a tax of zero: the note says the due amount may be incomplete, and the file counts such stays apart.
 */
function YearFigures({ year, summary }: FiguresProps) {
  const { t, i18n } = useTranslation();
  const { total, currency } = summary;
  const money = (cents: number | null) => (cents === null ? '—' : yearEndMoney(cents, currency, i18n.language));
  const count = (value: number) => new Intl.NumberFormat(i18n.language).format(value);

  return (
    <div className="space-y-3" data-testid="year-end-figures">
      {summary.comuni.length === 0 ? (
        // Said in words: a year with no stay in Italy and no payment has no row, and it is not a declaration of zeros.
        <p className="text-sm text-foreground/70" data-testid="year-end-empty">
          {t('reports.touristTax.yearEnd.figures.empty', { year })}
        </p>
      ) : (
        <>
          <StatStrip label={t('reports.touristTax.yearEnd.figures.label', { year })}>
            <StatTile label={t('reports.touristTax.yearEnd.figures.nights')} value={count(total.nights)} data-testid="year-end-nights" />
            <StatTile label={t('reports.touristTax.yearEnd.figures.owed')} value={money(total.owedCents)} data-testid="year-end-owed" />
            <StatTile label={t('reports.touristTax.yearEnd.figures.paid')} value={money(total.paidCents)} data-testid="year-end-paid" />
            <StatTile label={t('reports.touristTax.yearEnd.figures.balance')} value={money(total.balanceCents)} data-testid="year-end-balance" />
          </StatStrip>
          {total.staysWithoutAmount > 0 ? (
            <Alert variant="warning" data-testid="year-end-incomplete">
              {t('reports.touristTax.incompleteNote', { count: total.staysWithoutAmount })}
            </Alert>
          ) : null}
          {hasYearEndCurrency(currency) ? null : (
            <p className="text-sm text-foreground/70" data-testid="year-end-currency-missing">
              {t('reports.touristTax.yearEnd.figures.currencyMissing')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface FiguresSectionProps {
  year: number;
  query: UseQueryResult<TouristTaxSummary | null>;
}

/**
 * What the page says about the figures of the year, whatever the read did: a wait, a failure with a retry, a refusal told in words, the figures of the caller who reaches the whole organization, or the sentence that says
 * the figures belong to the whole organization. A 404 is «not found» whatever the cache still holds, a failed read is never drawn as an empty year, and the answer of a year is never shown under another.
 */
function FiguresSection({ year, query }: FiguresSectionProps) {
  const { t } = useTranslation();
  const { data } = query;
  const notFound = query.isError && getHttpStatus(query.error) === 404;

  let body: ReactNode;
  if (query.isPending) {
    body = <SkeletonLine lines={3} label={t('reports.touristTax.yearEnd.figures.loading')} />;
  } else if (query.isError && (!data || notFound)) {
    body = (
      <ErrorState
        title={notFound ? t('reports.touristTax.yearEnd.figures.notFound') : t('reports.touristTax.yearEnd.figures.error')}
        error={notFound ? undefined : query.error}
        onRetry={() => void query.refetch()}
        testId="year-end-error"
      />
    );
  } else if (!data) {
    // The server refuses the summary to this caller (`null`; no answer and no failure is a wait, told above): the access is not there, and nothing of a declaration is drawn (not zeros, not an empty year).
    body = (
      <Alert variant="info" data-testid="year-end-refused">
        {t('reports.touristTax.yearEnd.figures.refused')}
      </Alert>
    );
  } else if (data.paymentsHidden) {
    // A caller who reaches only some of the properties: the figures of the year belong to the whole organization, so none is shown (a part of them would read as the declaration).
    body = (
      <Alert variant="info" data-testid="year-end-partial">
        {t('reports.touristTax.yearEnd.figures.partial')}
      </Alert>
    );
  } else {
    body = (
      <>
        {/* A failed read with the last answer in memory (a 404 is told before): the figures may be out of date. */}
        {query.isError ? <StaleReadNotice onRetry={() => void query.refetch()} /> : null}
        <YearFigures year={year} summary={data} />
      </>
    );
  }

  return (
    <PlainSection
      title={t('reports.touristTax.yearEnd.figures.title', { year })}
      actionLabel={t('reports.touristTax.yearEnd.figures.byComune')}
      href={TOURIST_TAX_PATH}
      aria-busy={query.isFetching}
      data-testid="year-end-summary"
    >
      {body}
    </PlainSection>
  );
}

/**
 * The tourist tax at year end (E18/F01/US02/T03, NF-117): the year to hand over, the Italian figures it is made of, the three files for the comuni and for Ticino, and under them the same three results on screen. It is a page
 * of the list of reports behind the flag `taxReportingExports` (the backend answers 404 without it) and for who may read payments, as the API asks at its door; the year-end results need the whole organization, and the
 * server says so when they do not get it.
 *
 * The figures at the top are the year's summary from `GET /api/tourist-tax/summary`. The files are the year-end exports as CSV or Excel, which the page offers and never opens. The sections under them are the data of those
 * same files as JSON (`YearEndDetails`), shown as the server gives it: who may read the reasons of the exemptions is the server's (`guest.read`, art. 9 GDPR), and the page never works one out.
 */
export function TouristTaxYearEndPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const years = yearEndYears();
  const [year, setYear] = useState(years[0]);
  // The account of the agent is cut by month or by quarter: one choice for the file and for the account on screen.
  const [by, setBy] = useState<YearEndAccountCut>('month');
  const summary = useTouristTaxYearSummary(year);

  return (
    <AppShell>
      <div className="space-y-6" data-testid="tourist-tax-year-end-page">
        <PageHeader
          title={t('reports.touristTax.yearEnd.title')}
          description={t('reports.touristTax.yearEnd.description')}
          crumbs="auto"
          action={
            <div className="flex items-center gap-2">
              <Label htmlFor="year-end-year" className="sr-only">
                {t('reports.touristTax.yearEnd.year')}
              </Label>
              <Select id="year-end-year" value={year} onChange={(event) => setYear(Number(event.target.value))} data-testid="year-end-year">
                {years.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
          }
        />

        <FiguresSection year={year} query={summary} />

        <YearEndFiles year={year} by={by} onByChange={setBy} canReadReasons={hasPermission('short-rent', 'guest.read')} />

        <YearEndDetails year={year} by={by} onByChange={setBy} />
      </div>
    </AppShell>
  );
}
