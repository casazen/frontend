import { Ban, CalendarCheck, CircleCheck, Clock, DoorOpen, Lock, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { HostCalendarEvent } from './host-calendar';

/**
 * The seven kinds of entry of the host calendar. Each one has its own color, shape (`host-calendar.css`), icon and name, so
 * that no kind is told apart by color alone: the events, the legend and the detail of a block all read them from here.
 */
export type CalendarKind = 'Confirmed' | 'Pending' | 'CheckedIn' | 'CheckedOut' | 'toReview' | 'block' | 'manualBlock';

export interface CalendarKindInfo {
  kind: CalendarKind;
  icon: LucideIcon;
  /** Key of the locale files with the name of the kind, as the legend says it. */
  labelKey: string;
}

/** In the order of the legend. */
export const CALENDAR_KINDS: readonly CalendarKindInfo[] = [
  { kind: 'Confirmed', icon: CalendarCheck, labelKey: 'booking.calendar.legend.confirmed' },
  { kind: 'Pending', icon: Clock, labelKey: 'booking.calendar.legend.pending' },
  { kind: 'CheckedIn', icon: DoorOpen, labelKey: 'booking.calendar.legend.checkedIn' },
  { kind: 'CheckedOut', icon: CircleCheck, labelKey: 'booking.calendar.legend.checkedOut' },
  { kind: 'toReview', icon: TriangleAlert, labelKey: 'booking.calendar.legend.toReview' },
  { kind: 'block', icon: Lock, labelKey: 'booking.calendar.legend.block' },
  { kind: 'manualBlock', icon: Ban, labelKey: 'booking.calendar.legend.manualBlock' },
];

/** The kind an entry is drawn as. A stay that is not pending, arrived or over (or has an unknown status) is drawn as confirmed. */
export function calendarKindOf(event: HostCalendarEvent): CalendarKind {
  if (event.kind === 'block') return event.manual ? 'manualBlock' : 'block';
  if (event.otaReviewReason) return 'toReview';
  return event.status === 'Pending' || event.status === 'CheckedIn' || event.status === 'CheckedOut' ? event.status : 'Confirmed';
}

/** The icon and the name of a kind. */
export function calendarKindInfo(kind: CalendarKind): CalendarKindInfo {
  return CALENDAR_KINDS.find((info) => info.kind === kind) ?? CALENDAR_KINDS[0];
}
