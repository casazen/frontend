import { CopyCheck, GitMerge } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { ListPagination } from '@/components/shared/list-view/list-pagination';
import { SkeletonCard } from '@/components/ui/skeleton';
import { CrmEmptyState } from '@/features/crm/lib/crm-empty-state';
import { cn } from '@/lib/utils';
import { useMergeCandidates } from '@/queries/crm-merge';
import { MergeCandidateCard } from './merge-candidate-card';

const LIST_PATH = '/app/short-rent/crm/guests';

function pageOf(params: URLSearchParams): number {
  const raw = params.get('page')?.trim() ?? '';
  const page = /^\d+$/.test(raw) ? Number(raw) : 1;
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

function searchOfPage(params: URLSearchParams, page: number): URLSearchParams {
  const next = new URLSearchParams(params);
  if (page > 1) next.set('page', String(page));
  else next.delete('page');
  return next;
}

export function MergePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = pageOf(searchParams);
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useMergeCandidates(page);

  const totalCount = data?.totalCount ?? 0;
  const pageSize = data?.pageSize ?? 0;
  const lastPage = pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

  if (data && !isPlaceholderData && data.items.length === 0 && totalCount > 0 && page > lastPage) {
    return <Navigate replace to={{ search: searchOfPage(searchParams, lastPage).toString() }} />;
  }

  return (
    <div className="min-w-0 space-y-6" data-testid="crm-merge-page">
      <PageHeader icon={GitMerge} title={t('crm.merge.title')} description={t('crm.merge.description')} />

      {isLoading ? <SkeletonCard lines={6} label={t('crm.merge.loading')} /> : null}

      {isError ? <ErrorState title={t('crm.merge.loadError')} error={error} onRetry={() => void refetch()} testId="crm-merge-error" /> : null}

      {!isLoading && !isError && data && data.items.length === 0 ? (
        <CrmEmptyState
          testId="crm-merge-empty"
          icon={CopyCheck}
          title={t('crm.merge.empty.title')}
          description={t('crm.merge.empty.description')}
          action={{ label: t('crm.merge.empty.action'), href: LIST_PATH }}
        />
      ) : null}

      {!isError && data && data.items.length > 0 ? (
        <div aria-busy={isPlaceholderData || undefined} className={cn('space-y-4 transition-opacity', isPlaceholderData && 'opacity-60')}>
          <ul role="list" aria-label={t('crm.merge.label')} className="space-y-6" data-testid="crm-merge-list">
            {data.items.map((candidate) => (
              <li key={candidate.id}>
                <MergeCandidateCard candidate={candidate} />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-foreground/70" data-testid="crm-merge-count">
              {t('crm.merge.count', { count: totalCount })}
            </p>
            <ListPagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={(next) => setSearchParams((current) => searchOfPage(current, next))}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
