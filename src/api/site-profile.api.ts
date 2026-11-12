import { ApiClient } from './client';
import type { PropertyPhotoMeta, PropertyPhotoMetaInput, SiteProfile, SiteProfileRequest } from '@/types';

/**
 * The site profile of a property and the captions of its photos (`api/properties/{id}/site-profile`, DB-11a, NF-31, NF-32): read with
 * `property.read`, written with `property.write`. The save of the profile **replaces** it: the body is the whole profile.
 */
export const siteProfileApi = {
  /** The profile as the editor shows it, with the texts of the listing in every language (`translations`) and who wrote each (`origins`). */
  get: (propertyId: string) => ApiClient.get<SiteProfile>(`/properties/${propertyId}/site-profile`),

  /** Replaces the profile and answers with what is stored. 422 `property_site_profile_*` with the `field` that broke the rule. */
  save: (propertyId: string, body: SiteProfileRequest) => ApiClient.put<SiteProfile>(`/properties/${propertyId}/site-profile`, body),

  /** The photos of the gallery in display order, each with its caption (Italian and English), its size and its room. */
  getPhotos: (propertyId: string) => ApiClient.get<PropertyPhotoMeta[]>(`/properties/${propertyId}/site-profile/photos`),

  /**
   * Sets the caption and the room of the photos listed and clears both for the gallery photos not listed, so the editor sends them all.
   * 404 `property_photo_not_found` for an address that is not in the gallery, `property_room_not_found` for a room that is not the
   * property's; 422 `property_site_profile_italian_required` for an English caption without the Italian one.
   */
  savePhotos: (propertyId: string, photos: PropertyPhotoMetaInput[]) =>
    ApiClient.put<PropertyPhotoMeta[]>(`/properties/${propertyId}/site-profile/photos`, { photos }),
};
