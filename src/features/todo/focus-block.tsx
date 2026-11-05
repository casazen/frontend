import { useTranslation } from 'react-i18next';
import type { TodoActivity } from '@/api/internal-activities.api';
import { FocusBlock, type CalmTone } from '@/components/shared/calm';
import type { PermissionPredicate } from '@/config/route-manifest';
import { todoActionRoute } from './activity-card';
import { TODO_LIST_PATH, describeTodo } from './lib/todo-model';

interface TodoFocusBlockProps {
  /** The first item of the list: the one the server puts first, the most urgent. */
  activity: TodoActivity;
  /** How many other items wait after this one. */
  others: number;
  /** The names of the host's properties, by id (the item carries the id only). */
  propertyNames: ReadonlyMap<string, string>;
  /** Decides whether the person may open the page "Fallo ora" leads to. */
  hasPermission?: PermissionPredicate;
}

/**
 * "Adesso" on the Home (NF-07): the first item of the "To do" list in the one highlighted block of the page, with what it is, on which
 * object, by when and why, and the button that does it. The rest of the list is `TodoTodayList` under it. The item is the first of the
 * array the server sent, never one picked here (ADR-026-R5). A person who cannot open the page "Fallo ora" leads to gets the way to the
 * list instead, so the block is never a dead end.
 */
export function TodoFocusBlock({ activity, others, propertyNames, hasPermission }: TodoFocusBlockProps) {
  const { t, i18n } = useTranslation();
  const text = describeTodo(activity, { t, exists: (key) => i18n.exists(key), locale: i18n.language, propertyNames });
  const route = todoActionRoute(activity, hasPermission);
  // Late is the one thing that changes the news; an urgent item that is still in time is a warning, the others the accent of the area.
  const tone: CalmTone = text.deadline?.overdue ? 'danger' : text.urgency === 'High' ? 'warning' : 'neutral';

  return (
    <FocusBlock
      tone={tone}
      kicker={t('activity.todo.focus.kicker')}
      title={text.title}
      body={
        <>
          {text.why ? <span className="block">{text.why}</span> : null}
          <span className="block text-sm text-foreground/70">{text.object}</span>
        </>
      }
      when={text.deadline?.text}
      then={others > 0 ? t('activity.todo.focus.then', { count: others }) : undefined}
      primary={
        route
          ? {
              label: t('activity.todo.actions.doNow'),
              href: route,
              ariaLabel: t('activity.todo.actions.doNowFor', { title: text.title }),
              testId: 'home-todo-do-now',
            }
          : { label: t('activity.todo.focus.seeAll'), href: TODO_LIST_PATH, testId: 'home-todo-all' }
      }
      secondary={route ? { label: t('activity.todo.focus.seeAll'), href: TODO_LIST_PATH, testId: 'home-todo-all' } : undefined}
      data-testid="home-todo-focus"
      data-urgency={text.urgency}
    />
  );
}
