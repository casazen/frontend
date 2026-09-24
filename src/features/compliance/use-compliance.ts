import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeCheckoutWizard,
  completeComplianceActivation,
  fetchComplianceActivation,
  fetchComplianceSummary,
  fetchSafetyChecklist,
  saveSafetyChecklist,
  startCheckoutWizard,
} from '@/api/compliance.api';
import type {
  CheckoutWizardCompleteCommand,
  CompletePropertyActivationCommand,
  SaveSafetyChecklistCommand,
} from '@/types/compliance.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const COMPLIANCE_KEY = 'compliance';

export function useComplianceActivation(propertyId: string) {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'activation', propertyId],
    queryFn: () => fetchComplianceActivation(propertyId),
    enabled: !!propertyId,
  });
}

export function useCompleteComplianceActivation(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CompletePropertyActivationCommand) =>
      completeComplianceActivation(propertyId, payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      if (result.complianceStatus === 'Active') {
        toast.success(i18n.t('compliance.activation.completed'));
      } else {
        toast.warning(i18n.t('compliance.activation.blockersRemain'));
      }
    },
    onError: () => toast.error(i18n.t('compliance.activation.completeFailed')),
  });
}

export function useSafetyChecklist(propertyId: string) {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'safety-checklist', propertyId],
    queryFn: () => fetchSafetyChecklist(propertyId),
    enabled: !!propertyId,
  });
}

export function useSaveSafetyChecklist(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveSafetyChecklistCommand) => saveSafetyChecklist(propertyId, payload),
    onSuccess: (saved) => {
      queryClient.setQueryData([COMPLIANCE_KEY, 'safety-checklist', propertyId], saved);
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY, 'activation', propertyId] });
      toast.success(i18n.t('compliance.safety.saved'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('compliance.safety.saveFailed'));
    },
  });
}

export function useComplianceSummary() {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'summary'],
    queryFn: fetchComplianceSummary,
  });
}

export function useStartCheckoutWizard(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'checkout', bookingId],
    queryFn: () => startCheckoutWizard(bookingId),
    enabled: !!bookingId && enabled,
    retry: false,
  });
}

export function useCompleteCheckoutWizard(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CheckoutWizardCompleteCommand) =>
      completeCheckoutWizard(bookingId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings', bookingId] });
      toast.success(i18n.t('compliance.checkout.completed'));
    },
    onError: () => toast.error(i18n.t('compliance.checkout.completeFailed')),
  });
}
