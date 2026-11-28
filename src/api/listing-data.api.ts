import { ApiClient } from './client';
import type { AmenityCatalog, PropertyRoom, PropertyRoomInput, StayDiscountTier } from '@/types';

export const listingDataApi = {
  getRooms: (propertyId: string) => ApiClient.get<PropertyRoom[]>(`/properties/${propertyId}/rooms`),

  /**
   * Replaces the rooms (at most 20; 1 to 10 beds of a kind in a room; at least one bed in all, so never an empty list): a room sent with
   * the `id` of a stored one updates it and keeps its photos, a stored room not sent is removed and its photos lose the room. The same
   * save sets the bedrooms and the beds of the property from them. 422 `property_rooms_invalid`; 404 `property_room_not_found`.
   */
  putRooms: (propertyId: string, rooms: PropertyRoomInput[]) => ApiClient.put<PropertyRoom[]>(`/properties/${propertyId}/rooms`, { rooms }),

  getStayDiscounts: (propertyId: string) => ApiClient.get<StayDiscountTier[]>(`/properties/${propertyId}/stay-discounts`),

  putStayDiscounts: (propertyId: string, discounts: StayDiscountTier[]) =>
    ApiClient.put<StayDiscountTier[]>(`/properties/${propertyId}/stay-discounts`, { discounts }),
};

export const amenityCatalogApi = {
  get: () => ApiClient.get<AmenityCatalog>('/public/amenities', undefined, { public: true }),
};
