import { Ban, CalendarCheck, CalendarX2, CircleCheck, Clock, CreditCard, DoorOpen, Lock, TriangleAlert, Wrench, type LucideIcon } from 'lucide-react';
import type { HostCalendarEvent } from './host-calendar';

/**
 * The kinds of entry of the host calendar. Each one has its own color, shape (`host-calendar.css`), icon and name, so that no kind
 * is told apart by color alone: the events, the legend and the detail of a block all read them from here. The month draws the
 * first seven; the Timeline adds a stay that waits for the guest's payment, an intervention and a night taken twice.
 */
export type CalendarKind =
  | 'Confirmed'
  | 'Pending'
  | 'PendingPayment'
  | 'CheckedIn'
  | 'CheckedOut'
  | 'toReview'
  | 'block'
  | 'manualBlock'
  | 'service'
  | 'conflict';

export interface CalendarKindInfo {
  kind: CalendarKind;
  icon: LucideIcon;
  /** Key of the locale files with the name of the kind, as the legend says it. */
  labelKey: string;
}

/** In the order of the legend of the month. */
export const CALENDAR_KINDS: readonly CalendarKindInfo[] = [
  { kind: 'Confirmed', icon: CalendarCheck, labelKey: 'booking.calendar.legend.confirmed' },
  { kind: 'Pending', icon: Clock, labelKey: 'booking.calendar.legend.pending' },
  { kind: 'CheckedIn', icon: DoorOpen, labelKey: 'booking.calendar.legend.checkedIn' },
  { kind: 'CheckedOut', icon: CircleCheck, labelKey: 'booking.calendar.legend.checkedOut' },
  { kind: 'toReview', icon: TriangleAlert, labelKey: 'booking.calendar.legend.toReview' },
  { kind: 'block', icon: Lock, labelKey: 'booking.calendar.legend.block' },
  { kind: 'manualBlock', icon: Ban, labelKey: 'booking.calendar.legend.manualBlock' },
];

const TIMELINE_ONLY_KINDS: readonly CalendarKindInfo[] = [
  { kind: 'PendingPayment', icon: CreditCard, labelKey: 'booking.calendar.legend.pendingPayment' },
  { kind: 'service', icon: Wrench, labelKey: 'booking.calendar.legend.service' },
  { kind: 'conflict', icon: CalendarX2, labelKey: 'booking.calendar.legend.conflict' },
];

const ALL_KINDS: readonly CalendarKindInfo[] = [...CALENDAR_KINDS, ...TIMELINE_ONLY_KINDS];

/** The kinds of the legend of the Timeline, in its order: the stays by how far they are, then what comes from outside, then what is to look at. */
export const TIMELINE_KINDS: readonly CalendarKindInfo[] = (
  ['Confirmed', 'Pending', 'PendingPayment', 'CheckedIn', 'CheckedOut', 'toReview', 'block', 'manualBlock', 'service', 'conflict'] as const
).map((kind) => ALL_KINDS.find((info) => info.kind === kind) ?? ALL_KINDS[0]);

/** The kind an entry is drawn as. A stay that is not pending, arrived or over (or has an unknown status) is drawn as confirmed. */
export function calendarKindOf(event: HostCalendarEvent): CalendarKind {
  if (event.kind === 'block') return event.manual ? 'manualBlock' : 'block';
  if (event.otaReviewReason) return 'toReview';
  return event.status === 'Pending' || event.status === 'CheckedIn' || event.status === 'CheckedOut' ? event.status : 'Confirmed';
}

/** The icon and the name of a kind. */
export function calendarKindInfo(kind: CalendarKind): CalendarKindInfo {
  return ALL_KINDS.find((info) => info.kind === kind) ?? ALL_KINDS[0];
}
