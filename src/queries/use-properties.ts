import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertiesApi } from '@/api/properties.api';
import type {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertySearchParams,
  PropertyDocumentType,
  PropertyCadastralData,
  ApeIdentification,
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

/** `fresh`: read again from the server on mount even when cached (a form that starts from the stored values). */
export function useProperty(id: string, options: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, id],
    queryFn: () => propertiesApi.getById(id),
    enabled: !!id,
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

/** Cancellation policies a short-stay property can reference (global catalog). */
export function useCancellationPolicies(enabled = true) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, 'cancellation-policies'],
    queryFn: () => propertiesApi.getCancellationPolicies(),
    enabled,
    staleTime: 5 * 60 * 1000,
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

export function usePropertyDetail(id: string, options: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, id, 'detail'],
    queryFn: () => propertiesApi.getDetail(id),
    enabled: !!id,
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
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

/**
 * Dedicated pause/activate actions (A2-05): update every cache the list row, the detail page and the CIN/status
 * badges read from, so the new state shows without a manual refetch.
 */
function invalidatePropertyCaches(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
  queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, id] });
  queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, id, 'detail'] });
}

export function usePauseProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => propertiesApi.pause(id),
    onSuccess: (_, id) => {
      invalidatePropertyCaches(queryClient, id);
      toast.success(i18n.t('toast.propertyPaused'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.propertyPauseFailed'));
    },
  });
}

export function useActivateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => propertiesApi.activate(id),
    onSuccess: (_, id) => {
      invalidatePropertyCaches(queryClient, id);
      toast.success(i18n.t('toast.propertyActivated'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.propertyActivateFailed'));
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
      // The required documents are a step of the activation wizard (A5-18).
      queryClient.invalidateQueries({ queryKey: ['compliance', 'activation', variables.propertyId] });
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
      // The required documents are a step of the activation wizard (A5-18).
      queryClient.invalidateQueries({ queryKey: ['compliance', 'activation', variables.propertyId] });
      toast.success(i18n.t('toast.documentDeleted'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.documentDeleteFailed'));
    },
  });
}

/** LT-10: cadastral identification of the unit (foglio, particella, subalterno, categoria, rendita). */
export function useUpdatePropertyCadastral() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, data }: { propertyId: string; data: PropertyCadastralData }) =>
      propertiesApi.updateCadastral(propertyId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.propertyId] });
      toast.success(i18n.t('toast.cadastralSaved'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.cadastralSaveFailed'));
    },
  });
}

/** LT-10: code and energy class printed on an APE document. */
export function useUpdateApeIdentification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, docId, data }: { propertyId: string; docId: string; data: ApeIdentification }) =>
      propertiesApi.updateApeIdentification(propertyId, docId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.propertyId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.propertyId, 'detail'] });
      toast.success(i18n.t('toast.apeIdentificationSaved'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.apeIdentificationSaveFailed'));
    },
  });
}
