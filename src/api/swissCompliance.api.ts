import { ApiClient } from './client';
import type {
  TicinoNotificationRequest,
  OtrReportRequest,
  SwissComplianceFileResponse,
  UploadSwissReceiptForm,
  SwissReceiptResponse,
} from '@/types/swissCompliance.types';

export const swissComplianceApi = {
  generatePoliceXml: (propertyId: string, request: TicinoNotificationRequest) =>
    ApiClient.post<SwissComplianceFileResponse>(
      `/properties/${propertyId}/swiss/ticino-notification`,
      request
    ),

  generateOtrCsv: (propertyId: string, request: OtrReportRequest) =>
    ApiClient.post<SwissComplianceFileResponse>(`/properties/${propertyId}/swiss/otr-report`, request),

  uploadReceipt: async (propertyId: string, form: UploadSwissReceiptForm) => {
    const formData = new FormData();
    formData.append('type', form.type);
    formData.append('reportDate', form.reportDate);
    formData.append('reference', form.reference);
    formData.append('file', form.file);

    const response = await fetch(`${import.meta.env.VITE_API_URL}/properties/${propertyId}/swiss/upload-receipt`, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return response.json() as Promise<SwissReceiptResponse>;
  },
};
