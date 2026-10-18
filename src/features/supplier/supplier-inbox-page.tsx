import { Inbox } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ListView } from '@/components/shared/list-view/list-view';
import { useListState } from '@/components/shared/list-view/use-list-state';
import { Button } from '@/components/ui/button';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { useSupplierInbox, useSupplierInboxCounts } from '@/queries/use-supplier';
import { requestPath } from './requests/request-model';
import './requests/supplier-request-drawer';
import { inboxParamsOf, useSupplierRequestsList } from './requests/supplier-requests-list';
import { useRequestActions } from './requests/use-request-actions';

const PAGE_SIZE = 20;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The requests of the supplier (UI-14): one list with the quick filters the server counts (da rispondere, in attesa del cliente,
 * programmate, da incassare, archivio), a search, the filters in a drawer and the saved views. The state is in the address; the
 * server picks, searches and pages the rows. A row opens in the drawer of the shell, and the one thing to do about it (accept, complete)
 * is on the row. "Rispondi alla più urgente" is the one action of the page. With `?clientId=` (from the page of the customers, SP-16b)
 * the list holds only the requests of that customer, and says so.
 */
export function SupplierInboxPage() {
  const { t } = useTranslation();
  const actions = useRequestActions();
  const list = useSupplierRequestsList(actions);
  const viewsScope = useListViewsScope();
  const { state } = useListState(list);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedClient = searchParams.get('clientId');
  const clientId = requestedClient && GUID.test(requestedClient) ? requestedClient : undefined;
  const inbox = useSupplierInbox(inboxParamsOf(state, PAGE_SIZE, clientId));
  const counts = useSupplierInboxCounts();

  const toAnswer = counts.data?.toAnswer ?? 0;
  // The server puts the request to answer first on top of its tab: the first row is the most urgent.
  const urgent = useSupplierInbox({ tab: 'da-rispondere', page: 1, pageSize: 1 }, { enabled: toAnswer > 0 });
  const mostUrgent = toAnswer > 0 ? urgent.data?.items[0] : undefined;

  // A supplier who has no request at all gets what the requests are for, and not an empty table with filters.
  const c = counts.data;
  const nothingYet = c !== undefined && [c.toAnswer, c.awaitingCustomer, c.scheduled, c.toCollect, c.archive].every((n) => n === 0);
  const { icon: emptyIcon, ...empty } = list.empty;

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-inbox-page">
      <PageHeader
        title={t('supplier.requests.title')}
        description={t('supplier.requests.description')}
        crumbs="auto"
        primary={mostUrgent ? { label: t('supplier.requests.answerUrgent'), icon: Inbox, to: requestPath(mostUrgent.id), testId: 'supplier-inbox-urgent' } : undefined}
      />

      {nothingYet ? (
        <div className="rounded-xl bg-card p-2 shadow-sm ring-1 ring-inset ring-border" data-testid="supplier-inbox-empty">
          <EmptyState icon={emptyIcon ?? Inbox} {...empty} />
        </div>
      ) : (
        <>
          {clientId ? (
            <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="supplier-inbox-client-filter">
              <span>{t('supplier.requests.clientFilter.note')}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSearchParams(
                    (params) => {
                      params.delete('clientId');
                      return params;
                    },
                    { replace: true },
                  )
                }
              >
                {t('supplier.requests.clientFilter.clear')}
              </Button>
            </div>
          ) : null}
          <ListView
            list={list}
            mode="server"
            rows={inbox.data?.items ?? []}
            totalCount={inbox.data?.total}
            pageSize={PAGE_SIZE}
            isLoading={inbox.isLoading}
            isRefreshing={inbox.isPlaceholderData}
            isError={inbox.isError && !inbox.isLoading}
            error={inbox.error}
            errorTitle={t('supplier.requests.list.loadError')}
            onRetry={() => void inbox.refetch()}
            chipCounts={{ 'da-rispondere': counts.data?.toAnswer }}
            viewsScope={viewsScope}
            testId="supplier-inbox-list"
          />
        </>
      )}

      {actions.dialog}
    </div>
  );
}
