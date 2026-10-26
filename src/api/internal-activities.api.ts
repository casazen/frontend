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

export const internalActivitiesApi = {
  getMyActivities: () => ApiClient.get<InternalActivity[]>('/internal-activities/my-activities'),

  getActivity: (id: string) => ApiClient.get<InternalActivity>(`/internal-activities/${id}`),

  updateStatus: (id: string, data: UpdateStatusDto) =>
    ApiClient.put<InternalActivity>(`/internal-activities/${id}/status`, data),
};
