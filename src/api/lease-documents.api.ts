import axios from '@/lib/axios';
import { ApiClient } from './client';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { LeaseDocumentSection } from '@/types';

export type LeaseDocumentKind = 'Contract' | 'Attestation' | 'Registration' | 'Other';
export interface LeaseDocument {
  id: string; leaseId: string; kind: LeaseDocumentKind; fileName: string; sizeBytes: number; uploadedAt: string;
  /** A contract that was read: the sections its file is made of (the contract, its attestation, its calculation sheet). CF-DOCS-REAL. */
  sections?: LeaseDocumentSection[] | null;
  containsAttestation?: boolean;
  containsCalculationSheet?: boolean;
}

/**
 * What the receipt of the registration says (CF-DOCS-REAL, `GET /leases/:id/documents/:documentId/reading`): the figures the Agenzia delle
 * Entrate recorded. `Registered`, or `Rejected` when the Agenzia discarded the request: the contract is then NOT registered. Dates are
 * `YYYY-MM-DD`; `warnings` are the codes of what does not match the lease. It names nobody and gives no address.
 */
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

/** `Read`: the PDF is a receipt of the Agenzia; `Unreadable`: no text (a scan or a photo); `NotAReceipt`: it has text but is not one. */
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
  /** The values of a receipt of the registration already uploaded, read from the PDF when asked: nothing is declared by reading it. */
  readReceipt: async (leaseId: string, documentId: string): Promise<LeaseDocumentReading> => {
    const data = await ApiClient.get<unknown>(`/leases/${leaseId}/documents/${documentId}/reading`);
    const reading = data as Partial<LeaseDocumentReading> | null;
    if (!reading || reading.documentId !== documentId || (reading.state !== 'Read' && reading.state !== 'Unreadable' && reading.state !== 'NotAReceipt'))
      throw new UnexpectedApiResponseError('/leases/:id/documents/:documentId/reading');
    return { documentId, kind: String(reading.kind ?? ''), state: reading.state, receipt: reading.receipt ?? null };
  },
};
