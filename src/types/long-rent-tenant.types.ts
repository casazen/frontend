import type { LeaseStage } from './lease.types';
import type { LeaseErasureStatus } from './lease-lifecycle.types';
import type { RentInstallmentStatus } from './rent.types';

/**
 * The tenants of the long-term area (LR-09), as `GET /long-rent/tenants` answers. There is no tenant record: the server reads a person
 * from the parties of the leases (one person is one fiscal code), so one person on several leases is one row. The id is opaque; the
 * fiscal code is never sent, and the e-mail only masked. Dates are Europe/Rome calendar days or UTC midnights of them.
 */

export type TenantListView = 'All' | 'Current' | 'Former';

type TenantCitizenship = 'Eu' | 'NonEu';

export interface TenantLease {
  leaseId: string;
  propertyId: string;
  propertyName: string;
  stage: LeaseStage | null;
  monthlyRent: number;
  currentTermEndDate: string;
}

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
  isFormer: boolean;
  leases: TenantLease[];
  punctuality: TenantPunctuality;
}

interface TenantCounts {
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

interface TenantOverdue {
  count: number;
  amount: number;
  oldestInstallmentId: string;
  oldestDueDate: string;
  daysOverdue: number;
}

export interface TenantDetail {
  tenant: TenantRow;
  payments: TenantPayment[];
  overdue: TenantOverdue | null;
  onTimeDays: number;
}

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
