import { ApiClient } from './client';
import type {
  OwnerPortalProperty,
  OwnerPortalStatement,
  OwnerPortalInvoice,
  OwnerPortalWithholding,
} from '@/types';

export const ownerPortalApi = {
  /**
   * List properties with occupancy and revenue (ADR-011-R8).
   * Filtered by PropertyOwnership.OwnerUserId AND period active.
   */
  getProperties: () =>
    ApiClient.get<OwnerPortalProperty[]>('/owner-portal/properties'),

  /**
   * Get published statements for the owner (ADR-011-R2).
   * Only published statements are visible.
   */
  getStatements: (params?: { year?: number; propertyId?: string }) =>
    ApiClient.get<OwnerPortalStatement[]>('/owner-portal/statements', params),

  /**
   * Get invoices received by the owner from the agency (ADR-011-R2).
   */
  getInvoices: (params?: { year?: number; propertyId?: string }) =>
    ApiClient.get<OwnerPortalInvoice[]>('/owner-portal/invoices', params),

  /**
   * Get withholding tax summary for tax purposes (ADR-011-R2).
   */
  getWithholding: (year: number) =>
    ApiClient.get<OwnerPortalWithholding>(`/owner-portal/withholding?year=${year}`),
};
