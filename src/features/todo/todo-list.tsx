import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { useActivities, useActivityCount } from '@/queries/internalActivities';
import { useProperties } from '@/queries/use-properties';
import { TodoActivityCard, todoActionRoute } from './activity-card';
import { TODO_LIST_LIMIT, countUrgent, isTruncatedList, typeTitle, urgentCountOf } from './lib/todo-model';

const ALL = 'all';
const ACCOUNT = 'account';

/**
 * `/app/short-rent/activities`: the "To do" list of the host (NF-07, ADR-026), every open item the server sends for the scope of the
 * person, in the order the server sends them: the most urgent first, then by deadline. The page renders that array as it is and
 * never sorts it again (ADR-026-R5); the two filters, by type and by property, only leave items out. Each card says what, on which
 * object, by when and why, and "Fallo ora" opens the page where it is done; the list is read again after any write of the app, on the
 * window focus and every minute, so what the system closes by itself leaves it (ADR-026-R7). The server cuts the list at 50 items: from
 * there the page says "the first 50" and tells no total, and how many are urgent is the number of the menu (`/count` counts them all).
 * The staff page is `/app/admin/activities`.
 */
export function TodoListPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const activities = useActivities();
  const urgentActivities = useActivityCount();
  const properties = useProperties({ mode: 'short' });
  const [type, setType] = useState(ALL);
  const [property, setProperty] = useState(ALL);

  const items = useMemo(() => (Array.isArray(activities.data) ? activities.data : []), [activities.data]);
  const notAList = activities.data !== undefined && !Array.isArray(activities.data);
  const propertyNames = useMemo(
    () => new Map((Array.isArray(properties.data) ? properties.data : []).map((candidate) => [candidate.id, candidate.name] as const)),
    [properties.data],
  );
  const types = useMemo(() => [...new Set(items.map((item) => item.activityType))], [items]);
  const propertyIds = useMemo(() => [...new Set(items.flatMap((item) => (item.propertyId ? [item.propertyId] : [])))], [items]);
  const hasAccountItems = items.some((item) => !item.propertyId);

  const visible = items.filter(
    (item) =>
      (type === ALL || item.activityType === type) &&
      (property === ALL || (property === ACCOUNT ? !item.propertyId : item.propertyId === property)),
  );
  const filtered = type !== ALL || property !== ALL;
  const firstWithAction = visible.find((item) => todoActionRoute(item, hasPermission) !== null)?.id;
  const urgent = filtered ? countUrgent(visible) : urgentCountOf(items, urgentActivities.data?.count);
  const truncated = isTruncatedList(items.length);
  let summary: string;
  if (!truncated) summary = t('activity.todo.summary.total', { count: visible.length });
  else if (filtered) summary = t('activity.todo.summary.firstFiltered', { shown: visible.length, max: TODO_LIST_LIMIT });
  else summary = t('activity.todo.summary.first', { max: TODO_LIST_LIMIT });

  let content: ReactNode;
  if (activities.isLoading) {
    content = (
      <div role="status" aria-busy="true" className="space-y-3" data-testid="todo-loading">
        <span className="sr-only">{t('activity.todo.loading')}</span>
        <Skeleton className="h-32 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-32 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if ((activities.isError && !activities.data) || notAList) {
    content = (
      <ErrorState testId="todo-error" title={t('activity.todo.loadError')} error={activities.error} onRetry={() => void activities.refetch()} />
    );
  } else if (items.length === 0) {
    content = (
      <div data-testid="todo-empty">
        <EmptyState icon={CheckCircle2} title={t('activity.todo.empty.title')} description={t('activity.todo.empty.description')} />
      </div>
    );
  } else {
    content = (
      <>
        <p className="sr-only" aria-live="polite" data-testid="todo-summary">
          {summary}
          {urgent !== null && urgent > 0 ? (
            <>
              {' · '}
              <span data-testid="todo-urgent-count">{t('activity.todo.summary.urgent', { count: urgent })}</span>
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2 empty:hidden" role="group" aria-label={t('activity.todo.filter.label')} data-testid="todo-filters">
          {types.length > 1 ? (
            <Select
              size="sm"
              aria-label={t('activity.todo.filter.type')}
              data-testid="todo-filter-type"
              wrapperClassName="w-full sm:w-64"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value={ALL}>{t('activity.todo.filter.allTypes')}</option>
              {types.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {typeTitle(candidate, { t, exists: (key) => i18n.exists(key) })}
                </option>
              ))}
            </Select>
          ) : null}
          {propertyIds.length + (hasAccountItems ? 1 : 0) > 1 ? (
            <Select
              size="sm"
              aria-label={t('activity.todo.filter.property')}
              data-testid="todo-filter-property"
              wrapperClassName="w-full sm:w-64"
              value={property}
              onChange={(event) => setProperty(event.target.value)}
            >
              <option value={ALL}>{t('activity.todo.filter.allProperties')}</option>
              {propertyIds.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {propertyNames.get(candidate) ?? t('activity.todo.filter.unknownProperty')}
                </option>
              ))}
              {hasAccountItems ? <option value={ACCOUNT}>{t('activity.todo.filter.account')}</option> : null}
            </Select>
          ) : null}
        </div>



        {visible.length > 0 ? (
          <ul className="space-y-3" aria-label={t('activity.todo.listLabel')} data-testid="todo-list">
            {visible.map((activity) => (
              <TodoActivityCard
                key={activity.id}
                activity={activity}
                propertyNames={propertyNames}
                hasPermission={hasPermission}
                primary={activity.id === firstWithAction}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-wrap items-center gap-3 py-2" data-testid="todo-no-match">
            <p className="text-sm text-foreground/70">{t('activity.todo.filter.noMatch')}</p>
            {filtered ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 md:min-h-0"
                onClick={() => {
                  setType(ALL);
                  setProperty(ALL);
                }}
              >
                {t('activity.todo.filter.reset')}
              </Button>
            ) : null}
          </div>
        )}
      </>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6" data-testid="todo-page">
        <PageHeader
          title={t('activity.todo.title')}
          description={truncated ? t('activity.todo.descriptionCut', { max: TODO_LIST_LIMIT }) : t('activity.todo.description')}
        />
        {content}
      </div>
    </AppShell>
  );
}
