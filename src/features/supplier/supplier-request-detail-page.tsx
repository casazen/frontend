import { isAxiosError } from 'axios';
import { ClipboardList, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ServicePageHeader } from '@/features/supplier/components/service-page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { StatusPipeline } from '@/components/shared/status/status-pipeline';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useSupplierInboxItem } from '@/queries/supplier/use-inbox';
import { RequestDispute } from './inquiry/dispute-block';
import { isInquiry } from './inquiry/inquiry-model';
import { InquiryMessages } from './inquiry/inquiry-messages';
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
        <ServicePageHeader icon={ClipboardList} title={t('supplier.requests.requestTitle')} crumbs="auto" />
        <SkeletonLine lines={8} label={t('supplier.requests.loading')} />
      </div>
    );
  }

  if (isError || !request) {
    const notFound = isAxiosError(error) && error.response?.status === 404;
    return (
      <div className="min-w-0 space-y-6">
        <ServicePageHeader icon={ClipboardList} title={t('supplier.requests.requestTitle')} crumbs="auto" />
        {notFound ? (
          <div data-testid="supplier-request-not-found">
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
      <ServicePageHeader
        icon={ClipboardList}
        title={requestTitle(request, t)}
        description={[request.clientName, request.postalCode ? `${request.city} (${request.postalCode})` : request.city].filter(Boolean).join(' · ')}
        crumbs="auto"
      />
      <StatusPipeline kind="request" status={request.status} perspective="supplier" />
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)] xl:items-start">
        <div className="min-w-0 space-y-5">
          <RequestNow request={request} actions={actions} />
          <RequestDispute request={request} suspended={actions.suspended} />
          {isInquiry(request) ? <InquiryMessages request={request} actions={actions} /> : null}
        </div>
        <div className="min-w-0 space-y-4">
          <RequestFacts request={request} compact withDetails />
          <RequestDetails request={request} />
        </div>
      </div>
      {actions.dialog}
    </div>
  );
}
