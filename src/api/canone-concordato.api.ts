import axios from '@/lib/axios';
import { ApiClient } from './client';

export type CanoneConcordatoReasonCode =
  | 'data_unavailable'
  | 'zone_required'
  | 'zone_not_found'
  | 'invalid_surface'
  | 'surface_out_of_bands'
  | 'invalid_element_counts'
  | 'term_too_short';

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
  contractYears?: number | null;
  usableSqm?: number | null;
  bandMinSqm?: number | null;
  bandMaxSqm?: number | null;
  indicative?: boolean;
  warnings?: string[];
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  subFascia3QualifyingTypeDElements?: string | null;
  agreementExpiresAt?: string | null;
  agreementRemainsInForceUntilReplaced?: boolean;
}

export interface CanoneConcordatoZone {
  name: string;
  cadastralSheets: string[];
}

export interface CanoneConcordatoZones {
  comune: string;
  available: boolean;
  dataCompleteness: 'Complete' | 'Partial' | 'Missing' | null;
  zones: CanoneConcordatoZone[];
}

export type ImuNotificationReasonCode =
  | 'imu_notification_not_concordato'
  | 'imu_notification_lease_not_registered'
  | 'imu_notification_data_unavailable';

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
  startDate: string;
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
