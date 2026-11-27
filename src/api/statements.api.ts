import axios from '@/lib/axios';
import { ApiClient } from './client';
import { acceptsRefusal } from './accept-refusal';
import { fileApi, type DownloadedFile } from './file.api';
import type {
  OwnerStatement,
  StatementFilters,
  GenerateStatementRequest,
} from '@/types';

/**
 * The monthly statements of the agency's owners (backend `api/statements`, ADR-017). Paths are relative to the API base URL, which already ends in `/api`.
 * The reads and the files need `agency.statement.view`, the writes `agency.statement.manage`: the owner and the administrators of an org on the agency plan.
 */
export const statementsApi = {
  /**
   * List of owner statements, optionally filtered by property owner and/or property; `null` when the server refuses it to this caller (403): a refused read
   * would send the whole app to the page of no access, and the page only has to say that the access is not there.
   */
  getAll: async (filters?: StatementFilters): Promise<OwnerStatement[] | null> => {
    const response = await axios.get<OwnerStatement[]>('/statements', { params: filters, validateStatus: acceptsRefusal });
    return response.status === 403 ? null : response.data;
  },

  /** Generates a new monthly statement for the given owner, property, and period. */
  generate: (data: GenerateStatementRequest) =>
    ApiClient.post<OwnerStatement>('/statements/generate', data),

  /** Approves a Draft statement, locking it for review. */
  approve: (id: string) =>
    ApiClient.post<void>(`/statements/${id}/approve`),

  /**
   * Publishes an Approved statement: it becomes immutable and can go into a wire file. The server only changes its status: it sends nothing to the owner (no
   * message, and the owner portal lists no statement yet).
   */
  publish: (id: string) =>
    ApiClient.post<void>(`/statements/${id}/publish`),

  /** The statement as a PDF, as the server stored it (only an Approved or a Published statement: 422 `statement_not_exportable` for a Draft). */
  downloadPdf: (id: string): Promise<DownloadedFile> => fileApi.get(`/statements/${id}/pdf`),

  /** The statement as a CSV, under the same rules as the PDF. */
  downloadCsv: (id: string): Promise<DownloadedFile> => fileApi.get(`/statements/${id}/csv`),
};
