import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { AgencyAccessRefused, AgencyFinanceGate } from '@/components/finance/agency-finance-gate';
import { F24Card } from '@/components/finance/F24Card';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { useExactMoney } from '@/hooks/use-exact-money';
import { F24_CURRENCY } from '@/lib/agency-finance';
import { getHttpStatus } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useF24Record, useTaxReconciliation } from '@/queries/use-owner-accounting';
import { useWithholdingSummary } from '@/queries/withholding';

/**
 * Withholding tax page (ADR-018, E06/F05/US01/T02): the withholding of the month by owner, the F24 of the month with its PDF and the registration of its payment.
 * The backend gives it only to the owner and the administrators of an org on the agency plan (`agency.withholding.manage`), so the role and the plan are checked
 * before anything is read (`AgencyFinanceGate`). Opening the page makes nothing: the F24 is read only for a month the reconciliation says has one (the server builds one when asked for a month without), and
 * a month without withholding says so instead of failing.
 */
export function WithholdingPage() {
  const { t } = useTranslation();
  return (
    <AgencyFinanceGate testId="withholding-page" title={t('withholding.title')} description={t('withholding.description')} loadingLabel={t('withholding.loading')}>
      <WithholdingBody />
    </AgencyFinanceGate>
  );
}

function WithholdingBody() {
  const { t } = useTranslation();
  const { month: monthLabel, locale } = useOwnerFormat();
  const money = useExactMoney();
  const today = todayInRome();
  const [selectedMonth, setSelectedMonth] = useState(Number(today.slice(5, 7)));
  const [selectedYear, setSelectedYear] = useState(Number(today.slice(0, 4)));

  const summaryQuery = useWithholdingSummary(selectedMonth, selectedYear);
  const summary = summaryQuery.data;
  // The rest is read once the summary came back: a server that refuses the summary (a 403 the read accepts) refuses the rest the same way, and a second refused
  // read would take the whole app to the page of no access.
  const reconciliation = useTaxReconciliation(selectedYear, summary !== undefined && summary !== null);
  const row = reconciliation.data?.months.find((candidate) => candidate.month === selectedMonth);
  const hasF24 = row?.f24 !== null && row?.f24 !== undefined;
  const f24Query = useF24Record(selectedMonth, selectedYear, hasF24);

  const currentYear = Number(today.slice(0, 4));
  const monthName = (month: number) => new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 1)));

  const header = (
    <PageHeader
      title={t('withholding.title')}
      description={t('withholding.description')}
      crumbs="auto"
      action={
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="month" className="sr-only">
              {t('withholding.month')}
            </Label>
            <Select id="month" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {monthName(month)}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="year" className="sr-only">
              {t('withholding.year')}
            </Label>
            <Select id="year" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </div>
        </div>
      }
    />
  );

  if (summaryQuery.isPending) {
    return (
      <div className="space-y-6" data-testid="withholding-page">
        {header}
        <SkeletonCard lines={4} label={t('withholding.loading')} />
      </div>
    );
  }

  // A 404 is «not found» whatever the cache still holds; any other failure with nothing to show is told with a retry.
  if (summaryQuery.isError && (!summary || getHttpStatus(summaryQuery.error) === 404)) {
    return (
      <div className="space-y-6" data-testid="withholding-page">
        {header}
        <ErrorState
          title={getHttpStatus(summaryQuery.error) === 404 ? t('withholding.notFound') : t('withholding.error')}
          error={getHttpStatus(summaryQuery.error) === 404 ? undefined : summaryQuery.error}
          onRetry={() => void summaryQuery.refetch()}
        />
      </div>
    );
  }

  // The server refuses the summary: the access is not there, and nothing of the page is offered.
  if (summary === null) {
    return (
      <div className="space-y-6" data-testid="withholding-page">
        {header}
        <AgencyAccessRefused />
      </div>
    );
  }

  const period = monthLabel(selectedYear, selectedMonth);
  const owners = summary?.ownerSummaries ?? [];

  return (
    <div className="space-y-6" data-testid="withholding-page">
      {header}

      <PlainSection title={t('withholding.summary.title')} data-testid="withholding-summary">
        <p className="text-sm text-muted-foreground">{t('withholding.summary.description')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">{t('withholding.summary.total')}</p>
            <p className="font-semibold text-2xl" data-testid="withholding-total">
              {money(summary?.totalWithholding ?? 0, F24_CURRENCY)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('withholding.summary.taxable')}</p>
            <p className="font-semibold text-2xl" data-testid="withholding-base">
              {money(summary?.totalBase ?? 0, F24_CURRENCY)}
            </p>
          </div>
        </div>

        {owners.length > 0 ? (
          <ul className="space-y-2" aria-label={t('withholding.summary.byOwner')}>
            {owners.map((owner) => (
              <li key={owner.ownerId} className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-3 text-sm sm:grid-cols-4" data-testid={`withholding-owner-${owner.ownerId}`}>
                <div>
                  <p className="text-muted-foreground">{t('withholding.summary.owner')}</p>
                  <p className="font-medium">{owner.ownerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('withholding.summary.grossBase')}</p>
                  <p className="font-medium">{money(owner.totalBase, F24_CURRENCY)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('withholding.summary.withheld')}</p>
                  <p className="font-semibold">{money(owner.totalWithholding, F24_CURRENCY)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('withholding.summary.payouts')}</p>
                  <p className="font-medium">{owner.payoutCount}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-muted-foreground" data-testid="withholding-none">
            {t('withholding.summary.noData')}
          </p>
        )}
      </PlainSection>

      <PlainSection title={t('withholding.f24.sectionTitle', { period })} data-testid="withholding-f24">
        {reconciliation.isPending ? (
          <SkeletonCard lines={2} label={t('withholding.loading')} />
        ) : reconciliation.isError ? (
          <ErrorState title={t('withholding.error')} error={reconciliation.error} onRetry={() => void reconciliation.refetch()} />
        ) : !hasF24 ? (
          <Alert
            variant="info"
            action={
              <Button asChild size="sm" variant="outline">
                <Link to={`/app/account/owner-close?period=${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}>{t('withholding.f24.openClose')}</Link>
              </Button>
            }
            data-testid="f24-none"
          >
            {t('withholding.f24.none')}
          </Alert>
        ) : f24Query.isPending ? (
          <SkeletonCard lines={3} label={t('withholding.loading')} />
        ) : f24Query.data ? (
          <F24Card record={f24Query.data} />
        ) : (
          <ErrorState title={t('withholding.error')} error={f24Query.error} onRetry={() => void f24Query.refetch()} />
        )}
      </PlainSection>
    </div>
  );
}
