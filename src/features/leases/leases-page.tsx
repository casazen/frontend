import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { LONG_RENT_PROPERTIES_PATH, LONG_RENT_PROPERTY_CREATE_PATH } from '@/features/properties/long-rent/paths';
import { PageHeader } from '@/components/layout/page-header';
import { ListView } from '@/components/shared/list-view/list-view';
import { Button } from '@/components/ui/button';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { useLeases } from '@/queries/use-leases';
import { LongRentGuide } from '@/features/onboarding/components/long-rent-guide';
import type { LeaseSummary } from '@/types';
import { useLeasesList } from './lease-list';

const LEASE_CREATE_PATH = '/app/long-rent/leases/new';

const START_STEPS = [
  { key: 'property', href: LONG_RENT_PROPERTY_CREATE_PATH },
  { key: 'ape', href: LONG_RENT_PROPERTIES_PATH },
  { key: 'lease', href: LEASE_CREATE_PATH },
] as const;

/** First visit with no contracts: the three steps, in order, instead of a single "create" button. */
function LongRentStartGuide() {
  const { t } = useTranslation();

  return (
    <ol className="mx-auto grid max-w-2xl gap-3 text-left" data-testid="long-rent-start-guide">
      {START_STEPS.map((step, index) => (
        <li key={step.key} className="flex gap-3 rounded-lg border bg-card p-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {index + 1}
          </span>
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{t(`leases.guide.${step.key}.title`)}</p>
            <p className="text-sm text-muted-foreground">{t(`leases.guide.${step.key}.description`)}</p>
            <Button variant={index === 0 ? 'default' : 'outline'} size="sm" asChild>
              <Link to={step.href}>{t(`leases.guide.${step.key}.cta`)}</Link>
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The long-term leases (LR-02, LR-02b, LR-02c) on the unified list. The server sends the whole list once (it is not paginated) with, for
 * each lease, its stage, how far along it is and the step it waits for; the list does the rest on the client: the quick filters
 * (`?chip=todo`), the filters of the drawer, the search (`?q=rossi`) and the order, all in the address, with the most urgent step first.
 * Each row has a drawer with the lease at a glance, the button that does its next step, and the CSV.
 *
 * The first visit, with no lease at all, keeps the guide of the first steps (`LongRentGuide` above, the three steps below).
 */
export function LeasesPage() {
  const { t } = useTranslation();
  const list = useLeasesList();
  const viewsScope = useListViewsScope();

  // The plain list has no parameter at all: it is the same request, and the same cache, as the guide above it makes.
  const { data, isLoading, isError, error, refetch } = useLeases(undefined, { refetchOnMount: true });
  const leases: readonly LeaseSummary[] = data ?? [];
  const noLeasesAtAll = !isLoading && !isError && leases.length === 0;

  return (
    <div className="min-w-0 space-y-6" data-testid="leases-page">
      <PageHeader
        title={t('nav.leases')}
        description={t('leaseList.description')}
        crumbs="auto"
        primary={{ label: t('leases.createLease'), icon: Plus, to: LEASE_CREATE_PATH, testId: 'lease-list-new' }}
        mobilePrimary="fab"
      />

      <LongRentGuide />

      <ListView<LeaseSummary>
        list={list}
        rows={leases}
        isLoading={isLoading}
        isError={isError && !isLoading}
        error={error}
        errorTitle={t('leases.loadError')}
        onRetry={() => void refetch()}
        viewsScope={viewsScope}
        testId="lease-list"
      />

      {noLeasesAtAll ? <LongRentStartGuide /> : null}
    </div>
  );
}
