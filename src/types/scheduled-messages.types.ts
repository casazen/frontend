import type { MessageContactChannel } from './message-hub.types';

export type ScheduledMessageStatus = 'Scheduled' | 'Sent' | 'Skipped' | 'Blocked' | 'Failed' | 'Cancelled' | 'Expired';

export interface ScheduledMessage {
  id: string;
  bookingId: string;
  routineId: string | null;
  routineName: string;
  actionIndex: number;
  plannedAtUtc: string;
  timeZone: string;
  status: ScheduledMessageStatus;
  blockedReason: string | null;
  skipReason: string | null;
  edited: boolean;
  outsideHours: boolean;
  sentAt: string | null;
  sentThreadKey: string | null;
  channel: MessageContactChannel;
  channelReason: string | null;
  text: string | null;
  missingVariables: string[];
  canEdit: boolean;
  canSkip: boolean;
  canSendNow: boolean;
}
