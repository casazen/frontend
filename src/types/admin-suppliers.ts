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
