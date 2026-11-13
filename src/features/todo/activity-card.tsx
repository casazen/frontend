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
import { CONNECTION_HEALTH_SECTION } from '@/features/compliance/lib/connection-health-model';
import { messageThreadPath } from '@/lib/message-hub-routes';
import { cn } from '@/lib/utils';
import { useCloseActivity } from '@/queries/internalActivities';
import { describeTodo } from './lib/todo-model';

/**
 * Whose id fills the `:id` of a page: the id of the entity the item is about, or the id of its property. `thread` is the page of a conversation of the hub of messages
 * (`:threadKey`): its key is made from the kind of conversation (`threadKind`) and the id of the entity the item is about.
 */
export type TodoRouteTarget = 'entity' | 'property' | 'thread';

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
  /**
   * The kinds of entity an item must be about for this route to apply: several kinds of item share one action (`ResumeWizard` is the wizard of a
   * property and every step of the activation with Octorate), and each opens its own page. An item of another kind skips the route.
   */
  onlyFor?: readonly string[];
  /** The name of the parameter of the address that carries the id of the entity the item is about (`step` of a guided step of the panel), for a page that finds the rest from it. */
  entityParam?: string;
  /**
   * For `target: 'thread'`: the kind of conversation the key starts with, `ota` (a conversation of a channel, the id of its thread) or `direct` (a direct booking, the id of
   * the booking), as the hub gives them (`ota:{id}`, `direct:{bookingId}`).
   */
  threadKind?: 'ota' | 'direct';
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

/** The `entityType` of an item about a conversation of a channel (the thread of the copy of the channel's messages). */
const OTA_THREAD = 'OtaMessageThread';

/** The `entityType` of the items of the activation with Octorate: a guided step of the panel, a part of the plan, a «Fallo per me» request. */
const PANEL_STEP = 'OnboardingPanelStep';
const ONBOARDING_PART = 'OnboardingPart';
const ASSIST_REQUEST = 'OnboardingAssistRequest';
const ONBOARDING_FLOW = 'OnboardingFlow';

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
 * - `ReplyToMessage`: the conversation in the hub of messages (E05/F05/US04), `/messages/ota:{id}` for an item about a thread of a channel (`OtaMessageThread`) and
 *   `/messages/direct:{id}` for an item about the booking of a direct conversation; `ApproveAiDraft`: the queue of the approvals, or the tab Messaggi of the booking;
 * - `ResumeWizard`: the activation of the property, the wizard that is resumed by property, and the steps of the activation of CasaZen with Octorate
 *   (epic E10), told apart by the entity (`onlyFor`): a guided step of the panel opens its own page (it finds its kind from the id of the step), a
 *   part put off or left half way, and a «Fallo per me» request, open the plan (their items know the id of a stored row, not the part). The flow to
 *   complete opens the summary of the activation (its item knows a derived id, not the flow, so the table opens on all the flows).
 *
 * A route filled with the id of the entity (`target: 'entity'`) names the kind of entity the item must be about (`entityType`, `Booking`
 * for the page of a booking): `ApproveAiDraft` may be about a queue item, whose id is not a booking's, so such an item gets no booking address from it (the button is left
 * out and the row leads to the list). A conversation is opened through its key (`target: 'thread'`), which the kind of entity tells apart.
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
    route: { path: '/app/short-rent/messages/:threadKey', target: 'thread', entityType: OTA_THREAD, threadKind: 'ota' },
    fallback: { path: '/app/short-rent/messages/:threadKey', target: 'thread', entityType: BOOKING, threadKind: 'direct' },
  },
  ApproveAiDraft: {
    route: { path: '/app/short-rent/approval-queue' },
    fallback: { path: '/app/short-rent/bookings/:id', target: 'entity', entityType: BOOKING, tab: 'messages' },
  },
  ResumeWizard: {
    route: { path: '/app/short-rent/onboarding/panel', onlyFor: [PANEL_STEP], entityParam: 'step' },
    fallback: [
      { path: '/app/short-rent/onboarding', onlyFor: [ONBOARDING_PART, ASSIST_REQUEST] },
      { path: '/app/short-rent/onboarding/summary', onlyFor: [ONBOARDING_FLOW] },
      { path: '/app/short-rent/properties/:id/activation', target: 'property' },
    ],
  },
  ReconnectChannel: {
    route: { path: '/app/short-rent/channels' },
  },
  // A fiscal document of the channel manager the SDI rejected or that is still to collect (E06/F03/US02/T01, `ActivityAction` 30): the fiscal page of the
  // host, where the documents are. The page that lists them (E06/F03/US04/T01) replaces this entry when it exists, as the notes above say.
  ReviewFiscalDocument: {
    route: { path: '/app/short-rent/fiscal' },
  },
  // The actions the traffic light of the cockpit raises (E03/F02/US01/T03, NF-52): the feeder opens a "To do" for each red or yellow item, with the
  // action of the cockpit. They lead where the cockpit leads (`COMPLIANCE_ACTION_TARGETS` of `lib/compliance-routes.ts`), so the «Adesso» block of the
  // Home and the page of the adempimenti end in the same place. `UploadIstatProof` and `VerifyIdentity` above were there before it.
  // - `SendAlloggiatiManually`: the Alloggiati section of the booking (the item is about the stay);
  // - `ActivateOctorateSend`: the wizard that activates the send of the property (E03/F01/US02/T02, `?property=<id>`: the police send is the property's), or, for who may not
  //   change the sender, the page of the property on the section of its connection health;
  // - `EnterMunicipalityTaxRate`: the page of the property (the tourist tax rate is the property's; no page enters it yet);
  // - `RenewPoliceCredentials`: the Alloggiati dashboard;
  // - `DeclareTouristTax`: the archive of the proofs, on the tax declaration of the property (the month is in the entity type of the item,
  //   `PropertyPeriod:yyyy-MM`; the archive reads `kind` and `property` from the address).
  SendAlloggiatiManually: {
    route: { path: '/app/short-rent/bookings/:id', target: 'entity', entityType: BOOKING, tab: 'alloggiati' },
  },
  ActivateOctorateSend: {
    route: { path: '/app/short-rent/compliance/sender', propertyParam: 'property' },
    fallback: { path: '/app/short-rent/properties/:id', target: 'property', search: { section: CONNECTION_HEALTH_SECTION } },
  },
  RenewPoliceCredentials: {
    route: { path: '/app/short-rent/alloggiati' },
  },
  EnterMunicipalityTaxRate: {
    route: { path: '/app/short-rent/properties/:id', target: 'property' },
  },
  DeclareTouristTax: {
    route: { path: '/app/short-rent/alloggiati/reports', propertyParam: 'property', search: { kind: 'TouristTaxDeclaration' } },
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
  if (route.onlyFor && !route.onlyFor.includes(activity.entityType)) return null;
  const entry = getManifestEntry(route.path);
  if (!entry) return null;
  if (hasPermission && !entry.requiredPermissions.every((permission) => hasPermission(entry.context, permission))) return null;

  let path = entry.path;
  if (route.target === 'thread') {
    // The key of a conversation is `ota:{id}` or `direct:{bookingId}`; the address carries it escaped, like every link to a conversation.
    const id = entityOf(route, activity);
    if (!id || !route.threadKind) return null;
    path = messageThreadPath(`${route.threadKind}:${id}`);
  } else if (route.target) {
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
  if (route.entityParam) {
    if (!usable(activity.entityId)) return null;
    query.set(route.entityParam, activity.entityId);
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
