import { useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { periodProblem } from '@/features/reports/report-period';
import { useOrg } from '@/hooks/useOrg';
import { useWorkspace } from '@/hooks/use-workspace';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { useOwnerReport, usePerformanceReport, useTrendReport } from '@/queries/use-host-reports';
import { useProperties } from '@/queries/use-properties';
import { OverviewFilters } from './overview-filters';
import {
  HOST_PERIOD_SOURCE,
  defaultOverviewState,
  isEmptyPerformance,
  overviewDays,
  overviewQuery,
  type OverviewGrouping,
  type OverviewState,
} from './overview-model';
import { OwnerTable } from './owner-table';
import { PerformanceTable } from './performance-table';
import { PerformanceTiles } from './performance-tiles';
import { TrendChart } from './trend-chart';

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

export function ReportsOverview() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const headingId = useId();
  const { isAgency } = useOrg();
  const { hasPermission } = useWorkspace();
  const [state, setState] = useState<OverviewState>(() => defaultOverviewState(todayInRome()));
  const properties = useProperties({ mode: 'short' });
  const propertyList = useMemo(() => (Array.isArray(properties.data) ? properties.data : []), [properties.data]);

  const days = overviewDays(state, todayInRome());
  const problem = periodProblem(days, HOST_PERIOD_SOURCE);
  const propertyId = propertyList.some((property) => property.id === state.propertyId) ? state.propertyId : '';

  const mayGroupByOwner = isAgency && hasPermission('short-rent', ORG_BILLING_ADMIN_PERMISSION);
  const asked = problem === null;
  const ownerReport = useOwnerReport(days, asked && mayGroupByOwner && state.grouping === 'owner');
  const ownerRefused = ownerReport.data === null;
  const groupings: readonly OverviewGrouping[] = ['all', 'property', 'channel', ...(mayGroupByOwner && !ownerRefused ? (['owner'] as const) : [])];
  const grouping = groupings.includes(state.grouping) ? state.grouping : 'all';
  const query = overviewQuery(days, { compare: state.compare, grouping }, grouping === 'owner' ? '' : propertyId);

  const performance = usePerformanceReport(query, asked);
  const trend = useTrendReport(query, asked);
  const report = asked ? performance.data : undefined;
  const trendReport = asked ? trend.data : undefined;
  const owners = asked && grouping === 'owner' ? ownerReport : undefined;
  const change = useCallback((next: Partial<OverviewState>) => setState((current) => ({ ...current, ...next })), []);

  return (
    <section aria-labelledby={headingId} data-testid="reports-overview" className="min-w-0 space-y-4">
      <h2 id={headingId} className="text-lg font-semibold">
        {t('reports.overview.title')}
      </h2>

      <OverviewFilters
        state={{ ...state, grouping }}
        days={days}
        properties={propertyList}
        propertyId={propertyId}
        groupings={groupings}
        onChange={change}
      />

      {problem ? (
        <p role="alert" className="text-sm text-destructive" data-testid="reports-overview-problem">
          {t(`reports.error.${problem}`)}
        </p>
      ) : null}

      {report ? (
        <div className={cn('space-y-6', performance.isPlaceholderData && 'opacity-60')} aria-busy={performance.isPlaceholderData} data-testid="reports-overview-results">
          <PerformanceTiles
            row={report.total}
            currency={report.currency}
            compared={report.comparePeriod !== null}
            names={{
              occupancy: t('reports.overview.tiles.occupancy'),
              revenue: t('reports.overview.tiles.revenue'),
              adr: t('reports.overview.tiles.adr'),
              revPar: t('reports.overview.tiles.revPar'),
            }}
            label={t('reports.overview.tiles.label')}
          />
          {report.comparePeriod ? (
            <p className="text-sm text-foreground/70" data-testid="reports-overview-compare-period">
              {t('reports.overview.comparePeriod', {
                from: formatStayDate(report.comparePeriod.from, locale, SHORT_DATE),
                to: formatStayDate(report.comparePeriod.to, locale, SHORT_DATE),
              })}
            </p>
          ) : null}

          {isEmptyPerformance(report) ? (
            <p className="text-sm text-foreground/70" data-testid="reports-overview-empty">
              {t('reports.overview.empty')}
            </p>
          ) : (
            <>
              {trendReport ? (
                <TrendChart
                  unit={trendReport.unit}
                  buckets={trendReport.buckets}
                  series={trendReport.series}
                  currency={trendReport.currency}
                  compared={trendReport.comparePeriod !== null}
                  groupBy={trendReport.groupBy}
                />
              ) : trend.isError ? (
                <ErrorState title={t('reports.overview.error')} error={trend.error} onRetry={() => void trend.refetch()} testId="reports-trend-error" />
              ) : (
                <SkeletonCard lines={4} />
              )}
              {report.groupBy !== 'none' ? (
                <PerformanceTable rows={report.rows} total={report.total} groupBy={report.groupBy} compared={report.comparePeriod !== null} currency={report.currency} />
              ) : null}
              {owners ? (
                owners.data ? (
                  <div className={cn(owners.isPlaceholderData && 'opacity-60')} aria-busy={owners.isPlaceholderData}>
                    <OwnerTable report={owners.data} />
                  </div>
                ) : owners.isError ? (
                  <ErrorState title={t('reports.overview.error')} error={owners.error} onRetry={() => void owners.refetch()} testId="reports-owner-error" />
                ) : (
                  <SkeletonCard lines={4} />
                )
              ) : null}
            </>
          )}
          <p className="text-sm text-foreground/70">{t('reports.overview.basis')}</p>
        </div>
      ) : asked && performance.isError ? (
        <ErrorState title={t('reports.overview.error')} error={performance.error} onRetry={() => void performance.refetch()} testId="reports-overview-error" />
      ) : asked ? (
        <SkeletonLine lines={3} />
      ) : null}
    </section>
  );
}
