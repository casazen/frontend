import axios from '@/lib/axios';
import { ApiClient } from './client';
import type { PropertyPhotosDto } from '@/types';

const UPLOAD_TIMEOUT_MS = 120_000;

export const propertyImagesApi = {
  getAll: (propertyId: string) => ApiClient.get<PropertyPhotosDto>(`/properties/${propertyId}/images`),

  async upload(propertyId: string, files: File[]): Promise<PropertyPhotosDto> {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    const response = await axios.post<PropertyPhotosDto>(`/properties/${propertyId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
    });
    return response.data;
  },

  remove: (propertyId: string, photoUrl: string) =>
    ApiClient.delete<PropertyPhotosDto>(`/properties/${propertyId}/images?url=${encodeURIComponent(photoUrl)}`),

  reorder: (propertyId: string, orderedPhotoUrls: string[]) =>
    ApiClient.put<PropertyPhotosDto>(`/properties/${propertyId}/images/order`, orderedPhotoUrls),

  setCover: (propertyId: string, photoUrl: string) =>
    ApiClient.put<PropertyPhotosDto>(`/properties/${propertyId}/images/cover`, { url: photoUrl }),
};
