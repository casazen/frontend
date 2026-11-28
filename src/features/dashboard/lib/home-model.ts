import type { TFunction } from 'i18next';
import type { PermissionPredicate } from '@/config/route-manifest';
import { translateErrorCode } from '@/lib/api-errors';
import { complianceActionRoute } from '@/lib/compliance-routes';
import { getServiceCategoryLabel, getServiceRequestStatusLabel } from '@/lib/i18n-labels';
import { messageThreadPath } from '@/lib/message-hub-routes';
import { addDays, formatRomeDateTime, formatStayDate, romeDateOf, romeWallClock, todayInRome } from '@/lib/stay-dates';
import { COMPLIANCE_COCKPIT_ACTIONS, type ComplianceCockpitAction } from '@/types/compliance.types';
import type { HostThreadSummary } from '@/types/guest-message.types';
import type { MessageHubThread } from '@/types/message-hub.types';
import type {
  DashboardIcalFeed,
  DashboardToday,
  DashboardTodayService,
  DashboardTodayStay,
  DashboardTodoItem,
} from '@/types/dashboard.types';

export type NoteTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface RowNote {
  text: string;
  tone: NoteTone;
}

export type RowAction =
  | { kind: 'link'; label: string; to: string }
  | { kind: 'respond'; label: string; bookingId: string };

export type TodayKind = 'arrivals' | 'departures' | 'cleaning' | 'jobs';

export interface HomeRow {
  id: string;
  kind?: TodayKind;
  done?: boolean;
  title: string;
  subject?: string;
  sub?: string;
  note?: RowNote;
  to: string;
  bookingId?: string;
  unread?: number;
  action?: RowAction;
}

interface Context {
  t: TFunction;
  locale: string;
}

const SERVICES_PATH = '/app/short-rent/marketplace/mine';
const CALENDAR_PATH = '/app/short-rent/bookings/calendar';
const bookingPath = (bookingId: string) => `/app/short-rent/bookings/${bookingId}`;
const clock = (instant: string): string => {
  const wall = romeWallClock(instant);
  return wall ? `${String(wall.hour).padStart(2, '0')}:${String(wall.minute).padStart(2, '0')}` : '';
};

function stayRange(from: string, to: string, locale: string): string {
  const short: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${formatStayDate(from.slice(0, 10), locale, short)}–${formatStayDate(to.slice(0, 10), locale, short)}`;
}

const SERVICE_TONES: Record<string, NoteTone> = { Richiesto: 'neutral', PresoInCarico: 'info', InCorso: 'info', Completato: 'success', Pagato: 'success', Rifiutato: 'danger' };

function arrivalNote(stay: DashboardTodayStay, t: TFunction): RowNote {
  if (stay.status === 'CheckedIn' || stay.status === 'CheckedOut') return { text: t('dashboard.today.note.arrived'), tone: 'success' };
  if (stay.checkIn?.dataComplete) return { text: t('dashboard.today.note.docsOk'), tone: 'success' };
  switch (stay.checkIn?.state) {
    case 'Completed': return { text: t('dashboard.today.note.submittedIncomplete'), tone: 'warning' };
    case 'Sent': return { text: t('dashboard.today.note.linkSent'), tone: 'neutral' };
    case 'InProgress': return { text: t('dashboard.today.note.inProgress'), tone: 'info' };
    case 'Expired': return { text: t('dashboard.today.note.expired'), tone: 'warning' };
    case 'NotSent': return { text: t('dashboard.today.note.linkNotSent'), tone: 'warning' };
    default: return { text: t('dashboard.today.note.unknown'), tone: 'neutral' };
  }
}

function arrivalRow(stay: DashboardTodayStay, { t, locale }: Context): HomeRow {
  return {
    id: `arrival-${stay.bookingId}`,
    kind: 'arrivals',
    done: stay.status === 'CheckedIn' || stay.status === 'CheckedOut',
    title: stay.guestName || t('compliance.checkout.guestFallback'),
    sub: `${stay.propertyName} · ${stayRange(stay.checkInDate, stay.checkOutDate, locale)} · ${t('dashboard.today.guests', { count: stay.numberOfGuests })}`,
    note: arrivalNote(stay, t),
    to: `${bookingPath(stay.bookingId)}?tab=guest`,
  };
}

function departureRow(stay: DashboardTodayStay, canWrite: boolean, { t }: Context): HomeRow {
  const departed = stay.status === 'CheckedOut';
  const cleaning = stay.cleaning;
  const note: RowNote = departed
    ? { text: t('dashboard.today.note.departed'), tone: 'success' }
    : cleaning
      ? { text: t('dashboard.today.note.cleaning', { status: getServiceRequestStatusLabel(cleaning.status, t) }), tone: SERVICE_TONES[cleaning.status] ?? 'neutral' }
      : { text: t('dashboard.today.note.noCleaning'), tone: 'warning' };
  return {
    id: `departure-${stay.bookingId}`,
    kind: 'departures',
    done: departed,
    title: stay.guestName,
    sub: `${stay.propertyName} · ${t('dashboard.today.guests', { count: stay.numberOfGuests })}`,
    note,
    to: bookingPath(stay.bookingId),
    bookingId: stay.bookingId,
    action:
      canWrite && !departed
        ? { kind: 'link', label: t('dashboard.today.action.registerDeparture'), to: `${bookingPath(stay.bookingId)}/checkout` }
        : undefined,
  };
}

function serviceRow(service: DashboardTodayService, { t }: Context): HomeRow {
  const time = service.scheduledStart ? `${clock(service.scheduledStart)}${service.scheduledEnd ? `–${clock(service.scheduledEnd)}` : ''}` : '';
  return {
    id: `service-${service.id}`,
    kind: service.category === 'cleaning' ? 'cleaning' : 'jobs',
    done: service.status === 'Completato' || service.status === 'Pagato',
    title: service.serviceName?.trim() || getServiceCategoryLabel(service.category, t),
    sub: [service.propertyName, service.supplierName, time].filter(Boolean).join(' · '),
    note: { text: getServiceRequestStatusLabel(service.status, t), tone: SERVICE_TONES[service.status] ?? 'neutral' },
    to: service.bookingId ? bookingPath(service.bookingId) : SERVICES_PATH,
  };
}

export function buildTodayRows(today: DashboardToday, options: { propertyId: string; canWrite: boolean }, context: Context): HomeRow[] {
  const inScope = (item: { propertyId: string }) => !options.propertyId || item.propertyId === options.propertyId;
  return [
    ...today.arrivals.items.filter(inScope).map((stay) => arrivalRow(stay, context)),
    ...today.departures.items.filter(inScope).map((stay) => departureRow(stay, options.canWrite, context)),
    ...today.services.items.filter(inScope).map((service) => serviceRow(service, context)),
  ];
}

/** How pressing a deadline is, in words: red within a day, amber within three, otherwise a plain date. */
export function urgencyOf(dueAt: string | null, { t, locale }: Context, now: Date = new Date()): RowNote {
  const due = dueAt ? new Date(dueAt).getTime() : Number.NaN;
  if (Number.isNaN(due) || !dueAt) return { text: t('dashboard.todo.urgency.whenYouCan'), tone: 'neutral' };
  const hoursLeft = (due - now.getTime()) / 3_600_000;
  const day = romeDateOf(dueAt);
  const today = todayInRome(now);
  const time = clock(dueAt);
  const text =
    hoursLeft < 0
      ? t('dashboard.todo.urgency.overdue')
      : day === today
        ? t('dashboard.todo.urgency.todayAt', { time })
        : day === addDays(today, 1)
          ? t('dashboard.todo.urgency.tomorrowAt', { time })
          : t('dashboard.todo.urgency.dateAt', { date: formatStayDate(day, locale, { day: 'numeric', month: 'long' }), time });
  return { text, tone: hoursLeft <= 24 ? 'danger' : hoursLeft <= 72 ? 'warning' : 'neutral' };
}

const TODO_ACTIONS = [
  'RespondToRequest',
  'ResolveAlloggiatiFailure',
  'SendAlloggiati',
  'CompleteGuestCheckIn',
  'ReviewFailedPayment',
  'CheckOut',
  'ConfirmPropertyReady',
  'ActivateProperty',
  'RespondToServiceRequest',
  'ConfirmFinalAmount',
  'PayServiceRequest',
  'ResolveCalendarConflict',
] as const;
type TodoAction = (typeof TODO_ACTIONS)[number];

const isTodoAction = (action: string): action is TodoAction => (TODO_ACTIONS as readonly string[]).includes(action);
const isCockpitAction = (action: string): action is ComplianceCockpitAction => (COMPLIANCE_COCKPIT_ACTIONS as readonly string[]).includes(action);

const CONFLICT_LEAD_DAYS = 2;

function calendarConflictPath(item: DashboardTodoItem): string {
  const params = new URLSearchParams({ view: 'timeline' });
  const first = romeDateOf(item.dueAt);
  if (first) params.set('from', addDays(first, -CONFLICT_LEAD_DAYS));
  if (item.propertyId) params.set('propertyId', item.propertyId);
  return `${CALENDAR_PATH}?${params.toString()}`;
}

function todoPath(item: DashboardTodoItem, hasPermission: PermissionPredicate): string {
  if (item.action === 'ResolveCalendarConflict') return calendarConflictPath(item);
  if (isCockpitAction(item.action)) {
    const route = complianceActionRoute({ action: item.action, propertyId: item.propertyId, bookingId: item.bookingId }, hasPermission);
    if (route) return route;
  }
  if (item.bookingId) return item.action === 'ReviewFailedPayment' ? `${bookingPath(item.bookingId)}?tab=payment` : bookingPath(item.bookingId);
  return item.propertyId && item.action === 'ActivateProperty' ? `/app/short-rent/properties/${item.propertyId}` : SERVICES_PATH;
}

function missingText(item: DashboardTodoItem, t: TFunction): string | undefined {
  const missing = (item.missing ?? []).find((m) => m.code === 'guest_field_missing' || m.code === 'guest_data_incomplete' || m.code === 'calendar_conflict');
  if (!missing) return undefined;
  if (missing.code === 'calendar_conflict') return t('dashboard.todo.missing.calendarConflict');
  return missing.code === 'guest_field_missing' ? t('dashboard.todo.missing.guestFields', { count: missing.count ?? 1 }) : t('dashboard.todo.missing.guestData');
}

/**
 * How pressing a night taken twice is: it is due from the first night the two share (a date, not a time of day), red when that is
 * within three days or has begun, amber otherwise.
 */
function conflictNote(item: DashboardTodoItem, { t, locale }: Context, now?: Date): RowNote {
  const first = romeDateOf(item.dueAt);
  if (!first) return { text: t('dashboard.todo.urgency.whenYouCan'), tone: 'neutral' };
  const today = todayInRome(now);
  return {
    text: t('dashboard.todo.ResolveCalendarConflict.since', { date: formatStayDate(first, locale, { day: 'numeric', month: 'long' }) }),
    tone: first <= addDays(today, 3) ? 'danger' : 'warning',
  };
}

export type HomeThread = HostThreadSummary | MessageHubThread;

function isHubThread(thread: HomeThread): thread is MessageHubThread {
  return 'threadKey' in thread;
}

export interface TodoOptions {
  propertyId: string;
  canWrite: boolean;
  hasPermission: PermissionPredicate;
  threads?: readonly HomeThread[];
}

function messageRow(thread: HomeThread, { t, locale }: Context): HomeRow {
  const hub = isHubThread(thread);
  const bookingId = thread.bookingId ?? undefined;
  const to = hub && (thread.source === 'Ota' || bookingId === undefined) ? messageThreadPath(thread.threadKey) : `${bookingPath(bookingId ?? '')}?tab=messages`;
  const preview = (hub ? thread.preview : thread.lastGuestMessagePreview)?.trim();
  const guest = (thread.guestName ?? '').trim() || t('dashboard.todo.RespondToGuest.guestFallback');
  return {
    id: `message-${hub ? thread.threadKey : thread.bookingId}`,
    title: t('dashboard.todo.RespondToGuest.title', { label: guest }),
    subject: guest,
    sub: [thread.propertyName, preview ? `«${preview}»` : null].filter(Boolean).join(' · '),
    note: {
      text: t('dashboard.todo.RespondToGuest.waiting', {
        when: formatRomeDateTime(thread.lastMessageAt, locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      }),
      tone: 'warning',
    },
    to,
    bookingId,
    unread: thread.unreadCount,
    action: { kind: 'link', label: t('dashboard.todo.RespondToGuest.cta'), to },
  };
}

/**
 * The rows of "Da fare": what the server says, in its order (most pressing first), then the guests who wrote and wait for an answer
 * (SR-12), then the calendars that do not update.
 * An action this version of the app does not know has no text to show: it is left out, never shown as a bare key.
 */
export function buildTodoRows(today: DashboardToday, feeds: readonly DashboardIcalFeed[], options: TodoOptions, context: Context, now?: Date): HomeRow[] {
  const { t, locale } = context;
  const approvals = new Map(today.approvals.items.map((approval) => [approval.bookingId, approval]));
  const inScope = (propertyId: string | null) => !options.propertyId || propertyId === null || propertyId === options.propertyId;

  const items = today.todo.items
    .filter((item) => isTodoAction(item.action) && inScope(item.propertyId))
    .map((item, position): HomeRow => {
      const action = item.action as TodoAction;
      const to = todoPath(item, options.hasPermission);
      const approval = action === 'RespondToRequest' && item.bookingId ? approvals.get(item.bookingId) : undefined;
      const cinMissing = action === 'ActivateProperty' && (item.missing ?? []).some((m) => m.code.startsWith('activation_cin'));
      const conflict = action === 'ResolveCalendarConflict';
      const sub = approval
        ? `${approval.propertyName} · ${stayRange(approval.checkInDate, approval.checkOutDate, locale)} · ${t('dashboard.today.guests', { count: approval.numberOfGuests })}`
        : [action === 'ActivateProperty' || conflict ? null : item.propertyName, missingText(item, t)].filter(Boolean).join(' · ');
      const cta = t(cinMissing ? 'dashboard.todo.ActivateProperty.ctaCin' : `dashboard.todo.${action}.cta`);
      const respond = action === 'RespondToRequest' && options.canWrite && item.bookingId;
      const linkLabel = action === 'RespondToRequest' ? t('dashboard.todo.open') : cta;
      return {
        id: `${action}-${conflict ? `${position}-` : ''}${item.bookingId ?? item.serviceRequestId ?? item.propertyId ?? item.label}`,
        title: t(`dashboard.todo.${action}.title`, { label: item.label }),
        subject: item.label,
        sub: sub || undefined,
        note: conflict ? conflictNote(item, context, now) : urgencyOf(item.dueAt, context, now),
        to,
        bookingId: conflict ? undefined : (item.bookingId ?? undefined),
        action: respond ? { kind: 'respond', label: cta, bookingId: item.bookingId! } : { kind: 'link', label: linkLabel, to },
      };
    });

  const messages = (options.threads ?? []).filter((thread) => inScope(thread.propertyId ?? null)).map((thread) => messageRow(thread, context));

  const failing = feeds
    .filter((feed) => feed.lastImportStatus === 'Failure' || feed.lastImportStatus === 'PartialFailure')
    .filter((feed) => inScope(feed.propertyId))
    .map(
      (feed): HomeRow => ({
        id: `ical-${feed.feedId}`,
        title: t('dashboard.todo.ical.title', { feed: feed.label?.trim() || t(`ical.channels.${feed.channel}`), property: feed.propertyName }),
        subject: feed.propertyName,
        sub: translateErrorCode(feed.lastErrorCode, t) ?? feed.lastError ?? undefined,
        note: { text: t('dashboard.todo.ical.note'), tone: 'warning' },
        to: `/app/short-rent/properties/${feed.propertyId}?tab=ical`,
        action: { kind: 'link', label: t('dashboard.todo.ical.cta'), to: `/app/short-rent/properties/${feed.propertyId}?tab=ical` },
      }),
    );

  return [...items, ...messages, ...failing];
}
