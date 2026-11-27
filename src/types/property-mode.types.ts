import type { RentalMode } from './property.types';

/**
 * The scheduled change of the rental mode of a property (backend PM-02, decision D16): short stays to long-term leases or
 * back, on a day, never over a stay or a lease. Dates are calendar days of Europe/Rome written `2026-12-01` (read them
 * with `parseStayDate`, never with `new Date()`); the instants are UTC.
 */

type PropertyModeChangeStatus = 'Scheduled' | 'Applied' | 'Cancelled' | 'Failed';

export interface PropertyModeChange {
  id: string;
  propertyId: string;
  fromMode: RentalMode;
  toMode: RentalMode;
  effectiveDate: string;
  status: PropertyModeChangeStatus;
  createdAt: string;
  appliedAt: string | null;
  cancelledAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

export type PropertyModeBlockerKind = 'Stay' | 'ImportedBlock' | 'Lease' | 'DraftLease';

/**
 * A stay, a block imported from a portal calendar or a lease that stands in the way of a change: ids, dates and status only,
 * never a name. `end` is the departure of a stay, the first free day of a block, the last day of a lease; `freeFrom` the
 * first day the change can start without being stopped by it (`null` for a draft lease: no day frees it, it is deleted).
 * `status` is the booking or lease status (a block has none), `source` the booking source or the channel of the feed.
 */
export interface PropertyModeBlocker {
  kind: PropertyModeBlockerKind;
  id: string;
  start: string;
  end: string;
  freeFrom: string | null;
  status: string | null;
  source: string | null;
}

export interface PropertyModePreview {
  propertyId: string;
  currentMode: RentalMode;
  targetMode: RentalMode;
  today: string;
  earliestDate: string;
  date: string;
  canSchedule: boolean;
  issues: string[];
  blockers: PropertyModeBlocker[];
  calendarClosedUntil: string | null;
  scheduledChange: PropertyModeChange | null;
}

export interface PropertyModeState {
  propertyId: string;
  rentalMode: RentalMode;
  scheduledChange: PropertyModeChange | null;
  lastChange: PropertyModeChange | null;
}

export interface SchedulePropertyModeChangeDto {
  to: RentalMode;
  effectiveDate: string;
}
