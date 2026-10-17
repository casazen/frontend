import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import {
  createSupplierDashboardLink,
  createSupplierOnboardingLink,
  fetchSupplierPaymentsAccount,
} from '@/api/supplier-payments.api';
import { resolveSupplierPaymentsState, type SupplierPaymentsAccount } from '@/types/supplier-payments';

const ACCOUNT_KEY = ['supplier', 'payments', 'account'] as const;

/**
 * Asking Stripe again, a few times and not for long: right after the supplier sent the form Stripe may take a few seconds to
 * enable the account, so the first answer can still say "checking". After the last read the page says what it has read, with a
 * button to ask again.
 */
const STRIPE_READS = 3;
const STRIPE_READ_GAP_MS = 2_500;

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/** The account read from Stripe; asked again while the only thing left is Stripe's own check, and only a few times. */
async function readFromStripe(signal: AbortSignal): Promise<SupplierPaymentsAccount> {
  let account = await fetchSupplierPaymentsAccount(true);
  for (let read = 1; read < STRIPE_READS && resolveSupplierPaymentsState(account) === 'verifying'; read += 1) {
    await pause(STRIPE_READ_GAP_MS, signal);
    account = await fetchSupplierPaymentsAccount(true);
  }
  return account;
}

/**
 * The supplier's Stripe account (SP-14). A plain visit shows what the server has; coming back from Stripe (`afterStripe`) or
 * pressing "ask again" reads it from Stripe, and the rows of the last answer stay on screen until the new one arrives. It is
 * read again every time the page opens (the shared client does not on mount). A 404 means online payments are not active on the
 * server: the page says so.
 */
export function useSupplierPaymentsAccount(afterStripe: boolean) {
  // How many times the supplier asked Stripe; 0 is the plain read.
  const [stripeReads, setStripeReads] = useState(afterStripe ? 1 : 0);
  const query = useQuery({
    queryKey: [...ACCOUNT_KEY, stripeReads],
    queryFn: ({ signal }) => (stripeReads === 0 ? fetchSupplierPaymentsAccount(false) : readFromStripe(signal)),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    /** Stripe is being asked now (as opposed to the server's own copy). */
    askingStripe: stripeReads > 0 && query.isFetching,
    askStripeAgain: () => setStripeReads((reads) => reads + 1),
  };
}

/**
 * The Stripe address where the supplier connects the account or finishes it. The page opens it at once: the account may not exist
 * until this call, and the address works once. A failure is shown by the page, with "Riprova" when trying again may help.
 */
export function useSupplierOnboardingLink() {
  return useMutation({
    mutationFn: createSupplierOnboardingLink,
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

/** The single-use address of the Express Dashboard of the account, opened at once. */
export function useSupplierDashboardLink() {
  return useMutation({
    mutationFn: createSupplierDashboardLink,
    onSuccess: ({ url }) => window.location.assign(url),
  });
}
