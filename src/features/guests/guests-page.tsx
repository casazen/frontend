import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ListView } from '@/components/shared/list-view/list-view';
import { useListState } from '@/components/shared/list-view/use-list-state';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { guestsApi } from '@/api/guests.api';
import { useGuestsList } from './guests-list';

const PAGE_SIZE = 20;

export function GuestsPage() {
  const { t } = useTranslation();
  const list = useGuestsList();
  const viewsScope = useListViewsScope();
  const { state } = useListState(list);
  const search = state.q.trim();

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['guests', { search, page: state.page }],
    queryFn: () => guestsApi.getAll({ search: search || undefined, page: state.page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={t('guests.title')} description={t('guests.search')} />

        <ListView
          list={list}
          mode="server"
          rows={data?.items ?? []}
          totalCount={data?.totalCount}
          pageSize={PAGE_SIZE}
          isLoading={isLoading}
          isRefreshing={isPlaceholderData}
          isError={isError && !isLoading}
          error={error}
          errorTitle={t('guests.loadError')}
          onRetry={() => void refetch()}
          viewsScope={viewsScope}
          testId="guest-list"
        />
      </div>
    </AppShell>
  );
}
