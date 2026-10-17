import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { ListView } from '@/components/shared/list-view/list-view';
import { useSupplierClients } from '@/queries/use-supplier-clients';
import { useSupplierClientsList } from './supplier-clients-list';

/**
 * The customers of the supplier (SP-16b): the hosts of CasaZen and the private customers of its showcase in one list, each with the jobs
 * taken together, the last and the next one and what they paid, and a drawer with the latest requests and, after a take, the contact. The
 * server sends up to 200 customers (the latest activity first) and the list searches and filters them; if there are more, the page says so.
 * A load that fails says it and offers "Riprova": never an empty list in its place. It writes nothing and exports nothing (SP-D25).
 */
export function SupplierClientsPage() {
  const { t } = useTranslation();
  const clients = useSupplierClients();
  const list = useSupplierClientsList();
  const items = clients.data?.items ?? [];
  const total = clients.data?.total ?? 0;

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-clients-page">
      <PageHeader title={t('supplier.clients.title')} description={t('supplier.clients.description')} crumbs="auto" />
      <ListView
        list={list}
        mode="client"
        rows={items}
        isLoading={clients.isLoading}
        isRefreshing={clients.isFetching && !clients.isLoading}
        isError={clients.isError && !clients.data}
        error={clients.error}
        errorTitle={t('supplier.clients.loadError')}
        onRetry={() => void clients.refetch()}
        testId="supplier-clients-list"
      />
      {total > items.length ? (
        <p className="text-sm text-foreground/70" data-testid="supplier-clients-truncated">
          {t('supplier.clients.truncated', { shown: items.length, total })}
        </p>
      ) : null}
    </div>
  );
}
