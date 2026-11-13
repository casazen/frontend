import axios from '@/lib/axios';
import type { LeaseDocument } from './lease-documents.api';

export interface RegistrationField {
  key: string; name: string; label: string; type: string; required: boolean;
  help: string; options: { code: string; description: string }[]; group: string;
}
export interface RegistrationData {
  version: number; values: Record<string, string>; documents: Record<string, string>;
}
export interface RegistrationPreparation {
  schema: { documentId: string; verifiedOn: string; fields: RegistrationField[] };
  data: RegistrationData;
  issues: { field: string; message: string }[];
  ready: boolean; paid: boolean;
}
export const registrationPreparationApi = {
  get: async (id: string) => (await axios.get<RegistrationPreparation>(`/leases/${id}/registration/preparation`)).data,
  save: async (id: string, data: RegistrationData) => (await axios.put<RegistrationPreparation>(`/leases/${id}/registration/preparation`, data)).data,
  upload: async (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', 'RegistrationIdentity');
    const result = await axios.post<LeaseDocument>(`/leases/${id}/registration/preparation/documents`, form,
      { headers: { 'Content-Type': 'multipart/form-data' } });
    return result.data;
  },
};
