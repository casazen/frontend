// Routine types - mirrors backend contract (E12/F01/US01/T01, ADR-022)
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

export interface RoutineEventConfig {
  days?: number;
  hours?: number;
  dayOfWeek?: number;
}

export interface RoutineAction {
  type: RoutineActionType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: any;
}

export interface Routine {
  id: string;
  orgId: string;
  name: string;
  eventType: RoutineEventType;
  eventConfig: string; // JSON
  conditionJson: string; // ADR-014 format
  actionsJson: string; // JSON array of RoutineAction
  testMode: boolean;
  active: boolean;
}

export interface CreateRoutineDto {
  name: string;
  eventType: RoutineEventType;
  eventConfig?: RoutineEventConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  condition?: any; // Condition builder object (ADR-014)
  actions: RoutineAction[];
  testMode?: boolean;
  active?: boolean;
}

export interface UpdateRoutineDto {
  name?: string;
  eventType?: RoutineEventType;
  eventConfig?: RoutineEventConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  condition?: any;
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
  completedAt?: string;
  outcome: string;
  resumeAt?: string;
  resultJson: string;
}

export interface RoutineSimulationResult {
  routineId: string;
  routineName: string;
  conditionsMatched: boolean;
  wouldExecute: boolean;
  actions: Array<{
    type: RoutineActionType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config?: any;
    wouldBlock: boolean;
  }>;
}

export interface RoutineLibraryTemplate {
  name: string;
  description: string;
  eventType: RoutineEventType;
  eventConfig?: RoutineEventConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  condition?: any;
  actions: RoutineAction[];
}
