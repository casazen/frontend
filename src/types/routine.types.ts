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

export type RoutineActionType =
  | 'MessageToGuest'
  | 'NotifyOwner'
  | 'NotifyStaff'
  | 'NotifyTeam'
  | 'CreateActivity'
  | 'SendAccessCode'
  | 'RequestReview'
  | 'AddTag'
  | 'Wait'
  | 'CreateCleaningRequest';

export interface RoutineEventConfig {
  days?: number;
  hours?: number;
}

export type RoutineActionConfig = Record<string, unknown>;

export interface RoutineAction {
  type: RoutineActionType;
  config?: RoutineActionConfig;
}

export type RoutineConditionField = 'propertyId' | 'channel' | 'stayDuration' | 'guestCount' | 'bookingLeadTime';

export type RoutineConditionOperator = 'equals' | 'notEquals' | 'in' | 'notIn' | 'greaterThan' | 'lessThan' | 'between';

type RoutineConditionValue = string | number | string[] | number[];

export interface RoutineConditionRule {
  fieldId: RoutineConditionField;
  operator: RoutineConditionOperator;
  value: RoutineConditionValue;
}

interface RoutineConditionGroup {
  operator: 'AND' | 'OR';
  rules: RoutineConditionRule[];
}

export interface RoutineCondition {
  version: string;
  groups: RoutineConditionGroup[];
}

export interface Routine {
  agentObjective?: string | null;
  id: string;
  orgId: string;
  name: string;
  eventType: RoutineEventType;
  eventConfig: string;
  conditionJson: string;
  actionsJson: string;
  testMode: boolean;
  active: boolean;
}

export interface CreateRoutineDto {
  agentObjective?: string | null;
  name: string;
  eventType: RoutineEventType;
  eventConfig?: RoutineEventConfig;
  condition?: RoutineCondition | Record<string, never>;
  actions: RoutineAction[];
  testMode?: boolean;
  active?: boolean;
}

export interface UpdateRoutineDto {
  agentObjective?: string | null;
  name?: string;
  eventType?: RoutineEventType;
  eventConfig?: RoutineEventConfig;
  condition?: RoutineCondition | Record<string, never>;
  actions?: RoutineAction[];
  testMode?: boolean;
  active?: boolean;
}

export interface RoutineExecution {
  id: string;
  orgId: string;
  routineId: string;
  eventId: string;
  startedAt: string;
  completedAt?: string | null;
  outcome: string;
  resumeAt?: string | null;
  resultJson: string;
}

export type RoutineActionOutcome = 'done' | 'simulated' | 'blocked' | 'skipped' | 'failed' | 'waiting';

export interface RoutineExecutionActionResult {
  index: number;
  type: RoutineActionType;
  outcome: RoutineActionOutcome;
  code?: string;
}

export interface RoutineExecutionResult {
  actions: RoutineExecutionActionResult[];
  code?: string;
}

interface RoutineSimulatedAction {
  index: number;
  type: RoutineActionType;
  config?: RoutineActionConfig;
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

export interface RoutineActionCatalogItem {
  type: RoutineActionType;
  available: boolean;
  code: string | null;
}

export interface RoutineLibraryTemplate {
  agentObjective: string;
  name: string;
  description: string;
  eventType: RoutineEventType;
  eventConfig?: RoutineEventConfig;
  condition?: RoutineCondition;
  actions: RoutineAction[];
}
