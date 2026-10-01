import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { propertyImagesApi } from '@/api/property-images.api';
import i18n from '@/i18n/config';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import type { PropertyPhotosDto } from '@/types';

const PROPERTIES_KEY = 'properties';

export const propertyPhotosKey = (propertyId: string | undefined) => [PROPERTIES_KEY, propertyId, 'photos'] as const;

/** Photo gallery of a property (PC-04): the photos in display order (the first is the cover) and the upload rules. */
export function usePropertyPhotos(propertyId: string | undefined) {
  return useQuery({
    queryKey: propertyPhotosKey(propertyId),
    queryFn: () => propertyImagesApi.getAll(propertyId!),
    enabled: Boolean(propertyId),
  });
}

/**
 * Every change answers with the gallery as it is now: it replaces the cached one at once, and the other reads of the
 * property that show photos (list cards, record, detail with its carousel) are refreshed.
 */
function applyGallery(queryClient: QueryClient, propertyId: string, gallery: PropertyPhotosDto) {
  queryClient.setQueryData(propertyPhotosKey(propertyId), gallery);
  void queryClient.invalidateQueries({
    queryKey: [PROPERTIES_KEY],
    predicate: (query) => query.queryKey[2] !== 'photos',
  });
}

/** 404 (photo already deleted) and 409 (order of an older gallery): another tab or user changed it, show it as it is. */
function refreshWhenOutdated(queryClient: QueryClient, propertyId: string, error: unknown) {
  const status = getHttpStatus(error);
  if (status === 404 || status === 409) void queryClient.invalidateQueries({ queryKey: propertyPhotosKey(propertyId) });
}

/**
 * Uploads photos (all or none). Errors: toast here, and the same message inline in the gallery (`error` of the
 * mutation).
 */
export function useUploadPropertyPhotos(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => propertyImagesApi.upload(propertyId, files),
    onSuccess: (gallery, files) => {
      applyGallery(queryClient, propertyId, gallery);
      toast.success(i18n.t('property.photos.uploaded', { count: files.length }));
    },
    onError: (error) => {
      refreshWhenOutdated(queryClient, propertyId, error);
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('property.photos.uploadFailed'));
    },
  });
}

/** Deletes a photo (the storage object goes with it). */
export function useDeletePropertyPhoto(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoUrl: string) => propertyImagesApi.remove(propertyId, photoUrl),
    onSuccess: (gallery) => {
      applyGallery(queryClient, propertyId, gallery);
      toast.success(i18n.t('property.photos.deleted'));
    },
    onError: (error) => {
      refreshWhenOutdated(queryClient, propertyId, error);
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('property.photos.deleteFailed'));
    },
  });
}

/** Saves a new order of the whole gallery (the first photo becomes the cover). */
export function useReorderPropertyPhotos(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedPhotoUrls: string[]) => propertyImagesApi.reorder(propertyId, orderedPhotoUrls),
    onSuccess: (gallery) => applyGallery(queryClient, propertyId, gallery),
    onError: (error) => {
      refreshWhenOutdated(queryClient, propertyId, error);
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('property.photos.reorderFailed'));
    },
  });
}

/** Makes a photo the cover of the property. */
export function useSetPropertyCoverPhoto(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoUrl: string) => propertyImagesApi.setCover(propertyId, photoUrl),
    onSuccess: (gallery) => {
      applyGallery(queryClient, propertyId, gallery);
      toast.success(i18n.t('property.photos.coverSet'));
    },
    onError: (error) => {
      refreshWhenOutdated(queryClient, propertyId, error);
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('property.photos.coverFailed'));
    },
  });
}
