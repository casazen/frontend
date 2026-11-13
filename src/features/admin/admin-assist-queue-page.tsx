import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { useNow } from '@/hooks/use-now';
import { getHttpStatus } from '@/lib/api-errors';
import { ClientPager } from '@/features/onboarding/components/client-pager';
import { useAssistQueue, useUpdateAssistRequest } from '@/queries/use-admin-onboarding-assist';
import type { AssistRequestStatus, AssistUpdateStatus, PagedAssistRequests } from '@/types/onboarding.types';
import { AssistRequestRow } from './components/assist-request-row';

/** The page size of the queue: a staff queue is read, not scrolled through; the server takes at most 100. */
const PAGE_SIZE = 25;

/** What the filter can ask: the open requests (the default: requested and in progress), one status, or all of them. */
type QueueFilter = 'open' | 'requested' | 'inProgress' | 'done' | 'cancelled' | 'all';
const FILTERS: readonly QueueFilter[] = ['open', 'requested', 'inProgress', 'done', 'cancelled', 'all'];
const FILTER_STATUS: Partial<Record<QueueFilter, AssistRequestStatus>> = {
  requested: 'Requested',
  inProgress: 'InProgress',
  done: 'Done',
  cancelled: 'Cancelled',
};

interface QueueSectionProps {
  /** The title of the list when the page shows two (the open view): «Da prendere in carico», «In corso». */
  title?: string;
  query: UseQueryResult<PagedAssistRequests>;
  page: number;
  onPage: (page: number) => void;
  now: number;
  busy: boolean;
  onUpdate: (id: string, status: AssistUpdateStatus, note?: string) => Promise<unknown>;
  testId: string;
  /** The line of a list with nothing in it, when the page does not say it for both lists. */
  empty?: string;
}

/**
 * One list of the queue, as the server pages it: loading, a failed read with a retry (never an empty list), the rows and the pager. A 404 is «not found» whatever
 * the cache still holds, and a refresh that fails over older rows says so.
 */
function QueueSection({ title, query, page, onPage, now, busy, onUpdate, testId, empty }: QueueSectionProps) {
  const { t } = useTranslation();
  const notFound = query.isError && getHttpStatus(query.error) === 404;
  const failed = query.isError && (!query.data || notFound);
  const stale = query.isError && !failed;
  const data = query.data;

  let body: ReactNode;
  if (query.isLoading) {
    body = (
      <div role="status" aria-busy="true" className="space-y-2" data-testid={`${testId}-loading`}>
        <span className="sr-only">{t('onboardingPlan.assist.loading')}</span>
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if (failed || !data) {
    body = notFound ? (
      <ErrorState testId={`${testId}-error`} title={t('onboardingPlan.assist.notFound')} />
    ) : (
      <ErrorState testId={`${testId}-error`} title={t('onboardingPlan.assist.loadError')} error={query.error} onRetry={() => void query.refetch()} showSupport />
    );
  } else {
    const items = Array.isArray(data.items) ? data.items : [];
    const total = Number.isFinite(data.totalCount) ? data.totalCount : items.length;
    const size = data.pageSize > 0 ? data.pageSize : PAGE_SIZE;
    body =
      items.length === 0 ? (
        empty ? (
          <p className="text-sm text-foreground/70" data-testid={`${testId}-empty`}>
            {empty}
          </p>
        ) : null
      ) : (
        <>
          {stale ? (
            <p role="alert" className="text-sm text-danger-foreground" data-testid={`${testId}-stale`}>
              {t('onboardingPlan.assist.stale')}
            </p>
          ) : null}
          <ul role="list" className="space-y-3" data-testid={`${testId}-rows`}>
            {items.map((request) => (
              <AssistRequestRow key={request.id} request={request} now={now} busy={busy} onUpdate={onUpdate} />
            ))}
          </ul>
          <ClientPager page={data.page > 0 ? data.page : page} pages={Math.max(1, Math.ceil(total / size))} total={total} onPage={onPage} testId={`${testId}-pager`} />
        </>
      );
  }

  return (
    <section className="min-w-0 space-y-3" aria-label={title ?? t('onboardingPlan.assist.listLabel')} data-testid={testId}>
      {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
      {body}
    </section>
  );
}

/**
 * `/app/admin/onboarding-assist`, «Richieste di aiuto» (E10/F03/US03/T03, NF-107, NF-15, UX-15): where CasaZen support finds the «Fallo per me» requests of the hosts.
 * The queue is the server's (paged, open requests first and the oldest first) and the page shows what the backend sends: identifiers, the context in words, the
 * property and its comune, the status and the note, never a draft nor a secret. By default it lists the open requests, those to take and those in progress; the
 * filter narrows to one status or widens to all. Each request can be taken, done or cancelled with an optional note, and every action is logged by the backend
 * in the log of the host's organization: the page offers no way to act without it.
 *
 * A platform administrator's page (the server answers to nobody else): a person without the permission of the staff queue opens it and reads that there is no
 * access, with no request sent. Behind the flag `octorateOnboarding`. One update is on its way at a time: every action of every row is off until it answered.
 */
export function AdminAssistQueuePage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const allowed = hasPermission('admin', 'admin.users.read');
  const now = useNow();
  const update = useUpdateAssistRequest();
  const [filter, setFilter] = useState<QueueFilter>('open');
  // One page number for each list of the queue, so that paging the requests to take does not move the ones in progress.
  const [pages, setPages] = useState<Record<string, number>>({});
  const pageOf = (key: string) => pages[key] ?? 1;
  const setPage = (key: string) => (page: number) => setPages((previous) => ({ ...previous, [key]: page }));

  const openView = filter === 'open';
  const requested = useAssistQueue({ status: 'Requested', page: pageOf('requested'), pageSize: PAGE_SIZE }, { enabled: allowed && openView });
  const inProgress = useAssistQueue({ status: 'InProgress', page: pageOf('inProgress'), pageSize: PAGE_SIZE }, { enabled: allowed && openView });
  const single = useAssistQueue({ status: FILTER_STATUS[filter], page: pageOf(filter), pageSize: PAGE_SIZE }, { enabled: allowed && !openView });

  const onUpdate = (id: string, status: AssistUpdateStatus, note?: string) => update.mutateAsync({ id, status, note });
  const busy = update.isPending;
  const openEmpty =
    openView &&
    requested.isSuccess &&
    inProgress.isSuccess &&
    !requested.isError &&
    !inProgress.isError &&
    (requested.data?.totalCount ?? 1) === 0 &&
    (inProgress.data?.totalCount ?? 1) === 0;

  let content: ReactNode;
  if (!allowed) {
    content = (
      <p className="text-sm text-foreground/70" data-testid="assist-no-access">
        {t('onboardingPlan.assist.noAccess')}
      </p>
    );
  } else if (openView) {
    content = openEmpty ? (
      <p className="text-sm text-foreground/70" data-testid="assist-empty">
        {t('onboardingPlan.assist.empty')}
      </p>
    ) : (
      <div className="space-y-6">
        <QueueSection title={t('onboardingPlan.assist.sections.requested')} query={requested} page={pageOf('requested')} onPage={setPage('requested')} now={now} busy={busy} onUpdate={onUpdate} testId="assist-requested" empty={t('onboardingPlan.assist.emptySection')} />
        <QueueSection title={t('onboardingPlan.assist.sections.inProgress')} query={inProgress} page={pageOf('inProgress')} onPage={setPage('inProgress')} now={now} busy={busy} onUpdate={onUpdate} testId="assist-in-progress" empty={t('onboardingPlan.assist.emptySection')} />
      </div>
    );
  } else {
    content = <QueueSection query={single} page={pageOf(filter)} onPage={setPage(filter)} now={now} busy={busy} onUpdate={onUpdate} testId="assist-list" empty={t('onboardingPlan.assist.emptyFiltered')} />;
  }

  return (
    <div className="space-y-6" data-testid="admin-assist-queue-page">
      <PageHeader title={t('onboardingPlan.assist.title')} description={t('onboardingPlan.assist.description')} />

      <div className="space-y-1 text-sm text-foreground/70" data-testid="assist-notes">
        <p>{t('onboardingPlan.assist.hostSees')}</p>
        <p>{t('onboardingPlan.assist.askTheUser')}</p>
      </div>

      {allowed ? (
        <div className="max-w-xs space-y-1">
          <label htmlFor="assist-filter" className="text-sm font-medium">
            {t('onboardingPlan.assist.filter.label')}
          </label>
          <Select
            id="assist-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value as QueueFilter)}
            data-testid="assist-filter"
          >
            {FILTERS.map((value) => (
              <option key={value} value={value}>
                {t(`onboardingPlan.assist.filter.${value}`)}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {content}
    </div>
  );
}
