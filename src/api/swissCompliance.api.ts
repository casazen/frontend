import { ApiClient } from './client';
import axios from '@/lib/axios';
import { fileApi, type DownloadedFile } from './file.api';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  DeclareSwissDayRequest,
  DeclareTicinoDayRequest,
  SwissDeclaration,
  SwissNotificationDay,
  TicinoDeclaration,
  TicinoNotificationDay,
  TicinoNotificationRequest,
  UploadSwissReceiptForm,
  SwissReceiptResponse,
} from '@/types/swissCompliance.types';

const swissPath = (propertyId: string) => `/properties/${encodeURIComponent(propertyId)}/swiss`;

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

  /**
   * One arrival day of the assisted notification of a canton other than Ticino (E31/F02/US01/T01, NF-131): the guests as data ready to copy, what they lack, the portal, the deadline and
   * who declared the day. Without `date` the oldest day still to notify, else today. Behind `Features:GuestRegistrationRegimes` (404 `not_found` while it is off); asks `guest.read`.
   * 422 `swiss_notification_not_applicable` for a property the notification does not cover (not Swiss, Ticino, a canton that only keeps a register, a place not known).
   */
  getSwissDay: (propertyId: string, date?: string) => ApiClient.get<SwissNotificationDay>(`${swissPath(propertyId)}/notification-day`, date ? { date } : undefined),

  /**
   * Says the host notified the guests of an arrival day to the authority (decision D10): the day is closed and the other hosts of the property are told. Idempotent: a day declared
   * already answers the declaration that exists (`created: false`). Needs `alloggiati.submit`; 422 `swiss_declaration_day_in_future` for a day that has not started.
   */
  declareSwissDay: (propertyId: string, request: DeclareSwissDayRequest) => ApiClient.post<SwissDeclaration>(`${swissPath(propertyId)}/notification-declare`, request),

  /** Takes the declaration of a day back: the day is to notify again. Idempotent (204 also when nothing was declared). */
  undeclareSwissDay: (propertyId: string, arrivalDay: string) =>
    ApiClient.delete<void>(`${swissPath(propertyId)}/notification-declare?arrivalDay=${encodeURIComponent(arrivalDay)}`),

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
