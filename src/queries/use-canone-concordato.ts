import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useCanoneConcordatoZones(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['canone-concordato', 'zones', propertyId],
    queryFn: () => canoneConcordatoApi.getZones(propertyId!),
    enabled: !!propertyId,
  });
}

export function useImuNotificationStatus(leaseId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: imuNotificationStatusKey(leaseId),
    queryFn: () => canoneConcordatoApi.getImuNotificationStatus(leaseId!),
    enabled: !!leaseId && enabled,
  });
}

function imuNotificationStatusKey(leaseId: string | undefined) {
  return ['canone-concordato', 'imu-notification', leaseId] as const;
}

export function useAttestationGuidance(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['canone-concordato', 'attestation', propertyId],
    queryFn: () => canoneConcordatoApi.getAttestationGuidance(propertyId!),
    enabled: !!propertyId,
  });
}

export function useExportImuNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaseId: string) => canoneConcordatoApi.exportImuNotification(leaseId),
    onSuccess: (_data, leaseId) => {
      void queryClient.invalidateQueries({ queryKey: ['leases', leaseId] });
    },
  });
}

export function useMarkImuNotificationSent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaseId: string) => canoneConcordatoApi.markImuNotificationSent(leaseId),
    onSuccess: (_data, leaseId) => {
      void queryClient.invalidateQueries({ queryKey: ['leases', leaseId] });
      void queryClient.invalidateQueries({ queryKey: imuNotificationStatusKey(leaseId) });
    },
  });
}
