import axios from '@/lib/axios';
import { ApiClient } from './client';
import type { Property } from '@/types';

export const propertyImagesApi = {
  // POST /api/properties/{id}/images (multipart/form-data)
  async upload(propertyId: string, images: File[]): Promise<{ property: Property; uploadedImages: string[] }> {
    const formData = new FormData();
    images.forEach((image) => {
      formData.append('images', image);
    });

    const response = await axios.post<{ property: Property; uploadedImages: string[] }>(
      `/properties/${propertyId}/images`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  // GET /api/properties/{id}/images
  getAll: (propertyId: string) =>
    ApiClient.get<string[]>(`/properties/${propertyId}/images`),

  // DELETE /api/properties/{id}/images/{imageIndex}
  delete: (propertyId: string, imageIndex: number) =>
    ApiClient.delete<Property>(`/properties/${propertyId}/images/${imageIndex}`),

  // PUT /api/properties/{id}/images/order
  reorder: (propertyId: string, orderedImageUrls: string[]) =>
    ApiClient.put<Property>(`/properties/${propertyId}/images/order`, orderedImageUrls),
};
