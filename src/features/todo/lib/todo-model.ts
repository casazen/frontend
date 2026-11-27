import type { TFunction } from 'i18next';
import type { ActivityUrgency, TodoActivity } from '@/api/internal-activities.api';
import { addDays, formatStayDate, romeWallClock, todayInRome } from '@/lib/stay-dates';
import { COMPLIANCE_REASON_CODES } from '@/types/compliance.types';

export const TODO_LIST_PATH = '/app/short-rent/activities';

export const TODO_LIST_LIMIT = 50;

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
  ListingChangedOutside: {
    titleKey: 'activity.todo.type.ListingChangedOutside.title',
    whyKey: 'activity.todo.type.ListingChangedOutside.why',
  },
  FiscalDocument: { titleKey: 'activity.todo.type.FiscalDocument.title', whyKey: 'activity.todo.type.FiscalDocument.why' },
  WizardResume: { titleKey: 'activity.todo.type.WizardResume.title', whyKey: 'activity.todo.type.WizardResume.why' },
  IntegrationError: { titleKey: 'activity.todo.type.IntegrationError.title', whyKey: 'activity.todo.type.IntegrationError.why' },
  CredentialsToRenew: { titleKey: 'activity.todo.type.CredentialsToRenew.title', whyKey: 'activity.todo.type.CredentialsToRenew.why' },
  ReconnectChannelManager: {
    titleKey: 'activity.todo.type.ReconnectChannelManager.title',
    whyKey: 'activity.todo.type.ReconnectChannelManager.why',
  },
  IdentityVerification: { titleKey: 'activity.todo.type.IdentityVerification.title', whyKey: 'activity.todo.type.IdentityVerification.why' },
  MunicipalityTaxRateMissing: {
    titleKey: 'activity.todo.type.MunicipalityTaxRateMissing.title',
    whyKey: 'activity.todo.type.MunicipalityTaxRateMissing.why',
  },
  TouristTaxDeadline: { titleKey: 'activity.todo.type.TouristTaxDeadline.title', whyKey: 'activity.todo.type.TouristTaxDeadline.why' },
  TouristTaxRefundDue: { titleKey: 'activity.todo.type.TouristTaxRefundDue.title', whyKey: 'activity.todo.type.TouristTaxRefundDue.why' },
  CleaningDue: { titleKey: 'activity.todo.type.CleaningDue.title', whyKey: 'activity.todo.type.CleaningDue.why' },
  BookingSpecialRequest: { titleKey: 'activity.todo.type.BookingSpecialRequest.title', whyKey: 'activity.todo.type.BookingSpecialRequest.why' },
  ConfirmChannelMapping: { titleKey: 'activity.todo.type.ConfirmChannelMapping.title', whyKey: 'activity.todo.type.ConfirmChannelMapping.why' },
  CheckImportedListing: { titleKey: 'activity.todo.type.CheckImportedListing.title', whyKey: 'activity.todo.type.CheckImportedListing.why' },
  BookingOverlap: { titleKey: 'activity.todo.type.BookingOverlap.title', whyKey: 'activity.todo.type.BookingOverlap.why' },
  BookingSyncConflict: { titleKey: 'activity.todo.type.BookingSyncConflict.title', whyKey: 'activity.todo.type.BookingSyncConflict.why' },
  MessageToReply: { titleKey: 'activity.todo.type.MessageToReply.title', whyKey: 'activity.todo.type.MessageToReply.why' },
  OwnerStayToReview: { titleKey: 'activity.todo.type.OwnerStayToReview.title', whyKey: 'activity.todo.type.OwnerStayToReview.why' },
  OwnerStaySyncFailed: { titleKey: 'activity.todo.type.OwnerStaySyncFailed.title', whyKey: 'activity.todo.type.OwnerStaySyncFailed.why' },
  OwnerDocumentExpiring: { titleKey: 'activity.todo.type.OwnerDocumentExpiring.title', whyKey: 'activity.todo.type.OwnerDocumentExpiring.why' },
  OwnerStatementNoticeFailed: {
    titleKey: 'activity.todo.type.OwnerStatementNoticeFailed.title',
    whyKey: 'activity.todo.type.OwnerStatementNoticeFailed.why',
  },
  RoutineTask: { titleKey: 'activity.todo.type.RoutineTask.title', whyKey: 'activity.todo.type.RoutineTask.why' },
  CleaningDateChanged: { titleKey: 'activity.todo.type.CleaningDateChanged.title', whyKey: 'activity.todo.type.CleaningDateChanged.why' },
  CheckInLinkToSend: { titleKey: 'activity.todo.type.CheckInLinkToSend.title', whyKey: 'activity.todo.type.CheckInLinkToSend.why' },
  ScheduledMessageIssue: { titleKey: 'activity.todo.type.ScheduledMessageIssue.title', whyKey: 'activity.todo.type.ScheduledMessageIssue.why' },
  CompanyTenantDecision: { titleKey: 'activity.todo.type.CompanyTenantDecision.title', whyKey: 'activity.todo.type.CompanyTenantDecision.why' },
  // The self-billed invoices (TD17) of the agency (FIX/BE-TD17-ALERTS): a TD17 the SDI rejected (it counts as not issued, and has no correction yet), and the drafts of a month made by the monthly run, to check and issue.
  // Both are about the organization, never a property, and the server lists them only to who holds `agency.invoice.manage`; «Fallo ora» opens the page of the self-billed invoices (`ReviewSelfBilling`).
  SelfBillingRejected: { titleKey: 'activity.todo.type.SelfBillingRejected.title', whyKey: 'activity.todo.type.SelfBillingRejected.why' },
  SelfBillingDraftsToReview: { titleKey: 'activity.todo.type.SelfBillingDraftsToReview.title', whyKey: 'activity.todo.type.SelfBillingDraftsToReview.why' },
  // A cleaning recharged to an owner at its cost whose VAT nobody stated (E14/F01/US02/T01, NF-114, ⚖ I13; `ActivityType` 140): the backend posts the charge as it is and raises this item when the agency posts the month, and once more
  // at the close of the statement. Since FIX/BE-CLEANING-VAT it is about the cleaning request (`ServiceRequest`) with the action `StateCleaningVat`, and «Fallo ora» opens the question «La ditta di pulizie ha applicato l'IVA su
  // questa fattura?» (FIX/FE-CLEANING-VAT-QUESTION, `ACTION_ROUTE_MAP` of `activity-card.tsx`). The items raised before (action `ReviewBooking`, about the stay or the request) keep the button of that action. The `why` of the
  // locale files is what an item says when its reason is not a sentence of the server: it asks to answer the question and says what each answer does.
  ImportedPropertyReview: { titleKey: 'activationJourney.import.todoTitle', whyKey: 'activationJourney.import.todoWhy' },
  CleaningVatToState: { titleKey: 'activity.todo.type.CleaningVatToState.title', whyKey: 'activity.todo.type.CleaningVatToState.why' },
};

const UNKNOWN_TYPE_KEYS: TypeKeys = { titleKey: 'activity.todo.type.unknown.title', whyKey: 'activity.todo.type.unknown.why' };

const ENTITY_KEYS: Record<string, { labelKey: string }> = {
  Booking: { labelKey: 'activity.todo.entity.Booking' },
  OwnerStatementVersion: { labelKey: 'activity.todo.entity.OwnerStatementVersion' },
  Property: { labelKey: 'activity.todo.entity.Property' },
};

const URGENCY_KEYS: Record<ActivityUrgency, { labelKey: string }> = {
  High: { labelKey: 'activity.todo.urgency.High' },
  Medium: { labelKey: 'activity.todo.urgency.Medium' },
  Low: { labelKey: 'activity.todo.urgency.Low' },
};

const REASON_PREFIX = 'activity.todo.reason.';

const ROUTINE_TASK_TYPE = 'RoutineTask';

export interface TodoText {
  title: string;
  object: string;
  why: string | null;
  deadline: TodoDeadline | null;
  urgency: ActivityUrgency;
  urgencyLabel: string;
}

export interface TodoDeadline {
  text: string;
  overdue: boolean;
  day: string;
}

export interface TodoTextContext {
  t: TFunction;
  exists: (key: string) => boolean;
  locale: string;
  propertyNames: ReadonlyMap<string, string>;
  now?: Date;
}

export function urgencyOf(value: string | null | undefined): ActivityUrgency {
  return value === 'High' || value === 'Medium' ? value : 'Low';
}

export function countUrgent(items: readonly Pick<TodoActivity, 'urgency'>[]): number {
  return items.filter((item) => item.urgency === 'High').length;
}

export function urgentCountOf(items: readonly Pick<TodoActivity, 'urgency'>[], serverCount: number | undefined): number | null {
  if (typeof serverCount === 'number') return serverCount;
  return isTruncatedList(items.length) ? null : countUrgent(items);
}

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

/** The start of the kind of entity of an item about a property and a month (`PropertyPeriod:yyyy-MM`: ISTAT, the tourist tax), which the feeder of the compliance raises. */
const PERIOD_ENTITY = /^PropertyPeriod:(\d{4}-(?:0[1-9]|1[0-2]))$/;

function monthOf(entityType: string, locale: string): string | null {
  const month = PERIOD_ENTITY.exec(entityType)?.[1];
  return month ? formatStayDate(`${month}-01`, locale, { month: 'long', year: 'numeric' }) || null : null;
}

function describeObject(activity: TodoActivity, ctx: TodoTextContext): string {
  const { t } = ctx;
  const month = monthOf(activity.entityType, ctx.locale);
  const entityKey = entityLabelKeyOf(month ? 'Property' : activity.entityType, ctx.exists);
  const property = activity.propertyId ? ctx.propertyNames.get(activity.propertyId) : undefined;
  const parts = [entityKey ? t(entityKey) : null, property ?? null, month].filter((part): part is string => Boolean(part));
  if (parts.length > 0) return parts.join(' · ');
  return activity.propertyId ? t('activity.todo.object.property') : t('activity.todo.object.organization');
}

function describeWhy(activity: TodoActivity, ctx: TodoTextContext): string | null {
  const reason = activity.reason?.trim();
  if (reason && activity.activityType === ROUTINE_TASK_TYPE) return reason;
  if (reason) {
    const key = `${REASON_PREFIX}${reason}`;
    if (ctx.exists(key)) return ctx.t(key);
    const own = `compliance.reason.${reason}`;
    if ((COMPLIANCE_REASON_CODES as readonly string[]).includes(reason) && ctx.exists(own)) return ctx.t(own);
    if (/\s/.test(reason)) return reason;
  }
  return ctx.t(typeKeysOf(activity.activityType, ctx.exists).whyKey);
}

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

export function typeTitle(activityType: string, ctx: Pick<TodoTextContext, 't' | 'exists'>): string {
  return ctx.t(typeKeysOf(activityType, ctx.exists).titleKey);
}
