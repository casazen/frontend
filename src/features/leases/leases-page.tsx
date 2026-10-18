import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { LONG_RENT_PROPERTIES_PATH, LONG_RENT_PROPERTY_CREATE_PATH } from '@/features/properties/long-rent/paths';
import { PageHeader } from '@/components/layout/page-header';
import { ListView } from '@/components/shared/list-view/list-view';
import { useListState } from '@/components/shared/list-view/use-list-state';
import { Button } from '@/components/ui/button';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { useLeases } from '@/queries/use-leases';
import { LongRentGuide } from '@/features/onboarding/components/long-rent-guide';
import type { LeaseSummary } from '@/types';
import { leaseViewOfChip, useLeasesList } from './lease-list';

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
 * The long-term leases (LR-02) on the unified list: a search and the views of the server (Attivi, In preparazione, In
 * scadenza, Terminati) that stay in the address (`?chip=active&q=rossi`), the name of the tenant and the rent that is late,
 * the state in a badge, a drawer with the lease at a glance, and the CSV. The server narrows the list (`GET /leases?view=&q=`),
 * so the page asks it with what the address says; the list does not filter or sort on its own.
 *
 * The first visit, with no lease at all, keeps the guide of the first steps (`LongRentGuide` above, the three steps below).
 */
export function LeasesPage() {
  const { t } = useTranslation();
  const list = useLeasesList();
  const viewsScope = useListViewsScope();
  const { state } = useListState(list);

  const view = leaseViewOfChip(state.chip);
  const search = state.q.trim();
  // The plain list has no parameter at all: it is the same request, and the same cache, as the guide above it makes.
  const params = view || search ? { view, q: search || undefined } : undefined;
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useLeases(params, { keepPrevious: true, refetchOnMount: true });
  const leases: readonly LeaseSummary[] = data ?? [];
  const noLeasesAtAll = !isLoading && !isError && !isPlaceholderData && leases.length === 0 && params === undefined;

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
        mode="server"
        rows={leases}
        isLoading={isLoading}
        isRefreshing={isPlaceholderData}
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
