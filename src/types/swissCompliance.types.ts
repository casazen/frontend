export interface TicinoNotificationRequest {
  reportDate: string;
}

export interface OtrReportRequest {
  fromDate: string;
  toDate: string;
}

export interface SwissComplianceFileResponse {
  propertyId: string;
  fileName: string;
  contentType: string;
  content: string;
  reference: string;
  fileHash: string;
}

export interface UploadSwissReceiptForm {
  type: string;
  reportDate: string;
  reference: string;
  file: File;
}

export interface SwissReceiptResponse {
  id: string;
  propertyId: string;
  type: string;
  reportDate: string;
  reference: string;
  fileHash: string;
  uploadedAt: string;
}
