import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { verificationApi } from '@/api/verification.api';
import type {
  VerificationDecisionRequest,
  VerificationRejectionRequest,
} from '@/types/verification.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const VERIFICATION_KEY = 'verification';

/**
 * Pending verifications within the operator's perimeter (AC-NF12-3).
 * Refetches on mount: the list changes when operators work on it elsewhere.
 */
export function usePendingVerifications() {
  return useQuery({
    queryKey: [VERIFICATION_KEY, 'pending'],
    queryFn: () => verificationApi.getPending(),
    refetchOnMount: true,
  });
}

/** Request a new selfie photo from the guest (AC-NF12-5). */
export function useRequestNewPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) => verificationApi.requestNewPhoto(bookingId),
    onSuccess: () => {
      toast.success(i18n.t('verification.action.photoRequested'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('verification.action.photoRequestFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [VERIFICATION_KEY] });
    },
  });
}

/** Record manual verification decision (AC-NF12-6). */
export function useRecordVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, data }: { bookingId: string; data: VerificationDecisionRequest }) =>
      verificationApi.recordVerification(bookingId, data),
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [VERIFICATION_KEY] });
    },
  });
}

/** Reject the guest's check-in (AC-NF12-7). */
export function useRejectVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, data }: { bookingId: string; data: VerificationRejectionRequest }) =>
      verificationApi.rejectVerification(bookingId, data),
    onSuccess: () => {
      toast.success(i18n.t('verification.action.rejected'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('verification.action.rejectFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [VERIFICATION_KEY] });
    },
  });
}
