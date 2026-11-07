import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_TYPES,
  type NotificationChannel,
  type NotificationEventType,
  type NotificationPreferences,
  type SaveNotificationPreferencesRequest,
} from '@/types';

/** The page of the settings, a tab of the profile of Affitti brevi. */
export const NOTIFICATION_PREFERENCES_PATH = '/app/short-rent/profile/notifications';

/** The words of each kind of event: its name and one line in simple words. The keys are written out so that the i18n test finds a missing one. */
export const EVENT_TEXTS: Record<NotificationEventType, { labelKey: string; hintKey: string }> = {
  NewGuestMessage: {
    labelKey: 'notificationPreferences.event.newGuestMessage',
    hintKey: 'notificationPreferences.eventHint.newGuestMessage',
  },
  UrgentGuestMessage: {
    labelKey: 'notificationPreferences.event.urgentGuestMessage',
    hintKey: 'notificationPreferences.eventHint.urgentGuestMessage',
  },
  AiDraftToApprove: {
    labelKey: 'notificationPreferences.event.aiDraftToApprove',
    hintKey: 'notificationPreferences.eventHint.aiDraftToApprove',
  },
  NewBooking: {
    labelKey: 'notificationPreferences.event.newBooking',
    hintKey: 'notificationPreferences.eventHint.newBooking',
  },
  BookingCancelled: {
    labelKey: 'notificationPreferences.event.bookingCancelled',
    hintKey: 'notificationPreferences.eventHint.bookingCancelled',
  },
  LegalDeadline: {
    labelKey: 'notificationPreferences.event.legalDeadline',
    hintKey: 'notificationPreferences.eventHint.legalDeadline',
  },
  SyncError: {
    labelKey: 'notificationPreferences.event.syncError',
    hintKey: 'notificationPreferences.eventHint.syncError',
  },
  ScheduledMessageIssue: {
    labelKey: 'notificationPreferences.event.scheduledMessageIssue',
    hintKey: 'notificationPreferences.eventHint.scheduledMessageIssue',
  },
};

/** The name of each channel, as the header of its column. */
export const CHANNEL_TEXTS: Record<NotificationChannel, { labelKey: string }> = {
  MobilePush: { labelKey: 'notificationPreferences.channel.mobilePush' },
  BrowserPush: { labelKey: 'notificationPreferences.channel.browserPush' },
  Email: { labelKey: 'notificationPreferences.channel.email' },
  CounterOnly: { labelKey: 'notificationPreferences.channel.counterOnly' },
};

/** The kind of event that can never be left without a channel (the server answers 422 `notification_legal_channel_required` otherwise). */
const LEGAL_DEADLINE: NotificationEventType = 'LegalDeadline';

/** True for the kind of event whose last channel cannot be switched off. */
export function isLegalDeadline(eventType: NotificationEventType): boolean {
  return eventType === LEGAL_DEADLINE;
}

/** One row of the page: a kind of event, what the caller has for it, and whether that is only the default. */
export interface EventRowModel {
  eventType: NotificationEventType;
  channels: NotificationChannel[];
  isDefault: boolean;
}

/** Which channels can deliver today, one answer for each channel: a channel the API does not list cannot be switched. */
export type ChannelAvailability = Readonly<Record<NotificationChannel, boolean>>;

const isKnownEvent = (value: string): value is NotificationEventType => (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value);

/** The channels of a list in the order of the columns, once each; a name this version of the page does not know is left out. */
function inColumnOrder(channels: readonly string[]): NotificationChannel[] {
  return NOTIFICATION_CHANNELS.filter((channel) => channels.includes(channel));
}

/** Which of the four channels the API says can deliver. */
export function channelAvailability(preferences: NotificationPreferences): ChannelAvailability {
  const answer: Record<NotificationChannel, boolean> = { MobilePush: false, BrowserPush: false, Email: false, CounterOnly: false };
  for (const item of preferences.availableChannels) {
    if (item.channel in answer) answer[item.channel] = item.available === true;
  }
  return answer;
}

/**
 * The rows of the page: one for each kind of event the page has words for, in the order of the API (it is the order the page shows
 * them in). A kind of event this version does not know has no name to show, and one the API repeats is shown once.
 */
export function eventRows(preferences: NotificationPreferences): EventRowModel[] {
  const rows: EventRowModel[] = [];
  for (const setting of preferences.events) {
    if (!isKnownEvent(setting.eventType) || rows.some((row) => row.eventType === setting.eventType)) continue;
    rows.push({ eventType: setting.eventType, channels: inColumnOrder(setting.channels), isDefault: setting.isDefault });
  }
  return rows;
}

/** What one switch of a row looks like. `lock` says why it cannot be moved: the channel cannot deliver yet, or it is the last one of a legal deadline. */
export interface ChannelCell {
  checked: boolean;
  disabled: boolean;
  lock: 'unavailable' | 'last-legal-channel' | null;
}

export function channelCell(
  eventType: NotificationEventType,
  channels: readonly NotificationChannel[],
  channel: NotificationChannel,
  availability: ChannelAvailability,
): ChannelCell {
  // A channel that cannot deliver is never shown as on, whatever is stored for it.
  if (!availability[channel]) return { checked: false, disabled: true, lock: 'unavailable' };

  const checked = channels.includes(channel);
  const delivering = channels.filter((candidate) => availability[candidate]).length;
  if (isLegalDeadline(eventType) && checked && delivering <= 1) return { checked, disabled: true, lock: 'last-legal-channel' };
  return { checked, disabled: false, lock: null };
}

/**
 * The channels of a row once `channel` is switched on or off, in the order of the columns, or `null` when the switch cannot move: the
 * channel cannot deliver, or it is the last one of a legal deadline (the page blocks it, the server would answer 422). A channel that cannot
 * deliver is never sent: the server refuses the whole save for it.
 */
export function withChannel(
  eventType: NotificationEventType,
  channels: readonly NotificationChannel[],
  channel: NotificationChannel,
  on: boolean,
  availability: ChannelAvailability,
): NotificationChannel[] | null {
  if (!availability[channel]) return null;

  const next = channels.filter((candidate) => candidate !== channel && availability[candidate]);
  if (on) next.push(channel);
  if (next.length === 0 && isLegalDeadline(eventType)) return null;
  return inColumnOrder(next);
}

/** The save of the channels of one kind of event: the others stay as they are. */
export function eventSave(eventType: NotificationEventType, channels: NotificationChannel[]): SaveNotificationPreferencesRequest {
  return { events: [{ eventType, channels }] };
}

const SERVER_TIME = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const INPUT_TIME = /^(\d{2}):(\d{2})$/;

/** `22:00:00` of the API as the `22:00` a time field takes; empty for anything that is not a time. */
export function toTimeFieldValue(time: string): string {
  const match = SERVER_TIME.exec(time);
  return match ? `${match[1]}:${match[2]}` : '';
}

/** The `22:00` of a time field as the `22:00:00` the API takes; `null` while the field is empty or is not a time of the day. */
export function toApiTime(fieldValue: string): string | null {
  const match = INPUT_TIME.exec(fieldValue);
  return match && Number(match[1]) < 24 && Number(match[2]) < 60 ? `${fieldValue}:00` : null;
}

/** The quiet hours as the two fields show them. */
export interface QuietHoursFields {
  start: string;
  end: string;
}

/** The save of the quiet hours, or `null` while a field is empty. */
export function quietHoursSave(fields: QuietHoursFields): SaveNotificationPreferencesRequest | null {
  const start = toApiTime(fields.start);
  const end = toApiTime(fields.end);
  return start && end ? { quietHours: { start, end } } : null;
}
