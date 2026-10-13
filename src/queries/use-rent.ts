import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { publicRentApi, rentApi } from '@/api/rent.api';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import type { ConfigureRentScheduleInput, MarkRentPaidInput, RentLedger } from '@/types';

const RENT_KEY = 'lease-rent';
const PUBLIC_RENT_KEY = 'public-rent-payment';

/**
 * Rent page of a lease (LT-06): schedule, installments and what the landlord can do. The lease status is part of the
 * key: signing the lease (offline, or by the provider while the page is open) changes what the ledger allows
 * (`canConfigure`), so the ledger is read again instead of staying "not signed yet".
 */
export function useRentLedger(leaseId: string, leaseStatus?: string) {
  return useQuery({
    queryKey: [RENT_KEY, leaseId, leaseStatus ?? null],
    queryFn: () => rentApi.getLedger(leaseId),
    enabled: !!leaseId,
  });
}

function useRentMutation<TVariables, TResult>(
  leaseId: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
  successKey: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RENT_KEY, leaseId] });
      toast.success(i18n.t(successKey));
    },
    onError: (error) => {
      // The ledger may have changed (paid online meanwhile, payment in flight): show the real state.
      void queryClient.invalidateQueries({ queryKey: [RENT_KEY, leaseId] });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('rent.actionFailed'));
    },
  });
}

export function useConfigureRentSchedule(leaseId: string) {
  return useRentMutation(
    leaseId,
    (input: ConfigureRentScheduleInput) => rentApi.configureSchedule(leaseId, input),
    'rent.scheduleSaved',
  );
}

export function useDisableRentSchedule(leaseId: string) {
  return useRentMutation<void, RentLedger>(leaseId, () => rentApi.disableSchedule(leaseId), 'rent.scheduleDisabled');
}

export function useMarkRentPaid(leaseId: string) {
  return useRentMutation(
    leaseId,
    ({ installmentId, input }: { installmentId: string; input: MarkRentPaidInput }) =>
      rentApi.markPaid(leaseId, installmentId, input),
    'rent.markedPaid',
  );
}

export function useSendRentPaymentRequest(leaseId: string) {
  return useRentMutation(
    leaseId,
    (installmentId: string) => rentApi.sendPaymentRequest(leaseId, installmentId),
    'rent.paymentRequestSent',
  );
}

/** The tenant's payment page: the installment of the link (404 when the link is wrong or replaced). */
export function usePublicRentPayment(installmentId: string, token: string, awaitingStripe = false) {
  return useQuery({
    queryKey: [PUBLIC_RENT_KEY, installmentId, token],
    queryFn: () => publicRentApi.getPayment(installmentId, token),
    enabled: !!installmentId && !!token,
    retry: false,
    // After the tenant confirmed a payment, the state comes from the Stripe webhook: read it again until it moves.
    refetchInterval: (query) =>
      awaitingStripe && (query.state.data?.state === 'Payable' || query.state.data?.state === 'Processing') ? 3_000 : false,
  });
}

export function useCreateRentPaymentSession(installmentId: string, token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => publicRentApi.createPaymentSession(installmentId, token),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: [PUBLIC_RENT_KEY, installmentId, token] });
    },
  });
}
