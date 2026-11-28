import axios from '@/lib/axios';
import { ApiClient } from './client';
import { acceptsRefusal } from './accept-refusal';
import { fileApi, type DownloadedFile } from './file.api';
import type {
  OwnerStatement,
  StatementFilters,
  GenerateStatementRequest,
} from '@/types';

export const statementsApi = {
  getAll: async (filters?: StatementFilters): Promise<OwnerStatement[] | null> => {
    const response = await axios.get<OwnerStatement[]>('/statements', { params: filters, validateStatus: acceptsRefusal });
    return response.status === 403 ? null : response.data;
  },

  generate: (data: GenerateStatementRequest) =>
    ApiClient.post<OwnerStatement>('/statements/generate', data),

  approve: (id: string) =>
    ApiClient.post<void>(`/statements/${id}/approve`),

  publish: (id: string) =>
    ApiClient.post<void>(`/statements/${id}/publish`),

  downloadPdf: (id: string): Promise<DownloadedFile> => fileApi.get(`/statements/${id}/pdf`),

  downloadCsv: (id: string): Promise<DownloadedFile> => fileApi.get(`/statements/${id}/csv`),
};
