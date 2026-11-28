import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertyImagesApi } from '@/api/property-images.api';
import { siteProfileApi } from '@/api/site-profile.api';
import { buildSiteProfileRequest, type ListingTextDraft } from '@/lib/listing-texts';
import { photoMetaInputs, type PhotoMetaDraft } from '@/lib/listing-photos';

const PROPERTIES_KEY = 'properties';

export const siteProfileKey = (propertyId: string | undefined) => [PROPERTIES_KEY, propertyId, 'site-profile'] as const;
const photoMetaKey = (propertyId: string | undefined) => [PROPERTIES_KEY, propertyId, 'photo-meta'] as const;

export function useSiteProfile(propertyId: string | undefined, options: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: siteProfileKey(propertyId),
    queryFn: () => siteProfileApi.get(propertyId!),
    enabled: Boolean(propertyId),
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

/**
 * Saves the texts of the languages other than Italian. The save of the profile replaces it as a whole, so the profile is read again
 * right before and everything else in it is sent back unchanged (`buildSiteProfileRequest`): the step never wipes what the booking site
 * shows. Silent, like the other saves of the wizard: the step tells how it went.
 */
export function useSaveListingTexts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId, drafts }: { propertyId: string; drafts: Record<string, ListingTextDraft> }) => {
      const current = await siteProfileApi.get(propertyId);
      return siteProfileApi.save(propertyId, buildSiteProfileRequest(current, drafts));
    },
    onSuccess: (profile, { propertyId }) => {
      queryClient.setQueryData(siteProfileKey(propertyId), profile);
    },
  });
}

export function usePropertyPhotoMeta(propertyId: string | undefined, options: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: photoMetaKey(propertyId),
    queryFn: () => siteProfileApi.getPhotos(propertyId!),
    enabled: Boolean(propertyId),
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

export function useSavePhotoMeta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId, drafts }: { propertyId: string; drafts: readonly PhotoMetaDraft[] }) => {
      const gallery = await propertyImagesApi.getAll(propertyId);
      return siteProfileApi.savePhotos(propertyId, photoMetaInputs(drafts, gallery.photoUrls));
    },
    onSuccess: (photos, { propertyId }) => {
      queryClient.setQueryData(photoMetaKey(propertyId), photos);
    },
  });
}
