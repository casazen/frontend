import { ApiClient } from '@/api/client';
import {
  parseMaintenanceRequest,
  parseMaintenanceRequestList,
  type CreateMaintenanceRequestInput,
  type MaintenanceDecisionInput,
  type MaintenanceRequest,
} from './model';

function collectionPath(leaseId: string): string {
  return `/leases/${encodeURIComponent(leaseId)}/maintenance-requests`;
}

function requestPath(leaseId: string, requestId: string): string {
  return `${collectionPath(leaseId)}/${encodeURIComponent(requestId)}`;
}

function asRequest(value: unknown): MaintenanceRequest {
  const parsed = parseMaintenanceRequest(value);
  if (!parsed) throw new Error('maintenance-request');
  return parsed;
}

export const maintenanceRequestsApi = {
  list: async (leaseId: string): Promise<MaintenanceRequest[]> =>
    parseMaintenanceRequestList(await ApiClient.get<unknown>(collectionPath(leaseId))),

  create: async (leaseId: string, input: CreateMaintenanceRequestInput): Promise<MaintenanceRequest> => {
    const photo = input.photo ?? null;
    if (photo) {
      const form = new FormData();
      form.append('what', input.what);
      form.append('urgency', input.urgency);
      form.append('note', input.note);
      form.append('photo', photo, photo.name);
      return asRequest(
        await ApiClient.post<unknown>(collectionPath(leaseId), form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
      );
    }
    return asRequest(
      await ApiClient.post<unknown>(collectionPath(leaseId), {
        what: input.what,
        urgency: input.urgency,
        note: input.note,
      }),
    );
  },

  decide: async (leaseId: string, requestId: string, input: MaintenanceDecisionInput): Promise<MaintenanceRequest> =>
    asRequest(
      await ApiClient.post<unknown>(`${requestPath(leaseId, requestId)}/decision`, {
        decision: input.decision,
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    ),

  pay: async (leaseId: string, requestId: string): Promise<MaintenanceRequest> =>
    asRequest(await ApiClient.post<unknown>(`${requestPath(leaseId, requestId)}/payment`, {})),
};
