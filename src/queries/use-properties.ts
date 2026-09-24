import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertiesApi } from '@/api/properties.api';
import type {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertySearchParams,
  PropertyDocumentType,
} from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
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

/** Documents of a property (APE included), shared cache with the lease form. */
export function usePropertyDocuments(id: string | undefined) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, id, 'documents'],
    queryFn: () => propertiesApi.getDocuments(id!),
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
      toast.success(i18n.t('toast.propertyCreated'));
    },
    onError: (error: unknown) => {
      // Plan-limit (403/409) is surfaced as an Italian message + upgrade CTA by the call site
      // (create page inline alert / list dialog toast), so skip the generic error toast here.
      if (isPlanLimitError(error)) return;
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.propertyCreateFailed'));
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
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.id, 'detail'] });
      toast.success(i18n.t('toast.propertyUpdated'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.propertyUpdateFailed'));
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => propertiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
      toast.success(i18n.t('toast.propertyDeleted'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.propertyDeleteFailed'));
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

export function usePublicProperty(id: string) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, id, 'public'],
    queryFn: () => propertiesApi.getPublicProperty(id),
    enabled: !!id,
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
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.propertyId, 'documents'] });
      toast.success(i18n.t('toast.documentUploaded'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.documentUploadFailed'));
    },
  });
}

export function useDownloadPropertyDocument() {
  return useMutation({
    mutationFn: ({ propertyId, docId }: { propertyId: string; docId: string; fileName: string }) =>
      propertiesApi.downloadDocument(propertyId, docId),
    onSuccess: (blob, variables) => {
      saveBlobAs(blob, variables.fileName);
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.documentDownloadFailed'));
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
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.propertyId, 'documents'] });
      toast.success(i18n.t('toast.documentDeleted'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.documentDeleteFailed'));
    },
  });
}
