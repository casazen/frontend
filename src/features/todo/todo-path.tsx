import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import type { TodoActivity } from '@/api/internal-activities.api';
import { GuidePath, type CalmTone, type GuidePathStep } from '@/components/shared/calm';
import type { PermissionPredicate } from '@/config/route-manifest';
import { cn } from '@/lib/utils';
import { todoActionRoute } from './activity-card';
import { TODO_LIST_LIMIT, TODO_LIST_PATH, describeTodo, isTruncatedList, type TodoText } from './lib/todo-model';

/** How many items the path shows: the one to do now and the next three. */
export const TODO_PATH_ITEMS = 4;

interface TodoPathProps {
  /** The items in the order the server sent them (ADR-026-R5): the first is the one to do now. */
  items: readonly TodoActivity[];
  /** How many urgent items wait: the number of the server (it counts them all, the list is cut). `null` when it is not known. */
  urgent: number | null;
  propertyNames: ReadonlyMap<string, string>;
  /** Decides whether the person may open the page «Fallo ora» leads to. */
  hasPermission?: PermissionPredicate;
  /**
   * Whether the first item is the step to do now (the one highlighted thing of the Home). False while what carries a risk of a sanction holds
   * the highlight (the block of the adempimenti): the items are then the road ahead, none of them current.
   */
  focus?: boolean;
  limit?: number;
  className?: string;
}

/** The note of an item: a deadline that has passed in the color of danger, an urgent one in the color of warning, the others quiet. */
function noteToneOf(text: TodoText): CalmTone {
  if (text.deadline?.overdue) return 'danger';
  return text.urgency === 'High' ? 'warning' : 'neutral';
}

/**
 * «I tuoi prossimi passi» on the Home (NF-07, the guide): the «Da fare» list as a road, the item to do now first with its «Fallo ora», then the
 * next ones, each with its own button, and the way to the whole list. It replaces the colored block «Adesso» and the list under it: a deadline
 * that has passed is said by the words and the color of its note, never by painting the block red, which read as an error. The rows keep the
 * order of the array (the server sorts by urgency and then by deadline).
 */
export function TodoPath({ items, urgent, propertyNames, hasPermission, focus = true, limit = TODO_PATH_ITEMS, className }: TodoPathProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const context = { t, exists: (key: string) => i18n.exists(key), locale: i18n.language, propertyNames };
  // A list of the length the server cuts at may have more items behind it: no total is told from it.
  const truncated = isTruncatedList(items.length);

  const steps: GuidePathStep[] = items.slice(0, limit).map((activity, index) => {
    const text = describeTodo(activity, context);
    const route = todoActionRoute(activity, hasPermission);
    const current = focus && index === 0;
    return {
      id: activity.id,
      title: text.title,
      // The step to do now says why it matters; the others only what they are about, so the road stays short.
      detail: current && text.why ? `${text.why} · ${text.object}` : text.object,
      note: text.deadline?.text ?? (text.urgency === 'High' ? text.urgencyLabel : undefined),
      noteTone: noteToneOf(text),
      kicker: current ? t('activity.todo.path.now') : undefined,
      state: current ? 'current' : 'upcoming',
      // The button is the way in. An item whose page the person cannot open leads to the list, where it is told in full.
      action: route
        ? {
            label: t('activity.todo.actions.doNow'),
            href: route,
            ariaLabel: t('activity.todo.actions.doNowFor', { title: text.title }),
            testId: current ? 'home-todo-do-now' : undefined,
          }
        : { label: t('activity.todo.path.open'), href: TODO_LIST_PATH, ariaLabel: `${t('activity.todo.path.open')}: ${text.title}` },
    };
  });
  const hidden = items.length - steps.length;

  return (
    <section
      aria-labelledby={titleId}
      className={cn('min-w-0 rounded-xl border bg-card p-4 shadow-sm sm:p-6', className)}
      data-testid="home-todo-path"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={titleId} className="break-words text-lg font-semibold">
            {t('activity.todo.path.title')}
          </h2>
          <p className="text-sm text-foreground/70" data-testid="home-todo-counts">
            {truncated ? t('activity.todo.summary.first', { max: TODO_LIST_LIMIT }) : t('activity.todo.summary.total', { count: items.length })}
            {urgent !== null && urgent > 0 ? (
              <>
                {' · '}
                <span className="font-medium text-foreground" data-testid="home-todo-urgent">
                  {t('activity.todo.summary.urgent', { count: urgent })}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <Link
          to={TODO_LIST_PATH}
          className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary-text outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="home-todo-see-all"
        >
          {t('activity.todo.next.seeAll')}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <GuidePath label={t('activity.todo.path.title')} steps={steps} data-testid="home-todo-steps" />

      {hidden > 0 ? (
        <p className="mt-4 text-sm text-foreground/70" data-testid="home-todo-more">
          {t('activity.todo.next.more', { count: hidden })}
        </p>
      ) : null}
    </section>
  );
}
