import { useMemo } from 'react';
import { useMutation, useMutationState, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { scheduledMessagesApi } from '@/api/scheduled-messages.api';
import { hasOpenMessage, isAboutToChange } from '@/features/bookings/lib/scheduled-messages';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import i18n from '@/i18n/config';
import { INTERNAL_ACTIVITIES_KEY, retryTransientErrors } from '@/lib/query-client';

export const SCHEDULED_MESSAGES_KEY = 'scheduled-messages';

const WRITE_KEY = [SCHEDULED_MESSAGES_KEY, 'write'] as const;

export const SCHEDULED_MESSAGES_STALE_MS = 30_000;

export const SCHEDULED_MESSAGES_POLL_MS = 60_000;

export const SCHEDULED_MESSAGES_SLOW_POLL_MS = 300_000;

/**
 * The messages the routines will send to the guest of a booking (`GET /api/bookings/{id}/scheduled-messages`, NF-71), in time order. `enabled` is false while the flag
 * `scheduledMessages` is off or the person cannot read the booking: nothing is asked then.
 *
 * It is read again every time the section opens (`refetchOnMount: 'always'`: `true` would read only data that is stale, and the list of the last visit would be shown), on return to the
 * window, when the bell announces a message that was held back (`use-notifications-realtime`), every minute while a message is about to change by itself and every five minutes while some message can
 * still change (planned, held back or failed): the pace is chosen again after every read, because the interval is not asked again as the clock moves. The texts are the words
 * of messages written for a guest: the reading is dropped as soon as no page shows it (`gcTime: 0`, the app keeps unobserved data for ten minutes otherwise).
 */
export function useScheduledMessages(bookingId: string, enabled: boolean) {
  return useQuery({
    queryKey: [SCHEDULED_MESSAGES_KEY, bookingId],
    queryFn: () => scheduledMessagesApi.list(bookingId),
    enabled: enabled && Boolean(bookingId),
    staleTime: SCHEDULED_MESSAGES_STALE_MS,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const messages = query.state.data;
      if (!hasOpenMessage(messages)) return false;
      return isAboutToChange(messages, new Date()) ? SCHEDULED_MESSAGES_POLL_MS : SCHEDULED_MESSAGES_SLOW_POLL_MS;
    },
    retry: retryTransientErrors(1),
  });
}

interface WriteVariables {
  bookingId: string;
  id: string;
}

interface EditVariables extends WriteVariables {
  text: string | null;
}

function messageIdOf(variables: unknown): string | undefined {
  const id = typeof variables === 'object' && variables !== null ? (variables as { id?: unknown }).id : undefined;
  return typeof id === 'string' ? id : undefined;
}

export function useScheduledMessageIdsBeingWritten(): ReadonlySet<string> {
  const ids = useMutationState({
    filters: { mutationKey: [...WRITE_KEY], status: 'pending' },
    select: (mutation) => messageIdOf(mutation.state.variables),
  });
  return useMemo(() => new Set(ids.filter((id): id is string => id !== undefined)), [ids]);
}

/**
 * What a write makes stale. The list of the booking is read again and the promise ends when that reading has: the `onSettled` of every write returns it, so the write stays pending (and the buttons of the
 * card wait) until the list shows the message as it is now: a message that went out is never left on the screen with its buttons on for the time the list takes to come back. A blocked message has a
 * «To do» that closes or opens with the write, so the list and the number of the menu are read again too (without restarting a reading that is already on its way).
 */
function refreshAfterWrite(queryClient: QueryClient, bookingId: string): Promise<void> {
  void queryClient.invalidateQueries({ queryKey: [INTERNAL_ACTIVITIES_KEY] }, { cancelRefetch: false });
  return queryClient.invalidateQueries({ queryKey: [SCHEDULED_MESSAGES_KEY, bookingId] });
}

/**
 * Changes the text of ONE message for its booking (`PUT /api/scheduled-messages/{id}`), or clears the change with a `null` text so that the message goes back to the template of the routine.
 * The text is the host's own words for a guest: the mutation is dropped as soon as nothing observes it (`gcTime: 0`, the cache of the mutations keeps results for five minutes otherwise) and a
 * refusal is kept without the request that carried it (`withoutRequest`: the status and the body of the answer stay, which is what a screen turns into words).
 */
export function useEditScheduledMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...WRITE_KEY, 'edit'],
    gcTime: 0,
    mutationFn: async ({ id, text }: EditVariables) => {
      try {
        return await scheduledMessagesApi.edit(id, text);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (_message, variables) => {
      toast.success(i18n.t(variables.text === null ? 'booking.scheduledMessages.edit.restored' : 'booking.scheduledMessages.edit.saved'));
    },
    onSettled: (_message, _error, variables) => refreshAfterWrite(queryClient, variables.bookingId),
  });
}

export function useSkipScheduledMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...WRITE_KEY, 'skip'],
    gcTime: 0,
    mutationFn: async ({ id }: WriteVariables) => {
      try {
        return await scheduledMessagesApi.skip(id);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (message) => {
      if (message.status === 'Skipped') toast.success(i18n.t('booking.scheduledMessages.skip.done'));
      else toast.warning(i18n.t('booking.scheduledMessages.skip.notDone'));
    },
    onSettled: (_message, _error, variables) => refreshAfterWrite(queryClient, variables.bookingId),
  });
}

export function useSendScheduledMessageNow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...WRITE_KEY, 'send-now'],
    gcTime: 0,
    mutationFn: async ({ id }: WriteVariables) => {
      try {
        return await scheduledMessagesApi.sendNow(id);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (message) => {
      if (message.status === 'Sent') toast.success(i18n.t('booking.scheduledMessages.sendNow.done'));
      else if (message.status === 'Failed') toast.error(i18n.t('booking.scheduledMessages.sendNow.failed'));
      else toast.warning(i18n.t('booking.scheduledMessages.sendNow.notSent'));
    },
    onSettled: (_message, _error, variables) => refreshAfterWrite(queryClient, variables.bookingId),
  });
}
