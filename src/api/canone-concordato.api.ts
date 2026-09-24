import axios from '@/lib/axios';
import { ApiClient } from './client';

/** Why no range is available (backend `CanoneConcordatoReasonCodes`). */
export type CanoneConcordatoReasonCode =
  | 'data_unavailable'
  | 'zone_required'
  | 'zone_not_found'
  | 'invalid_surface'
  | 'surface_out_of_bands'
  | 'invalid_element_counts'
  | 'term_too_short';

/**
 * `GET /properties/:id/canone-concordato/eligibility` (LT-10). The range comes from the backend, computed with the term of
 * the lease dates. `indicative`: the agreement data are not confirmed (Partial), the range is only a guide (A7-23).
 */
export interface CanoneConcordatoEligibility {
  available: boolean;
  reason: string | null;
  reasonCode?: CanoneConcordatoReasonCode | string | null;
  comune: string;
  zone: string | null;
  subFascia: number | null;
  canoneMinAnnuo: number | null;
  canoneMaxAnnuo: number | null;
  canoneMinMensile: number | null;
  canoneMaxMensile: number | null;
  dataCompleteness: 'Complete' | 'Partial' | 'Missing' | null;
  imuAppliesTheoretical: boolean;
  ataApplies: boolean;
  attestationRequired: boolean;
  disclaimer: string;
  /** Whole years of the term, from the dates. */
  contractYears?: number | null;
  /** Surface plus appurtenances at the agreement's percentages. */
  usableSqm?: number | null;
  /** Surface band used: (bandMinSqm, bandMaxSqm], bandMaxSqm null for the last one. */
  bandMinSqm?: number | null;
  bandMaxSqm?: number | null;
  indicative?: boolean;
  /** `partial_data`, `subfascia3_max_needs_more_d`, `no_duration_uplift_over_6_years`. */
  warnings?: string[];
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  subFascia3QualifyingTypeDElements?: string | null;
}

export interface AttestationSignatory {
  name: string;
  role: 'Proprieta' | 'Inquilini';
  contact: string;
}

export interface AttestationGuidance {
  comune: string;
  organizations: AttestationSignatory[];
}

/** Query of the eligibility endpoint: the unit characteristics and the lease dates (no year count, A7-12). */
export interface EligibilityQuery {
  sqm: number;
  garageSqm?: number;
  balconySqm?: number;
  otherAppurtenanceSqm?: number;
  privateGreenSqm?: number;
  typeACount: number;
  typeBCount: number;
  typeCCount: number;
  typeDCount: number;
  qualifyingTypeDCount?: number;
  furnished: boolean;
  airConditioning?: boolean;
  stoveHeating?: boolean;
  zone?: string;
  foglio?: string;
  /** `YYYY-MM-DD` */
  startDate: string;
  /** `YYYY-MM-DD`, inclusive */
  endDate: string;
}

export const canoneConcordatoApi = {
  getEligibility: (propertyId: string, query: EligibilityQuery) =>
    ApiClient.get<CanoneConcordatoEligibility>(
      `/properties/${propertyId}/canone-concordato/eligibility`,
      query,
    ),
  getAttestationGuidance: (propertyId: string) =>
    ApiClient.get<AttestationGuidance>(
      `/properties/${propertyId}/canone-concordato/attestation-guidance`,
    ),
  exportImuNotification: async (leaseId: string): Promise<Blob> => {
    const response = await axios.get(
      `/leases/${leaseId}/canone-concordato/imu-notification/export`,
      { responseType: 'blob' },
    );
    return response.data;
  },
  markImuNotificationSent: (leaseId: string) =>
    ApiClient.post<void>(
      `/leases/${leaseId}/canone-concordato/imu-notification/mark-sent`,
    ),
};
