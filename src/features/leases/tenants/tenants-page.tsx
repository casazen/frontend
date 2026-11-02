import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { ListView } from '@/components/shared/list-view/list-view';
import { useListState } from '@/components/shared/list-view/use-list-state';
import { useWorkspace } from '@/hooks/use-workspace';
import { useTenants } from '@/queries/use-long-rent-tenants';
import type { TenantRow } from '@/types';
import { tenantViewOfChip, useTenantsList } from './tenants-list';

const LEASE_CREATE_PATH = '/app/long-rent/leases/new';
const PAGE_SIZE = 25;
const NO_ROWS: readonly TenantRow[] = [];

/**
 * Inquilini (LR-09): who lives in the properties let long term, since when, for how much and how punctually. A person is read from
 * the parties of the leases, so one person on several leases is one row. The views (Attuali, Ex inquilini, Tutti), the search and the
 * page are in the address (`?chip=former&q=rossi&page=2`) and the server narrows the list; the list does not filter or sort on its
 * own. Opening a row leads to the sheet of the person, which holds the payments and, behind «Privacy», the copy of their data and the
 * request to erase them. No phone, no «Chiama», no message (decisions D3, D4, LR-D23).
 */
export function TenantsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canCreateLease = hasPermission('long-rent', 'lease.create');
  const list = useTenantsList(canCreateLease);
  const { state } = useListState(list);

  const search = state.q.trim();
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useTenants({
    view: tenantViewOfChip(state.chip),
    q: search || undefined,
    page: state.page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="min-w-0 space-y-6" data-testid="tenants-page">
      <PageHeader
        title={t('longRentTenants.title')}
        description={t('longRentTenants.description')}
        crumbs="auto"
        primary={canCreateLease ? { label: t('longRentTenants.newLease'), icon: Plus, to: LEASE_CREATE_PATH, testId: 'tenants-new-lease' } : undefined}
        mobilePrimary="fab"
      />

      <ListView<TenantRow>
        list={list}
        mode="server"
        rows={data?.items ?? NO_ROWS}
        totalCount={data?.total}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        isRefreshing={isPlaceholderData}
        isError={isError && !isLoading}
        error={error}
        errorTitle={t('longRentTenants.loadError')}
        onRetry={() => void refetch()}
        testId="tenants-list"
      />
    </div>
  );
}
