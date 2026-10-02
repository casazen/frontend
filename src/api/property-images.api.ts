import axios from '@/lib/axios';
import { ApiClient } from './client';
import type { PropertyPhotosDto } from '@/types';

/** Up to 10 photos of 10 MB in one request: more than the default 30 s on a slow connection. */
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Photo gallery of a property (PC-04): `/api/properties/{id}/images`. Every call answers with the gallery as it is
 * after the change (photos in display order, the first is the cover, and the upload rules).
 */
export const propertyImagesApi = {
  /** GET /api/properties/{id}/images */
  getAll: (propertyId: string) => ApiClient.get<PropertyPhotosDto>(`/properties/${propertyId}/images`),

  /** POST /api/properties/{id}/images (multipart field `images`): all the files are stored, or none. */
  async upload(propertyId: string, files: File[]): Promise<PropertyPhotosDto> {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    const response = await axios.post<PropertyPhotosDto>(`/properties/${propertyId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
    });
    return response.data;
  },

  /** DELETE /api/properties/{id}/images?url=... : by URL, never by position (another tab may have changed it). */
  remove: (propertyId: string, photoUrl: string) =>
    ApiClient.delete<PropertyPhotosDto>(`/properties/${propertyId}/images?url=${encodeURIComponent(photoUrl)}`),

  /** PUT /api/properties/{id}/images/order: every photo URL of the gallery, once, in the new order. */
  reorder: (propertyId: string, orderedPhotoUrls: string[]) =>
    ApiClient.put<PropertyPhotosDto>(`/properties/${propertyId}/images/order`, orderedPhotoUrls),

  /** PUT /api/properties/{id}/images/cover: the photo moves first. */
  setCover: (propertyId: string, photoUrl: string) =>
    ApiClient.put<PropertyPhotosDto>(`/properties/${propertyId}/images/cover`, { url: photoUrl }),
};
