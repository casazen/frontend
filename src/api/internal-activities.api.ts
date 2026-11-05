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

/** How urgent a "To do" item is: the name of an `ActivityUrgency` of the backend. The nav counter counts only `High` (ADR-026-R12). */
export type ActivityUrgency = 'Low' | 'Medium' | 'High';

/**
 * An item of the "To do" list as `GET /api/me/activities` answers it (E04/F01/US01/T01, ADR-026-R3): what it is, where its "Do now"
 * leads and what it is about, by type and id. No person, no staff data (`staffUserId`, rate, notes): the detail of the entity is read
 * from the API of the entity. The server sorts the list (most urgent first, then by deadline, then by creation) and the client keeps that
 * order (ADR-026-R5).
 */
export interface TodoActivity {
  id: string;
  /** What it is: the name of an `ActivityType` of the backend (`CheckInPending`, `AlloggiatiDeadline`, ...). */
  activityType: string;
  /** Where "Do now" leads: the name of an `ActivityAction` of the backend; a later version may send one this app does not know yet. */
  action: string;
  /** The kind of entity it is about (`Booking`, ...). */
  entityType: string;
  /** The id of that entity. */
  entityId: string;
  /** The property, `null` for an item of the whole account (a lost channel connection). */
  propertyId: string | null;
  /** The deadline (UTC instant), when it has one. */
  dueAt: string | null;
  urgency: ActivityUrgency;
  /** Why it was raised, one line: a code or a short text, never personal data. */
  reason: string | null;
  createdAt: string;
}

/** `GET /api/me/activities/count`: how many of the caller's open items are urgent. */
export interface TodoCount {
  count: number;
}

export const internalActivitiesApi = {
  getMyActivities: () => ApiClient.get<InternalActivity[]>('/internal-activities/my-activities'),

  getActivity: (id: string) => ApiClient.get<InternalActivity>(`/internal-activities/${id}`),

  updateStatus: (id: string, data: UpdateStatusDto) =>
    ApiClient.put<InternalActivity>(`/internal-activities/${id}/status`, data),

  /** The open "To do" items the caller reaches (HostScope), sorted by the server. */
  getPending: () => ApiClient.get<TodoActivity[]>('/me/activities'),

  /** The number on the nav badge: the urgent ones among them. */
  getUrgentCount: () => ApiClient.get<TodoCount>('/me/activities/count'),

  /** Closes one item by hand (204; an item already closed answers 204 too, one the caller does not reach 404). */
  close: (id: string) => ApiClient.post<void>(`/me/activities/${id}/close`),
};
