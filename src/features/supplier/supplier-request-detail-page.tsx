import { isAxiosError } from 'axios';
import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { StatusPipeline } from '@/components/shared/status/status-pipeline';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useSupplierInboxItem } from '@/queries/use-supplier';
import { INBOX_PATH, requestTitle } from './requests/request-model';
import { RequestDetails, RequestFacts, RequestNow } from './requests/request-parts';
import { useRequestActions } from './requests/use-request-actions';

/**
 * One request of the supplier (SU-08, UI-16): where it is on its way, what to do now (the one highlighted block, with the buttons of
 * the phase), when, where, who and how much, and, one click away, the job, the address and the contact (after the take), the payment
 * and the history. The guest of the stay is never shown: the API does not send it. Taking, refusing and completing are here as in the
 * drawer of the list. A request that is not the supplier's is "not found".
 */
export function SupplierRequestDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: request, isLoading, isError, error, refetch } = useSupplierInboxItem(id);
  const actions = useRequestActions(() => void refetch());

  if (isLoading) {
    return (
      <div className="min-w-0 space-y-6" data-testid="supplier-request-loading" aria-busy="true">
        <PageHeader title={t('supplier.requests.requestTitle')} crumbs="auto" />
        <SkeletonLine lines={8} label={t('supplier.requests.loading')} />
      </div>
    );
  }

  if (isError || !request) {
    const notFound = isAxiosError(error) && error.response?.status === 404;
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader title={t('supplier.requests.requestTitle')} crumbs="auto" />
        {notFound ? (
          <div className="rounded-xl bg-card p-2 shadow-sm ring-1 ring-inset ring-border" data-testid="supplier-request-not-found">
            <EmptyState
              icon={SearchX}
              title={t('supplier.requests.notFound.title')}
              description={t('supplier.requests.notFound.description')}
              action={{ label: t('supplier.requests.notFound.back'), href: INBOX_PATH }}
            />
          </div>
        ) : (
          <ErrorState testId="supplier-request-error" title={t('supplier.requests.loadError')} error={error} onRetry={() => void refetch()} />
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-request-detail">
      <PageHeader
        title={requestTitle(request, t)}
        description={[request.clientName, request.postalCode ? `${request.city} (${request.postalCode})` : request.city].filter(Boolean).join(' · ')}
        crumbs="auto"
      />
      <StatusPipeline kind="request" status={request.status} perspective="supplier" />
      <RequestNow request={request} actions={actions} />
      <RequestFacts request={request} />
      <RequestDetails request={request} />
      {actions.dialog}
    </div>
  );
}
