import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchSupplierClient, fetchSupplierClients } from '@/api/supplier-clients.api';

export function useSupplierClients() {
  return useQuery({
    queryKey: ['supplier', 'clients', 'list'],
    queryFn: fetchSupplierClients,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

export function useSupplierClient(id: string) {
  return useQuery({
    queryKey: ['supplier', 'clients', 'detail', id],
    queryFn: () => fetchSupplierClient(id),
    refetchOnMount: 'always',
  });
}
