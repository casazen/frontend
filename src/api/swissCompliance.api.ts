import { ApiClient } from './client';
import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  TicinoNotificationDay,
  TicinoNotificationRequest,
  UploadSwissReceiptForm,
  SwissReceiptResponse,
} from '@/types/swissCompliance.types';

export const swissComplianceApi = {
  /** One arrival day of the Ticino police notification (casazen/backend#979); without `date` the oldest day still to notify, else today. */
  getTicinoDay: (propertyId: string, date?: string) =>
    ApiClient.get<TicinoNotificationDay>(`/properties/${propertyId}/swiss/ticino-notification`, date ? { date } : undefined),

  /** The file of the day for notifiche.ti.ch, in the official CSV (default) or XML: bytes, never JSON. */
  downloadTicinoFile: async (propertyId: string, request: TicinoNotificationRequest): Promise<Blob> => {
    try {
      const response = await axios.post<Blob>(`/properties/${propertyId}/swiss/ticino-notification`, request, { responseType: 'blob' });
      return response.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  uploadReceipt: async (propertyId: string, form: UploadSwissReceiptForm): Promise<SwissReceiptResponse> => {
    const formData = new FormData();
    formData.append('type', form.type);
    formData.append('reportDate', form.reportDate);
    formData.append('reference', form.reference);
    formData.append('file', form.file);

    const response = await axios.post<SwissReceiptResponse>(
      `/properties/${propertyId}/swiss/upload-receipt`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },
};
