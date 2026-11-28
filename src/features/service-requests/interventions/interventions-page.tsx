import { useMemo } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Wrench } from 'lucide-react';
import { ServicePageHeader } from '@/features/supplier/components/service-page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ListView } from '@/components/shared/list-view/list-view';
import { useListState } from '@/components/shared/list-view/use-list-state';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { useProperties } from '@/queries/use-properties';
import { useServiceCategories } from '@/queries/use-service-categories';
import { useInterventionCounts, useInterventions, useLatestInterventions } from '@/queries/use-service-requests';
import type { Property } from '@/types';
import type { ServiceRequest } from '@/types/service-request';
import {
  currentInterventionsSearch,
  INTERVENTIONS_PAGE_SIZE,
  interventionFilterParams,
  interventionListParams,
  readBookingId,
  supplierOptions,
} from './intervention-model';
import { useInterventionsList } from './interventions-list';
import { INTERVENTIONS_PATH, requestInterventionPath } from './paths';
import { useHostPermissions } from './use-host-permissions';
import { useInterventionActions } from './use-intervention-actions';

const NO_PROPERTIES: readonly Property[] = [];
const NO_REQUESTS: readonly ServiceRequest[] = [];
const NO_CODES: readonly string[] = [];

/**
 * The interventions of the host (SR-08): what it asked of the suppliers, in the unified list in `server` mode, with the chips, the
 * filters, the order and the one action of a row (the one the server names). The server does the searching, filtering, ordering and
 * paging (`GET /api/service-requests`), so the state and the search reach every intervention and not only the ones of a page. All of it
 * is in the address (`?chip=topay&q=idraulico&f_property=…&page=2`): Back, a refresh and the way back from a page give the list as it was.
 * `?bookingId=` narrows it to the interventions of one stay (the page of a booking links here).
 */
function InterventionsListPage() {
  const { t } = useTranslation();
  const [address] = useSearchParams();
  const bookingId = readBookingId(address);
  const permissions = useHostPermissions();
  const viewsScope = useListViewsScope();
  const actions = useInterventionActions();

  const properties = useProperties({ mode: 'short' });
  const categories = useServiceCategories();
  const latest = useLatestInterventions();
  const suppliers = useMemo(() => supplierOptions(latest.data ?? NO_REQUESTS), [latest.data]);

  const list = useInterventionsList({
    steps: actions.steps,
    busy: actions.busy,
    permissions,
    properties: Array.isArray(properties.data) ? properties.data : NO_PROPERTIES,
    suppliers,
    categories: categories.data ?? NO_CODES,
  });
  const { state } = useListState(list);
  const ready = !properties.isLoading && !categories.isLoading;
  const rows = useInterventions(interventionListParams(state, { bookingId }), { enabled: ready });
  const counts = useInterventionCounts(interventionFilterParams(state, { bookingId }), { enabled: ready });

  const narrowed = state.q.trim() !== '' || Object.keys(state.filters).length > 0 || bookingId !== undefined;
  const nothingAtAll = !narrowed && counts.data?.all === 0 && !counts.isPlaceholderData;
  const { icon: emptyIcon, ...empty } = list.empty;

  const withoutStay = useMemo(() => {
    const next = new URLSearchParams(address);
    next.delete('bookingId');
    next.delete('page');
    const query = next.toString();
    return `${INTERVENTIONS_PATH}${query ? `?${query}` : ''}`;
  }, [address]);

  return (
    <div className="min-w-0 space-y-6" data-testid="interventions-page">
      <ServicePageHeader
        icon={Wrench}
        crumbs="auto"
        title={t('interventions.title')}
        description={t('interventions.description')}
        primary={
          permissions.canRequest
            ? { label: t('interventions.request'), icon: Wrench, to: requestInterventionPath(state.filters.property), testId: 'intervention-new' }
            : undefined
        }
        mobilePrimary="fab"
      />

      {bookingId ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-testid="interventions-stay-filter">
          <span>{t('interventions.list.forStay')}</span>
          <Link to={withoutStay} className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">
            {t('interventions.list.showAll')}
          </Link>
        </p>
      ) : null}

      {nothingAtAll ? (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm" data-testid="interventions-empty">
          <EmptyState icon={emptyIcon ?? Wrench} {...empty} />
        </div>
      ) : (
        <ListView<ServiceRequest>
          list={list}
          mode="server"
          rows={rows.data?.items ?? NO_REQUESTS}
          totalCount={rows.data?.total}
          pageSize={INTERVENTIONS_PAGE_SIZE}
          chipCounts={{ topay: counts.data?.toPay }}
          isLoading={!ready || rows.isLoading}
          isRefreshing={rows.isPlaceholderData}
          isError={rows.isError && !rows.isLoading}
          error={rows.error}
          errorTitle={t('interventions.list.loadError')}
          onRetry={() => void rows.refetch()}
          viewsScope={viewsScope}
          testId="interventions-list"
        />
      )}

      {actions.dialogs}
    </div>
  );
}

export function InterventionsPage() {
  const [address] = useSearchParams();
  const current = currentInterventionsSearch(address);
  if (current) return <Navigate to={{ search: `?${current}` }} replace />;
  return <InterventionsListPage />;
}
