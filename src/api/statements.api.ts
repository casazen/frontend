import { ApiClient } from './client';
import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  OwnerStatement,
  StatementFilters,
  GenerateStatementRequest,
} from '@/types';

export const statementsApi = {
  /** List of owner statements, optionally filtered by property owner and/or property. */
  getAll: (filters?: StatementFilters) =>
    ApiClient.get<OwnerStatement[]>('/statements', filters),

  /** Generates a new monthly statement for the given owner, property, and period. */
  generate: (data: GenerateStatementRequest) =>
    ApiClient.post<OwnerStatement>('/statements/generate', data),

  /** Approves a Draft statement, locking it for review. */
  approve: (id: string) =>
    ApiClient.post<void>(`/statements/${id}/approve`),

  /** Publishes an Approved statement, sending it to the owner. */
  publish: (id: string) =>
    ApiClient.post<void>(`/statements/${id}/publish`),

  /** Exports a statement as PDF. */
  downloadPdf: async (id: string): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>(`/statements/${id}/pdf`, {
        responseType: 'blob',
      });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  /** Exports a statement as CSV. */
  downloadCsv: async (id: string): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>(`/statements/${id}/csv`, {
        responseType: 'blob',
      });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },
};
