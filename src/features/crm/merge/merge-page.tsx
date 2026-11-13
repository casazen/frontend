import { CopyCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListPagination } from '@/components/shared/list-view/list-pagination';
import { SkeletonCard } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMergeCandidates } from '@/queries/crm-merge';
import { MergeCandidateCard } from './merge-candidate-card';

const LIST_PATH = '/app/short-rent/crm/guests';

/** The page of the address (`?page=2`, from 2); anything that is not a whole number from 1 is the first. */
function pageOf(params: URLSearchParams): number {
  const raw = params.get('page')?.trim() ?? '';
  const page = /^\d+$/.test(raw) ? Number(raw) : 1;
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

/** The query string of the page `page`: the first is the default and is not written. */
function searchOfPage(params: URLSearchParams, page: number): URLSearchParams {
  const next = new URLSearchParams(params);
  if (page > 1) next.set('page', String(page));
  else next.delete('page');
  return next;
}

/**
 * The merge proposals of the CRM (E07/F01/US04/T03, NF-88, CRM-01): the pairs of guests the matching thinks may be one person, one card
 * each, the surest first, 20 to a page. Nothing merges by itself: the host decides every pair, merging it or saying it is two people. The
 * server lists only the pairs the caller reaches in full, and answers a pair that was decided or is out of reach with an error that the
 * card tells in plain words. The page is reachable only with the CRM flag on and the permission `guest.write`.
 */
export function MergePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = pageOf(searchParams);
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useMergeCandidates(page);

  const totalCount = data?.totalCount ?? 0;
  const pageSize = data?.pageSize ?? 0;
  const lastPage = pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

  // A page that is not there any more (the last pair of it was decided): the list goes to the last one that is.
  if (data && !isPlaceholderData && data.items.length === 0 && totalCount > 0 && page > lastPage) {
    return <Navigate replace to={{ search: searchOfPage(searchParams, lastPage).toString() }} />;
  }

  return (
    <div className="min-w-0 space-y-6" data-testid="crm-merge-page">
      <PageHeader title={t('crm.merge.title')} description={t('crm.merge.description')} />

      {isLoading ? <SkeletonCard lines={6} label={t('crm.merge.loading')} /> : null}

      {isError ? <ErrorState title={t('crm.merge.loadError')} error={error} onRetry={() => void refetch()} testId="crm-merge-error" /> : null}

      {!isLoading && !isError && data && data.items.length === 0 ? (
        <EmptyState
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
