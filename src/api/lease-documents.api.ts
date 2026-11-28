import axios from '@/lib/axios';
import { ApiClient } from './client';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { LeaseDocumentSection } from '@/types';

export type LeaseDocumentKind = 'Contract' | 'Attestation' | 'Registration' | 'Other' | 'RegistrationIdentity';
export interface LeaseDocument {
  id: string; leaseId: string; kind: LeaseDocumentKind; fileName: string; sizeBytes: number; uploadedAt: string;
  sections?: LeaseDocumentSection[] | null;
  containsAttestation?: boolean;
  containsCalculationSheet?: boolean;
}

export interface RegistrationReceiptReading {
  outcome: 'Registered' | 'Rejected';
  code: string | null;
  number: string | null;
  series: string | null;
  registrationDate: string | null;
  office: string | null;
  annualRent: number | null;
  start: string | null;
  end: string | null;
  stipulationDate: string | null;
  typology: string | null;
  cedolareSecca: boolean | null;
  comune: string | null;
  province: string | null;
  warnings: string[];
}

export interface LeaseDocumentReading {
  documentId: string;
  kind: string;
  state: 'Read' | 'Unreadable' | 'NotAReceipt';
  receipt: RegistrationReceiptReading | null;
}

export const leaseDocumentsApi = {
  list: async (leaseId: string): Promise<LeaseDocument[]> => {
    const data = await ApiClient.get<unknown>(`/leases/${leaseId}/documents`);
    if (!Array.isArray(data) || data.some((d) => !d || typeof d.id !== 'string' || d.leaseId !== leaseId || typeof d.fileName !== 'string'))
      throw new UnexpectedApiResponseError('/leases/:id/documents');
    return data as LeaseDocument[];
  },
  upload: async (leaseId: string, file: File, kind: LeaseDocumentKind): Promise<LeaseDocument> => {
    const data = new FormData(); data.append('file', file); data.append('kind', kind);
    const response = await axios.post<LeaseDocument>(`/leases/${leaseId}/documents`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },
  download: async (leaseId: string, documentId: string): Promise<Blob> =>
    (await axios.get<Blob>(`/leases/${leaseId}/documents/${documentId}/download`, { responseType: 'blob' })).data,
  remove: async (leaseId: string, documentId: string): Promise<void> => {
    await ApiClient.delete<void>(
      `/leases/${encodeURIComponent(leaseId)}/documents/${encodeURIComponent(documentId)}`,
    );
  },
  readReceipt: async (leaseId: string, documentId: string): Promise<LeaseDocumentReading> => {
    const data = await ApiClient.get<unknown>(`/leases/${leaseId}/documents/${documentId}/reading`);
    const reading = data as Partial<LeaseDocumentReading> | null;
    if (!reading || reading.documentId !== documentId || (reading.state !== 'Read' && reading.state !== 'Unreadable' && reading.state !== 'NotAReceipt'))
      throw new UnexpectedApiResponseError('/leases/:id/documents/:documentId/reading');
    return { documentId, kind: String(reading.kind ?? ''), state: reading.state, receipt: reading.receipt ?? null };
  },
};
