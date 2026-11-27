export const ADMIN_SUPPLIER_STATUSES = ['Pending', 'Active', 'Suspended'] as const;
export type AdminSupplierStatus = (typeof ADMIN_SUPPLIER_STATUSES)[number];

export interface AdminSupplier {
  orgId: string;
  legalName: string;
  email: string;
  phone: string;
  status: AdminSupplierStatus;
  categories: string[];
  comuni: string[];
  createdAt: string;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  openRequests: number;
}

export const ADMIN_INVITE_STATES = ['Pending', 'Used', 'Expired', 'Revoked'] as const;
type AdminInviteState = (typeof ADMIN_INVITE_STATES)[number];

export interface AdminInvite {
  id: string;
  email: string;
  comuneCode: string;
  categories: string[];
  message?: string | null;
  state: AdminInviteState;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
}

type AdminSupplierAuditAction = 'Suspended' | 'Reactivated' | 'InviteResent' | 'InviteRevoked';

export interface AdminSupplierAuditEntry {
  id: string;
  action: AdminSupplierAuditAction;
  actorUserId: string;
  actorName?: string | null;
  occurredAt: string;
  reason?: string | null;
  previousStatus?: AdminSupplierStatus | null;
  newStatus?: AdminSupplierStatus | null;
}

export interface AdminSuppliersParams {
  search?: string;
  status?: AdminSupplierStatus;
  page?: number;
  pageSize?: number;
}

export interface AdminInvitesParams {
  search?: string;
  state?: AdminInviteState;
  page?: number;
  pageSize?: number;
}
