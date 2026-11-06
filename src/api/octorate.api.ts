import { ApiClient } from './client';
import type {
  ConfirmMappingRequest,
  ImportListingResult,
  OctorateConnection,
  OctorateConnectResult,
  OctorateConnectStart,
  OctorateListing,
  SetRoomRequest,
} from '@/types';

/** The mapping endpoints are keyed by the accommodation id the channel manager gives; it travels in the path, so it is encoded. */
const mappingPath = (octorateAccommodationId: string) => `/octorate/mapping/${encodeURIComponent(octorateAccommodationId)}`;

/**
 * The connection of the org to its channel manager (E02/F01, ADR-023): the endpoints of `api/octorate`. All of them answer 404 while the
 * backend flag `Features:OctorateConnector` is off. The consent is given on the site of the channel manager: CasaZen never sees a
 * password, and the code and the state of the callback are used once and never kept.
 */
export const octorateApi = {
  /** Where the connection stands, with the quota the channel manager reports while it is connected (`ota.read`). */
  getConnectionStatus: () => ApiClient.get<OctorateConnection>('/octorate/connection'),

  /** A new consent: the address of the page where the host gives it, to be opened in the same tab (`ota.write`, the whole org). */
  startConnect: () => ApiClient.post<OctorateConnectStart>('/octorate/connect/start'),

  /**
   * Completes the consent with what the callback page received. A `state` that is unknown, used, expired or of another org or user
   * is a 400 `octorate_state_invalid`; credentials of the other environment are a 409 `octorate_wrong_environment`; a code the
   * channel manager does not exchange is a 502 `octorate_exchange_failed`.
   */
  completeConnect: (code: string, state: string) =>
    ApiClient.post<OctorateConnectResult>('/octorate/connect/complete', { code, state }),

  /** Removes the connection (204). The mappings and what was imported stay. */
  disconnect: () => ApiClient.delete<void>('/octorate/connection'),

  /**
   * The listings found on the channel manager with their mapping, as CasaZen stored them (no call to the channel manager), limited to what
   * the caller reaches (`ota.read`). Empty until the listings were read once (`refreshListings`).
   */
  getFoundListings: () => ApiClient.get<OctorateListing[]>('/octorate/properties'),

  /**
   * Reads the listings on the channel manager again and proposes a property for each (`ota.write`). A listing already confirmed or
   * rejected is not touched. Answers the listings after the read; a 409 `octorate_not_connected` when the org is not connected.
   */
  refreshListings: () => ApiClient.post<OctorateListing[]>('/octorate/properties/refresh'),

  /**
   * Confirms the listing to a property (204, `ota.write`, and the caller must reach the property). `octorateProductId` is the room of a
   * listing with several rooms. 404 when the property is not the org's or not reachable; 409 `octorate_mapping_property_taken` when the
   * property is confirmed to another listing, `octorate_mapping_linked_to_other_property` when the listing is confirmed to another
   * property; 422 `octorate_room_invalid` for a room that does not belong to the listing.
   */
  confirmMapping: (octorateAccommodationId: string, propertyId: string, octorateProductId?: string) => {
    const body: ConfirmMappingRequest = octorateProductId ? { propertyId, octorateProductId } : { propertyId };
    return ApiClient.put<void>(mappingPath(octorateAccommodationId), body);
  },

  /**
   * Chooses the room of a listing that is already confirmed (204): a property is one unit, and a listing with several rooms needs to say
   * which one. 422 `octorate_room_invalid` for a room of another listing, `octorate_mapping_not_confirmed` for a listing not confirmed yet.
   */
  setMappingRoom: (octorateAccommodationId: string, octorateProductId: string) => {
    const body: SetRoomRequest = { octorateProductId };
    return ApiClient.put<void>(`${mappingPath(octorateAccommodationId)}/room`, body);
  },

  /** Says the listing is not one of the org's properties (204): refreshes leave it alone and it stops blocking the properties it could have been. */
  rejectMapping: (octorateAccommodationId: string) => ApiClient.delete<void>(mappingPath(octorateAccommodationId)),

  /**
   * Imports the listing as a new CasaZen property, inactive and to check, and confirms the mapping (201). Nothing is created on the
   * channel manager. 409 `plan_limit_reached` at the limit of the plan, `octorate_mapping_already_confirmed` for a confirmed listing.
   */
  importListing: (octorateAccommodationId: string) =>
    ApiClient.post<ImportListingResult>(`${mappingPath(octorateAccommodationId)}/import`),
};
