import { ApiClient } from './client';
import type {
  Routine,
  CreateRoutineDto,
  UpdateRoutineDto,
  RoutineExecution,
  RoutineSimulationResult,
} from '@/types';

export const routinesApi = {
  getAll: () => ApiClient.get<Routine[]>('/routines'),

  getById: (id: string) => ApiClient.get<Routine>(`/routines/${id}`),

  create: (dto: CreateRoutineDto) => ApiClient.post<Routine>('/routines', dto),

  update: (id: string, dto: UpdateRoutineDto) => ApiClient.put<Routine>(`/routines/${id}`, dto),

  delete: (id: string) => ApiClient.delete(`/routines/${id}`),

  /** Toggle active status */
  setActive: (id: string, active: boolean) => ApiClient.put<Routine>(`/routines/${id}/active`, { active }),

  /** Toggle test mode */
  setTestMode: (id: string, testMode: boolean) =>
    ApiClient.put<Routine>(`/routines/${id}/test-mode`, { testMode }),

  /** Get execution log for a routine */
  getExecutions: (routineId: string) => ApiClient.get<RoutineExecution[]>(`/routines/${routineId}/executions`),

  /** Test mode simulation (dry run) */
  simulate: (routineId: string, samplePayload: object) =>
    ApiClient.post<RoutineSimulationResult>(`/routines/${routineId}/simulate`, samplePayload),
};
