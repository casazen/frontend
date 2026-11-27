/**
 * How a user wants to be alerted (E05/F03, NF-65, ADR-025): the contract of `GET` and `PUT api/me/notification-preferences`. The API
 * writes the enums by name and the times as `HH:mm:ss` on the clock of Europe/Rome; the settings are always the caller's own.
 */

/** The kinds of event a host user is alerted about, in the order the page shows them (the order of the backend enum). */
export const NOTIFICATION_EVENT_TYPES = [
  'NewGuestMessage',
  'UrgentGuestMessage',
  'AiDraftToApprove',
  'NewBooking',
  'BookingCancelled',
  'LegalDeadline',
  'SyncError',
  'ScheduledMessageIssue',
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

/** The ways to be alerted, in the order of the columns of the page. `CounterOnly` is the number on the bell, which never waits. */
export const NOTIFICATION_CHANNELS = ['MobilePush', 'BrowserPush', 'Email', 'CounterOnly'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** The quiet hours of the caller: the push and the email wait for their end, the counter does not. */
export interface NotificationQuietHours {
  /** When they start, `HH:mm:ss` (default 22:00). */
  start: string;
  /** When they end, `HH:mm:ss` (default 08:00); equal to the start there are none. */
  end: string;
  /** A legal deadline alerts also during them (always on today). */
  legalAlertsOverride: boolean;
}

/** What the caller has for one kind of event: `isDefault` when it never chose and the default of PO-10 applies. */
export interface NotificationEventSetting {
  eventType: NotificationEventType;
  /** The channels of this kind of event; empty = nothing at all (never for a legal deadline). */
  channels: NotificationChannel[];
  isDefault: boolean;
}

/** A channel and whether it can deliver today; `reason` is a code of the API (`web_push_not_available`) while it cannot. */
export interface NotificationChannelAvailability {
  channel: NotificationChannel;
  available: boolean;
  reason: string | null;
}

export interface NotificationPreferences {
  quietHours: NotificationQuietHours;
  /** One entry for each kind of event, in the order the page shows them. */
  events: NotificationEventSetting[];
  availableChannels: NotificationChannelAvailability[];
}

/**
 * A save of the caller's own settings. The kinds of event that are not listed stay as they are, and one that is listed gets exactly the
 * channels given (`[]` = nothing at all, refused by the API for the legal deadline). An empty request is a 422.
 */
export interface SaveNotificationPreferencesRequest {
  quietHours?: { start: string; end: string };
  events?: Array<{ eventType: NotificationEventType; channels: NotificationChannel[] }>;
}
