import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BillingApi } from '@/api/billing.api';
import i18n from '@/i18n/config';
import {
  getPortalErrorMessage,
  getProfileErrorMessage,
  normalizeSubscriptionStatus,
  redirectToStripe,
} from '@/features/billing/billing-utils';
import { ME_QUERY_KEY } from '@/lib/onboarding-gate';
import { ENTITLEMENT_QUERY_KEY } from '@/queries/use-users';
import type { BillingProfileRequest, BillingSubscription, CheckoutSessionRequest } from '@/types';

export const BILLING_PLANS_QUERY_KEY = ['billing', 'plans'] as const;
export const BILLING_SUBSCRIPTION_QUERY_KEY = ['billing', 'subscription'] as const;

/** Plans with their price and whether they can be bought in this environment. */
export function useBillingPlans(enabled = true) {
  return useQuery({
    queryKey: BILLING_PLANS_QUERY_KEY,
    queryFn: () => BillingApi.getPlans(),
    enabled,
  });
}

interface SubscriptionQueryOptions {
  enabled?: boolean;
  /** Polling interval for the last subscription read (e.g. while a checkout waits for the Stripe webhook); `false` stops it. */
  pollInterval?: (subscription: BillingSubscription | undefined) => number | false;
}

/** Subscription of the org, always read again: the real state after a checkout or a visit to the portal. */
export function useBillingSubscription({ enabled = true, pollInterval }: SubscriptionQueryOptions = {}) {
  return useQuery({
    queryKey: BILLING_SUBSCRIPTION_QUERY_KEY,
    queryFn: async (): Promise<BillingSubscription> => {
      const subscription = await BillingApi.getSubscription();
      return { ...subscription, status: normalizeSubscriptionStatus(subscription.status) };
    },
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: pollInterval ? (query) => pollInterval(query.state.data) : false,
  });
}

/**
 * Starts the Stripe Checkout and leaves the app for it. Errors are handled by the page (409 `already_subscribed`,
 * 409 `billing_gate_closed`, 422 `billing_plan_unavailable`).
 */
export function useStartCheckout() {
  return useMutation({
    mutationFn: (request: CheckoutSessionRequest) => BillingApi.createCheckoutSession(request),
    onSuccess: ({ checkoutUrl }) => redirectToStripe(checkoutUrl),
  });
}

/**
 * Opens the Stripe billing portal (plan change, payment method, open invoices). `returnPath`: the plan or billing page
 * the portal links back to, i.e. the calling page (PL-16).
 */
export function useOpenBillingPortal(returnPath?: string) {
  return useMutation({
    mutationFn: () => BillingApi.createPortalSession(returnPath),
    onSuccess: ({ portalUrl }) => redirectToStripe(portalUrl),
    onError: (error) => {
      toast.error(getPortalErrorMessage(error, i18n.t));
    },
  });
}

/** Country and VAT id of the org, used for the subscription invoices. */
export function useUpdateBillingProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: BillingProfileRequest) => BillingApi.updateProfile(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BILLING_SUBSCRIPTION_QUERY_KEY });
      toast.success(i18n.t('billing.profile.saved'));
    },
    onError: (error) => {
      toast.error(getProfileErrorMessage(error, i18n.t));
    },
  });
}

/** The plan changed on Stripe: the effective tier of the profile and the entitlement are read again. */
export function useRefreshPlanAfterPayment() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
  }, [queryClient]);
}
