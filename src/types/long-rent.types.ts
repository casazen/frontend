import type { LeaseNextStep, LeaseStage } from './lease.types';
import type { RentRegisterCounters } from './rent.types';

/**
 * The agenda and the overview of the long-term area (LR-01; `now` since LR-01b), as `GET /long-rent/deadlines` and
 * `GET /long-rent/overview` answer. Dates are Europe/Rome calendar days (`YYYY-MM-DD`). Only what the server sends today: the
 * reduced LR-01b left out the count by stage, the to-do list, the lease filter of the agenda and the types `LeaseStart` and
 * `DepositReturn`, so none of them is here.
 */

/** What the agenda lists: the five kinds of date the server knows. IMU and ISTAT are not among them. */
type LongRentDeadlineType = 'RliRegistration' | 'Questura' | 'LeaseEnd' | 'Notice' | 'Rent';

/**
 * One date of the agenda. `daysFromToday` is negative when it is past (`isOverdue`: a registration, a Questura communication or a
 * rent still to do). The tenant is the first one of the lease, by name only, both names null once anonymized. A rent carries its
 * installment and its amount.
 */
export interface LongRentDeadline {
  type: LongRentDeadlineType;
  date: string;
  daysFromToday: number;
  isOverdue: boolean;
  leaseId: string;
  propertyId: string;
  propertyName: string;
  tenantFirstName: string | null;
  tenantLastName: string | null;
  installmentId: string | null;
  amount: number | null;
}

export interface LongRentDeadlines {
  from: string;
  to: string;
  items: LongRentDeadline[];
  truncated: boolean;
}

export interface LongRentDeadlinesParams {
  from?: string;
  to?: string;
  leaseId?: string;
}

export interface LongRentLeaseCounters {
  active: number;
  expiring: number;
  inPreparation: number;
  toSign: number;
  toRegister: number;
  ended: number;
}

export interface LongRentNow {
  leaseId: string;
  propertyId: string;
  propertyName: string;
  tenantFirstName: string | null;
  tenantLastName: string | null;
  stage: LeaseStage;
  step: LeaseNextStep;
}

export interface LongRentOverview {
  today: string;
  leases: LongRentLeaseCounters;
  rentMonth: string;
  rents: RentRegisterCounters;
  nextDeadline: LongRentDeadline | null;
  now?: LongRentNow | null;
}
