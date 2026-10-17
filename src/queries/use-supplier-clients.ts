import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchSupplierClient, fetchSupplierClients } from '@/api/supplier-clients.api';

/** The customers of the supplier, read again every time the page opens (a job taken or completed elsewhere changes them). */
export function useSupplierClients() {
  return useQuery({
    queryKey: ['supplier', 'clients', 'list'],
    queryFn: fetchSupplierClients,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

/** One customer with its latest requests, read when its drawer opens. */
export function useSupplierClient(id: string) {
  return useQuery({
    queryKey: ['supplier', 'clients', 'detail', id],
    queryFn: () => fetchSupplierClient(id),
    refetchOnMount: 'always',
  });
}
