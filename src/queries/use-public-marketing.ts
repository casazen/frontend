import { useMutation } from '@tanstack/react-query';
import { publicMarketingApi } from '@/api/public-marketing.api';
import type {
  ConfirmLinkParams,
  ConfirmResult,
  UnsubscribeLinkParams,
  UnsubscribeResult,
} from '@/types/public-marketing.types';

/**
 * The person stops the promotional e-mails with the signed values of the link (CRM-08). Sent once per click: a mutation never retries by
 * itself (`queryClient`). The values are only in the memory of the open page: no query key holds them, and the mutation is dropped from
 * the cache as soon as the page is closed (`gcTime: 0`).
 */
export function useUnsubscribe() {
  return useMutation<UnsubscribeResult, unknown, UnsubscribeLinkParams>({
    mutationFn: (params) => publicMarketingApi.unsubscribe(params),
    gcTime: 0,
  });
}

/** The person confirms the subscription with the signed values of the link (CRM-03, double opt-in); confirmed also when it already was. */
export function useConfirmSubscription() {
  return useMutation<ConfirmResult, unknown, ConfirmLinkParams>({
    mutationFn: (params) => publicMarketingApi.confirm(params),
    gcTime: 0,
  });
}
