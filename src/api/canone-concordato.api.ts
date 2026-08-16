import axios from '@/lib/axios';
import { ApiClient } from './client';

export interface CanoneConcordatoEligibility {
  available: boolean;
  reason: string | null;
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
  typeACount: number;
  typeBCount: number;
  typeCCount: number;
  typeDCount: number;
  furnished: boolean;
  years: number;
  zone?: string;
  foglio?: string;
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
