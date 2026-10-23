import { useCallback } from 'react';
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
 * service and into the list, so that what is on screen is what the server has without another request. A service the list
 * does not have yet (a creation, a copy) goes last, as the API puts it. The list is also marked stale, so that it is read
 * again by whoever shows it, now or when it opens.
 */
function keepService(client: QueryClient, service: SupplierService) {
  client.setQueryData<SupplierService>(supplierServiceKeys.detail(service.id), service);
  client.setQueryData<SupplierServiceList>(supplierServiceKeys.list(), (list) => {
    if (!list) return list;
    if (list.items.some((item) => item.id === service.id)) {
      return { ...list, items: list.items.map((item) => (item.id === service.id ? service : item)) };
    }
    return { ...list, items: [...list.items, service], total: list.total + 1 };
  });
  void client.invalidateQueries({ queryKey: supplierServiceKeys.list() });
}

/** Takes a service out of the cache and out of the list: it was deleted, here or somewhere else. */
function dropService(client: QueryClient, id: string) {
  client.removeQueries({ queryKey: supplierServiceKeys.detail(id) });
  client.setQueryData<SupplierServiceList>(supplierServiceKeys.list(), (list) => {
    if (!list || !list.items.some((item) => item.id === id)) return list;
    return { ...list, items: list.items.filter((item) => item.id !== id), total: Math.max(0, list.total - 1) };
  });
  void client.invalidateQueries({ queryKey: supplierServiceKeys.list() });
}

/**
 * The catalog of the supplier (30 services at most, so it is one request). It is read again when a screen opens it after it was
 * marked stale (a service made or copied while no screen showed the list): the app does not do that by default.
 */
export function useSupplierServices() {
  return useQuery({ queryKey: supplierServiceKeys.list(), queryFn: fetchSupplierServices, refetchOnMount: true });
}

/**
 * One service. It is read when the screen opens it for the first time and after what the screen itself does (every answer of
 * the API puts the service in the cache), never in the background (not on opening it again, not on focus): a service that is
 * being edited must keep the `version` it was read at, together with the values the form was filled with, or the 409 of the
 * API (changed elsewhere) would be defeated by a refresh that quietly brings a new `version` under the old values.
 */
export function useSupplierService(id: string | undefined) {
  return useQuery({
    queryKey: supplierServiceKeys.detail(id),
    queryFn: () => fetchSupplierService(id!),
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/** What a screen does when it learns that a service is not there any more (a 404 on an action): forget it. The same function on every render. */
export function useForgetSupplierService() {
  const client = useQueryClient();
  return useCallback((id: string) => dropService(client, id), [client]);
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
    onSuccess: (_result, id) => dropService(client, id),
  });
}
