import { ApiClient } from './client';

export interface InternalActivity {
  id: string;
  orgId: string;
  propertyId: string;
  bookingId: string | null;
  staffUserId: string;
  activityType: string;
  internalRate: number | null;
  rechargeToOwner: boolean;
  status: string;
  notes: string | null;
  scheduledAt: string;
  completedAt: string | null;
  createdAt: string;
  createdByUserId: string | null;
}

export interface UpdateStatusDto {
  status: string;
  notes?: string;
}

export type ActivityUrgency = 'Low' | 'Medium' | 'High';

export interface TodoActivity {
  id: string;
  activityType: string;
  action: string;
  entityType: string;
  entityId: string;
  propertyId: string | null;
  dueAt: string | null;
  scheduledAt?: string | null;
  urgency: ActivityUrgency;
  /** Why it was raised, one line: a code or a short text, never personal data. */
  reason: string | null;
  createdAt: string;
}

export interface TodoCount {
  count: number;
}

export const internalActivitiesApi = {
  getMyActivities: () => ApiClient.get<InternalActivity[]>('/internal-activities/my-activities'),

  getActivity: (id: string) => ApiClient.get<InternalActivity>(`/internal-activities/${id}`),

  updateStatus: (id: string, data: UpdateStatusDto) =>
    ApiClient.put<InternalActivity>(`/internal-activities/${id}/status`, data),

  getPending: (excludeRoutineTasks = false) => ApiClient.get<TodoActivity[]>('/me/activities', excludeRoutineTasks ? { excludeRoutineTasks } : undefined),

  getUrgentCount: (excludeRoutineTasks = false) => ApiClient.get<TodoCount>('/me/activities/count', excludeRoutineTasks ? { excludeRoutineTasks } : undefined),
};
