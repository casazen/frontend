import { ApiClient } from './client';
import type { PropertyPhotoMeta, PropertyPhotoMetaInput, SiteProfile, SiteProfileRequest } from '@/types';

export const siteProfileApi = {
  get: (propertyId: string) => ApiClient.get<SiteProfile>(`/properties/${propertyId}/site-profile`),

  save: (propertyId: string, body: SiteProfileRequest) => ApiClient.put<SiteProfile>(`/properties/${propertyId}/site-profile`, body),

  getPhotos: (propertyId: string) => ApiClient.get<PropertyPhotoMeta[]>(`/properties/${propertyId}/site-profile/photos`),

  savePhotos: (propertyId: string, photos: PropertyPhotoMetaInput[]) =>
    ApiClient.put<PropertyPhotoMeta[]>(`/properties/${propertyId}/site-profile/photos`, { photos }),
};
