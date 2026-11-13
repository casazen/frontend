import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { cn } from '@/lib/utils';
import { useOnboardingIntegration } from '@/queries/use-onboarding-integration';
import { ConnectionHealthCard } from './components/connection-health-card';
import { ReopenPartsList } from './components/reopen-parts-list';

/**
 * `/app/short-rent/settings/integration`, the integration settings (E10/F03/US03/T01, NF-108, ONB-05): the onboarding is something the host comes back to. The
 * health of the connection to the channel manager comes first (the one highlighted block, with «Ricollega il canale» when the access was revoked), then what can
 * be reopened (who sends the Alloggiati communications, a channel, the properties, any part of the plan) and how the properties and the listings stand. The page
 * only reopens: the wizard that owns each part makes the change.
 *
 * An organization administrator's page (the server asks `OrgBillingAdmin`, and answers 403 to anyone else): who is not one opens it and reads who manages it,
 * with no request sent. Behind the flag `octorateOnboarding`. A read that fails is said as a failure (never as «all in order»); a 404 is «not found» whatever
 * the cache still holds; a refresh that fails while the page shows older figures says so.
 */
export function IntegrationSettingsPage() {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const overview = useOnboardingIntegration({ enabled: isAdmin });

  const notFound = overview.isError && getHttpStatus(overview.error) === 404;
  // TanStack Query keeps the data it had when a later read fails: a 404 is «not found» all the same, and any other failure with older data is said on top of it.
  const failed = overview.isError && (!overview.data || notFound);
  const stale = overview.isError && !failed;

  let content: ReactNode;
  if (!isAdmin) {
    content = (
      <p className="text-sm text-foreground/70" data-testid="integration-admin-only">
        {t('onboardingPlan.integration.adminOnly')}
      </p>
    );
  } else if (overview.isLoading) {
    content = (
      <div role="status" aria-busy="true" className="space-y-3" data-testid="integration-loading">
        <span className="sr-only">{t('onboardingPlan.integration.loading')}</span>
        <Skeleton className="h-32 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if (failed || !overview.data) {
    content = notFound ? (
      <ErrorState testId="integration-error" title={t('onboardingPlan.integration.notFound')} />
    ) : (
      <ErrorState
        testId="integration-error"
        title={t('onboardingPlan.integration.loadError')}
        error={overview.error}
        onRetry={() => void overview.refetch()}
        showSupport
      />
    );
  } else {
    content = (
      <>
        {stale ? (
          <p role="alert" className="text-sm text-danger-foreground" data-testid="integration-stale">
            {t('onboardingPlan.integration.stale')}
          </p>
        ) : null}
        {overview.data.connection ? <ConnectionHealthCard connection={overview.data.connection} /> : null}
        <ReopenPartsList parts={overview.data.parts} senders={overview.data.senders} channels={overview.data.channels} />
      </>
    );
  }

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="integration-settings-page">
        <PageHeader title={t('onboardingPlan.integration.title')} description={t('onboardingPlan.integration.description')} />
        {content}
      </div>
    </AppShell>
  );
}
