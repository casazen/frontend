import { useTranslation } from 'react-i18next';
import type { ActivityUrgency, TodoActivity } from '@/api/internal-activities.api';
import { DayList, PlainSection, type CalmTone, type DayListItem } from '@/components/shared/calm';
import type { PermissionPredicate } from '@/config/route-manifest';
import { todoActionRoute } from './activity-card';
import { HOME_NEXT_ITEMS, TODO_LIST_LIMIT, TODO_LIST_PATH, describeTodo, isTruncatedList } from './lib/todo-model';

/** Every level has its icon and its word in the row: the color of the tone is never the only signal. */
const URGENCY_TONE: Record<ActivityUrgency, CalmTone> = { High: 'danger', Medium: 'warning', Low: 'info' };

interface TodoTodayListProps {
  /** The items to list, in the order the server sent them: the ones after the item the focus block shows (all of them when it is not shown). */
  items: readonly TodoActivity[];
  /**
   * How many open items the list the server sent holds, the one of the focus block included. The server cuts the list at
   * {@link TODO_LIST_LIMIT}: from there it is "the first ones" and not a total.
   */
  total: number;
  /** How many of them are urgent: the number of the nav badge (it counts them all, the list is cut). `null` when it is not known. */
  urgent: number | null;
  propertyNames: ReadonlyMap<string, string>;
  hasPermission?: PermissionPredicate;
  limit?: number;
}

/**
 * The summary of the "To do" list on the Home (NF-07, ADR-026-R8): how many things wait and how many are urgent, the next few of them in
 * a compact list (what, on which object, urgency, "Fallo ora") and the way to the whole list. The rows keep the order of the array: the
 * server sorts by urgency and then by deadline, and a list that grouped them by day here would put a later urgent one under an earlier
 * quiet one (ADR-026-R5, so this is a `DayList` and not a `TodayList`).
 */
export function TodoTodayList({ items, total, urgent, propertyNames, hasPermission, limit = HOME_NEXT_ITEMS }: TodoTodayListProps) {
  const { t, i18n } = useTranslation();
  const context = { t, exists: (key: string) => i18n.exists(key), locale: i18n.language, propertyNames };
  // A list of the length the server cuts at may have more items behind it: no total (and no count of the rest) is told from it.
  const truncated = isTruncatedList(total);

  const rows: DayListItem[] = items.slice(0, limit).map((activity) => {
    const text = describeTodo(activity, context);
    const route = todoActionRoute(activity, hasPermission);
    const row = {
      id: activity.id,
      day: text.deadline?.day,
      title: text.title,
      subtitle: text.object,
      meta: text.urgencyLabel,
      tone: URGENCY_TONE[text.urgency],
    };
    // The button is the way in. A row that has none (a page the person cannot open) leads to the list, where the item is told in full.
    return route
      ? {
          ...row,
          action: { label: t('activity.todo.actions.doNow'), href: route, ariaLabel: t('activity.todo.actions.doNowFor', { title: text.title }) },
        }
      : { ...row, href: TODO_LIST_PATH };
  });
  const hidden = items.length - rows.length;

  return (
    <PlainSection
      title={t('activity.todo.next.title')}
      count={truncated ? undefined : items.length}
      actionLabel={t('activity.todo.next.seeAll')}
      href={TODO_LIST_PATH}
      actionTestId="home-todo-see-all"
      data-testid="home-todo-summary"
    >
      <p className="text-sm text-foreground/70" data-testid="home-todo-counts">
        {truncated ? t('activity.todo.summary.first', { max: TODO_LIST_LIMIT }) : t('activity.todo.summary.total', { count: total })}
        {urgent !== null && urgent > 0 ? (
          <>
            {' · '}
            <strong className="font-semibold text-danger-foreground" data-testid="home-todo-urgent">
              {t('activity.todo.summary.urgent', { count: urgent })}
            </strong>
          </>
        ) : null}
      </p>
      {rows.length > 0 ? (
        <DayList items={rows} data-testid="home-todo-rows" />
      ) : (
        <p className="py-2 text-sm text-foreground/70" data-testid="home-todo-nothing-else">
          {t('activity.todo.next.nothingElse')}
        </p>
      )}
      {hidden > 0 ? (
        <p className="text-sm text-foreground/70" data-testid="home-todo-more">
          {t('activity.todo.next.more', { count: hidden })}
        </p>
      ) : null}
    </PlainSection>
  );
}
