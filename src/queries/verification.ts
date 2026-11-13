import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { verificationApi } from '@/api/verification.api';
import type {
  VerificationDecisionRequest,
  VerificationMetricsPeriod,
  VerificationRejectionRequest,
} from '@/types/verification.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { COMPLIANCE_KEY } from '@/features/compliance/use-compliance';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { retryTransientErrors } from '@/lib/query-client';

/** Root of the verification queries: the queue and the figures. A decision, and a guest who hands a verification over, make the whole root stale. */
export const VERIFICATION_KEY = 'verification';

/**
 * Pending verifications within the operator's perimeter (AC-NF12-3). The queue changes whenever a guest hands a verification over or another
 * operator decides one, so it is read again every time the page opens and goes stale at once (the page open in front of the operator is kept
 * current by the real-time channel). It lists guests with their names and e-mail addresses: it is not kept once the page is closed (`gcTime: 0`).
 */
export function usePendingVerifications() {
  return useQuery({
    queryKey: [VERIFICATION_KEY, 'pending'],
    queryFn: () => verificationApi.getPending(),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}

/** The figures of the verifications of the last 30 days (or of `period`) for the bookings the operator reaches (NF-51 monitoring). Numbers only. */
export function useVerificationMetrics(period?: VerificationMetricsPeriod) {
  return useQuery({
    queryKey: [VERIFICATION_KEY, 'metrics', period?.from ?? null, period?.to ?? null],
    queryFn: () => verificationApi.getMetrics(period),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}

/**
 * What a decision of an operator changes, apart from the queue: the figures, the red mark of the compliance cockpit and the counter of the menu
 * (`operator_decision_required`). The "To do" of the verification closes with the decision: the list of the activities is read again by the global
 * rule of the cache of the mutations.
 */
function useRefreshAfterDecision() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [VERIFICATION_KEY] });
    void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY] });
  };
}

/**
 * The writes of the operator carry a note or a reason written in their own words about a guest: the mutation does not outlive the card that
 * made it (`gcTime: 0`) and what it keeps of a failure is the answer without the request that was sent (`withoutRequest`), which holds the text.
 */
const DECISION_MUTATION_OPTIONS = { gcTime: 0 } as const;

/** Request a new selfie photo from the guest (AC-NF12-5). */
export function useRequestNewPhoto() {
  const refresh = useRefreshAfterDecision();

  return useMutation({
    ...DECISION_MUTATION_OPTIONS,
    mutationKey: [VERIFICATION_KEY, 'request-photo'],
    mutationFn: async (bookingId: string) => {
      try {
        return await verificationApi.requestNewPhoto(bookingId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () => {
      toast.success(i18n.t('verification.action.photoRequested'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('verification.action.photoRequestFailed'));
    },
    onSettled: refresh,
  });
}

/**
 * Record manual verification decision (AC-NF12-6). An approval releases the access code of the property to the guest and e-mails it (the server
 * sends nothing when the property has no code), and says so; a rejection releases and sends nothing.
 */
export function useRecordVerification() {
  const refresh = useRefreshAfterDecision();

  return useMutation({
    ...DECISION_MUTATION_OPTIONS,
    mutationKey: [VERIFICATION_KEY, 'decide'],
    mutationFn: async ({ bookingId, data }: { bookingId: string; data: VerificationDecisionRequest }) => {
      try {
        return await verificationApi.recordVerification(bookingId, data);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (_result, variables) => {
      const outcome = variables.data.outcome;
      toast.success(
        outcome
          ? i18n.t('verification.action.verified')
          : i18n.t('verification.action.verificationRejected')
      );
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('verification.action.verifyFailed'));
    },
    onSettled: refresh,
  });
}

/** Reject the guest's check-in (AC-NF12-7). */
export function useRejectVerification() {
  const refresh = useRefreshAfterDecision();

  return useMutation({
    ...DECISION_MUTATION_OPTIONS,
    mutationKey: [VERIFICATION_KEY, 'reject'],
    mutationFn: async ({ bookingId, data }: { bookingId: string; data: VerificationRejectionRequest }) => {
      try {
        return await verificationApi.rejectVerification(bookingId, data);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () => {
      toast.success(i18n.t('verification.action.rejected'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('verification.action.rejectFailed'));
    },
    onSettled: refresh,
  });
}
