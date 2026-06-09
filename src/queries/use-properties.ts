import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertiesApi } from '@/api/properties.api';
import type {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertySearchParams,
  PropertyDocumentType,
} from '@/types';
import { toast } from 'sonner';
import { ENTITLEMENT_QUERY_KEY } from '@/queries/use-users';
import { isPlanLimitError } from '@/lib/entitlement-error';

const PROPERTIES_KEY = 'properties';

export function useProperties(params?: Record<string, string | number | boolean | undefined>) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, params],
    queryFn: () => propertiesApi.getAll(params),
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, id],
    queryFn: () => propertiesApi.getById(id),
    enabled: !!id,
  });
}

export function usePropertyDetail(id: string) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, id, 'detail'],
    queryFn: () => propertiesApi.getDetail(id),
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePropertyDto) => propertiesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
      // Usage changed → plan badge / create gating must refetch (#202, AC8).
      queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
      toast.success('Property created successfully');
    },
    onError: (error: unknown) => {
      // Plan-limit (403/409) is surfaced as an Italian message + upgrade CTA by the call site
      // (create page inline alert / list dialog toast), so skip the generic error toast here.
      if (isPlanLimitError(error)) return;
      toast.error('Failed to create property');
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePropertyDto }) =>
      propertiesApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.id] });
      toast.success('Property updated successfully');
    },
    onError: () => {
      toast.error('Failed to update property');
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => propertiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
      toast.success('Property deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete property');
    },
  });
}

export function useSearchProperties(params?: PropertySearchParams) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, 'search', params],
    queryFn: () => propertiesApi.search(params || {}),
    enabled: !!params,
  });
}

export function useUploadPropertyDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      propertyId,
      file,
      documentType,
    }: {
      propertyId: string;
      file: File;
      documentType: PropertyDocumentType;
    }) => propertiesApi.uploadDocument(propertyId, file, documentType),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.propertyId, 'detail'] });
      toast.success('Documento caricato con successo');
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      const message = error.response?.data?.error ?? 'Caricamento documento non riuscito';
      toast.error(message);
    },
  });
}

export function useDeletePropertyDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, docId }: { propertyId: string; docId: string }) =>
      propertiesApi.deleteDocument(propertyId, docId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.propertyId, 'detail'] });
      toast.success('Documento eliminato');
    },
    onError: () => {
      toast.error('Eliminazione documento non riuscita');
    },
  });
}
