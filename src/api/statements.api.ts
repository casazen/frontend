import { ApiClient } from './client';
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

  /** The statement as a PDF, as the server stored it (only an Approved or a Published statement: 422 `statement_not_exportable` for a Draft). */
  downloadPdf: (id: string): Promise<DownloadedFile> => fileApi.get(`/statements/${id}/pdf`),

  /** The statement as a CSV, under the same rules as the PDF. */
  downloadCsv: (id: string): Promise<DownloadedFile> => fileApi.get(`/statements/${id}/csv`),
};
