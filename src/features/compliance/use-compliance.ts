import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
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
import { summarizeLights } from '@/features/compliance/lib/compliance-light';
import { fineCount } from '@/features/compliance/lib/compliance-tiers';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type {
  CheckoutWizardCompleteCommand,
  CheckoutWizardProgressCommand,
  CompletePropertyActivationCommand,
  ComplianceSummaryResult,
  SaveSafetyChecklistCommand,
} from '@/types/compliance.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';

export const COMPLIANCE_KEY = 'compliance';

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
      if (getActivationBlockedProblem(error)) return;
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('compliance.activation.completeFailed'));
    },
  });
}

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

/**
 * What the host still has to do: read again every time the page opens, because the stays, the check-ins and the properties
 * change it from other screens, where this page is not watched (an invalidation would not reach it).
 */
export function useComplianceSummary() {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'summary'],
    queryFn: fetchComplianceSummary,
    refetchOnMount: 'always',
  });
}

const FINE_COUNT_STALE_MS = 60_000;

function useCountedSummary(enabled: boolean) {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'summary'],
    queryFn: fetchComplianceSummary,
    enabled,
    staleTime: FINE_COUNT_STALE_MS,
  });
}

export function useComplianceFineCount(enabled: boolean): number | undefined {
  const query = useCountedSummary(enabled);
  return enabled && query.data && typeof query.data === 'object' ? fineCount(query.data) : undefined;
}

/**
 * Whether the server sends the traffic light (NF-52): some item of the summary carries a light this version knows. With it the compliance
 * reaches the «Adesso» block of the Home through the unified «Da fare» (the feeder keeps that list in step with the cockpit), so the Home does not
 * hold a second block for it; without it (an older server, or the traffic light off) the Home is what it always was. False while it loads and when it fails.
 */
export function useComplianceLightsOn(enabled: boolean): boolean {
  const query = useCountedSummary(enabled);
  return enabled && query.data && typeof query.data === 'object' ? summarizeLights(query.data).lightsOn : false;
}

/**
 * The lights of the stay or the property that a card of «Cosa succede ora» shows (NF-52, AC-NF52-9): the summary of the adempimenti, read again
 * every time the page opens (the lights move with the clock and with what happens elsewhere, and the open page is kept in step by the live events
 * that refresh the cockpit). `enabled` is the permission to read the bookings, which the API asks: a bare 403 on a GET would take the user to
 * «nessun accesso». It never retries: the card does not wait for a second answer, and a read that failed says nothing (never green).
 */
export function useComplianceLights(enabled: boolean) {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'summary'],
    queryFn: fetchComplianceSummary,
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
}

type LightsRead = Pick<UseQueryResult<ComplianceSummaryResult>, 'data' | 'error' | 'isError'>;

const lightsAreOff = (read: LightsRead): boolean => read.isError && getHttpStatus(read.error) === 404;

export function lightsOf(read: LightsRead): ComplianceSummaryResult | undefined {
  return lightsAreOff(read) ? undefined : read.data;
}

export function lightsCouldNotBeRead(read: LightsRead): boolean {
  return read.isError && !lightsAreOff(read);
}

const checkoutStartKey = (bookingId: string) => [COMPLIANCE_KEY, 'checkout', bookingId];

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

export function useCheckoutWizard(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'checkout-state', bookingId],
    queryFn: () => fetchCheckoutWizard(bookingId),
    enabled: !!bookingId && enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useSaveCheckoutProgress(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (payload: CheckoutWizardProgressCommand) => {
      try {
        return await saveCheckoutProgress(bookingId, payload);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (state) => queryClient.setQueryData(checkoutStartKey(bookingId), state),
  });
}

export function useCompleteCheckoutWizard(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (payload: CheckoutWizardCompleteCommand) => {
      try {
        return await completeCheckoutWizard(bookingId, payload);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (result) => {
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
