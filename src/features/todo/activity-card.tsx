/* eslint-disable react-refresh/only-export-components -- ACTION_ROUTE_MAP (ADR-026-R6) is declared in this file and the task that raises a "To do" of a new action appends its entry here: fast refresh falls back to a full reload of this file, nothing else. */
import { useState } from 'react';
import { Link, generatePath } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, Clock, Info, type LucideIcon } from 'lucide-react';
import type { ActivityUrgency, TodoActivity } from '@/api/internal-activities.api';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getManifestEntry, type PermissionPredicate } from '@/config/route-manifest';
import type { BookingTab } from '@/features/bookings/lib/booking-tabs';
import { cn } from '@/lib/utils';
import { useCloseActivity } from '@/queries/internalActivities';
import { describeTodo } from './lib/todo-model';

/** Whose id fills the `:id` of a page: the id of the entity the item is about, or the id of its property. */
export type TodoRouteTarget = 'entity' | 'property';

/** A page of the ROUTE_MANIFEST (a pattern with `:id` when `target` says whose id fills it), optionally on a tab or a step of it. */
export interface TodoRoute {
  path: string;
  target?: TodoRouteTarget;
  /**
   * The kind of entity an item must be about for `target: 'entity'` to fill the page with its id (`Booking` for the page of a booking).
   * The id of an item about anything else (a queue item, a message thread) is not the id of a booking: it gets no address from this route.
   */
  entityType?: string;
  /** A tab of the page of a booking (`?tab=`). */
  tab?: BookingTab;
  /** Other parameters of the address, for a step of a wizard (`?step=`). */
  search?: Readonly<Record<string, string>>;
  /**
   * The name of the parameter of the address that carries the id of the property the item is about (`propertyId` for the wizard «Aggiungi
   * immobile» reopened on a property): a page that does not take the id in its path. Like `target: 'property'`, it needs an item that names one.
   */
  propertyParam?: string;
}

export interface TodoActionTarget {
  /** Where "Do now" leads. */
  route: TodoRoute;
  /**
   * Where it leads a person who cannot open `route`, or an item that lacks the id `route` needs: a page that tells the same thing in
   * read-only. Several pages are tried in order, the first the person can open wins.
   */
  fallback?: TodoRoute | readonly TodoRoute[];
}

/** The `entityType` the server sends for an item about a booking. */
const BOOKING = 'Booking';

/**
 * Where the "Do now" button of an item leads, by the `action` the server sends (ADR-026-R6): the single registry of the app. The task that
 * raises a "To do" of a new action adds its entry here (and its `ActivityAction` member in the backend), and the screen that opens it
 * adds its route to the ROUTE_MANIFEST if it does not exist: `__tests__/action-routes.test.ts` fails when an entry does not resolve to a page of the manifest.
 *
 * The addresses of the sketch of ADR-026 (`/check-in`, `/compliance/verification`, `/listings/{id}`, `/messages/{id}`, `/settings/channels`)
 * are not pages of the app: each action opens the nearest page that exists today, and the task that builds the screen it should open
 * replaces the entry:
 * - `StartCheckIn`: the host wizard "Guest check-in" of the booking (`/check-in`, E03/F01/US04/T02), or, for who may not write the booking,
 *   the tab Documenti of the booking, where the online check-in of the guests is sent and followed;
 * - `VerifyIdentity`: the queue of the verifications, or the same tab for who may not decide them;
 * - `UploadAlloggiatiProof`, `UploadIstatProof`: the Alloggiati Web page, the summary of the adempimenti (ISTAT has no page of its own);
 * - `FixListingError`: the wizard «Aggiungi immobile» of the property named by the item, at the step of the channels where the state of each
 *   channel and what to fix are told (E02/F03/US01/T04); for who may not write the properties the page of the property, and the channels
 *   when the item names none;
 * - `ReplyToMessage`, `ApproveAiDraft`: the tab Messaggi of the booking, or the queue of the approvals;
 * - `ResumeWizard`: the activation of the property, the one wizard that is resumed by property today.
 *
 * A route filled with the id of the entity (`target: 'entity'`) names the kind of entity the item must be about (`entityType`, `Booking`
 * for the page of a booking): `ReplyToMessage` may be about a message thread and `ApproveAiDraft` about a queue item, whose ids are not a
 * booking's, so those items get no address from it (the button is left out and the row leads to the list).
 */
export const ACTION_ROUTE_MAP = {
  ReviewBooking: {
    route: { path: '/app/short-rent/bookings/:id', target: 'entity', entityType: BOOKING },
  },
  StartCheckIn: {
    route: { path: '/app/short-rent/bookings/:id/check-in', target: 'entity', entityType: BOOKING },
    fallback: { path: '/app/short-rent/bookings/:id', target: 'entity', entityType: BOOKING, tab: 'guest' },
  },
  CompleteCheckOut: {
    route: { path: '/app/short-rent/bookings/:id/checkout', target: 'entity', entityType: BOOKING },
    fallback: { path: '/app/short-rent/bookings/:id', target: 'entity', entityType: BOOKING },
  },
  VerifyIdentity: {
    route: { path: '/app/short-rent/verifications' },
    fallback: { path: '/app/short-rent/bookings/:id', target: 'entity', entityType: BOOKING, tab: 'guest' },
  },
  UploadAlloggiatiProof: {
    route: { path: '/app/short-rent/alloggiati' },
  },
  UploadIstatProof: {
    route: { path: '/app/short-rent/compliance' },
  },
  FixListingError: {
    route: { path: '/app/short-rent/properties/create', propertyParam: 'propertyId', search: { step: 'channels' } },
    fallback: [{ path: '/app/short-rent/properties/:id', target: 'property' }, { path: '/app/short-rent/channels' }],
  },
  ReplyToMessage: {
    route: { path: '/app/short-rent/bookings/:id', target: 'entity', entityType: BOOKING, tab: 'messages' },
  },
  ApproveAiDraft: {
    route: { path: '/app/short-rent/approval-queue' },
    fallback: { path: '/app/short-rent/bookings/:id', target: 'entity', entityType: BOOKING, tab: 'messages' },
  },
  ResumeWizard: {
    route: { path: '/app/short-rent/properties/:id/activation', target: 'property' },
  },
  ReconnectChannel: {
    route: { path: '/app/short-rent/channels' },
  },
} satisfies Record<string, TodoActionTarget>;

/** An action this version of the app opens. The server may send one it does not know yet: it has no button. */
export type TodoAction = keyof typeof ACTION_ROUTE_MAP;

/** The id a guid-valued field has when the server had nothing to put there. */
const NO_ID = '00000000-0000-0000-0000-000000000000';

type TodoRouteSubject = Pick<TodoActivity, 'action' | 'entityType' | 'entityId' | 'propertyId'>;

function usable(id: string | null | undefined): id is string {
  return Boolean(id) && id !== NO_ID;
}

/** The property an item is about: the one it names, or the entity itself when the entity is a property. */
function propertyOf(activity: TodoRouteSubject): string | null {
  if (usable(activity.propertyId)) return activity.propertyId;
  return activity.entityType === 'Property' && usable(activity.entityId) ? activity.entityId : null;
}

/** The id of the entity an item is about, for a page of that kind of entity (`route.entityType`): none for an item about anything else. */
function entityOf(route: TodoRoute, activity: TodoRouteSubject): string | null {
  if (route.entityType !== undefined && activity.entityType !== route.entityType) return null;
  return usable(activity.entityId) ? activity.entityId : null;
}

function buildRoute(route: TodoRoute, activity: TodoRouteSubject, hasPermission?: PermissionPredicate): string | null {
  const entry = getManifestEntry(route.path);
  if (!entry) return null;
  if (hasPermission && !entry.requiredPermissions.every((permission) => hasPermission(entry.context, permission))) return null;

  let path = entry.path;
  if (route.target) {
    const id = route.target === 'property' ? propertyOf(activity) : entityOf(route, activity);
    if (!id) return null;
    path = generatePath(entry.path, { id });
  }

  const query = new URLSearchParams();
  if (route.propertyParam) {
    const id = propertyOf(activity);
    if (!id) return null;
    query.set(route.propertyParam, id);
  }
  if (route.tab && route.tab !== 'details') query.set('tab', route.tab);
  for (const [name, value] of Object.entries(route.search ?? {})) query.set(name, value);
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * The address "Do now" opens for an item, or `null` when there is none to offer: an action unknown to this version of the app, an item
 * that lacks the id its page needs (or is about another kind of entity than the page's), or a person who can open neither the page nor
 * its read-only fallback. The button is then left out, and never sends the person to a page that answers "no access".
 */
export function todoActionRoute(activity: TodoRouteSubject, hasPermission?: PermissionPredicate): string | null {
  if (!Object.hasOwn(ACTION_ROUTE_MAP, activity.action)) return null;
  const target: TodoActionTarget = ACTION_ROUTE_MAP[activity.action as TodoAction];
  const fallbacks = target.fallback === undefined ? [] : Array.isArray(target.fallback) ? target.fallback : [target.fallback as TodoRoute];
  for (const route of [target.route, ...fallbacks]) {
    const address = buildRoute(route, activity, hasPermission);
    if (address) return address;
  }
  return null;
}

const URGENCY_STYLE: Record<ActivityUrgency, { variant: NonNullable<BadgeProps['variant']>; Icon: LucideIcon }> = {
  High: { variant: 'destructive', Icon: AlertCircle },
  Medium: { variant: 'warning', Icon: AlertTriangle },
  Low: { variant: 'secondary', Icon: Info },
};

interface TodoActivityCardProps {
  activity: TodoActivity;
  /** The names of the host's properties, by id (the item carries the id only). */
  propertyNames: ReadonlyMap<string, string>;
  /**
   * Decides what the person may do. Whether they may open the page "Do now" leads to (without it the button is always offered), and
   * whether they may mark the item as done, which asks the permission to write the properties of Affitti brevi (without it there is no
   * such button: what cannot be checked is not offered).
   */
  hasPermission?: PermissionPredicate;
}

/**
 * One item of the "To do" list: what it is, on which object, by when and why in one line, how urgent it is (an icon and a word, never the
 * color alone), "Fallo ora" that opens the page where it is done, and "Segna come fatto" for the one who did it elsewhere and may write
 * the properties: it takes the item off the list of the whole organization, a deadline of the law included, so a role that only reads has
 * no such button (the endpoint must ask the same permission). This is the card of the host's list: the card of the staff work (status
 * and notes) is `components/activities/ActivityCard`, which stays as it is.
 */
export function TodoActivityCard({ activity, propertyNames, hasPermission }: TodoActivityCardProps) {
  const { t, i18n } = useTranslation();
  const [closing, setClosing] = useState(false);
  const close = useCloseActivity(activity.id);
  const text = describeTodo(activity, { t, exists: (key) => i18n.exists(key), locale: i18n.language, propertyNames });
  const route = todoActionRoute(activity, hasPermission);
  // The page of the list asks `property.read` only, which every role of the area holds: closing is a write, and it is not offered on a guess.
  const canClose = hasPermission?.('short-rent', 'property.write') === true;
  const { variant, Icon } = URGENCY_STYLE[text.urgency];

  return (
    <li
      data-testid="todo-activity"
      data-urgency={text.urgency}
      data-action={activity.action}
      className="space-y-3 rounded-lg bg-card p-4 ring-1 ring-inset ring-border"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="break-words text-base font-semibold" data-testid="todo-title">
            {text.title}
          </h2>
          <p className="break-words text-sm text-foreground/70" data-testid="todo-object">
            {text.object}
          </p>
        </div>
        <Badge variant={variant} className="gap-1" data-testid="todo-urgency">
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          {text.urgencyLabel}
        </Badge>
      </div>

      {text.deadline ? (
        <p
          className={cn('flex items-center gap-1.5 text-sm', text.deadline.overdue ? 'font-medium text-danger-foreground' : 'text-foreground/70')}
          data-testid="todo-deadline"
          data-overdue={text.deadline.overdue || undefined}
        >
          <Clock aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 break-words">{text.deadline.text}</span>
        </p>
      ) : null}

      {text.why ? (
        <p className="break-words text-sm" data-testid="todo-why">
          {text.why}
        </p>
      ) : null}

      {route || canClose ? (
        <div className="flex flex-wrap gap-2">
          {route ? (
            <Button asChild size="sm" className="min-h-11 md:min-h-0">
              <Link to={route} aria-label={t('activity.todo.actions.doNowFor', { title: text.title })} data-testid="todo-do-now">
                {t('activity.todo.actions.doNow')}
              </Link>
            </Button>
          ) : null}
          {canClose ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 md:min-h-0"
              aria-label={t('activity.todo.actions.closeFor', { title: text.title })}
              onClick={() => setClosing(true)}
              data-testid="todo-close"
            >
              {t('activity.todo.actions.close')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {canClose ? (
        <ConfirmationDialog
          open={closing}
          onOpenChange={setClosing}
          title={t('activity.todo.close.title')}
          description={t('activity.todo.close.description', { title: text.title })}
          confirmLabel={t('activity.todo.close.confirm')}
          isLoading={close.isPending}
          onConfirm={() => close.mutate()}
        />
      ) : null}
    </li>
  );
}
