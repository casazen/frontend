import { ApiClient } from './client';
import type { QuesturaCredentialsStatus, SetQuesturaCredentialsRequest } from '@/types/questura-credentials.types';

/** Alloggiati Web credentials of a property (CO-14): set, replace or remove; only the status is ever read. */
export const questuraCredentialsApi = {
  getStatus: (propertyId: string) =>
    ApiClient.get<QuesturaCredentialsStatus>(`/properties/${propertyId}/questura-credentials`),

  set: (propertyId: string, data: SetQuesturaCredentialsRequest) =>
    ApiClient.put<QuesturaCredentialsStatus>(`/properties/${propertyId}/questura-credentials`, data),

  remove: (propertyId: string) =>
    ApiClient.delete<void>(`/properties/${propertyId}/questura-credentials`),
};
