import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { ListView } from '@/components/shared/list-view/list-view';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { useWorkspace } from '@/hooks/use-workspace';
import { useAllLongRentServiceRequests } from '@/queries/use-service-requests';
import type { ServiceRequest } from '@/types/service-request';
import { DEFAULT_REQUEST_TAB, tabOfParam, viewOfTab, type RequestTab } from './long-rent-request-model';
import { useLongRentRequestsList } from './long-rent-requests-list';
import { NewLongRentRequest } from './new-long-rent-request';

const NO_ROWS: readonly ServiceRequest[] = [];

/**
 * Interventi of Affitti lunghi (LR-08b): the requests to the suppliers of the Portale for the properties let long term, from the
 * request to the payment, in one list. Three tabs, Aperti · Chiusi · Tutti (`?tab=`), each one asking the server for its view
 * (`?view=open|closed`, LR-08a); the list searches and sorts the requests of the tab. The name of a request opens its page, where
 * the next step is told; the button of the header asks for a new one. Who may only read the properties sees the list and has no button.
 */
export function LongRentRequestsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canRequest = hasPermission('long-rent', 'property.write');
  const [searchParams] = useSearchParams();
  const tab = tabOfParam(searchParams.get('tab'));
  const [requesting, setRequesting] = useState(false);
  const openRequest = useCallback(() => setRequesting(true), []);
  const closeRequest = useCallback(() => setRequesting(false), []);

  const list = useLongRentRequestsList({ tab, canRequest, onRequest: openRequest });
  const requests = useAllLongRentServiceRequests(viewOfTab(tab));

  const tabs: TabItem<RequestTab>[] = [
    { value: 'open', label: t('longRentRequests.list.tabs.open'), testId: 'long-rent-requests-tab-open' },
    { value: 'closed', label: t('longRentRequests.list.tabs.closed'), testId: 'long-rent-requests-tab-closed' },
    { value: 'all', label: t('longRentRequests.list.tabs.all'), testId: 'long-rent-requests-tab-all' },
  ];

  return (
    <div className="min-w-0 space-y-6" data-testid="long-rent-requests-page">
      <PageHeader
        title={t('nav.serviceRequests')}
        description={t('longRentRequests.list.description')}
        crumbs="auto"
        primary={canRequest ? { label: t('longRentRequests.list.request'), icon: Wrench, onClick: openRequest, testId: 'long-rent-request-new' } : undefined}
        mobilePrimary="fab"
      />

      <Tabs label={t('longRentRequests.list.tabs.label')} items={tabs} defaultValue={DEFAULT_REQUEST_TAB} value={tab}>
        <ListView<ServiceRequest>
          list={list}
          rows={requests.data ?? NO_ROWS}
          isLoading={requests.isLoading}
          isError={requests.isError && !requests.isLoading}
          error={requests.error}
          errorTitle={t('longRentRequests.list.loadError')}
          onRetry={() => void requests.refetch()}
          testId="long-rent-requests-list"
        />
      </Tabs>

      {requesting ? <NewLongRentRequest onClose={closeRequest} /> : null}
    </div>
  );
}
