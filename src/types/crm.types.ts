import type { PagedResult } from './users.types';

/**
 * CRM guest profile (NF-23, ADR-021): aggregated guest data for marketing and
 * segmentation, filtered by HostScope.
 */
export interface GuestCrmProfile {
  id: string;
  confirmedMarketingEmail: string;
  marketingConsentEmail: boolean;
  marketingConsentWhatsApp: boolean;
  language: string;
  country: string;
  totalStays: number;
  totalSpend: number;
  propertyIds: string[];
  tags: string[];
  firstStayAt: string;
  lastStayAt: string;
}

export interface GuestCrmListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export type GuestCrmProfileList = PagedResult<GuestCrmProfile>;
