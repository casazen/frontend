import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { propertyImagesApi } from '@/api/property-images.api';
import i18n from '@/i18n/config';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import type { PropertyPhotosDto } from '@/types';

const PROPERTIES_KEY = 'properties';

const propertyPhotosKey = (propertyId: string | undefined) => [PROPERTIES_KEY, propertyId, 'photos'] as const;

export function usePropertyPhotos(propertyId: string | undefined) {
  return useQuery({
    queryKey: propertyPhotosKey(propertyId),
    queryFn: () => propertyImagesApi.getAll(propertyId!),
    enabled: Boolean(propertyId),
  });
}

function applyGallery(queryClient: QueryClient, propertyId: string, gallery: PropertyPhotosDto) {
  queryClient.setQueryData(propertyPhotosKey(propertyId), gallery);
  void queryClient.invalidateQueries({
    queryKey: [PROPERTIES_KEY],
    predicate: (query) => query.queryKey[2] !== 'photos',
  });
}

function refreshWhenOutdated(queryClient: QueryClient, propertyId: string, error: unknown) {
  const status = getHttpStatus(error);
  if (status === 404 || status === 409) void queryClient.invalidateQueries({ queryKey: propertyPhotosKey(propertyId) });
}

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

export function useUploadOnePropertyPhoto(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => propertyImagesApi.upload(propertyId, [file]),
    onSuccess: (gallery) => applyGallery(queryClient, propertyId, gallery),
    onError: (error) => refreshWhenOutdated(queryClient, propertyId, error),
  });
}

export function useRemovePropertyPhotoQuietly(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoUrl: string) => propertyImagesApi.remove(propertyId, photoUrl),
    onSuccess: (gallery) => applyGallery(queryClient, propertyId, gallery),
    onError: (error) => refreshWhenOutdated(queryClient, propertyId, error),
  });
}

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
