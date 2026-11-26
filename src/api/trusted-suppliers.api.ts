import { ApiClient } from './client';

export interface TrustedSupplier {
  id: string;
  supplierOrgId: string;
  supplierName?: string | null;
  hostOrigin?: boolean;
  assignedPropertyIds: string[];
  priority: number;
  visibleInMarketplace: boolean;
  createdAt: string;
}

export interface InviteSupplierDto {
  vatNumber?: string;
  fiscalCode?: string;
  phone?: string;
  email: string;
  propertyIds: string[];
}

export const trustedSuppliersApi = {
  getAll: () => ApiClient.get<TrustedSupplier[]>('/trusted-suppliers'),

  invite: (data: InviteSupplierDto) => ApiClient.post<void>('/trusted-suppliers/invite', data),

  remove: (id: string) => ApiClient.delete<void>(`/trusted-suppliers/${id}`),
};
