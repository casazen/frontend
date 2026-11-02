import type { LeaseStage } from './lease.types';
import type { RentalMode } from './property.types';

/**
 * The properties of the long-term area with what the plain lists do not say (LR-07a), as `GET /long-rent/properties` answers: the APE and the
 * cadastral data the lease needs, the state of the property, the lease that holds it and the day it is free again, the lease that is coming and
 * the change of mode that is programmed. No name of a tenant and no amount: those come with the list of the leases.
 */

/** What the APE of the property says, the way the contract needs it: nothing on file, a certificate without its code and class, or both on record. */
export type LongRentApeStatus = 'Missing' | 'ToConfirm' | 'Identified';

/** `Rented`: a lease in force holds it. `InPreparation`: none does but one is on its way. `Free`: nothing. */
export type LongRentPropertyState = 'Free' | 'Rented' | 'InPreparation';

/** The lease that holds the property. `freeFrom` is the first free day, only when the lease does not go on (a notice or an early end, or a type without renewal). */
export interface LongRentPropertyLease {
  leaseId: string;
  stage: LeaseStage | null;
  /** The last day of the period the lease is in now. */
  currentTermEndDate: string;
  noticeOn: string | null;
  freeFrom: string | null;
}

export interface LongRentPreparingLease {
  leaseId: string;
  stage: LeaseStage | null;
}

export interface LongRentScheduledModeChange {
  toMode: RentalMode;
  effectiveDate: string;
}

export interface LongRentPropertyAggregate {
  id: string;
  name: string;
  address: string;
  city: string;
  unit: string | null;
  ape: LongRentApeStatus;
  apeValid: boolean;
  /** The energy class of the latest certificate that has its code and class. */
  apeClass: string | null;
  cadastralComplete: boolean;
  /** `null` when the person may not read the leases: nothing is said of them. */
  status: LongRentPropertyState | null;
  currentLease: LongRentPropertyLease | null;
  preparingLease: LongRentPreparingLease | null;
  scheduledModeChange: LongRentScheduledModeChange | null;
}
