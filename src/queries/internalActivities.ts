import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { internalActivitiesApi } from '@/api/internal-activities.api';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { INTERNAL_ACTIVITIES_KEY } from '@/lib/query-client';

const TODO_POLL_MS = 60_000;

export function useMyActivities() {
  return useQuery({
    queryKey: [INTERNAL_ACTIVITIES_KEY, 'my-activities'],
    queryFn: () => internalActivitiesApi.getMyActivities(),
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
 * Open items excluding routine reminders, filtered by the server before pagination.
 * The caller's open "To do" items (E04/F01/US01/T01), already sorted by the server: the most urgent first, then by deadline. The
 * screens render this array as it is and never sort it again (ADR-026-R5). It is read again when a screen that shows it opens (a list
 * that other screens change: the client does not refetch on mount by default), after every successful write of the app
 * (`queryClient`, ADR-026-R7), on the window focus, and every {@link TODO_POLL_MS} while the page is visible.
 */
export function useActivities({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [INTERNAL_ACTIVITIES_KEY, 'todo'],
    queryFn: () => internalActivitiesApi.getPending(true),
    enabled,
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: TODO_POLL_MS,
  });
}

/**
 * Excludes routine reminders, as the list does.
 * The number on the nav badge: how many of the caller's items are urgent (`High`). It answers `{ count }`; a screen that gets
 * anything else shows no number. The nav is always on screen, so it is the one that keeps the number fresh: on focus, when the
 * network comes back and every {@link TODO_POLL_MS}.
 */
export function useActivityCount({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [INTERNAL_ACTIVITIES_KEY, 'todo-count'],
    queryFn: () => internalActivitiesApi.getUrgentCount(true),
    enabled,
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: TODO_POLL_MS,
  });
}
