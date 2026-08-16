import { useMutation, useQuery } from '@tanstack/react-query';
import {
  canoneConcordatoApi,
  type EligibilityQuery,
} from '@/api/canone-concordato.api';

export function useCanoneConcordatoEligibility() {
  return useMutation({
    mutationFn: ({ propertyId, query }: { propertyId: string; query: EligibilityQuery }) =>
      canoneConcordatoApi.getEligibility(propertyId, query),
  });
}

export function useAttestationGuidance(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['canone-concordato', 'attestation', propertyId],
    queryFn: () => canoneConcordatoApi.getAttestationGuidance(propertyId!),
    enabled: !!propertyId,
  });
}

export function useExportImuNotification() {
  return useMutation({
    mutationFn: (leaseId: string) => canoneConcordatoApi.exportImuNotification(leaseId),
  });
}

export function useMarkImuNotificationSent() {
  return useMutation({
    mutationFn: (leaseId: string) => canoneConcordatoApi.markImuNotificationSent(leaseId),
  });
}
