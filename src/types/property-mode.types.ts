import type { RentalMode } from './property.types';

/**
 * The scheduled change of the rental mode of a property (backend PM-02, decision D16): short stays to long-term leases or
 * back, on a day, never over a stay or a lease. Behind the flag `propertyModeChange`. Dates are calendar days of
 * Europe/Rome written `2026-12-01` (read them with `parseStayDate`, never with `new Date()`); the instants are UTC.
 */

/** Where a change is (`PropertyModeChangeStatus`): only a `Scheduled` one can be cancelled; the others are history. */
export type PropertyModeChangeStatus = 'Scheduled' | 'Applied' | 'Cancelled' | 'Failed';

/** A change of mode of a property (`PropertyModeChangeDto`). */
export interface PropertyModeChange {
  id: string;
  propertyId: string;
  fromMode: RentalMode;
  toMode: RentalMode;
  /** First day in the new mode. */
  effectiveDate: string;
  status: PropertyModeChangeStatus;
  createdAt: string;
  appliedAt: string | null;
  cancelledAt: string | null;
  failedAt: string | null;
  /** Stable code of the rule that stopped the job (`property_mode_blocked_by_bookings`), never a text. */
  failureReason: string | null;
}

/** What stands in the way of a change (`PropertyModeBlockerKind`). */
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

/** `GET /properties/{id}/mode/preview`: what a change to `targetMode` on `date` would meet today. */
export interface PropertyModePreview {
  propertyId: string;
  currentMode: RentalMode;
  targetMode: RentalMode;
  /** Today, Europe/Rome. */
  today: string;
  /** The first day a change can start: tomorrow, or the day after the last thing in its way. */
  earliestDate: string;
  /** The day evaluated: the one asked for, or `earliestDate` when none was. */
  date: string;
  canSchedule: boolean;
  /** The stable error codes the creation would answer on `date` (`property_mode_blocked_by_bookings`…). Empty = it can be scheduled. */
  issues: string[];
  /** What stands in the way of `date`, by start. */
  blockers: PropertyModeBlocker[];
  /** For a change to long-term: the first free day after the dates the change closes. */
  calendarClosedUntil: string | null;
  scheduledChange: PropertyModeChange | null;
}

/** `GET /properties/{id}/mode`: the mode now, the change waiting for its day and the last one that is over. */
export interface PropertyModeState {
  propertyId: string;
  rentalMode: RentalMode;
  scheduledChange: PropertyModeChange | null;
  lastChange: PropertyModeChange | null;
}

/** Body of `POST /properties/{id}/mode/change`. */
export interface SchedulePropertyModeChangeDto {
  to: RentalMode;
  effectiveDate: string;
}
