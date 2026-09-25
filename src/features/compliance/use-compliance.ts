import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeCheckoutWizard,
  completeComplianceActivation,
  confirmPropertyReady,
  fetchCheckoutWizard,
  fetchComplianceActivation,
  fetchComplianceSummary,
  fetchSafetyChecklist,
  getActivationBlockedProblem,
  saveCheckoutProgress,
  saveSafetyChecklist,
  startCheckoutWizard,
} from '@/api/compliance.api';
import type {
  CheckoutWizardCompleteCommand,
  CheckoutWizardProgressCommand,
  CompletePropertyActivationCommand,
  SaveSafetyChecklistCommand,
} from '@/types/compliance.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const COMPLIANCE_KEY = 'compliance';

/**
 * Steps of the activation wizard. Always read again from the server when the wizard opens (A5-18): the steps and the
 * blockers change with edits made elsewhere (property page, CIN, documents, another device).
 */
export function useComplianceActivation(propertyId: string) {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'activation', propertyId],
    queryFn: () => fetchComplianceActivation(propertyId),
    enabled: !!propertyId,
    staleTime: 0,
    refetchOnMount: 'always',
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
    onError: (error) => {
      // 409 property_activation_blocked: the wizard lists the blockers with a link to their step (A5-18 b).
      if (getActivationBlockedProblem(error)) return;
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('compliance.activation.completeFailed'));
    },
  });
}

/** Saved safety checklist: read again from the server every time the form opens, never from a stale cache. */
export function useSafetyChecklist(propertyId: string) {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'safety-checklist', propertyId],
    queryFn: () => fetchSafetyChecklist(propertyId),
    enabled: !!propertyId,
    staleTime: 0,
    refetchOnMount: 'always',
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

const checkoutStartKey = (bookingId: string) => [COMPLIANCE_KEY, 'checkout', bookingId];

/**
 * Opens the check-out wizard of a stay whose arrival is registered (CO-08): the API checks the same rules as the
 * completion and records when the wizard was opened. Started once per page: never refetched in the background.
 */
export function useStartCheckoutWizard(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: checkoutStartKey(bookingId),
    queryFn: () => startCheckoutWizard(bookingId),
    enabled: !!bookingId && enabled,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * "Registra arrivo e procedi" (CO-08): the host confirms that the guest arrived; the API registers the arrival of the
 * confirmed booking and opens the check-out wizard in the same transaction. No toast: the page shows the error.
 */
export function useRegisterArrivalAndStartCheckout(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => startCheckoutWizard(bookingId, { registerArrival: true }),
    onSuccess: (result) => {
      queryClient.setQueryData(checkoutStartKey(bookingId), result);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['alloggiati'] });
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY, 'summary'] });
    },
  });
}

/**
 * The wizard of a stay without any change (CO-17): used once the stay is checked out, to show what was declared and
 * whether the property is still to be declared ready.
 */
export function useCheckoutWizard(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'checkout-state', bookingId],
    queryFn: () => fetchCheckoutWizard(bookingId),
    enabled: !!bookingId && enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Saves the progress of the wizard as the host moves between the steps (CO-17): the answer replaces the cached start,
 * so a reload opens the wizard on the same step with the same answers. No toast: the page shows the error.
 */
export function useSaveCheckoutProgress(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CheckoutWizardProgressCommand) => saveCheckoutProgress(bookingId, payload),
    onSuccess: (state) => queryClient.setQueryData(checkoutStartKey(bookingId), state),
  });
}

export function useCompleteCheckoutWizard(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CheckoutWizardCompleteCommand) =>
      completeCheckoutWizard(bookingId, payload),
    onSuccess: (result) => {
      // The cockpit changes; the wizard start of this stay is never fetched again (it would answer 409 now).
      queryClient.setQueryData([COMPLIANCE_KEY, 'checkout-state', bookingId], result.wizard);
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY, 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['alloggiati'] });
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
      toast.success(
        i18n.t(result.propertyReady ? 'compliance.checkout.completed' : 'compliance.checkout.completedNotReady'),
      );
    },
    onError: (error) =>
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('compliance.checkout.completeFailed')),
  });
}

/** The host declares the property ready after the check-out: the turnover leaves the cockpit (CO-17). */
export function useConfirmPropertyReady(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notes: string | null) => confirmPropertyReady(bookingId, notes),
    onSuccess: (state) => {
      queryClient.setQueryData([COMPLIANCE_KEY, 'checkout-state', bookingId], state);
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY, 'summary'] });
      toast.success(i18n.t('compliance.checkout.propertyReadyConfirmed'));
    },
    onError: (error) =>
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('compliance.checkout.propertyReadyFailed')),
  });
}
