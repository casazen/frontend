import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { propertySenderApi } from '@/api/property-sender.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { COMPLIANCE_HEALTH_KEY } from '@/queries/compliance-health';
import type { PropertySender, SenderConnectionTest, SwitchSenderRequest } from '@/types';

/** Root of the query key of the sender: one key for each property. */
export const PROPERTY_SENDER_KEY = 'property-sender';

const senderKey = (propertyId: string) => [PROPERTY_SENDER_KEY, propertyId] as const;

/**
 * The sender of a property (E03/F01/US02/T01). It is read again every time the wizard opens (the host may have changed it on another screen or in the channel
 * manager) and a read less than half a minute old is fresh; a return to the tab does not read it again, because for a channel-manager property each read asks
 * the channel manager (bounded in time): the steps ask again when they need to. `enabled` is false for who may not read the property: nothing is asked then.
 * What an error leaves in the cache is not an answer: the screens look at the error first (a 404 is «not found» whatever the cache still holds). `null` is the answer for a property the
 * caller does not reach (the read of a 403): also «not found» for the person.
 */
export function useSender(propertyId: string, enabled = true) {
  return useQuery({
    queryKey: senderKey(propertyId),
    queryFn: () => propertySenderApi.get(propertyId),
    enabled: enabled && propertyId !== '',
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
}

/** What a change of the sender changes elsewhere: the sender itself, the connection health of the property page and the cockpit of the adempimenti. */
function refreshAfterChange(queryClient: QueryClient, propertyId: string): void {
  void queryClient.invalidateQueries({ queryKey: senderKey(propertyId) });
  void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_HEALTH_KEY, propertyId] });
  void queryClient.invalidateQueries({ queryKey: ['compliance'] });
}

/**
 * Changes who sends (`PUT`). The body is the host's consent to the delegation and its confirmation that the other sender goes off: the mutation is dropped as soon as nothing
 * observes it (`gcTime: 0`, not five minutes in the cache of the mutations) and a refusal is kept without the request that was sent (`withoutRequest`: the status and the
 * body of the answer stay, which is what the screen turns into words, the 409 that asks for a confirmation or for the new text included).
 */
export function useSwitchSender(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (request: SwitchSenderRequest) => {
      try {
        return await propertySenderApi.switch(propertyId, request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (sender: PropertySender) => {
      queryClient.setQueryData<PropertySender>(senderKey(propertyId), sender);
      refreshAfterChange(queryClient, propertyId);
    },
  });
}

/**
 * The connection test (`POST`): it reads the police account on the channel manager and stores nothing. It is a mutation so that it runs when the host asks, never by
 * itself; what it answers is the screen's, and the sender is read again after it (the read asks the channel manager too).
 */
export function useTestConnection(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (): Promise<SenderConnectionTest> => {
      try {
        return await propertySenderApi.testConnection(propertyId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () => refreshAfterChange(queryClient, propertyId),
  });
}

/** The host says it saw «Attivato» in the panel of the channel manager (`POST`): the sender answers `Declared`, never `Active`. */
export function useDeclareActivated(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async () => {
      try {
        return await propertySenderApi.declareActivated(propertyId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (sender: PropertySender) => {
      queryClient.setQueryData<PropertySender>(senderKey(propertyId), sender);
      refreshAfterChange(queryClient, propertyId);
    },
  });
}
