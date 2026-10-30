import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CONNECT_STATUS_KEY, useConnectStatus, useOpenStripeDashboard, useStartConnectOnboarding } from '@/queries/use-connect';
import { resolveConnectUiStatus } from '@/types/connect.types';

/**
 * The Stripe account of the org and the way to connect it or finish its verification, for the pages that show it. Back from Stripe
 * (`?stripe_return=1` or `?stripe_refresh=1`, the pages the API builds) the status is read from Stripe again and the marks leave the
 * address. With `enabled` false nothing is read: the account page asks for the status only of the people who may open the payments page.
 */
export function useConnectPayments(enabled = true) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const stripeReturn = searchParams.get('stripe_return') === '1' || searchParams.get('stripe_refresh') === '1';

  const query = useConnectStatus(stripeReturn, enabled);
  const startOnboarding = useStartConnectOnboarding();
  const openDashboard = useOpenStripeDashboard();

  useEffect(() => {
    if (!stripeReturn) return;

    void queryClient.invalidateQueries({ queryKey: CONNECT_STATUS_KEY });
    setSearchParams({}, { replace: true });
  }, [stripeReturn, queryClient, setSearchParams]);

  return {
    status: query.data,
    uiStatus: resolveConnectUiStatus(query.data),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
    startOnboarding,
    openDashboard,
  };
}

export type ConnectPayments = ReturnType<typeof useConnectPayments>;

/** The status is known and the account cannot take payments yet: not connected, or connected and still being verified. */
export function isPaymentsMissing(payments: Pick<ConnectPayments, 'status' | 'uiStatus'>): boolean {
  return payments.status !== undefined && payments.uiStatus !== 'active';
}
