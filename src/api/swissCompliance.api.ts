import { ApiClient } from './client';
import axios from '@/lib/axios';
import { fileApi, type DownloadedFile } from './file.api';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  DeclareTicinoDayRequest,
  TicinoDeclaration,
  TicinoNotificationDay,
  TicinoNotificationRequest,
  UploadSwissReceiptForm,
  SwissReceiptResponse,
} from '@/types/swissCompliance.types';

export const swissComplianceApi = {
  /** One arrival day of the Ticino police notification (casazen/backend#979); without `date` the oldest day still to notify, else today. */
  getTicinoDay: (propertyId: string, date?: string) =>
    ApiClient.get<TicinoNotificationDay>(`/properties/${propertyId}/swiss/ticino-notification`, date ? { date } : undefined),

  /**
   * The file of the day for notifiche.ti.ch, in the official CSV (default) or XML: bytes, never JSON. A day that is declared uploaded (or has a receipt) answers 409
   * `ticino_day_already_declared` until the request carries `confirmRegenerate: true`.
   */
  downloadTicinoFile: async (propertyId: string, request: TicinoNotificationRequest): Promise<Blob> => {
    try {
      const response = await axios.post<Blob>(`/properties/${propertyId}/swiss/ticino-notification`, request, { responseType: 'blob' });
      return response.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  /** The sheet of a group of six or more persons of a stay (decision D11): the CSV the host keeps five years. Its name is the server's. */
  downloadGroupSheet: (propertyId: string, bookingId: string): Promise<DownloadedFile> =>
    fileApi.get(`/properties/${propertyId}/swiss/ticino-notification/group-sheet`, { bookingId }),

  /**
   * Says the file of an arrival day was uploaded to the portal, with or without the receipt (E30/F02/US02/T01, NF-128): the day is closed, and the other hosts of the property are told.
   * Idempotent: a day declared already answers the declaration that exists (`created: false`). Needs `alloggiati.submit`.
   */
  declareTicinoDay: (propertyId: string, request: DeclareTicinoDayRequest) =>
    ApiClient.post<TicinoDeclaration>(`/properties/${propertyId}/swiss/ticino-notification/declare`, request),

  /** Undoes the declaration of a day: it is to notify again unless a receipt of the portal closes it. Idempotent (204 also when nothing was declared). */
  undeclareTicinoDay: (propertyId: string, arrivalDay: string) =>
    ApiClient.delete<void>(`/properties/${propertyId}/swiss/ticino-notification/declare?arrivalDay=${encodeURIComponent(arrivalDay)}`),

  /** Records a document of the Swiss archive: the receipt of the portal, the authorization of the parents or the sheet of a group. */
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
