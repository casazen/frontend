import { ApiClient } from './client';
import type { AmenityCatalog, PropertyRoom, PropertyRoomInput, StayDiscountTier } from '@/types';

/**
 * The listing data of a unit that the channels ask for (E02/F03/US01, NF-34, NF-35): its rooms with their beds and its length-of-stay
 * discounts (`api/properties/{id}`). Both are read with `property.read` and replaced as a whole with `property.write`; a property of
 * another org answers 404.
 */
export const listingDataApi = {
  /** The rooms in order, each with its beds; an empty list while the host listed none. */
  getRooms: (propertyId: string) => ApiClient.get<PropertyRoom[]>(`/properties/${propertyId}/rooms`),

  /**
   * Replaces the rooms (at most 20; 1 to 10 beds of a kind in a room; at least one bed in all, so never an empty list): a room sent with
   * the `id` of a stored one updates it and keeps its photos, a stored room not sent is removed and its photos lose the room. The same
   * save sets the bedrooms and the beds of the property from them. 422 `property_rooms_invalid`; 404 `property_room_not_found`.
   */
  putRooms: (propertyId: string, rooms: PropertyRoomInput[]) => ApiClient.put<PropertyRoom[]>(`/properties/${propertyId}/rooms`, { rooms }),

  /** The tiers in order of nights; an empty list while the property has none. */
  getStayDiscounts: (propertyId: string) => ApiClient.get<StayDiscountTier[]>(`/properties/${propertyId}/stay-discounts`),

  /** Replaces the tiers (at most 5, each with its own minimum of 2 to 365 nights; an empty list removes them all). 422 `property_stay_discounts_invalid`. */
  putStayDiscounts: (propertyId: string, discounts: StayDiscountTier[]) =>
    ApiClient.put<StayDiscountTier[]>(`/properties/${propertyId}/stay-discounts`, { discounts }),
};

/**
 * The reference data of the amenities (NF-33): how the booking site names and groups each amenity a property can carry, in Italian and
 * English. Anonymous and the same for everybody: the one source of the labels and the groups, in the wizard and in the lists.
 */
export const amenityCatalogApi = {
  get: () => ApiClient.get<AmenityCatalog>('/public/amenities', undefined, { public: true }),
};
