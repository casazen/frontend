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

export const NOTIFICATION_CHANNELS = ['MobilePush', 'BrowserPush', 'Email', 'CounterOnly'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface NotificationQuietHours {
  start: string;
  end: string;
  legalAlertsOverride: boolean;
}

interface NotificationEventSetting {
  eventType: NotificationEventType;
  channels: NotificationChannel[];
  isDefault: boolean;
}

interface NotificationChannelAvailability {
  channel: NotificationChannel;
  available: boolean;
  reason: string | null;
}

export interface NotificationPreferences {
  quietHours: NotificationQuietHours;
  events: NotificationEventSetting[];
  availableChannels: NotificationChannelAvailability[];
}

export interface SaveNotificationPreferencesRequest {
  quietHours?: { start: string; end: string };
  events?: Array<{ eventType: NotificationEventType; channels: NotificationChannel[] }>;
}
