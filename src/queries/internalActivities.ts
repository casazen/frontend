import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { internalActivitiesApi } from '@/api/internal-activities.api';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { INTERNAL_ACTIVITIES_KEY } from '@/lib/query-client';

/**
 * How often the "To do" list and the number on the nav are read again while the page is visible. An item closes by itself when its
 * condition is met, but the server dispatches the events of the condition about once a minute (ADR-022, ADR-026): a read right after
 * the write may still show the item, the next ones do not. The window focus and the network coming back read it again too.
 */
export const TODO_POLL_MS = 60_000;

export function useMyActivities() {
  return useQuery({
    queryKey: [INTERNAL_ACTIVITIES_KEY, 'my-activities'],
    queryFn: () => internalActivitiesApi.getMyActivities(),
  });
}

export function useActivityDetail(id: string) {
  return useQuery({
    queryKey: [INTERNAL_ACTIVITIES_KEY, id],
    queryFn: () => internalActivitiesApi.getActivity(id),
    enabled: !!id,
  });
}

export function useUpdateActivityStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      internalActivitiesApi.updateStatus(id, { status, notes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [INTERNAL_ACTIVITIES_KEY] });
      toast.success(i18n.t('activity.statusUpdateSuccess'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('activity.statusUpdateError'));
    },
  });
}

/**
 * The caller's open "To do" items (E04/F01/US01/T01), already sorted by the server: the most urgent first, then by deadline. The
 * screens render this array as it is and never sort it again (ADR-026-R5). It is read again when a screen that shows it opens (a list
 * that other screens change: the client does not refetch on mount by default), after every successful write of the app
 * (`queryClient`, ADR-026-R7), on the window focus, and every {@link TODO_POLL_MS} while the page is visible.
 */
export function useActivities({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [INTERNAL_ACTIVITIES_KEY, 'todo'],
    queryFn: () => internalActivitiesApi.getPending(),
    enabled,
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: TODO_POLL_MS,
  });
}

/**
 * The number on the nav badge: how many of the caller's items are urgent (`High`). It answers `{ count }`; a screen that gets
 * anything else shows no number. The nav is always on screen, so it is the one that keeps the number fresh: on focus, when the
 * network comes back and every {@link TODO_POLL_MS}.
 */
export function useActivityCount({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [INTERNAL_ACTIVITIES_KEY, 'todo-count'],
    queryFn: () => internalActivitiesApi.getUrgentCount(),
    enabled,
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: TODO_POLL_MS,
  });
}

/**
 * "Segna come fatto": closes one item by hand. It takes the item off the list of the whole organization, so it asks the permission to
 * write the properties (`property.write` of Affitti brevi): the card offers it only to who holds it and the endpoint must ask the same,
 * a refusal (403) being told by the error toast. The list and the number are read again whatever the answer: when the item was already
 * closed or is not the caller's any more (404), reading the list is what takes it off the screen.
 */
export function useCloseActivity(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => internalActivitiesApi.close(id),
    onSuccess: () => {
      toast.success(i18n.t('activity.todo.closed'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('activity.todo.closeError'));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [INTERNAL_ACTIVITIES_KEY] }),
  });
}
