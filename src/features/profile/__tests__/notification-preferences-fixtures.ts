import type { NotificationChannel, NotificationEventType, NotificationPreferences } from '@/types';

const PUSH_AND_COUNTER: NotificationChannel[] = ['MobilePush', 'CounterOnly'];

export function defaultPreferences(): NotificationPreferences {
  return {
    quietHours: { start: '22:00:00', end: '08:00:00', legalAlertsOverride: true },
    events: [
      { eventType: 'NewGuestMessage', channels: [...PUSH_AND_COUNTER], isDefault: true },
      { eventType: 'UrgentGuestMessage', channels: [...PUSH_AND_COUNTER], isDefault: true },
      { eventType: 'AiDraftToApprove', channels: [...PUSH_AND_COUNTER], isDefault: true },
      { eventType: 'NewBooking', channels: [...PUSH_AND_COUNTER], isDefault: true },
      { eventType: 'BookingCancelled', channels: ['CounterOnly'], isDefault: true },
      { eventType: 'LegalDeadline', channels: ['MobilePush', 'Email', 'CounterOnly'], isDefault: true },
      { eventType: 'SyncError', channels: ['CounterOnly'], isDefault: true },
      { eventType: 'ScheduledMessageIssue', channels: ['CounterOnly'], isDefault: true },
    ],
    availableChannels: [
      { channel: 'MobilePush', available: true, reason: null },
      { channel: 'BrowserPush', available: false, reason: 'web_push_not_available' },
      { channel: 'Email', available: true, reason: null },
      { channel: 'CounterOnly', available: true, reason: null },
    ],
  };
}

export function withChosen(
  preferences: NotificationPreferences,
  eventType: NotificationEventType,
  channels: NotificationChannel[],
): NotificationPreferences {
  return {
    ...preferences,
    events: preferences.events.map((event) => (event.eventType === eventType ? { ...event, channels, isDefault: false } : event)),
  };
}
