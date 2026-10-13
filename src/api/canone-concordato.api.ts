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
  /** `partial_data`, `subfascia3_max_needs_more_d`, `no_duration_uplift_over_6_years`, `agreement_expired`. */
  warnings?: string[];
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  subFascia3QualifyingTypeDElements?: string | null;
  /** Formal expiry of the territorial agreement (LT-13); null when unknown. */
  agreementExpiresAt?: string | null;
  /** The agreement stays in force until a new one is signed. */
  agreementRemainsInForceUntilReplaced?: boolean;
}

/** A zone of the territorial agreement of the property's comune, with its cadastral sheets (LT-13, A7-24). */
export interface CanoneConcordatoZone {
  name: string;
  cadastralSheets: string[];
}

/** `GET /properties/:id/canone-concordato/zones`: the zones come from the agreement data, never typed by hand. */
export interface CanoneConcordatoZones {
  comune: string;
  available: boolean;
  dataCompleteness: 'Complete' | 'Partial' | 'Missing' | null;
  zones: CanoneConcordatoZone[];
}

/** Why the IMU notification cannot be exported or marked sent (backend `ImuNotificationErrorCodes`). */
export type ImuNotificationReasonCode =
  | 'imu_notification_not_concordato'
  | 'imu_notification_lease_not_registered'
  | 'imu_notification_data_unavailable';

/** Comune office that receives the IMU communication, from the reference data on the database (LT-13, A7-22). */
export interface ImuNotificationChannel {
  recipientOffice: string;
  email: string | null;
  pec: string | null;
  postalAddress: string | null;
  instructions: string | null;
  ratePercent: number | null;
  effectiveRatePercent: number | null;
  rateYear: number | null;
  rateKind: 'Official' | 'Derived' | null;
  rateNotes: string | null;
  rateSourceUrl: string | null;
  sourceUrl: string | null;
  dataCompleteness: 'Complete' | 'Partial' | 'Missing';
  lastVerifiedAt: string | null;
}

/**
 * `GET /leases/:id/canone-concordato/imu-notification`: whether the IMU notification applies to the lease (canone
 * concordato contract) and whether the backend allows it now (registered lease, agreement data), with the channel.
 */
export interface ImuNotificationStatus {
  applicable: boolean;
  available: boolean;
  reasonCode: ImuNotificationReasonCode | string | null;
  comune: string;
  channel: ImuNotificationChannel | null;
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
  getZones: (propertyId: string) =>
    ApiClient.get<CanoneConcordatoZones>(`/properties/${propertyId}/canone-concordato/zones`),
  getImuNotificationStatus: (leaseId: string) =>
    ApiClient.get<ImuNotificationStatus>(`/leases/${leaseId}/canone-concordato/imu-notification`),
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
