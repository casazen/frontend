import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { servicePaymentsApi } from '@/api/service-payments.api';

const PUBLIC_SERVICE_PAYMENT_KEY = 'public-service-payment';

/** After the payer confirmed a payment, the state comes from the Stripe webhook: it is read again until it moves. */
const POLL_MS = 3_000;

/** The payment page of the link (404 when the link is wrong, replaced or past its validity: the same answer for all). */
export function usePublicServicePayment(paymentId: string, token: string, awaitingStripe = false) {
  return useQuery({
    queryKey: [PUBLIC_SERVICE_PAYMENT_KEY, paymentId, token],
    queryFn: () => servicePaymentsApi.getPayment(paymentId, token),
    enabled: !!paymentId && !!token,
    retry: false,
    refetchInterval: (query) => (awaitingStripe && (query.state.data?.state === 'Payable' || query.state.data?.state === 'Processing') ? POLL_MS : false),
  });
}

/** The PaymentIntent to confirm with the Payment Element; a refusal (409) reads the payment again, since it moved. */
export function useCreateServicePaymentSession(paymentId: string, token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => servicePaymentsApi.createSession(paymentId, token),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: [PUBLIC_SERVICE_PAYMENT_KEY, paymentId, token] });
    },
  });
}
