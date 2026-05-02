import { apiClient } from './client';
import type { Property } from '@/types';

export const propertyImagesApi = {
  // POST /api/properties/{id}/images
  async upload(propertyId: string, images: File[]): Promise<{ property: Property; uploadedImages: string[] }> {
    const formData = new FormData();
    images.forEach((image) => {
      formData.append('images', image);
    });

    const response = await apiClient.post<{ property: Property; uploadedImages: string[] }>(
      `/properties/${propertyId}/images`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // GET /api/properties/{id}/images
  async getAll(propertyId: string): Promise<string[]> {
    const response = await apiClient.get<string[]>(`/properties/${propertyId}/images`);
    return response.data;
  },

  // DELETE /api/properties/{id}/images/{imageIndex}
  async delete(propertyId: string, imageIndex: number): Promise<Property> {
    const response = await apiClient.delete<Property>(`/properties/${propertyId}/images/${imageIndex}`);
    return response.data;
  },

  // PUT /api/properties/{id}/images/order
  async reorder(propertyId: string, orderedImageUrls: string[]): Promise<Property> {
    const response = await apiClient.put<Property>(
      `/properties/${propertyId}/images/order`,
      orderedImageUrls
    );
    return response.data;
  },
};
