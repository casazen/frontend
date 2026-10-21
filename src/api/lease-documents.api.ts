import axios from '@/lib/axios';
import { ApiClient } from './client';
import { UnexpectedApiResponseError } from '@/lib/api-errors';

export type LeaseDocumentKind = 'Contract' | 'Attestation' | 'Registration' | 'Other';
export interface LeaseDocument {
  id: string; leaseId: string; kind: LeaseDocumentKind; fileName: string; sizeBytes: number; uploadedAt: string;
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
};
