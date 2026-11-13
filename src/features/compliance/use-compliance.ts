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

/** How long the number on the menu is trusted before it is read again: the page itself always reads again when it opens. */
const FINE_COUNT_STALE_MS = 60_000;

/** The summary as the counters of the menu and of the Home read it: the cache entry of the page, trusted for a minute. */
function useCountedSummary(enabled: boolean) {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'summary'],
    queryFn: fetchComplianceSummary,
    enabled,
    staleTime: FINE_COUNT_STALE_MS,
  });
}

/**
 * How many things carry a risk of a sanction (`fineCount`): the number on the menu entry «Adempimenti» and the reason of the block
 * of the Home. It is the summary the page reads, in the same cache entry, so opening the page shows what the menu counted. A counter is
 * a hint: while it loads, when it fails or when the server answers something that is not the summary, there is no number.
 */
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

/** The read of the lights that a card holds: only what the helpers below need of it. */
type LightsRead = Pick<UseQueryResult<ComplianceSummaryResult>, 'data' | 'error' | 'isError'>;

/**
 * Whether the summary is not there at all (a 404: the traffic light is off). The card is then what it always was, and an old answer left in the cache
 * by the query is not an answer (TanStack Query keeps the data of a read that fails).
 */
const lightsAreOff = (read: LightsRead): boolean => read.isError && getHttpStatus(read.error) === 404;

/** The summary a card reads its lines from: none when the lights are off, whatever the cache still holds. */
export function lightsOf(read: LightsRead): ComplianceSummaryResult | undefined {
  return lightsAreOff(read) ? undefined : read.data;
}

/**
 * Whether a card could not read the lights and has to say so: the read failed with a 5xx, the network or a 403, which is «non lo so» and never
 * «tutto in ordine». A 404 is the traffic light off: the card is what it was.
 */
export function lightsCouldNotBeRead(read: LightsRead): boolean {
  return read.isError && !lightsAreOff(read);
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
 * Saves the progress of the wizard as the host moves between the steps and when it leaves with "Save and exit" (CO-17): the answer replaces
 * the cached start, so a reload opens the wizard on the same step with the same answers. No toast: the page shows the error.
 *
 * The answers hold free notes about the stay, so the mutation is dropped as soon as nothing observes it (`gcTime: 0`, not five minutes in the
 * cache of the mutations) and a refusal is kept without the request that was sent (`withoutRequest`: the status and the body of the answer stay).
 */
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

/** Closes the stay with the answers of the wizard; kept like the progress (`gcTime: 0`, a refusal without its request). */
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
