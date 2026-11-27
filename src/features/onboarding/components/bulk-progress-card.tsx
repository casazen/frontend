import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import { ErrorState } from '@/components/shared/error-state';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { flowNameKey, isOnboardingFlowKey } from '@/lib/onboarding-flows';
import type { BulkFlowProgress, BulkProgress } from '@/types/onboarding.types';

/** A count the server sent as a number; anything else is 0 (never `NaN` on screen). */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

interface BulkProgressCardProps {
  /** The progress query of the page (`useBulkProgress`): the page owns it so that the card and the pilot group read the same answer. */
  progress: UseQueryResult<BulkProgress>;
}

/**
 * «142 di 250 pronte» (E10/F03/US03/T02, NF-105, AC-NF105-3): how many properties are ready, with a bar, and for each flow how many are active, ready to be
 * switched on, still to complete and not available. It sits at the top of the page, always on screen, and follows what the agency does (the page reads it again
 * every 15 seconds). A property is ready when every flow that applies to it is active or has everything it needs.
 *
 * A read that fails is said as a failure and never as «all ready»; a 404 is «not found» whatever the cache holds; a refresh that fails over older figures says
 * that they may be out of date. With no property there is nothing to count: it says so instead of «0 di 0 pronte».
 */
export function BulkProgressCard({ progress }: BulkProgressCardProps) {
  const { t } = useTranslation();
  const notFound = progress.isError && getHttpStatus(progress.error) === 404;
  const failed = progress.isError && (!progress.data || notFound);
  const stale = progress.isError && !failed;
  const data = progress.data;

  let body;
  if (progress.isLoading) {
    body = (
      <div role="status" aria-busy="true" className="space-y-2" data-testid="bulk-progress-loading">
        <span className="sr-only">{t('onboardingPlan.bulk.progress.loading')}</span>
        <Skeleton className="h-8 w-48 motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-24 w-full motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if (failed || !data) {
    body = notFound ? (
      <ErrorState testId="bulk-progress-error" title={t('onboardingPlan.bulk.progress.notFound')} />
    ) : (
      <ErrorState testId="bulk-progress-error" title={t('onboardingPlan.bulk.progress.loadError')} error={progress.error} onRetry={() => void progress.refetch()} showSupport />
    );
  } else {
    const total = count(data.total);
    const ready = Math.min(count(data.ready), total);
    const flows = (Array.isArray(data.flows) ? data.flows : []).filter((flow): flow is BulkFlowProgress => !!flow && isOnboardingFlowKey(flow.flow));
    body =
      total === 0 ? (
        <p className="text-sm text-foreground/70" data-testid="bulk-progress-empty">
          {t('onboardingPlan.bulk.progress.empty')}
        </p>
      ) : (
        <>
          {stale ? (
            <p role="alert" className="text-sm text-danger-foreground" data-testid="bulk-progress-stale">
              {t('onboardingPlan.bulk.progress.stale')}
            </p>
          ) : null}
          <p className="text-2xl font-bold tabular-nums" data-testid="bulk-progress-summary">
            {t('onboardingPlan.bulk.progress.ready', { ready, count: total })}
          </p>
          <Progress
            value={(ready / total) * 100}
            tone={ready === total ? 'success' : 'default'}
            label={t('onboardingPlan.bulk.progress.title')}
            valueText={t('onboardingPlan.bulk.progress.ready', { ready, count: total })}
            data-testid="bulk-progress-bar"
          />
          {flows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm" data-testid="bulk-progress-flows">
                <caption className="sr-only">{t('onboardingPlan.bulk.progress.flowsCaption')}</caption>
                <thead>
                  <tr className="border-b text-foreground/70">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      {t('onboardingPlan.bulk.progress.flow')}
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">
                      {t('onboardingPlan.bulk.progress.active')}
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">
                      {t('onboardingPlan.bulk.progress.readyColumn')}
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">
                      {t('onboardingPlan.bulk.progress.toComplete')}
                    </th>
                    <th scope="col" className="py-2 pl-2 text-right font-medium">
                      {t('onboardingPlan.bulk.progress.notAvailable')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {flows.map((flow) => (
                    <tr key={flow.flow} className="border-b last:border-b-0" data-testid={`bulk-progress-flow-${flow.flow}`}>
                      <th scope="row" className="py-2 pr-3 font-medium">
                        {t(flowNameKey(flow.flow))}
                      </th>
                      <td className="px-2 py-2 text-right tabular-nums">{count(flow.active)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{count(flow.ready)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{count(flow.toComplete)}</td>
                      <td className="py-2 pl-2 text-right tabular-nums">{count(flow.notAvailable)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      );
  }

  return (
    <section
      aria-labelledby="bulk-progress-title"
      aria-busy={progress.isFetching && !progress.isLoading ? true : undefined}
      className="min-w-0 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
      data-testid="bulk-progress"
    >
      <h2 id="bulk-progress-title" className="text-lg font-semibold">
        {t('onboardingPlan.bulk.progress.title')}
      </h2>
      {body}
    </section>
  );
}
