import { useCommercialProfile } from '@/hooks/use-commercial-profile';
import { commercialRouteAllowed } from '@/features/onboarding/commercial-access';
import { useMemo } from 'react';
import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { routinesApi } from '@/api/routines.api';
import type { CreateRoutineDto, UpdateRoutineDto } from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { describeRoutineError } from '@/lib/routine-errors';

const ROUTINES_KEY = 'routines';
/** Outside the key of the routines, so that a change to a routine never reads the catalog again. */
const ROUTINE_ACTIONS_KEY = 'routine-actions';
const ROUTINE_WRITE_KEY = [ROUTINES_KEY, 'write'] as const;

const ROUTINES_STALE_TIME = 30 * 1000;

export function useRoutines(enabled = true) {
  const profile = useCommercialProfile();
  return useQuery({
    queryKey: [ROUTINES_KEY],
    queryFn: () => routinesApi.getAll(),
    enabled: enabled && commercialRouteAllowed(profile, '/app/short-rent/automations'),
    staleTime: ROUTINES_STALE_TIME,
    refetchOnMount: 'always',
  });
}

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

function routineIdOf(variables: unknown): string | undefined {
  if (typeof variables === 'string') return variables;
  const id = typeof variables === 'object' && variables !== null ? (variables as { id?: unknown }).id : undefined;
  return typeof id === 'string' ? id : undefined;
}

export function useRoutineIdsBeingWritten(): ReadonlySet<string> {
  const ids = useMutationState({
    filters: { mutationKey: [...ROUTINE_WRITE_KEY], status: 'pending' },
    select: (mutation) => routineIdOf(mutation.state.variables),
  });
  return useMemo(() => new Set(ids.filter((id): id is string => id !== undefined)), [ids]);
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
    mutationKey: [...ROUTINE_WRITE_KEY, 'update'],
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
    mutationKey: [...ROUTINE_WRITE_KEY, 'delete'],
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

export function useSetRoutineActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...ROUTINE_WRITE_KEY, 'set-active'],
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

export function useSetRoutineTestMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...ROUTINE_WRITE_KEY, 'set-test-mode'],
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
