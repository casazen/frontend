import { AlertTriangle, Ban, CalendarClock, CheckCircle2, CirclePause, SkipForward, TimerOff, type LucideIcon } from 'lucide-react';
import type { BadgeProps } from '@/components/ui/badge';
import type { MessageContactChannel, ScheduledMessage, ScheduledMessageStatus } from '@/types';

// What the section «Messaggi programmati» of a booking says about each message (E05/F07/US02, NF-71): the words of the states, of the reasons a message is held back, failed or ended,
// of the channel it will use, and the facts the screen reads from the answer of the server. Pure: no network, no clock of its own. Every text is a key written out (`*Key:`) so that the
// i18n test finds a missing translation, and a code this version does not know is told with a generic sentence, never as the code.

/** The zone the planned time is read on when the property sends none, or one this browser does not know. */
const FALLBACK_ZONE = 'Europe/Rome';

/** How near a planned message must be for an open page to read the list again by itself (the sweep sends what is overdue by more than a quarter of an hour, so a message due within two hours may change). */
const SOON_MS = 2 * 60 * 60 * 1000;

/** The messages that can still change: the three the server tries again (`Scheduled`, `Blocked`, `Failed`). */
const OPEN_STATUSES: ReadonlySet<string> = new Set<ScheduledMessageStatus>(['Scheduled', 'Blocked', 'Failed']);

/** True while a message can still go out. */
export function isOpenStatus(status: string): boolean {
  return OPEN_STATUSES.has(status);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// The state of a message
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

interface StatusView {
  /** The state in words, always shown beside its icon: the color is never the only signal. */
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

/** A state this version of the app does not know (a newer server): it is told as such, never as one of the known states. */
const UNKNOWN_STATUS_VIEW: StatusView = { labelKey: 'booking.scheduledMessages.status.unknown', badge: 'outline', Icon: AlertTriangle };

export function statusViewOf(status: string): StatusView {
  return Object.hasOwn(STATUS_VIEWS, status) ? STATUS_VIEWS[status as ScheduledMessageStatus] : UNKNOWN_STATUS_VIEW;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Why a message ended without going out
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** Who ended it: a person of the team (the answer does not say which one, so it never says «you»), or CasaZen with the reason. */
const PERSON_REASON = 'person';

/**
 * The reason a message that did not go out ended, by the stable code of the server (`ScheduledMessageReasons`): skipped by the system, cancelled with its booking or routine, expired. A code
 * this version does not know is told with the sentence of its state.
 */
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

/** What is said of a message that ended without a reason this version knows. */
const OTHER_ENDED_REASON: Readonly<Record<string, { reasonKey: string }>> = {
  Skipped: { reasonKey: 'booking.scheduledMessages.reason.otherSkipped' },
  Cancelled: { reasonKey: 'booking.scheduledMessages.reason.otherCancelled' },
  Expired: { reasonKey: 'booking.scheduledMessages.reason.otherExpired' },
};

/** The sentence about why a message that is over did not go out; `null` for a message that went out or can still go. */
export function endedReasonOf(message: Pick<ScheduledMessage, 'status' | 'skipReason'>): { reasonKey: string; byPerson: boolean } | null {
  if (message.status !== 'Skipped' && message.status !== 'Cancelled' && message.status !== 'Expired') return null;
  const code = message.skipReason;
  if (code === PERSON_REASON && message.status === 'Skipped') return { reasonKey: 'booking.scheduledMessages.reason.person', byPerson: true };
  const known = code && Object.hasOwn(ENDED_REASONS, code) ? ENDED_REASONS[code] : OTHER_ENDED_REASON[message.status];
  return { reasonKey: known.reasonKey, byPerson: false };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Why a message failed
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Why the last send of a `Failed` message did not go, by the stable code of the server: a code of the channel, or the message layer holding the message without having taken it. None of the
 * sentences names who carries the message: they say «il canale» and «la chat del portale».
 */
const FAILURE_REASONS: Readonly<Record<string, { reasonKey: string }>> = {
  chat_not_licensed: { reasonKey: 'booking.scheduledMessages.failure.chatNotLicensed' },
  octorate_message_error: { reasonKey: 'booking.scheduledMessages.failure.channelRefused' },
  octorate_rate_limited: { reasonKey: 'booking.scheduledMessages.failure.rateLimited' },
  octorate_unavailable: { reasonKey: 'booking.scheduledMessages.failure.unavailable' },
  message_unconfirmed: { reasonKey: 'booking.scheduledMessages.failure.unconfirmed' },
  manual_verify: { reasonKey: 'booking.scheduledMessages.failure.manualVerify' },
};

const OTHER_FAILURE_REASON = { reasonKey: 'booking.scheduledMessages.failure.other' };

/** The sentence of why a message failed, for the code in its `blockedReason`. */
export function failureReasonOf(code: string | null | undefined): { reasonKey: string } {
  return code && Object.hasOwn(FAILURE_REASONS, code) ? FAILURE_REASONS[code] : OTHER_FAILURE_REASON;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// What a blocked message waits for
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** The part of the booking, or of the app, where what is missing is completed. */
export type FixPlace = 'guest' | 'property' | 'tax' | 'routines';

export interface MissingItem {
  /** What is missing, as the end of the sentence «Manca: …». */
  itemKey: string;
  /** Where it is completed; `null` when it is not completed in a page (a name the channel sends, a text the host writes with «Modifica»). */
  fix: FixPlace | null;
}

const UNKNOWN_ITEM: MissingItem = { itemKey: 'booking.scheduledMessages.blocked.item.unknown', fix: null };

/**
 * What a blocked message waits for, by the code of the server: `variable_missing:{name}` for each of the thirteen variables of a template, and the reasons that are not a variable. The same codes
 * come back in the `missing` of a «Send now» that is refused. The data of the property (its times, its address, the code of the lock, how the guest gets in) are completed on the page of the property.
 */
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

/** The link that completes what is missing, in words. */
export const FIX_LABEL_KEYS: Readonly<Record<FixPlace, string>> = {
  guest: 'booking.scheduledMessages.blocked.fix.guest',
  property: 'booking.scheduledMessages.blocked.fix.property',
  tax: 'booking.scheduledMessages.blocked.fix.tax',
  routines: 'booking.scheduledMessages.blocked.fix.routines',
};

/** What a code of the server says is missing: the sentence of its own, or the generic one for a code this version does not know. */
export function missingItemOf(code: string): MissingItem {
  return Object.hasOwn(MISSING_ITEMS, code) ? MISSING_ITEMS[code] : UNKNOWN_ITEM;
}

/**
 * What a blocked message waits for, one code for each thing and each once, in the order the server tells them: the variables the text names that the booking has no value for, then the reason
 * the row is held back unless it is one of those variables already. A message that is not blocked waits for nothing.
 */
export function missingCodesOf(message: Pick<ScheduledMessage, 'status' | 'blockedReason' | 'missingVariables'>): string[] {
  if (message.status !== 'Blocked') return [];
  const codes = new Set<string>();
  for (const name of message.missingVariables) codes.add(`variable_missing:${name}`);
  if (message.blockedReason) codes.add(message.blockedReason);
  // A message held back for something the server did not name is still held back: it says so, in the generic sentence, instead of showing a state with no reason.
  if (codes.size === 0) codes.add('unknown');
  return [...codes];
}

/**
 * The codes a refused «Send now» (422 `scheduled_message_blocked`) says it still waits for: the `missing` of the body of the answer, only the texts. Anything else in it is left out.
 */
export function missingCodesOfProblem(data: unknown): string[] {
  const listed = typeof data === 'object' && data !== null ? (data as { missing?: unknown }).missing : undefined;
  if (!Array.isArray(listed)) return [];
  return [...new Set(listed.filter((code): code is string => typeof code === 'string' && code.length > 0 && code.length <= 120))];
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// How the guest is reached
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const CHANNEL_KEYS: Readonly<Record<MessageContactChannel, string>> = {
  Ota: 'booking.scheduledMessages.channel.ota',
  Direct: 'booking.scheduledMessages.channel.direct',
  Email: 'booking.scheduledMessages.channel.email',
  None: 'booking.scheduledMessages.channel.none',
};

/** Why there is no way to the guest now, by the stable code of the server (`MessageContactOptions.Reason`). */
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
  /** The way the message will go (the portal chat, the direct conversation, an e-mail) or that there is none. */
  channelKey: string;
  /** Why there is none; `null` when there is one. */
  reasonKey: string | null;
}

/**
 * How an open message will reach the guest. The server answers the channel only for a message that can still go: for one that is over it is `None` with no reason, which is not
 * «there is no way to the guest» but «nothing to say», so a message that is over has no line.
 */
export function channelLineOf(message: Pick<ScheduledMessage, 'status' | 'channel' | 'channelReason'>): ChannelLine | null {
  if (!isOpenStatus(message.status)) return null;
  const channelKey = Object.hasOwn(CHANNEL_KEYS, message.channel) ? CHANNEL_KEYS[message.channel] : CHANNEL_KEYS.None;
  if (channelKey !== CHANNEL_KEYS.None) return { channelKey, reasonKey: null };
  const code = message.channelReason;
  return { channelKey, reasonKey: (code && Object.hasOwn(NO_CHANNEL_REASONS, code) ? NO_CHANNEL_REASONS[code] : OTHER_NO_CHANNEL_REASON).reasonKey };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// The text
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** The three things a preview never makes: the link of the check-in is issued, the code of the lock is released and the link of the review is signed when the message is sent. */
const PLACEHOLDERS = ['check_in_link', 'access_code', 'review_link'] as const;
export type PlaceholderName = (typeof PLACEHOLDERS)[number];

/** The sentence that stands in a read-only text for what is made when the message is sent. */
export const PLACEHOLDER_KEYS: Readonly<Record<PlaceholderName, string>> = {
  check_in_link: 'booking.scheduledMessages.placeholder.checkInLink',
  access_code: 'booking.scheduledMessages.placeholder.accessCode',
  review_link: 'booking.scheduledMessages.placeholder.reviewLink',
};

const PLACEHOLDER_PATTERN = new RegExp(`\\[(${PLACEHOLDERS.join('|')})\\]`, 'g');

/** A piece of the text of a message: words, or a thing that is made when the message is sent. */
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

/** The thirteen variables of a template (`MessageTemplateRenderer.Variables`), in the order the screens list them: each is inserted in the text as `{{name}}` and filled when the message is sent. */
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

/** True for one of the thirteen names: `variable_missing:` is for those, while `template_missing` and `message_text_invalid` are codes of the server that are not variables. */
export function isTemplateVariable(name: string): boolean {
  return TEMPLATE_VARIABLES.some((variable) => variable.name === name);
}

/** A variable as a template writes it, `{{name}}` (the server allows spaces inside the braces and any case, and so does this). */
const VARIABLE_PATTERN = /\{\{([^{}]*)\}\}/g;

/** The names of the variables a text uses, read the way the server reads them. A stand-in of the preview (`[check_in_link]`) counts as the variable it stands for, since that is what is saved. */
export function variablesUsedIn(text: string): Set<string> {
  const used = new Set<string>();
  for (const match of withVariablesInPlaceOfStandIns(text).matchAll(VARIABLE_PATTERN)) used.add((match[1] ?? '').trim().toLowerCase());
  return used;
}

/**
 * The data the booking has no value for that the text, as the host has it now, does not name. The server takes a variable it has no value for OUT of the text it gives (`FillKnown`: «Il check-in è dalle {{check_in_time}}.» arrives
 * as «Il check-in è dalle.»), so a text saved from it goes without that datum, and the message, no longer held back for it, goes out with the gap. Only the variables of a template count: the other codes the server
 * lists (`template_missing`, `message_text_invalid`) are not data that can be put back.
 */
export function missingFromText(message: Pick<ScheduledMessage, 'missingVariables'>, text: string): string[] {
  const used = variablesUsedIn(text);
  return message.missingVariables.filter((name) => isTemplateVariable(name) && !used.has(name));
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** The instants of the API are UTC: a time written without a zone is UTC too, and never the clock of the browser. */
const ZONE_DESIGNATOR = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

/** The instant of a text of the API, or `null` when it is none. */
export function asInstant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const text = value.includes('T') && !ZONE_DESIGNATOR.test(value) ? `${value}Z` : value;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

const FORMATS = new Map<string, Intl.DateTimeFormat>();

/** One formatter for each language, zone and set of options, made when it is first needed (a timeline writes a time for each of its messages). */
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
      // A zone this browser does not know (or an empty one): the clock the stays are read on.
      format = new Intl.DateTimeFormat(locale, { ...options, timeZone: FALLBACK_ZONE });
    }
    FORMATS.set(key, format);
  }
  return format;
}

/**
 * An instant as the clock of the property says it, with the name of the zone («mar 24 nov, 08:00 CET»): the host sees the time the guest will read on the wall of the house, whatever the zone of
 * the browser. An instant that is not one is an empty text.
 */
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
