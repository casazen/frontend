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
const BILLING_SUBSCRIPTION_QUERY_KEY = ['billing', 'subscription'] as const;

export function useBillingPlans(enabled = true) {
  return useQuery({
    queryKey: BILLING_PLANS_QUERY_KEY,
    queryFn: () => BillingApi.getPlans(),
    enabled,
  });
}

interface SubscriptionQueryOptions {
  enabled?: boolean;
  pollInterval?: (subscription: BillingSubscription | undefined) => number | false;
}

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

export function useStartCheckout() {
  return useMutation({
    mutationFn: (request: CheckoutSessionRequest) => BillingApi.createCheckoutSession(request),
    onSuccess: ({ checkoutUrl }) => redirectToStripe(checkoutUrl),
  });
}

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

export function useRefreshPlanAfterPayment() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
  }, [queryClient]);
}
