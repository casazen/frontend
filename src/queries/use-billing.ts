import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BillingApi } from '@/api/billing.api';
import type { CheckoutSessionRequest, UpdateBillingProfileRequest } from '@/types/billing.types';
import { ENTITLEMENT_QUERY_KEY } from '@/queries/use-users';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

export const BILLING_PLANS_KEY = ['billing', 'plans'] as const;
export const BILLING_SUBSCRIPTION_KEY = ['billing', 'subscription'] as const;

function billingErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as { error?: string; detail?: string } | undefined;
    if (body?.error) return body.error;
    if (body?.detail) return body.detail;
  }
  return fallback;
}

export function useBillingPlans() {
  return useQuery({
    queryKey: BILLING_PLANS_KEY,
    queryFn: () => BillingApi.getPlans(),
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: BILLING_SUBSCRIPTION_KEY,
    queryFn: () => BillingApi.getSubscription(),
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: (data: CheckoutSessionRequest) => BillingApi.createCheckoutSession(data),
    onSuccess: (data) => {
      window.location.assign(data.checkoutUrl);
    },
    onError: (error) => {
      toast.error(billingErrorMessage(error, 'Impossibile avviare il checkout'));
    },
  });
}

export function useOpenPortal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => BillingApi.createPortalSession(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: BILLING_SUBSCRIPTION_KEY });
      window.location.assign(data.portalUrl);
    },
    onError: (error) => {
      toast.error(billingErrorMessage(error, 'Impossibile aprire il portale di fatturazione'));
    },
  });
}

export function useUpdateBillingProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateBillingProfileRequest) => BillingApi.updateBillingProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BILLING_SUBSCRIPTION_KEY });
    },
    onError: (error) => {
      toast.error(billingErrorMessage(error, 'Impossibile aggiornare il profilo di fatturazione'));
    },
  });
}

export function useInvalidateBillingOnCheckoutSuccess() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: BILLING_SUBSCRIPTION_KEY });
    queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ['me'] });
  };
}
