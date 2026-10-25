import { ApiClient } from './client';

export interface TrustedSupplier {
  id: string;
  orgId: string;
  supplierOrgId: string;
  assignedPropertyIds: string[];
  priority: number;
  visibleInMarketplace: boolean;
  createdAt: string;
}

export interface InviteSupplierDto {
  email: string;
  propertyIds: string[];
}

export interface UpdateVisibilityDto {
  visibleInMarketplace: boolean;
}

export const trustedSuppliersApi = {
  getAll: () => ApiClient.get<TrustedSupplier[]>('/trusted-suppliers'),

  invite: (data: InviteSupplierDto) => ApiClient.post<void>('/trusted-suppliers/invite', data),

  updateVisibility: (id: string, data: UpdateVisibilityDto) =>
    ApiClient.put<void>(`/trusted-suppliers/${id}/visibility`, data),

  remove: (id: string) => ApiClient.delete<void>(`/trusted-suppliers/${id}`),
};
