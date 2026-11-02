import { ApiClient } from './client';
import axios from '@/lib/axios';
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
