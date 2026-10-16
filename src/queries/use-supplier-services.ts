import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  createSupplierService,
  deleteSupplierService,
  duplicateSupplierService,
  fetchSupplierService,
  fetchSupplierServices,
  pauseSupplierService,
  publishSupplierService,
  updateSupplierService,
  uploadSupplierServicePhotos,
} from '@/api/supplier-services.api';
import type {
  SaveSupplierServiceBody,
  SupplierService,
  SupplierServiceList,
  UpdateSupplierServiceBody,
} from '@/types/supplier-services';

const SERVICES_KEY = ['supplier', 'services'] as const;
export const supplierServiceKeys = {
  all: SERVICES_KEY,
  list: () => [...SERVICES_KEY, 'list'] as const,
  detail: (id: string | undefined) => [...SERVICES_KEY, 'detail', id] as const,
};

/**
 * Every answer that changes a service carries the whole service with its new `version`: it goes into the cache of the
 * service and into the list, so that what is on screen is what the server has without another request. The list is also
 * marked stale, because a creation or a deletion changes how many services the supplier has.
 */
function keepService(client: QueryClient, service: SupplierService) {
  client.setQueryData<SupplierService>(supplierServiceKeys.detail(service.id), service);
  client.setQueryData<SupplierServiceList>(supplierServiceKeys.list(), (list) =>
    list ? { ...list, items: list.items.map((item) => (item.id === service.id ? service : item)) } : list,
  );
  void client.invalidateQueries({ queryKey: supplierServiceKeys.list() });
}

/** The catalog of the supplier (30 services at most, so it is one request). */
export function useSupplierServices() {
  return useQuery({ queryKey: supplierServiceKeys.list(), queryFn: fetchSupplierServices });
}

/**
 * One service. It is read when the screen opens and after what the screen itself does (every answer of the API puts the
 * service in the cache), never in the background: a service that is being edited must keep the `version` it was read at, or
 * the 409 of the API (changed elsewhere) would be defeated by a refresh that quietly brings the new one. A screen that
 * already has the service from its own answers passes `refetchOnMount: false`.
 */
export function useSupplierService(id: string | undefined, options: { refetchOnMount?: boolean } = {}) {
  return useQuery({
    queryKey: supplierServiceKeys.detail(id),
    queryFn: () => fetchSupplierService(id!),
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: options.refetchOnMount ?? true,
  });
}

export function useCreateSupplierService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveSupplierServiceBody) => createSupplierService(body),
    onSuccess: (service) => keepService(client, service),
  });
}

export function useUpdateSupplierService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSupplierServiceBody }) => updateSupplierService(id, body),
    onSuccess: (service) => keepService(client, service),
  });
}

export function usePublishSupplierService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publishSupplierService(id),
    onSuccess: (service) => keepService(client, service),
  });
}

export function usePauseSupplierService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pauseSupplierService(id),
    onSuccess: (service) => keepService(client, service),
  });
}

export function useDuplicateSupplierService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateSupplierService(id),
    onSuccess: (service) => keepService(client, service),
  });
}

export function useUploadSupplierServicePhotos() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, files }: { id: string; files: File[] }) => uploadSupplierServicePhotos(id, files),
    onSuccess: (service) => keepService(client, service),
  });
}

export function useDeleteSupplierService() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSupplierService(id),
    onSuccess: (_result, id) => {
      client.removeQueries({ queryKey: supplierServiceKeys.detail(id) });
      client.setQueryData<SupplierServiceList>(supplierServiceKeys.list(), (list) =>
        list ? { ...list, items: list.items.filter((item) => item.id !== id), total: Math.max(0, list.total - 1) } : list,
      );
      void client.invalidateQueries({ queryKey: supplierServiceKeys.list() });
    },
  });
}
