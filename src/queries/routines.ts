import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { routinesApi } from '@/api/routines.api';
import type { CreateRoutineDto, UpdateRoutineDto } from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { describeRoutineError } from '@/lib/routine-errors';

const ROUTINES_KEY = 'routines';
/** Outside the key of the routines, so that a change to a routine never reads the catalog again. */
const ROUTINE_ACTIONS_KEY = 'routine-actions';

/** How long the list of the routines and the log of one are fresh: they change by what the host does and by the events of the stays, so a page that is opened reads them again. */
const ROUTINES_STALE_TIME = 30 * 1000;

export function useRoutines() {
  return useQuery({
    queryKey: [ROUTINES_KEY],
    queryFn: () => routinesApi.getAll(),
    staleTime: ROUTINES_STALE_TIME,
    // The page is opened from a menu and read again every time: a routine changed or deleted elsewhere must not stay on screen.
    refetchOnMount: 'always',
  });
}

export function useRoutine(id: string | undefined) {
  return useQuery({
    queryKey: [ROUTINES_KEY, id],
    queryFn: () => routinesApi.getById(id!),
    enabled: !!id,
    staleTime: ROUTINES_STALE_TIME,
    refetchOnMount: 'always',
  });
}

/**
 * The actions a routine can hold and whether each can run today (`GET /routines/actions`). It says what the server can do, which changes with a deploy or a flag and
 * not while a person works: it is read once for the session.
 */
export function useRoutineActions() {
  return useQuery({
    queryKey: [ROUTINE_ACTIONS_KEY],
    queryFn: () => routinesApi.getActionCatalog(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useRoutineExecutions(routineId: string | undefined) {
  return useQuery({
    queryKey: [ROUTINES_KEY, routineId, 'executions'],
    queryFn: () => routinesApi.getExecutions(routineId!),
    enabled: !!routineId,
    staleTime: ROUTINES_STALE_TIME,
    refetchOnMount: 'always',
  });
}

export function useCreateRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateRoutineDto) => routinesApi.create(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ROUTINES_KEY] });
      toast.success(i18n.t('routines.createSuccess'));
    },
    onError: (error) => {
      toast.error(describeRoutineError(error, i18n.t) ?? i18n.t('routines.createError'));
    },
  });
}

export function useUpdateRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateRoutineDto }) => routinesApi.update(id, dto),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [ROUTINES_KEY] });
      void queryClient.invalidateQueries({ queryKey: [ROUTINES_KEY, variables.id] });
      toast.success(i18n.t('routines.updateSuccess'));
    },
    onError: (error) => {
      toast.error(describeRoutineError(error, i18n.t) ?? i18n.t('routines.updateError'));
    },
  });
}

export function useDeleteRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => routinesApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ROUTINES_KEY] });
      toast.success(i18n.t('routines.deleteSuccess'));
    },
    onError: (error) => {
      toast.error(describeRoutineError(error, i18n.t) ?? i18n.t('routines.deleteError'));
    },
  });
}

/** Switching on can be refused (422 `routine_action_not_available`): the routine stays off and the host is told which actions cannot run yet. */
export function useSetRoutineActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => routinesApi.setActive(id, active),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [ROUTINES_KEY] });
      void queryClient.invalidateQueries({ queryKey: [ROUTINES_KEY, variables.id] });
      toast.success(i18n.t(variables.active ? 'routines.activatedSuccess' : 'routines.deactivatedSuccess'));
    },
    onError: (error) => {
      toast.error(describeRoutineError(error, i18n.t) ?? i18n.t('routines.toggleActiveError'));
    },
  });
}

/** Switching test mode off on a routine that is on is refused in the same way as switching it on. */
export function useSetRoutineTestMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, testMode }: { id: string; testMode: boolean }) => routinesApi.setTestMode(id, testMode),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [ROUTINES_KEY] });
      void queryClient.invalidateQueries({ queryKey: [ROUTINES_KEY, variables.id] });
      toast.success(i18n.t(variables.testMode ? 'routines.testModeOnSuccess' : 'routines.testModeOffSuccess'));
    },
    onError: (error) => {
      toast.error(describeRoutineError(error, i18n.t) ?? i18n.t('routines.toggleTestModeError'));
    },
  });
}

export function useSimulateRoutine() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: object }) => routinesApi.simulate(id, payload),
    onError: (error) => {
      toast.error(describeRoutineError(error, i18n.t) ?? i18n.t('routines.simulateError'));
    },
  });
}
