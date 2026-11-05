import type { TFunction } from 'i18next';
import type { ActivityUrgency, TodoActivity } from '@/api/internal-activities.api';
import { addDays, formatStayDate, romeWallClock, todayInRome } from '@/lib/stay-dates';

/** The page of the whole list (ADR-026-R8): the Home links here, and so does the nav. */
export const TODO_LIST_PATH = '/app/short-rent/activities';

/** How many of the next items the Home lists under the one it shows first. */
export const HOME_NEXT_ITEMS = 3;

/** The most items the server sends in the list (`TodoLimits.MaxPendingItems` of the backend): it cuts the list there, while `/count` counts them all. */
export const TODO_LIST_LIMIT = 50;

/** Whether a list of this length may be only the first part of a longer one: its length is then "the first ones", never a total. */
export function isTruncatedList(length: number): boolean {
  return length >= TODO_LIST_LIMIT;
}

interface TypeKeys {
  titleKey: string;
  whyKey: string;
}

// The keys are written out (`*Key:` properties) so that the i18n test finds a missing translation. The `ActivityType` of the backend is
// open-ended (a later task appends the type it raises): a type that is not here is told with the words that task adds to the locale
// files under the same names (`activity.todo.type.<Type>.title` and `.why`), or with the generic ones of `unknown` when it adds none.
const TYPE_KEYS: Record<string, TypeKeys> = {
  CheckInPending: { titleKey: 'activity.todo.type.CheckInPending.title', whyKey: 'activity.todo.type.CheckInPending.why' },
  CheckOutPending: { titleKey: 'activity.todo.type.CheckOutPending.title', whyKey: 'activity.todo.type.CheckOutPending.why' },
  AlloggiatiDeadline: { titleKey: 'activity.todo.type.AlloggiatiDeadline.title', whyKey: 'activity.todo.type.AlloggiatiDeadline.why' },
  IstatDeadline: { titleKey: 'activity.todo.type.IstatDeadline.title', whyKey: 'activity.todo.type.IstatDeadline.why' },
  ReceiptToRetrieve: { titleKey: 'activity.todo.type.ReceiptToRetrieve.title', whyKey: 'activity.todo.type.ReceiptToRetrieve.why' },
  MessageToApprove: { titleKey: 'activity.todo.type.MessageToApprove.title', whyKey: 'activity.todo.type.MessageToApprove.why' },
  PublicationError: { titleKey: 'activity.todo.type.PublicationError.title', whyKey: 'activity.todo.type.PublicationError.why' },
  FiscalDocument: { titleKey: 'activity.todo.type.FiscalDocument.title', whyKey: 'activity.todo.type.FiscalDocument.why' },
  WizardResume: { titleKey: 'activity.todo.type.WizardResume.title', whyKey: 'activity.todo.type.WizardResume.why' },
  IntegrationError: { titleKey: 'activity.todo.type.IntegrationError.title', whyKey: 'activity.todo.type.IntegrationError.why' },
  CredentialsToRenew: { titleKey: 'activity.todo.type.CredentialsToRenew.title', whyKey: 'activity.todo.type.CredentialsToRenew.why' },
  ReconnectChannelManager: {
    titleKey: 'activity.todo.type.ReconnectChannelManager.title',
    whyKey: 'activity.todo.type.ReconnectChannelManager.why',
  },
};

const UNKNOWN_TYPE_KEYS: TypeKeys = { titleKey: 'activity.todo.type.unknown.title', whyKey: 'activity.todo.type.unknown.why' };

// Same for the kinds of entity (`EntityType` is a free string): `activity.todo.entity.<Type>` is added by the task that raises the item.
const ENTITY_KEYS: Record<string, { labelKey: string }> = {
  Booking: { labelKey: 'activity.todo.entity.Booking' },
  Property: { labelKey: 'activity.todo.entity.Property' },
};

const URGENCY_KEYS: Record<ActivityUrgency, { labelKey: string }> = {
  High: { labelKey: 'activity.todo.urgency.High' },
  Medium: { labelKey: 'activity.todo.urgency.Medium' },
  Low: { labelKey: 'activity.todo.urgency.Low' },
};

/** Reasons are codes or short texts of the server: only the ones that have a translation here are translated. */
const REASON_PREFIX = 'activity.todo.reason.';

/** What a person reads of one item. */
export interface TodoText {
  /** What it is: "Check-in da completare". */
  title: string;
  /** What it is about: the kind of entity and the property, "Prenotazione · Casa al mare". */
  object: string;
  /** Why it matters, one line; `null` when the server and the type say nothing. */
  why: string | null;
  /** By when, said in words; `null` for an item without a deadline. */
  deadline: TodoDeadline | null;
  urgency: ActivityUrgency;
  /** "Urgente", "Importante", "Quando puoi". */
  urgencyLabel: string;
}

export interface TodoDeadline {
  /** "Entro domani alle 14:00", "Scaduta: 5 nov". */
  text: string;
  overdue: boolean;
  /** The calendar day of the deadline in Europe/Rome (`YYYY-MM-DD`), for the date column of a list. */
  day: string;
}

export interface TodoTextContext {
  t: TFunction;
  /** Whether a translation key exists (`i18n.exists`): the reasons the server sends are open-ended. */
  exists: (key: string) => boolean;
  locale: string;
  /** The names of the host's properties, by id: the detail of a property is not in the item (ADR-026-R3). */
  propertyNames: ReadonlyMap<string, string>;
  /** Now, to tell a deadline that has passed from one that has not (tests set it). */
  now?: Date;
}

/** The urgency the server sent, or `Low` for a value this version of the app does not know. */
export function urgencyOf(value: string | null | undefined): ActivityUrgency {
  return value === 'High' || value === 'Medium' ? value : 'Low';
}

/** How many items are urgent: the ones the nav counts (`High`, ADR-026-R12). */
export function countUrgent(items: readonly Pick<TodoActivity, 'urgency'>[]): number {
  return items.filter((item) => item.urgency === 'High').length;
}

/**
 * How many items are urgent, for a line that counts them: the number of the nav badge when there is one (`/count` counts every urgent
 * item, and the list is cut at {@link TODO_LIST_LIMIT}), else the urgent ones of the list, which are all of them only while the list is not
 * cut. Of a cut list with no number from the server there is none to give (`null`).
 */
export function urgentCountOf(items: readonly Pick<TodoActivity, 'urgency'>[], serverCount: number | undefined): number | null {
  if (typeof serverCount === 'number') return serverCount;
  return isTruncatedList(items.length) ? null : countUrgent(items);
}

/** The instants of the API are UTC: a time written without a zone is UTC too, and never the clock of the browser. */
const ZONE = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

function asInstant(value: string): Date | null {
  const text = value.includes('T') && !ZONE.test(value) ? `${value}Z` : value;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

const two = (value: number) => String(value).padStart(2, '0');

function describeDeadline(dueAt: string | null, ctx: TodoTextContext): TodoDeadline | null {
  if (!dueAt) return null;
  const instant = asInstant(dueAt);
  const clock = instant ? romeWallClock(instant) : null;
  if (!instant || !clock) return null;

  const { t, locale } = ctx;
  const now = ctx.now ?? new Date();
  const today = todayInRome(now);
  // A deadline at midnight of Rome is a day, not an hour: it is late only once the day is over.
  const hasTime = clock.hour !== 0 || clock.minute !== 0;
  const overdue = hasTime ? instant.getTime() < now.getTime() : clock.date < today;

  const day =
    clock.date === today
      ? t('activity.todo.deadline.today')
      : clock.date === addDays(today, 1)
        ? t('activity.todo.deadline.tomorrow')
        : formatStayDate(clock.date, locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const when = hasTime ? t('activity.todo.deadline.withTime', { day, time: `${two(clock.hour)}:${two(clock.minute)}` }) : day;

  return {
    text: overdue ? t('activity.todo.deadline.overdue', { when }) : t('activity.todo.deadline.by', { when }),
    overdue,
    day: clock.date,
  };
}

/** The words of a type: the ones of the table, the ones a later task added to the locale files, or the generic ones. */
function typeKeysOf(activityType: string, exists: (key: string) => boolean): TypeKeys {
  if (Object.hasOwn(TYPE_KEYS, activityType)) return TYPE_KEYS[activityType];
  const own = `activity.todo.type.${activityType}`;
  if (!activityType || !exists(`${own}.title`)) return UNKNOWN_TYPE_KEYS;
  return { titleKey: `${own}.title`, whyKey: exists(`${own}.why`) ? `${own}.why` : UNKNOWN_TYPE_KEYS.whyKey };
}

function entityLabelKeyOf(entityType: string, exists: (key: string) => boolean): string | null {
  if (Object.hasOwn(ENTITY_KEYS, entityType)) return ENTITY_KEYS[entityType].labelKey;
  const own = `activity.todo.entity.${entityType}`;
  return entityType && exists(own) ? own : null;
}

function describeObject(activity: TodoActivity, ctx: TodoTextContext): string {
  const { t } = ctx;
  const entityKey = entityLabelKeyOf(activity.entityType, ctx.exists);
  const property = activity.propertyId ? ctx.propertyNames.get(activity.propertyId) : undefined;
  const parts = [entityKey ? t(entityKey) : null, property ?? null].filter((part): part is string => Boolean(part));
  if (parts.length > 0) return parts.join(' · ');
  return activity.propertyId ? t('activity.todo.object.property') : t('activity.todo.object.organization');
}

function describeWhy(activity: TodoActivity, ctx: TodoTextContext): string | null {
  const reason = activity.reason?.trim();
  if (reason) {
    const key = `${REASON_PREFIX}${reason}`;
    if (ctx.exists(key)) return ctx.t(key);
    // A short text written by the server is read as it is; a code nobody translated yet is not shown, the type tells why.
    if (/\s/.test(reason)) return reason;
  }
  return ctx.t(typeKeysOf(activity.activityType, ctx.exists).whyKey);
}

/** What a person reads of one item, in the words of the app. Nothing here changes the order of the list (ADR-026-R5). */
export function describeTodo(activity: TodoActivity, ctx: TodoTextContext): TodoText {
  const urgency = urgencyOf(activity.urgency);
  return {
    title: ctx.t(typeKeysOf(activity.activityType, ctx.exists).titleKey),
    object: describeObject(activity, ctx),
    why: describeWhy(activity, ctx),
    deadline: describeDeadline(activity.dueAt, ctx),
    urgency,
    urgencyLabel: ctx.t(URGENCY_KEYS[urgency].labelKey),
  };
}

/** The name of a type, for the filter of the page. */
export function typeTitle(activityType: string, ctx: Pick<TodoTextContext, 't' | 'exists'>): string {
  return ctx.t(typeKeysOf(activityType, ctx.exists).titleKey);
}
