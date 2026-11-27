import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { maintenanceRequestsApi } from './api';
import type { CreateMaintenanceRequestInput, MaintenanceDecisionInput } from './model';

export const MAINTENANCE_REQUESTS_KEY = 'maintenance-requests';

function onError(error: unknown, fallback: string) {
  toast.error(getProblemMessage(error, i18n.t) ?? fallback);
}

export function useMaintenanceRequests(leaseId: string) {
  return useQuery({
    queryKey: [MAINTENANCE_REQUESTS_KEY, leaseId],
    queryFn: () => maintenanceRequestsApi.list(leaseId),
    enabled: !!leaseId,
  });
}

export function useCreateMaintenanceRequest(leaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaintenanceRequestInput) => maintenanceRequestsApi.create(leaseId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [MAINTENANCE_REQUESTS_KEY, leaseId] });
    },
    onError: (error) => onError(error, i18n.t('maintenanceRequest.sendError')),
  });
}

export function useDecideMaintenanceRequest(leaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { requestId: string; decision: MaintenanceDecisionInput }) =>
      maintenanceRequestsApi.decide(leaseId, input.requestId, input.decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [MAINTENANCE_REQUESTS_KEY, leaseId] });
    },
    onError: (error) => onError(error, i18n.t('maintenanceRequest.decisionError')),
  });
}

export function usePayMaintenanceRequest(leaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => maintenanceRequestsApi.pay(leaseId, requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [MAINTENANCE_REQUESTS_KEY, leaseId] });
    },
    onError: (error) => onError(error, i18n.t('maintenanceRequest.paymentError')),
  });
}
