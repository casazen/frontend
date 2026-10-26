import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { routinesApi } from '@/api/routines.api';
import type { CreateRoutineDto, UpdateRoutineDto } from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const ROUTINES_KEY = 'routines';

export function useRoutines() {
  return useQuery({
    queryKey: [ROUTINES_KEY],
    queryFn: () => routinesApi.getAll(),
  });
}

export function useRoutine(id: string | undefined) {
  return useQuery({
    queryKey: [ROUTINES_KEY, id],
    queryFn: () => routinesApi.getById(id!),
    enabled: !!id,
  });
}

export function useRoutineExecutions(routineId: string | undefined) {
  return useQuery({
    queryKey: [ROUTINES_KEY, routineId, 'executions'],
    queryFn: () => routinesApi.getExecutions(routineId!),
    enabled: !!routineId,
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
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('routines.createError'));
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
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('routines.updateError'));
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
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('routines.deleteError'));
    },
  });
}

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
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('routines.toggleActiveError'));
    },
  });
}

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
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('routines.toggleTestModeError'));
    },
  });
}

export function useSimulateRoutine() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: object }) => routinesApi.simulate(id, payload),
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('routines.simulateError'));
    },
  });
}
