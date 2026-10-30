import type { LeaseStage } from './lease.types';
import type { LeaseErasureStatus } from './lease-lifecycle.types';
import type { RentInstallmentStatus } from './rent.types';

/**
 * The tenants of the long-term area (LR-09), as `GET /long-rent/tenants` answers. There is no tenant record: the server reads a person
 * from the parties of the leases (one person is one fiscal code), so one person on several leases is one row. The id is opaque; the
 * fiscal code is never sent, and the e-mail only masked. Dates are Europe/Rome calendar days or UTC midnights of them.
 */

/** The views of the list the server knows: `Current` has at least one lease that has not concluded, `Former` has only concluded ones. */
export type TenantListView = 'All' | 'Current' | 'Former';

/** Whether the tenant is a citizen of the Union. */
export type TenantCitizenship = 'Eu' | 'NonEu';

/** A lease the person is on: the stage is the one of the path of the lease, decided by the server. */
export interface TenantLease {
  leaseId: string;
  propertyId: string;
  propertyName: string;
  stage: LeaseStage | null;
  monthlyRent: number;
  /** The last day of the period the lease is in now. */
  currentTermEndDate: string;
}

/** The installments due so far and how many of them were paid within the grace period (`onTimeDays` of the sheet). */
export interface TenantPunctuality {
  onTime: number;
  total: number;
}

export interface TenantRow {
  id: string;
  firstName: string;
  lastName: string;
  citizenship: TenantCitizenship;
  contactEmailMasked: string;
  /** Every lease of the person has concluded. */
  isFormer: boolean;
  /** Newest first. */
  leases: TenantLease[];
  punctuality: TenantPunctuality;
}

/** How many people each view holds for the search asked. */
export interface TenantCounts {
  all: number;
  current: number;
  former: number;
}

export interface TenantPage {
  items: TenantRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: TenantCounts;
}

export interface TenantListParams {
  view?: TenantListView;
  q?: string;
  page?: number;
  pageSize?: number;
}

/** An installment due so far of one of the person's leases. `daysOverdue` only while it is overdue. */
export interface TenantPayment {
  id: string;
  leaseId: string;
  propertyName: string;
  dueDate: string;
  amount: number;
  status: RentInstallmentStatus;
  paidOn: string | null;
  isOverdue: boolean;
  daysOverdue: number | null;
}

/** What is past due across the person's leases; the oldest installment tells which month to look at. */
export interface TenantOverdue {
  count: number;
  amount: number;
  oldestInstallmentId: string;
  oldestDueDate: string;
  daysOverdue: number;
}

/** `GET /long-rent/tenants/:id`: the row, the six latest installments due, what is overdue (null when nothing is) and the grace period used. */
export interface TenantDetail {
  tenant: TenantRow;
  payments: TenantPayment[];
  overdue: TenantOverdue | null;
  onTimeDays: number;
}

/** What the erasure request did on one lease of the person: the outcome of the lease's own request (`LeaseErasureStatus`). */
export interface TenantErasureLease {
  leaseId: string;
  propertyName: string;
  status: LeaseErasureStatus;
  /** For a lease that has not ended: the day from which its parties are anonymized; null otherwise. */
  anonymizationFrom: string | null;
  partiesKept: number;
}

/** `POST /long-rent/tenants/:id/erasure-request`: idempotent, lease by lease. */
export interface TenantErasureResult {
  leases: TenantErasureLease[];
}
