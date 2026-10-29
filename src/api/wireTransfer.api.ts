import { ApiClient } from './client';
import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import type { CreateBatchRequest, CreateBatchResponse } from '@/types';

export const wireTransferApi = {
  /** Create a wire transfer batch from the given statement IDs. */
  createBatch: (data: CreateBatchRequest) =>
    ApiClient.post<CreateBatchResponse>('/wire-transfers/batch', data),

  /** Download the wire transfer batch file (SEPA pain.001 or Swiss Payment Standards XML). */
  downloadBatchFile: async (batchId: string): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>(`/wire-transfers/batch/${batchId}/file`, {
        responseType: 'blob',
      });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  /** Confirm that the batch file has been downloaded. */
  confirmDownload: (batchId: string) =>
    ApiClient.post<void>(`/wire-transfers/batch/${batchId}/confirm-download`),

  /** Confirm that the batch has been paid (wire transfers executed at the bank). */
  confirmPaid: (batchId: string) =>
    ApiClient.post<void>(`/wire-transfers/batch/${batchId}/confirm-paid`),
};
