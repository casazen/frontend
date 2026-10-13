/** Status of a supplier profile (backend `SupplierStatus`). */
export const ADMIN_SUPPLIER_STATUSES = ['Pending', 'Active', 'Suspended'] as const;
export type AdminSupplierStatus = (typeof ADMIN_SUPPLIER_STATUSES)[number];

/** A supplier in the admin list (`GET /admin/suppliers`, SU-12). */
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
  /** Internal note of the admin who suspended it: never shown to the supplier. */
  suspensionReason?: string | null;
  /** Requests the supplier still has to work (new, taken, in progress). */
  openRequests: number;
}

/** State of an invite, computed by the API: an invite from before the token hashes counts as `Expired`. */
export const ADMIN_INVITE_STATES = ['Pending', 'Used', 'Expired', 'Revoked'] as const;
export type AdminInviteState = (typeof ADMIN_INVITE_STATES)[number];

/** An invite in the admin list (`GET /admin/suppliers/invites`); the link token is never sent. */
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

export type AdminSupplierAuditAction = 'Suspended' | 'Reactivated' | 'InviteResent' | 'InviteRevoked';

/** One line of the audit trail of a supplier (`GET /admin/suppliers/{orgId}/audit`). */
export interface AdminSupplierAuditEntry {
  id: string;
  action: AdminSupplierAuditAction;
  actorUserId: string;
  /** Name (or email) of the admin, null when the account is unknown. */
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
