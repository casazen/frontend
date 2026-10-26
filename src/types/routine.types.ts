// Routine types - mirrors backend contract (E12/F01/US01/T01, ADR-022)

export enum RoutineEventType {
  // Booking lifecycle events
  BookingNew = 'BookingNew',
  BookingConfirmed = 'BookingConfirmed',
  BookingModified = 'BookingModified',
  BookingCanceled = 'BookingCanceled',

  // Check-in/check-out timing events (relative to dates)
  BeforeCheckin = 'BeforeCheckin',
  AfterCheckin = 'AfterCheckin',
  BeforeCheckout = 'BeforeCheckout',
  AfterCheckout = 'AfterCheckout',

  // Check-in/check-out occurrence events
  CheckinOccurred = 'CheckinOccurred',
  CheckoutOccurred = 'CheckoutOccurred',

  // Guest flow completion events
  OnlineCheckinCompleted = 'OnlineCheckinCompleted',
  IdVerificationCompleted = 'IdVerificationCompleted',

  // Compliance events
  AlloggiatiReceiptArrived = 'AlloggiatiReceiptArrived',

  // Communication events
  GuestMessageReceived = 'GuestMessageReceived',
  ReviewReceived = 'ReviewReceived',

  // Payment events
  PaymentSucceeded = 'PaymentSucceeded',
  PaymentFailed = 'PaymentFailed',

  // Recurring event
  Weekly = 'Weekly',
}

export enum RoutineActionType {
  Wait = 'Wait',
  SendMessage = 'SendMessage',
  CreateActivity = 'CreateActivity',
  SendAccessCode = 'SendAccessCode',
}

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
