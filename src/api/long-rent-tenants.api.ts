import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type { TenantDetail, TenantErasureResult, TenantListParams, TenantPage } from '@/types';
import { ApiClient } from './client';

export const TENANT_EXPORT_FILE_NAME = 'dati-personali.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The tenants of the long-term area (LR-09). Reading needs `lease.read`; the copy of a person's data and the request to erase them need
 * `lease.create` as well, and the second cannot be taken back. Nothing here writes to anybody. The rules and the error codes are in the
 * runbook of the backend (`long-rent-aggregates.md` § 13).
 */
export const longRentTenantsApi = {
  getAll: async (params: TenantListParams = {}): Promise<TenantPage> => {
    const { view, ...rest } = params;
    const data = await ApiClient.get<unknown>('/long-rent/tenants', { ...rest, view: view === 'All' ? undefined : view });
    if (!isRecord(data) || !Array.isArray(data.items)) throw new UnexpectedApiResponseError('/long-rent/tenants');
    return data as unknown as TenantPage;
  },

  getById: async (id: string): Promise<TenantDetail> => {
    const data = await ApiClient.get<unknown>(`/long-rent/tenants/${encodeURIComponent(id)}`);
    if (!isRecord(data) || !isRecord(data.tenant)) throw new UnexpectedApiResponseError('/long-rent/tenants/:id');
    return data as unknown as TenantDetail;
  },

  downloadData: async (id: string): Promise<Blob> => {
    try {
      const response = await axios.get<Blob>(`/long-rent/tenants/${encodeURIComponent(id)}/export`, { responseType: 'blob' });
      return response.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  /** Asks the erasure of the data of a person on each of their leases (art. 17 GDPR). Idempotent: asking again answers where it stands. */
  requestErasure: async (id: string): Promise<TenantErasureResult> => {
    const data = await ApiClient.post<unknown>(`/long-rent/tenants/${encodeURIComponent(id)}/erasure-request`);
    if (!isRecord(data) || !Array.isArray(data.leases)) throw new UnexpectedApiResponseError('/long-rent/tenants/:id/erasure-request');
    return data as unknown as TenantErasureResult;
  },
};
