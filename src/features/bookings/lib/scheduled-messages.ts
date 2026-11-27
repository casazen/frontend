import { AlertTriangle, Ban, CalendarClock, CheckCircle2, CirclePause, SkipForward, TimerOff, type LucideIcon } from 'lucide-react';
import type { BadgeProps } from '@/components/ui/badge';
import type { MessageContactChannel, ScheduledMessage, ScheduledMessageStatus } from '@/types';

// What the section «Messaggi programmati» of a booking says about each message (E05/F07/US02, NF-71): the words of the states, of the reasons a message is held back, failed or ended,
// of the channel it will use, and the facts the screen reads from the answer of the server. Pure: no network, no clock of its own. Every text is a key written out (`*Key:`) so that the
// i18n test finds a missing translation, and a code this version does not know is told with a generic sentence, never as the code.

const FALLBACK_ZONE = 'Europe/Rome';

const SOON_MS = 2 * 60 * 60 * 1000;

const OPEN_STATUSES: ReadonlySet<string> = new Set<ScheduledMessageStatus>(['Scheduled', 'Blocked', 'Failed']);

export function isOpenStatus(status: string): boolean {
  return OPEN_STATUSES.has(status);
}

interface StatusView {
  labelKey: string;
  badge: NonNullable<BadgeProps['variant']>;
  Icon: LucideIcon;
}

const STATUS_VIEWS: Readonly<Record<ScheduledMessageStatus, StatusView>> = {
  Scheduled: { labelKey: 'booking.scheduledMessages.status.Scheduled', badge: 'secondary', Icon: CalendarClock },
  Sent: { labelKey: 'booking.scheduledMessages.status.Sent', badge: 'success', Icon: CheckCircle2 },
  Skipped: { labelKey: 'booking.scheduledMessages.status.Skipped', badge: 'outline', Icon: SkipForward },
  Blocked: { labelKey: 'booking.scheduledMessages.status.Blocked', badge: 'warning', Icon: CirclePause },
  Failed: { labelKey: 'booking.scheduledMessages.status.Failed', badge: 'destructive', Icon: AlertTriangle },
  Expired: { labelKey: 'booking.scheduledMessages.status.Expired', badge: 'outline', Icon: TimerOff },
  Cancelled: { labelKey: 'booking.scheduledMessages.status.Cancelled', badge: 'outline', Icon: Ban },
};

const UNKNOWN_STATUS_VIEW: StatusView = { labelKey: 'booking.scheduledMessages.status.unknown', badge: 'outline', Icon: AlertTriangle };

export function statusViewOf(status: string): StatusView {
  return Object.hasOwn(STATUS_VIEWS, status) ? STATUS_VIEWS[status as ScheduledMessageStatus] : UNKNOWN_STATUS_VIEW;
}

const PERSON_REASON = 'person';

const ENDED_REASONS: Readonly<Record<string, { reasonKey: string }>> = {
  channel_rule: { reasonKey: 'booking.scheduledMessages.reason.channelRule' },
  contact_unavailable: { reasonKey: 'booking.scheduledMessages.reason.contactUnavailable' },
  mapping_not_confirmed: { reasonKey: 'booking.scheduledMessages.reason.mappingNotConfirmed' },
  campaign_needs_consent: { reasonKey: 'booking.scheduledMessages.reason.campaignNeedsConsent' },
  check_in_completed: { reasonKey: 'booking.scheduledMessages.reason.checkInCompleted' },
  check_in_with_operator: { reasonKey: 'booking.scheduledMessages.reason.checkInWithOperator' },
  check_in_not_open: { reasonKey: 'booking.scheduledMessages.reason.checkInNotOpen' },
  booking_cancelled: { reasonKey: 'booking.scheduledMessages.reason.bookingCancelled' },
  routine_inactive: { reasonKey: 'booking.scheduledMessages.reason.routineInactive' },
  condition_not_met: { reasonKey: 'booking.scheduledMessages.reason.conditionNotMet' },
  missed: { reasonKey: 'booking.scheduledMessages.reason.missed' },
  check_out_reached: { reasonKey: 'booking.scheduledMessages.reason.checkOutReached' },
};

const OTHER_ENDED_REASON: Readonly<Record<string, { reasonKey: string }>> = {
  Skipped: { reasonKey: 'booking.scheduledMessages.reason.otherSkipped' },
  Cancelled: { reasonKey: 'booking.scheduledMessages.reason.otherCancelled' },
  Expired: { reasonKey: 'booking.scheduledMessages.reason.otherExpired' },
};

export function endedReasonOf(message: Pick<ScheduledMessage, 'status' | 'skipReason'>): { reasonKey: string; byPerson: boolean } | null {
  if (message.status !== 'Skipped' && message.status !== 'Cancelled' && message.status !== 'Expired') return null;
  const code = message.skipReason;
  if (code === PERSON_REASON && message.status === 'Skipped') return { reasonKey: 'booking.scheduledMessages.reason.person', byPerson: true };
  const known = code && Object.hasOwn(ENDED_REASONS, code) ? ENDED_REASONS[code] : OTHER_ENDED_REASON[message.status];
  return { reasonKey: known.reasonKey, byPerson: false };
}

const FAILURE_REASONS: Readonly<Record<string, { reasonKey: string }>> = {
  chat_not_licensed: { reasonKey: 'booking.scheduledMessages.failure.chatNotLicensed' },
  octorate_message_error: { reasonKey: 'booking.scheduledMessages.failure.channelRefused' },
  octorate_rate_limited: { reasonKey: 'booking.scheduledMessages.failure.rateLimited' },
  octorate_unavailable: { reasonKey: 'booking.scheduledMessages.failure.unavailable' },
  message_unconfirmed: { reasonKey: 'booking.scheduledMessages.failure.unconfirmed' },
  manual_verify: { reasonKey: 'booking.scheduledMessages.failure.manualVerify' },
};

const OTHER_FAILURE_REASON = { reasonKey: 'booking.scheduledMessages.failure.other' };

export function failureReasonOf(code: string | null | undefined): { reasonKey: string } {
  return code && Object.hasOwn(FAILURE_REASONS, code) ? FAILURE_REASONS[code] : OTHER_FAILURE_REASON;
}

export type FixPlace = 'guest' | 'property' | 'tax' | 'routines';

export interface MissingItem {
  itemKey: string;
  fix: FixPlace | null;
}

const UNKNOWN_ITEM: MissingItem = { itemKey: 'booking.scheduledMessages.blocked.item.unknown', fix: null };

const MISSING_ITEMS: Readonly<Record<string, MissingItem>> = {
  'variable_missing:guest_name': { itemKey: 'booking.scheduledMessages.blocked.variable.guestName', fix: null },
  'variable_missing:property_name': { itemKey: 'booking.scheduledMessages.blocked.variable.propertyName', fix: 'property' },
  'variable_missing:booking_code': { itemKey: 'booking.scheduledMessages.blocked.variable.bookingCode', fix: null },
  'variable_missing:check_in_date': { itemKey: 'booking.scheduledMessages.blocked.variable.checkInDate', fix: null },
  'variable_missing:check_out_date': { itemKey: 'booking.scheduledMessages.blocked.variable.checkOutDate', fix: null },
  'variable_missing:check_in_time': { itemKey: 'booking.scheduledMessages.blocked.variable.checkInTime', fix: 'property' },
  'variable_missing:check_out_time': { itemKey: 'booking.scheduledMessages.blocked.variable.checkOutTime', fix: 'property' },
  'variable_missing:host_name': { itemKey: 'booking.scheduledMessages.blocked.variable.hostName', fix: null },
  'variable_missing:check_in_link': { itemKey: 'booking.scheduledMessages.blocked.variable.checkInLink', fix: 'guest' },
  'variable_missing:check_in_method': { itemKey: 'booking.scheduledMessages.blocked.variable.checkInMethod', fix: 'property' },
  'variable_missing:access_code': { itemKey: 'booking.scheduledMessages.blocked.variable.accessCode', fix: 'property' },
  'variable_missing:property_address': { itemKey: 'booking.scheduledMessages.blocked.variable.propertyAddress', fix: 'property' },
  'variable_missing:review_link': { itemKey: 'booking.scheduledMessages.blocked.variable.reviewLink', fix: null },
  id_not_verified: { itemKey: 'booking.scheduledMessages.blocked.item.idNotVerified', fix: 'guest' },
  access_code_held: { itemKey: 'booking.scheduledMessages.blocked.item.accessCodeHeld', fix: 'tax' },
  template_missing: { itemKey: 'booking.scheduledMessages.blocked.item.templateMissing', fix: 'routines' },
  message_text_invalid: { itemKey: 'booking.scheduledMessages.blocked.item.textInvalid', fix: null },
  check_in_in_progress: { itemKey: 'booking.scheduledMessages.blocked.item.checkInInProgress', fix: null },
};

export const FIX_LABEL_KEYS: Readonly<Record<FixPlace, string>> = {
  guest: 'booking.scheduledMessages.blocked.fix.guest',
  property: 'booking.scheduledMessages.blocked.fix.property',
  tax: 'booking.scheduledMessages.blocked.fix.tax',
  routines: 'booking.scheduledMessages.blocked.fix.routines',
};

export function missingItemOf(code: string): MissingItem {
  return Object.hasOwn(MISSING_ITEMS, code) ? MISSING_ITEMS[code] : UNKNOWN_ITEM;
}

function missingCodeOf(name: string): string {
  return isTemplateVariable(name) ? `variable_missing:${name}` : name;
}

/**
 * What a message that can still go waits for, one code for each thing and each once, in the order the server tells them: the variables the text names that the booking has no value for and, for a blocked
 * message, the reason the row is held back (unless it is one of those variables already). It is said for every open message, not only the blocked one: a planned or a failed message whose booking lacks
 * a datum is held back when its time comes (or when it is tried again), and its text, which has the datum taken out, is not what the guest will read. A message that is over waits for nothing.
 * On a failed message `blockedReason` is why the last send did not go, which has its own sentence, so it is never listed here.
 */
export function missingCodesOf(message: Pick<ScheduledMessage, 'status' | 'blockedReason' | 'missingVariables'>): string[] {
  if (!isOpenStatus(message.status)) return [];
  const codes = new Set<string>();
  for (const name of message.missingVariables) codes.add(missingCodeOf(name));
  if (message.status === 'Blocked') {
    if (message.blockedReason) codes.add(message.blockedReason);
    // A message held back for something the server did not name is still held back: it says so, in the generic sentence, instead of showing a state with no reason.
    if (codes.size === 0) codes.add('unknown');
  }
  return [...codes];
}

export function missingCodesOfProblem(data: unknown): string[] {
  const listed = typeof data === 'object' && data !== null ? (data as { missing?: unknown }).missing : undefined;
  if (!Array.isArray(listed)) return [];
  return [...new Set(listed.filter((code): code is string => typeof code === 'string' && code.length > 0 && code.length <= 120))];
}

const CHANNEL_KEYS: Readonly<Record<MessageContactChannel, string>> = {
  Ota: 'booking.scheduledMessages.channel.ota',
  Direct: 'booking.scheduledMessages.channel.direct',
  Email: 'booking.scheduledMessages.channel.email',
  None: 'booking.scheduledMessages.channel.none',
};

const NO_CHANNEL_REASONS: Readonly<Record<string, { reasonKey: string }>> = {
  mapping_not_confirmed: { reasonKey: 'booking.scheduledMessages.channel.reason.mappingNotConfirmed' },
  thread_closed: { reasonKey: 'booking.scheduledMessages.channel.reason.threadClosed' },
  no_conversation: { reasonKey: 'booking.scheduledMessages.channel.reason.noConversation' },
  contact_info_unavailable: { reasonKey: 'booking.scheduledMessages.channel.reason.contactInfoUnavailable' },
  octorate_not_connected: { reasonKey: 'booking.scheduledMessages.channel.reason.notConnected' },
  channel_unknown: { reasonKey: 'booking.scheduledMessages.channel.reason.unknown' },
};

const OTHER_NO_CHANNEL_REASON = { reasonKey: 'booking.scheduledMessages.channel.reason.other' };

export interface ChannelLine {
  channelKey: string;
  reasonKey: string | null;
}

export function channelLineOf(message: Pick<ScheduledMessage, 'status' | 'channel' | 'channelReason'>): ChannelLine | null {
  if (!isOpenStatus(message.status)) return null;
  const channelKey = Object.hasOwn(CHANNEL_KEYS, message.channel) ? CHANNEL_KEYS[message.channel] : CHANNEL_KEYS.None;
  if (channelKey !== CHANNEL_KEYS.None) return { channelKey, reasonKey: null };
  const code = message.channelReason;
  return { channelKey, reasonKey: (code && Object.hasOwn(NO_CHANNEL_REASONS, code) ? NO_CHANNEL_REASONS[code] : OTHER_NO_CHANNEL_REASON).reasonKey };
}

const PLACEHOLDERS = ['check_in_link', 'access_code', 'review_link'] as const;
export type PlaceholderName = (typeof PLACEHOLDERS)[number];

export const PLACEHOLDER_KEYS: Readonly<Record<PlaceholderName, string>> = {
  check_in_link: 'booking.scheduledMessages.placeholder.checkInLink',
  access_code: 'booking.scheduledMessages.placeholder.accessCode',
  review_link: 'booking.scheduledMessages.placeholder.reviewLink',
};

const PLACEHOLDER_PATTERN = new RegExp(`\\[(${PLACEHOLDERS.join('|')})\\]`, 'g');

export type TextPart = { kind: 'text'; text: string } | { kind: 'placeholder'; name: PlaceholderName };

/** The text of a message cut at the three placeholders of the preview, so that each is shown as a sentence and not as a code in brackets. */
export function splitPlaceholders(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let from = 0;
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    if (match.index > from) parts.push({ kind: 'text', text: text.slice(from, match.index) });
    parts.push({ kind: 'placeholder', name: match[1] as PlaceholderName });
    from = match.index + match[0].length;
  }
  if (from < text.length) parts.push({ kind: 'text', text: text.slice(from) });
  return parts;
}

/**
 * The text of the preview as the host edits it: the three stand-ins of the preview go back to the variable they stand for (`[check_in_link]` is `{{check_in_link}}`), because a text saved with the
 * brackets would be sent with the brackets. Saving applies it again, so that a stand-in typed by hand is a variable too.
 */
export function withVariablesInPlaceOfStandIns(text: string): string {
  return text.replace(PLACEHOLDER_PATTERN, (_match, name: string) => `{{${name}}}`);
}

export const TEMPLATE_VARIABLES: ReadonlyArray<{ name: string; labelKey: string }> = [
  { name: 'guest_name', labelKey: 'booking.scheduledMessages.edit.variable.guestName' },
  { name: 'property_name', labelKey: 'booking.scheduledMessages.edit.variable.propertyName' },
  { name: 'booking_code', labelKey: 'booking.scheduledMessages.edit.variable.bookingCode' },
  { name: 'check_in_date', labelKey: 'booking.scheduledMessages.edit.variable.checkInDate' },
  { name: 'check_out_date', labelKey: 'booking.scheduledMessages.edit.variable.checkOutDate' },
  { name: 'check_in_time', labelKey: 'booking.scheduledMessages.edit.variable.checkInTime' },
  { name: 'check_out_time', labelKey: 'booking.scheduledMessages.edit.variable.checkOutTime' },
  { name: 'host_name', labelKey: 'booking.scheduledMessages.edit.variable.hostName' },
  { name: 'check_in_link', labelKey: 'booking.scheduledMessages.edit.variable.checkInLink' },
  { name: 'check_in_method', labelKey: 'booking.scheduledMessages.edit.variable.checkInMethod' },
  { name: 'access_code', labelKey: 'booking.scheduledMessages.edit.variable.accessCode' },
  { name: 'property_address', labelKey: 'booking.scheduledMessages.edit.variable.propertyAddress' },
  { name: 'review_link', labelKey: 'booking.scheduledMessages.edit.variable.reviewLink' },
];

export function isTemplateVariable(name: string): boolean {
  return TEMPLATE_VARIABLES.some((variable) => variable.name === name);
}

const VARIABLE_PATTERN = /\{\{([^{}]*)\}\}/g;

/** The names of the variables a text uses, read the way the server reads them. A stand-in of the preview (`[check_in_link]`) counts as the variable it stands for, since that is what is saved. */
export function variablesUsedIn(text: string): Set<string> {
  const used = new Set<string>();
  for (const match of withVariablesInPlaceOfStandIns(text).matchAll(VARIABLE_PATTERN)) used.add((match[1] ?? '').trim().toLowerCase());
  return used;
}

export function missingFromText(message: Pick<ScheduledMessage, 'missingVariables'>, text: string): string[] {
  const used = variablesUsedIn(text);
  return message.missingVariables.filter((name) => isTemplateVariable(name) && !used.has(name));
}

const ZONE_DESIGNATOR = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

export function asInstant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const text = value.includes('T') && !ZONE_DESIGNATOR.test(value) ? `${value}Z` : value;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

const FORMATS = new Map<string, Intl.DateTimeFormat>();

function formatterFor(locale: string, zone: string, withWeekday: boolean): Intl.DateTimeFormat {
  const key = `${locale}|${zone}|${withWeekday}`;
  let format = FORMATS.get(key);
  if (!format) {
    const options: Intl.DateTimeFormatOptions = {
      ...(withWeekday ? { weekday: 'short' } : {}),
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'short',
    };
    try {
      format = new Intl.DateTimeFormat(locale, { ...options, timeZone: zone });
    } catch {
      format = new Intl.DateTimeFormat(locale, { ...options, timeZone: FALLBACK_ZONE });
    }
    FORMATS.set(key, format);
  }
  return format;
}

export function formatOnPropertyClock(instant: string | null | undefined, zone: string, locale: string, withWeekday = true): string {
  const date = asInstant(instant);
  return date ? formatterFor(locale, zone, withWeekday).format(date) : '';
}

/** The messages in time order: the planned time, then the place of the action in the routine. The server sends them so; a list that arrives otherwise is put right. */
export function sortedInTimeOrder(messages: readonly ScheduledMessage[]): ScheduledMessage[] {
  const at = (message: ScheduledMessage) => asInstant(message.plannedAtUtc)?.getTime() ?? Number.POSITIVE_INFINITY;
  return [...messages].sort((a, b) => at(a) - at(b) || a.actionIndex - b.actionIndex);
}

/**
 * Whether the list can change without anybody doing anything, so that a page left open reads it again: a message that is waiting for its time within the next two hours (the routine or the sweep
 * sends it), or one that is held back or failed (the sweep tries again every quarter of an hour). A page that shows only ended messages, or messages for days away, asks for nothing.
 */
export function isAboutToChange(messages: readonly ScheduledMessage[] | undefined, now: Date): boolean {
  return (
    messages?.some((message) => {
      if (message.status === 'Blocked' || message.status === 'Failed') return true;
      if (message.status !== 'Scheduled') return false;
      const planned = asInstant(message.plannedAtUtc);
      return planned !== null && planned.getTime() - now.getTime() <= SOON_MS;
    }) ?? false
  );
}

/**
 * Whether any message can still change by itself (planned, held back or failed): while it can, an open page keeps reading the list, so that a message that goes out on its own stops saying «Programmato».
 * `isAboutToChange` says how soon; it cannot say it for good, because TanStack Query asks `refetchInterval` again only when the query or the component is updated, not as the clock moves: a page opened
 * three hours before a message, and left alone, would never learn that the two hours had begun. A page that shows only messages that are over asks for nothing.
 */
export function hasOpenMessage(messages: readonly ScheduledMessage[] | undefined): boolean {
  return messages?.some((message) => isOpenStatus(message.status)) ?? false;
}
