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

  setActive: (id: string, active: boolean) => ApiClient.put<Routine>(`/routines/${id}/active`, { active }),

  setTestMode: (id: string, testMode: boolean) =>
    ApiClient.put<Routine>(`/routines/${id}/test-mode`, { testMode }),

  getActionCatalog: () => ApiClient.get<RoutineActionCatalogItem[]>('/routines/actions'),

  getExecutions: (routineId: string) => ApiClient.get<RoutineExecution[]>(`/routines/${routineId}/executions`),

  simulate: (routineId: string, samplePayload: object) =>
    ApiClient.post<RoutineSimulationResult>(`/routines/${routineId}/simulate`, samplePayload),
};
