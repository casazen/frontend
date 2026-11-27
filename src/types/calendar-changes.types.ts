/**
 * The changes of the calendar (E08/F05/US02/T02, T03, NF-36, NF-78): `POST /api/calendar/changes/preview` says what a change would do, `POST /api/calendar/changes` applies it
 * all or nothing and answers the process that sends it to the channel manager, `GET /api/calendar/changes[/{id}]` reads the processes and `POST .../{id}/retry` sends a failed one
 * again. Dates are calendar dates (`yyyy-MM-dd`), instants are UTC, enums are names, a value that is not set is absent. A process never says "published": `Sent` is "accepted by
 * the channel manager".
 */

type FieldPatchAction = 'Keep' | 'Set' | 'Clear';

export interface FieldPatch<T> {
  action: FieldPatchAction;
  /** The value to set; required with `Set`, ignored otherwise. */
  value?: T;
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

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

export type CalendarChangeState = 'Applied' | 'Queued' | 'Sending' | 'Sent' | 'Confirmed' | 'PartiallySent' | 'Failed';

type CalendarChangePropertyState = 'Pending' | 'Accepted' | 'Confirmed' | 'Failed' | 'Skipped';

type CalendarChangeKind = 'DayRules' | 'Block' | 'Bulk' | 'Publication';

export interface CalendarChangeProperty {
  propertyId: string;
  state: CalendarChangePropertyState;
  errorCode?: string;
  errorMessage?: string;
  chunkCount: number;
  from?: string;
  to?: string;
}

export interface CalendarChange {
  id: string;
  kind: CalendarChangeKind;
  state: CalendarChangeState;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  propertyCount: number;
  dayCount: number;
  quotaUnitsEstimated: number;
  from?: string;
  to?: string;
  errorCode?: string;
  errorMessage?: string;
  nextAttemptAt?: string;
  properties: CalendarChangeProperty[];
}

export interface CalendarChangeValues {
  priceCents: number;
  minNights: number;
  maxNights?: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  minAdvanceDays?: number;
  maxAdvanceDays?: number;
}

interface CalendarChangeSample {
  date: string;
  before: CalendarChangeValues;
  after: CalendarChangeValues;
}

interface CalendarChangePreviewProperty {
  propertyId: string;
  name: string;
  mirrored: boolean;
  days: number;
  changedDays: number;
  unchangedDays: number;
  takenDays: number;
  skippedPastDays: number;
  samples: CalendarChangeSample[];
  estimatedQuotaUnits: number;
}

interface CalendarChangeWarning {
  code: string;
  propertyId: string;
  message: string;
}

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
