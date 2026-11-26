import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { getHttpStatus } from '@/lib/api-errors';

export interface SupplierFile { id: string; fileName: string; uploadedAt: string }
export interface ServiceFiles { id: string; serviceName: string; supplierName: string; documents: SupplierFile[] }

export function useGuestSupplierFiles(endpoint: string) {
  return useQuery({
    queryKey: ['guest-service-documents', endpoint],
    queryFn: async ({ signal }) => {
      try { return await ApiClient.get<ServiceFiles[]>(`${endpoint}/supplier-services`, undefined, { public: true, signal }); }
      catch (error) { if (getHttpStatus(error) === 404) return []; throw error; }
    },
    retry: false,
    gcTime: 0,
  });
}
