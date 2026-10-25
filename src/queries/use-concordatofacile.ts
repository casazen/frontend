import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ConcordatoFacileApi } from '@/api/concordatofacile.api';
import { getProblemCode } from '@/lib/api-errors';

/** Query key for CF access state. */
export const CF_ACCESS_QUERY_KEY = (leaseId: string) => ['concordatofacile', 'access', leaseId] as const;

/** 409 of the checkout: the lease already has the service (paid, gift) or has paid and the payment is not recorded yet (CF-FIX). */
export const CF_ALREADY_PURCHASED_CODE = 'concordatofacile_already_purchased';

/** True for the 409 `concordatofacile_already_purchased` of the checkout. */
export function isCfAlreadyPurchased(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409 && getProblemCode(error.response.data) === CF_ALREADY_PURCHASED_CODE;
}

/** 409 of the link: the privacy notice was not accepted for this lease (CF-FLOW, backend): the person has to accept it first. */
export const CF_PRIVACY_NOT_ACCEPTED_CODE = 'concordatofacile_privacy_not_accepted';

/** True for the 409 `concordatofacile_privacy_not_accepted` of the link. */
export function isCfPrivacyNotAccepted(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409 && getProblemCode(error.response.data) === CF_PRIVACY_NOT_ACCEPTED_CODE;
}

/** Back from the payment the access is read again this often (the webhook of Stripe can arrive after the person does)... */
export const CF_ACCESS_POLL_MS = 2_000;
/** ...for about this long (CF-FLOW): then the person is told that the activation takes a moment and can check again. */
export const CF_ACCESS_POLL_LIMIT_MS = 40_000;

interface CfAccessOptions {
  /** Read the access again every ~2 s while it is not active: the return from the payment (`?checkout=success`). The caller ends it. */
  watch?: boolean;
  /** Without it nothing is asked (a caller that only needs the access of some leases). */
  enabled?: boolean;
}

/**
 * Check CF access for a lease (ADR-005-R8).
 * Refetches on every mount to get fresh payment, gift, privacy and form state (NF-02): they change outside the app (the webhook of
 * Stripe, the form itself) and the answer costs the server one read of its own database. With `watch` it reads again every {@link CF_ACCESS_POLL_MS} until the
 * access is active; the caller stops it (after {@link CF_ACCESS_POLL_LIMIT_MS}) by turning `watch` off.
 */
export function useCfAccess(leaseId: string, { watch = false, enabled = true }: CfAccessOptions = {}) {
  return useQuery({
    queryKey: CF_ACCESS_QUERY_KEY(leaseId),
    queryFn: () => ConcordatoFacileApi.getAccess(leaseId),
    refetchOnMount: 'always',
    enabled,
    refetchInterval: watch ? (query) => (query.state.data?.hasAccess ? false : CF_ACCESS_POLL_MS) : false,
  });
}

/**
 * Create Stripe checkout session for CF payment (ADR-005-R1).
 * Returns sessionUrl to redirect to Stripe. When the server answers that the lease already has the service (409
 * `concordatofacile_already_purchased`: the payment was made, possibly in another tab, or is still being recorded) the access is read
 * again, so the page shows the access that is now active instead of an error (CF-FIX).
 */
export function useCfCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaseId: string) => ConcordatoFacileApi.createCheckout(leaseId),
    onError: (error, leaseId) => {
      if (isCfAlreadyPurchased(error)) {
        void queryClient.invalidateQueries({ queryKey: CF_ACCESS_QUERY_KEY(leaseId) });
      }
    },
  });
}

/**
 * Consume the org's gift for a lease (NF-03, ADR-006-R10).
 * Atomically assigns the gift and grants access.
 * Invalidates access query on success.
 */
export function useCfConsumeGift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaseId: string) => ConcordatoFacileApi.consumeGift(leaseId),
    onSuccess: (_, leaseId) => {
      queryClient.invalidateQueries({ queryKey: CF_ACCESS_QUERY_KEY(leaseId) });
    },
  });
}

/**
 * The person accepts the privacy notice before the guided form (CF-FLOW). The server answers with the access as it is now (and it is
 * idempotent), which goes into the cache: the sheet drops the checkbox and the main button goes on.
 */
export function useCfAcceptPrivacy(leaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ConcordatoFacileApi.acceptPrivacy(leaseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CF_ACCESS_QUERY_KEY(leaseId) });
    },
  });
}

/**
 * Takes the browser, in the SAME tab, to the address the server signed (CF-FLOW). The link is only worth following if it is a web
 * address, so anything else (a script, a relative path) is refused before the browser leaves the app. `replace` swaps the entry of
 * the page in the history, so that "back" from the form does not land on a page that sends the person on again.
 */
export function goToCfForm(url: string, replace: boolean): void {
  const { protocol } = new URL(url);
  if (protocol !== 'https:' && protocol !== 'http:') throw new Error('The link of the form is not a web address');
  if (replace) window.location.replace(url);
  else window.location.assign(url);
}

interface OpenCfFormOptions {
  /** The page that opens the form is only a step on the way (the passage page): its history entry is replaced and not kept. */
  replace?: boolean;
}

/**
 * THE one gesture that opens the guided form (CF-FLOW): `POST …/concordatofacile/link` and, once the server has signed the link, the
 * same tab of the browser goes to it (ADR-007-R6, ADR-007-R12). No `window.open` and no new tab: a window opened after an asynchronous
 * answer is the one browsers block. The link is worth 15 minutes and every call is recorded as an event of the lease, so a caller
 * asks once per gesture: `isPending || isSuccess` is the time to keep the button from being pressed again (the page is on its way
 * out), and a page coming back from the browser's cache (`pageshow`) gets the button back.
 */
export function useOpenCfForm(leaseId: string, { replace = false }: OpenCfFormOptions = {}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => ConcordatoFacileApi.generateLink(leaseId),
    onSuccess: ({ url }) => goToCfForm(url, replace),
    onError: (error) => {
      // The privacy notice is not accepted (the server is the one that knows): read the access again, and the sheet asks for it.
      if (isCfPrivacyNotAccepted(error)) void queryClient.invalidateQueries({ queryKey: CF_ACCESS_QUERY_KEY(leaseId) });
    },
  });
  const { reset } = mutation;

  // Back from the form through the cache of the browser: the page is as it was left, so the button is given back and the access, which
  // now says the form was opened, is read again.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      reset();
      void queryClient.invalidateQueries({ queryKey: CF_ACCESS_QUERY_KEY(leaseId) });
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [reset, queryClient, leaseId]);

  return mutation;
}

/** Query key for the lease of a CF practice. */
export const CF_PRACTICE_LEASE_QUERY_KEY = (practiceId: string) => ['concordatofacile', 'practice-lease', practiceId] as const;

/**
 * The lease of the org a practice of the partner belongs to (NF-06): the upload page opened from the button «Carica i dati in
 * CasaZen» of ConcordatoFacile. It never retries: a 404 is the answer (wrong number, another org, service off) and every retry would
 * be one more read of the partner's status API; a failure leaves the user choosing the contract by hand.
 */
export function useCfPracticeLease(practiceId: string) {
  return useQuery({
    queryKey: CF_PRACTICE_LEASE_QUERY_KEY(practiceId),
    queryFn: () => ConcordatoFacileApi.lookupPracticeLease(practiceId),
    enabled: practiceId !== '',
    retry: false,
  });
}

/** Query key for CF status. */
export const CF_STATUS_QUERY_KEY = (leaseId: string) => ['concordatofacile', 'status', leaseId] as const;

/**
 * Get practice status for a lease (ADR-008-R15, ADR-008-R16).
 * Refetches on mount and polls based on nextUpdateAt. Asked only where the lease has the access and is the draft made for the
 * partner (the sheet of the contract, CF-FLOW): `enabled` keeps every other caller from reading the partner's API.
 */
export function useCfStatus(leaseId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: CF_STATUS_QUERY_KEY(leaseId),
    queryFn: () => ConcordatoFacileApi.getStatus(leaseId),
    refetchOnMount: true,
    enabled,
    // No retries when it fails (the server already tries three times): the sheet says the status is not available and goes on.
    retry: false,
    refetchInterval: (data) => {
      // Compute refetch interval from nextUpdateAt (ADR-008-R16)
      if (!data?.state?.data?.nextUpdateAt) return false;
      const nextUpdate = new Date(data.state.data.nextUpdateAt).getTime();
      const now = Date.now();
      return Math.max(0, nextUpdate - now);
    },
  });
}
