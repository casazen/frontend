/**
 * The changes of the calendar (E08/F05/US02/T02, T03, NF-36, NF-78): `POST /api/calendar/changes/preview` says what a change would do, `POST /api/calendar/changes` applies it
 * all or nothing and answers the process that sends it to the channel manager, `GET /api/calendar/changes[/{id}]` reads the processes and `POST .../{id}/retry` sends a failed one
 * again. Dates are calendar dates (`yyyy-MM-dd`), instants are UTC, enums are names, a value that is not set is absent. A process never says "published": `Sent` is "accepted by
 * the channel manager".
 */

/** What to do to one value of the rules of a night: keep it (the default), set it to `value`, or clear it (a flag goes back to off). */
export type FieldPatchAction = 'Keep' | 'Set' | 'Clear';

export interface FieldPatch<T> {
  action: FieldPatchAction;
  /** The value to set; required with `Set`, ignored otherwise. */
  value?: T;
}

/** The weekdays of a change, by the names the API reads (`System.DayOfWeek`). */
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/**
 * The body of the preview and of the application: one to fifty properties, a period of at most 366 days (both included), optionally only some weekdays (an empty list is refused by
 * the API, never read as "all": it is left out to mean every day), and what to do to each of the seven values. A price is the number typed, never rounded here.
 */
export interface CalendarChangeRequest {
  propertyIds: string[];
  from: string;
  to: string;
  daysOfWeek?: Weekday[];
  price: FieldPatch<number>;
  minNights: FieldPatch<number>;
  maxNights: FieldPatch<number>;
  closedToArrival: FieldPatch<boolean>;
  closedToDeparture: FieldPatch<boolean>;
  minAdvanceDays: FieldPatch<number>;
  maxAdvanceDays: FieldPatch<number>;
}

/** Where a change stands (backend `CalendarChangeState`). `Sent` is the channel manager accepting the work, which is not the publication on the portals. */
export type CalendarChangeState = 'Applied' | 'Queued' | 'Sending' | 'Sent' | 'Confirmed' | 'PartiallySent' | 'Failed';

/** Where one property of a change stands (backend `CalendarChangePropertyState`): `Skipped` is a property that is not on the channel manager. */
export type CalendarChangePropertyState = 'Pending' | 'Accepted' | 'Confirmed' | 'Failed' | 'Skipped';

export type CalendarChangeKind = 'DayRules' | 'Block' | 'Bulk' | 'Publication';

export interface CalendarChangeProperty {
  propertyId: string;
  state: CalendarChangePropertyState;
  /** The stable code of the first chunk that failed (`octorate_quota_low`, `octorate_unavailable`, ...). */
  errorCode?: string;
  errorMessage?: string;
  chunkCount: number;
  from?: string;
  to?: string;
}

/** A change of the calendar as a process (`GET /api/calendar/changes/{id}`). */
export interface CalendarChange {
  id: string;
  kind: CalendarChangeKind;
  state: CalendarChangeState;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  propertyCount: number;
  dayCount: number;
  /** The units of quota of the channel manager the change is expected to use: an estimate. */
  quotaUnitsEstimated: number;
  from?: string;
  to?: string;
  errorCode?: string;
  errorMessage?: string;
  nextAttemptAt?: string;
  properties: CalendarChangeProperty[];
}

/** What a night holds: the price a guest is quoted and the rules in force. */
export interface CalendarChangeValues {
  priceCents: number;
  minNights: number;
  maxNights?: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  minAdvanceDays?: number;
  maxAdvanceDays?: number;
}

/** A night the change would change, with its values before and after. */
export interface CalendarChangeSample {
  date: string;
  before: CalendarChangeValues;
  after: CalendarChangeValues;
}

/** What the change would do to one property. */
export interface CalendarChangePreviewProperty {
  propertyId: string;
  name: string;
  /** The property books into the channel manager: the change would be sent there. */
  mirrored: boolean;
  days: number;
  changedDays: number;
  unchangedDays: number;
  /** Nights taken by a booking, a hold, a request or a block: counted and not skipped (a rule on a booked night changes nothing for that booking). */
  takenDays: number;
  skippedPastDays: number;
  /** The first five changed nights with their values before and after. */
  samples: CalendarChangeSample[];
  /** An estimate of the units of quota of the channel manager the change would use. */
  estimatedQuotaUnits: number;
}

/** Something to know before applying: `property_not_mirrored` (the change stays in CasaZen) or `room_not_chosen` (nothing is sent until the room is chosen). */
export interface CalendarChangeWarning {
  code: string;
  propertyId: string;
  message: string;
}

/** The answer of the preview: nothing was changed, and the quota is an estimate. */
export interface CalendarChangePreview {
  properties: CalendarChangePreviewProperty[];
  days: number;
  changedDays: number;
  unchangedDays: number;
  takenDays: number;
  skippedPastDays: number;
  estimatedQuotaUnits: number;
  warnings: CalendarChangeWarning[];
}
