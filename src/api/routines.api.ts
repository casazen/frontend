import { ApiClient } from './client';
import type {
  Routine,
  CreateRoutineDto,
  UpdateRoutineDto,
  RoutineActionCatalogItem,
  RoutineExecution,
  RoutineSimulationResult,
} from '@/types';

export const routinesApi = {
  suggestAction: (instruction: string) =>
    ApiClient.post<{ type: 'CreateCleaningRequest' | 'RequestReview' | null }>('/routines/suggest-action', { instruction }),

  getAll: () => ApiClient.get<Routine[]>('/routines'),

  create: (dto: CreateRoutineDto) => ApiClient.post<Routine>('/routines', dto),

  update: (id: string, dto: UpdateRoutineDto) => ApiClient.put<Routine>(`/routines/${id}`, dto),

  delete: (id: string) => ApiClient.delete(`/routines/${id}`),

  /** Toggle active status */
  setActive: (id: string, active: boolean) => ApiClient.put<Routine>(`/routines/${id}/active`, { active }),

  /** Toggle test mode */
  setTestMode: (id: string, testMode: boolean) =>
    ApiClient.put<Routine>(`/routines/${id}/test-mode`, { testMode }),

  /** The actions a routine can hold, each with whether it can run today (`GET /routines/actions`): the same list the engine and the activation read. */
  getActionCatalog: () => ApiClient.get<RoutineActionCatalogItem[]>('/routines/actions'),

  /** Get execution log for a routine (the newest first, 50 at most) */
  getExecutions: (routineId: string) => ApiClient.get<RoutineExecution[]>(`/routines/${routineId}/executions`),

  /** Test mode simulation (dry run) */
  simulate: (routineId: string, samplePayload: object) =>
    ApiClient.post<RoutineSimulationResult>(`/routines/${routineId}/simulate`, samplePayload),
};
