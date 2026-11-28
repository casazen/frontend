import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { guestRegistrationApi } from '@/api/guest-registration.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { GuestNotificationOverride } from '@/types/guest-registration.types';

export const guestRegistrationKey = (propertyId: string) => ['properties', propertyId, 'guest-registration'] as const;

const CARD_STALE_TIME = 30 * 1000;

/**
 * The regime of a property and the host's setting (`GET api/properties/{id}/guest-registration`). Read again every time the card opens
 * (`refetchOnMount: 'always'`), and a read that fails is not the old answer: a screen reads `isError` before `data` (TanStack Query keeps the old data on
 * an error, and a 404 or a 403 must never be told with it). `enabled` is false for a screen that must not ask (the flag is off, the person may not read).
 */
export function useGuestRegistration(propertyId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: guestRegistrationKey(propertyId),
    queryFn: () => guestRegistrationApi.get(propertyId),
    enabled: propertyId !== '' && (options.enabled ?? true),
    staleTime: CARD_STALE_TIME,
    refetchOnMount: 'always',
  });
}

/**
 * Saves the host's setting (`PUT api/properties/{id}/guest-registration`): `Required`, `NotRequired` or `null` (follow the regime again). The mutation is
 * not kept once nothing observes it (`gcTime: 0`) and a refusal is kept without the request that was sent (`withoutRequest`): the status and the body of the
 * answer stay, the body of the request does not. No toast: the card says how it went. Whatever the answer the card is read again, so it shows what the server
 * holds, never what the person hoped; the cockpit and the activation read the duty too, so they are marked stale.
 */
export function useSetGuestRegistrationOverride(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationKey: [...guestRegistrationKey(propertyId), 'override'],
    mutationFn: async (override: GuestNotificationOverride | null) => {
      try {
        return await guestRegistrationApi.setOverride(propertyId, override);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(guestRegistrationKey(propertyId), saved);
      void queryClient.invalidateQueries({ queryKey: ['compliance'] });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: guestRegistrationKey(propertyId) }),
  });
}
