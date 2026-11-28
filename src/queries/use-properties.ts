import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertiesApi } from '@/api/properties.api';
import type {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyDocumentType,
  RentalMode,
  PropertyCadastralData,
  ApeIdentification,
  PropertyDocumentDto,
} from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { apeReadFoundNothing, hasApeIdentification, rememberApeReadFoundNothing } from '@/lib/ape-documents';
import { saveBlobAs } from '@/lib/file-download';
import { propertyDeleteBlock } from '@/lib/property-delete-block';
import { toastUndo } from '@/lib/toast-undo';
import { ENTITLEMENT_QUERY_KEY } from '@/queries/use-users';
import { isPlanLimitError } from '@/lib/entitlement-error';

export const PROPERTIES_KEY = 'properties';
/** The reading again of one APE: outside the key of the documents, so that refreshing them never runs the OCR again. */
const APE_READ_KEY = 'ape-read';

export const SHORT_PROPERTIES_OVERVIEW = { mode: 'short', view: 'overview' } as const;

export function useProperties(
  params?: Record<string, string | number | boolean | undefined>,
  options: { fresh?: boolean; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, params],
    queryFn: () => propertiesApi.getAll(params),
    enabled: options.enabled ?? true,
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

export function useProperty(id: string, options: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, id],
    queryFn: () => propertiesApi.getById(id),
    enabled: !!id,
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

export function usePlanUsage(enabled = true) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, 'plan-usage'],
    queryFn: () => propertiesApi.getPlanUsage(),
    enabled,
    retry: false,
    refetchOnMount: 'always',
  });
}

export function useCancellationPolicies(enabled = true) {
  return useQuery({
    queryKey: [PROPERTIES_KEY, 'cancellation-policies'],
    queryFn: () => propertiesApi.getCancellationPolicies(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

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

export function useCreateProperty(rentalMode: RentalMode) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePropertyDto) => propertiesApi.create({ ...data, rentalMode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
      queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
      toast.success(i18n.t('toast.propertyCreated'));
    },
    onError: (error: unknown) => {
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
      // UI-07 (toastUndo): pausing has a true inverse, `activate` (idempotent, nothing else changes), so the toast offers it.
      toastUndo(i18n.t('toast.propertyPaused'), {
        undo: async () => {
          await propertiesApi.activate(id);
          invalidatePropertyCaches(queryClient, id);
          toast.success(i18n.t('toast.propertyActivated'));
        },
      });
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

export function useDeleteProperty({ explainBlocked = false }: { explainBlocked?: boolean } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => propertiesApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: [PROPERTIES_KEY, id] });
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
      // Usage of the plan, dashboard counters, calendar/bookings and compliance (CIN) lists all count properties.
      queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
      toast.success(i18n.t('toast.propertyDeleted'));
    },
    onError: (error) => {
      if (explainBlocked && propertyDeleteBlock(error)) return;
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.propertyDeleteFailed'));
    },
  });
}

export function useSetPropertyResponsible() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string | null }) => propertiesApi.setResponsible(id, userId),
    onSettled: (_data, _error, { id }) => invalidatePropertyCaches(queryClient, id),
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
    onSuccess: (document, variables) => {
      if (variables.documentType === 'Ape' && document?.id) {
        queryClient.setQueryData([APE_READ_KEY, document.id], document);
        if (!hasApeIdentification(document)) rememberApeReadFoundNothing(document.id);
      }
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.propertyId, 'detail'] });
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.propertyId, 'documents'] });
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
      queryClient.invalidateQueries({ queryKey: ['compliance', 'activation', variables.propertyId] });
      toast.success(i18n.t('toast.documentDeleted'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.documentDeleteFailed'));
    },
  });
}

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

/**
 * LT-10: the code and the energy class of a stored APE read again by the server (the file, and the public register of the region
 * for a code the file does not show), on request ("Leggi dall'APE"). Silent: the place that asks shows what was found, and asks
 * only for what was not. It succeeds once the documents shown were read again, so that they already carry what was found.
 */
export function useReadApeIdentification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, docId }: { propertyId: string; docId: string }) => propertiesApi.readApeIdentification(propertyId, docId),
    onSuccess: (document, variables) => {
      if (!hasApeIdentification(document)) rememberApeReadFoundNothing(variables.docId);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.propertyId, 'documents'] }),
        queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, variables.propertyId, 'detail'] }),
      ]);
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.apeReadFailed'));
    },
  });
}

/**
 * LT-10: an APE whose code and class are not there yet (uploaded before they were read automatically) is read again by the server
 * by itself, once per document: one query shared by the property page and the lease form, never again in this browser for a
 * document whose reading found nothing (see `apeReadFoundNothing`). `enabled`: the place shows this document for its contract
 * (the latest APE). Resolves once the documents shown were read again, so that they already carry what was found.
 */
export function useApeAutoRead(propertyId: string | undefined, document: PropertyDocumentDto | undefined, enabled = true) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [APE_READ_KEY, document?.id],
    queryFn: async () => {
      const read = await propertiesApi.readApeIdentification(propertyId!, document!.id);
      if (!hasApeIdentification(read)) rememberApeReadFoundNothing(document!.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, propertyId, 'documents'] }),
        queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, propertyId, 'detail'] }),
      ]);
      return read;
    },
    enabled:
      enabled &&
      !!propertyId &&
      document?.documentType === 'Ape' &&
      !hasApeIdentification(document) &&
      !apeReadFoundNothing(document.id),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
