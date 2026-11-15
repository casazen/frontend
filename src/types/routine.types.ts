// Routine types - mirror the backend contract (E01/F04/US01/T03, ADR-022, ADR-014):
// `Casazen.Web/DTOs/Routines/RoutineDtos.cs`, `RoutinesController` and `RoutineActionCatalog`.
// Backend enum: Casazen.Core/Entities/Enums/RoutineEventType.cs

export type RoutineEventType =
  | 'BookingNew'
  | 'BookingConfirmed'
  | 'BookingModified'
  | 'BookingCanceled'
  | 'BeforeCheckin'
  | 'AfterCheckin'
  | 'BeforeCheckout'
  | 'AfterCheckout'
  | 'CheckinOccurred'
  | 'CheckoutOccurred'
  | 'OnlineCheckinCompleted'
  | 'IdVerificationCompleted'
  | 'AlloggiatiReceiptArrived'
  | 'GuestMessageReceived'
  | 'ReviewReceived'
  | 'PaymentSucceeded'
  | 'PaymentFailed'
  | 'ActivityCompleted'
  | 'WeeklyRecurrence';

// Backend enum: Casazen.Core/Entities/Enums/RoutineActionType.cs
export type RoutineActionType =
  | 'MessageToGuest'
  | 'NotifyOwner'
  | 'NotifyStaff'
  | 'NotifyTeam'
  | 'CreateActivity'
  | 'SendAccessCode'
  | 'RequestReview'
  | 'AddTag'
  | 'Wait';

/** `{ days, hours }`: whole numbers 0 to 365, for the time events (before / after the check-in / check-out); an empty object for the others. */
export interface RoutineEventConfig {
  days?: number;
  hours?: number;
}

/**
 * The configuration of an action: a JSON object (at most 4 KB) whose members each type defines (`RoutineActionRules`): `Wait` takes `days` and `hours`
 * (whole numbers, together from 1 hour to 365 days), `CreateActivity` takes `text` (1 to 140 characters) and `dueInDays` (whole, 0 to 60, optional);
 * the other types take any object.
 */
export type RoutineActionConfig = Record<string, unknown>;

export interface RoutineAction {
  type: RoutineActionType;
  config?: RoutineActionConfig;
}

/** The fields of the catalog (ADR-014) a routine condition can read: the facts of the booking an event is about. Any other field is a 422. */
export type RoutineConditionField = 'propertyId' | 'channel' | 'stayDuration' | 'guestCount' | 'bookingLeadTime';

export type RoutineConditionOperator = 'equals' | 'notEquals' | 'in' | 'notIn' | 'greaterThan' | 'lessThan' | 'between';

/**
 * What a rule compares with, of the kind its operator takes: a list of property ids for `propertyId`; the name of a channel (a `BookingSource`) or a list of them for
 * `channel`; a whole number for `equals` on a count, a number for `greaterThan` and `lessThan`, two numbers (the lower first) for `between`.
 */
export type RoutineConditionValue = string | number | string[] | number[];

export interface RoutineConditionRule {
  fieldId: RoutineConditionField;
  operator: RoutineConditionOperator;
  value: RoutineConditionValue;
}

export interface RoutineConditionGroup {
  operator: 'AND' | 'OR';
  rules: RoutineConditionRule[];
}

/** The condition of ADR-014 as the API reads it: the version is a text (`"1.0"`), the rules of a group are `rules` and each names its field `fieldId`. */
export interface RoutineCondition {
  version: string;
  groups: RoutineConditionGroup[];
}

export interface Routine {
  id: string;
  orgId: string;
  name: string;
  eventType: RoutineEventType;
  eventConfig: string; // JSON text of the RoutineEventConfig
  conditionJson: string; // JSON text of the condition (ADR-014): `{}` for none
  actionsJson: string; // JSON text of the array of RoutineAction
  testMode: boolean;
  active: boolean;
}

export interface CreateRoutineDto {
  name: string;
  eventType: RoutineEventType;
  eventConfig?: RoutineEventConfig;
  /** `{}` (or nothing) is "no condition". */
  condition?: RoutineCondition | Record<string, never>;
  actions: RoutineAction[];
  testMode?: boolean;
  active?: boolean;
}

/** A change to a routine: what is left out stays as it is (a condition the editor cannot show is left out, so it stays). */
export interface UpdateRoutineDto {
  name?: string;
  eventType?: RoutineEventType;
  eventConfig?: RoutineEventConfig;
  condition?: RoutineCondition | Record<string, never>;
  actions?: RoutineAction[];
  testMode?: boolean;
  active?: boolean;
}

/** One line of the log of a routine, newest first (`GET /routines/{id}/executions`, 50 a page). */
export interface RoutineExecution {
  id: string;
  orgId: string;
  routineId: string;
  eventId: string;
  startedAt: string;
  completedAt?: string | null;
  /** `Pending`, `Running`, `Waiting`, `Success` or `Failed` (`RoutineExecutionOutcomes`); a value this version does not know is shown as it is. */
  outcome: string;
  resumeAt?: string | null;
  /** JSON text: `{ actions: [{ index, type, outcome, code? }], nextActionIndex, code? }`. */
  resultJson: string;
}

/** How one action of an execution ended (`RoutineActionOutcomes`). */
export type RoutineActionOutcome = 'done' | 'simulated' | 'blocked' | 'failed' | 'waiting';

export interface RoutineExecutionActionResult {
  index: number;
  type: RoutineActionType;
  outcome: RoutineActionOutcome;
  /** Why: the guardrail of a blocked action or the stable code of a failed one. */
  code?: string;
}

/** What `resultJson` of an execution says, read by `parseExecutionResult`. */
export interface RoutineExecutionResult {
  actions: RoutineExecutionActionResult[];
  /** Why the execution as a whole failed, when it did not fail in an action. */
  code?: string;
}

export interface RoutineSimulatedAction {
  index: number;
  type: RoutineActionType;
  config?: RoutineActionConfig;
  /** It would not run: a guardrail stops it, or it cannot run yet. */
  wouldBlock: boolean;
  code?: string | null;
}

export interface RoutineSimulationResult {
  routineId: string;
  routineName: string;
  conditionsMatched: boolean;
  wouldExecute: boolean;
  actions: RoutineSimulatedAction[];
  code?: string | null;
}

/** An action of the catalog (`GET /routines/actions`): whether it can run today and, when it cannot, `routine_action_not_available`. */
export interface RoutineActionCatalogItem {
  type: RoutineActionType;
  available: boolean;
  code: string | null;
}

export interface RoutineLibraryTemplate {
  name: string;
  description: string;
  eventType: RoutineEventType;
  eventConfig?: RoutineEventConfig;
  condition?: RoutineCondition;
  actions: RoutineAction[];
}
