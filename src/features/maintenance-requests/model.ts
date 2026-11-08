/** Wire values of a maintenance request on `POST/GET /leases/{leaseId}/maintenance-requests`. */

export const MAINTENANCE_URGENCIES = ['bassa', 'normale', 'urgente'] as const;
export type MaintenanceUrgency = (typeof MAINTENANCE_URGENCIES)[number];

export const MAINTENANCE_STATUSES = ['pending', 'approved', 'rejected', 'paid'] as const;
export type MaintenanceRequestStatus = (typeof MAINTENANCE_STATUSES)[number];

export interface MaintenanceRequest {
  id: string;
  leaseId: string;
  what: string;
  urgency: MaintenanceUrgency;
  note: string;
  photoName: string | null;
  status: MaintenanceRequestStatus;
  /** Why the landlord or the agency rejected the request. Empty unless the status is `rejected`. */
  reason: string | null;
  createdAt: string;
}

export interface CreateMaintenanceRequestInput {
  what: string;
  urgency: MaintenanceUrgency;
  note: string;
  photo?: File | null;
}

export interface MaintenanceDecisionInput {
  decision: 'approved' | 'rejected';
  reason?: string;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseMaintenanceUrgency(value: unknown): MaintenanceUrgency {
  const raw = textOf(value).toLowerCase();
  if (raw === 'bassa' || raw === 'low') return 'bassa';
  if (raw === 'urgente' || raw === 'urgent' || raw === 'high' || raw === 'emergency') return 'urgente';
  return 'normale';
}

export function parseMaintenanceStatus(value: unknown): MaintenanceRequestStatus {
  const raw = textOf(value).toLowerCase().replace(/[\s_-]/g, '');
  if (raw === 'approved' || raw === 'approvata' || raw === 'accepted') return 'approved';
  if (raw === 'rejected' || raw === 'rifiutata') return 'rejected';
  if (raw === 'paid' || raw === 'pagata') return 'paid';
  return 'pending';
}

/** One request. Unknown shapes become null so a list can drop them. */
export function parseMaintenanceRequest(value: unknown): MaintenanceRequest | null {
  const record = recordOf(value);
  const body = recordOf(record?.data) ?? record;
  if (!body) return null;
  const id = textOf(body.id ?? body.requestId);
  if (!id) return null;
  const photoName = textOf(body.photoName ?? body.photoFileName);
  const reason = textOf(body.reason ?? body.decisionReason ?? body.rejectionReason);
  return {
    id,
    leaseId: textOf(body.leaseId),
    what: textOf(body.what ?? body.title ?? body.issue ?? body.description),
    urgency: parseMaintenanceUrgency(body.urgency),
    note: textOf(body.note ?? body.notes),
    photoName: photoName || null,
    status: parseMaintenanceStatus(body.status),
    reason: reason || null,
    createdAt: textOf(body.createdAt ?? body.submittedAt),
  };
}

/** A bare array, or `{ items | requests | maintenanceRequests }`. */
export function parseMaintenanceRequestList(value: unknown): MaintenanceRequest[] {
  const record = recordOf(value);
  const rows = Array.isArray(value)
    ? value
    : Array.isArray(record?.items)
      ? record.items
      : Array.isArray(record?.requests)
        ? record.requests
        : Array.isArray(record?.maintenanceRequests)
          ? record.maintenanceRequests
          : [];
  return rows.flatMap((row) => {
    const parsed = parseMaintenanceRequest(row);
    return parsed ? [parsed] : [];
  });
}

/** The tenant never approves or pays. The landlord pays only after an approval. */
export function canPayMaintenance(audience: 'tenant' | 'landlord', status: MaintenanceRequestStatus): boolean {
  return audience === 'landlord' && status === 'approved';
}

export function canDecideMaintenance(audience: 'tenant' | 'landlord', status: MaintenanceRequestStatus): boolean {
  return audience === 'landlord' && status === 'pending';
}
