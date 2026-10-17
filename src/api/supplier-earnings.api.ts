import { ApiClient } from '@/api/client';
import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import type { SupplierEarningsParams, SupplierEarningsResponse } from '@/types/supplier-earnings';

/** The filters that are set, as the query of the server wants them (an empty one is not sent). */
function queryOf({ tab, from, to, clientId, page, pageSize }: SupplierEarningsParams): Record<string, string | number> {
  return {
    ...(tab && tab !== 'tutti' ? { tab } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(clientId ? { clientId } : {}),
    ...(page ? { page } : {}),
    ...(pageSize ? { pageSize } : {}),
  };
}

/**
 * A page of the completed and paid jobs of the supplier with gross, commission and net, and the figures above them (`summary`, which
 * the filters do not change). Every amount is in cents and made by the server. The answer carries money: it is never cached.
 */
export async function fetchSupplierEarnings(params: SupplierEarningsParams): Promise<SupplierEarningsResponse> {
  return ApiClient.get<SupplierEarningsResponse>('/supplier/earnings', queryOf(params));
}

/**
 * The same rows as a CSV for the accountant (the server makes it: UTF-8 with a byte order mark, no contacts, no VAT), with the same
 * filters and no page. 422 `supplier_earnings_export_too_large` above 20,000 rows: the problem body is read so its message can be shown.
 */
export async function downloadSupplierEarnings({ tab, from, to, clientId }: SupplierEarningsParams): Promise<Blob> {
  try {
    const response = await axios.get<Blob>('/supplier/earnings/export', {
      params: queryOf({ tab, from, to, clientId }),
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    throw await withJsonErrorBody(error);
  }
}
