import { ApiClient } from './client';
import type {
  ChannelAccessStart,
  ConfirmMappingRequest,
  ConnectChannelRequest,
  CreateExistingInventoryBatchRequest,
  ExistingInventoryBatch,
  ImportListingResult,
  InventoryIntent,
  InventoryIntentAssignment,
  OctorateConnection,
  OctorateConnectResult,
  OctorateConnectStart,
  OctorateListing,
  SetRoomRequest,
} from '@/types';

const mappingPath = (octorateAccommodationId: string) => `/octorate/mapping/${encodeURIComponent(octorateAccommodationId)}`;

const batchPath = (batchId: string) => `/octorate/existing-inventory/batches/${encodeURIComponent(batchId)}`;
const channelPath = (batchId: string, channelCode: string) => `${batchPath(batchId)}/channels/${encodeURIComponent(channelCode)}`;
const channelAccessPath = (batchId: string, channelCode: string) => `${channelPath(batchId, channelCode)}/access`;

/**
 * The connection of the org to its channel manager (E02/F01, ADR-023): the endpoints of `api/octorate`. All of them answer 404 while the
 * backend flag `Features:OctorateConnector` is off. The consent is given on the site of the channel manager: CasaZen never sees a
 * password, and the code and the state of the callback are used once and never kept.
 */
export const octorateApi = {
  getConnectionStatus: () => ApiClient.get<OctorateConnection>('/octorate/connection'),

  startConnect: () => ApiClient.post<OctorateConnectStart>('/octorate/connect/start'),

  /**
   * Completes the consent with what the callback page received. A `state` that is unknown, used, expired or of another org or user
   * is a 400 `octorate_state_invalid`; credentials of the other environment are a 409 `octorate_wrong_environment`; a code the
   * channel manager does not exchange is a 502 `octorate_exchange_failed`.
   */
  completeConnect: (code: string, state: string) =>
    ApiClient.post<OctorateConnectResult>('/octorate/connect/complete', { code, state }),

  disconnect: () => ApiClient.delete<void>('/octorate/connection'),

  getFoundListings: () => ApiClient.get<OctorateListing[]>('/octorate/properties'),

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

  setMappingRoom: (octorateAccommodationId: string, octorateProductId: string) => {
    const body: SetRoomRequest = { octorateProductId };
    return ApiClient.put<void>(`${mappingPath(octorateAccommodationId)}/room`, body);
  },

  rejectMapping: (octorateAccommodationId: string) => ApiClient.delete<void>(mappingPath(octorateAccommodationId)),

  importListing: (octorateAccommodationId: string) =>
    ApiClient.post<ImportListingResult>(`${mappingPath(octorateAccommodationId)}/import`),

  createExistingInventoryBatch: (request: CreateExistingInventoryBatchRequest) =>
    ApiClient.post<ExistingInventoryBatch>('/octorate/existing-inventory/batches', request),

  getExistingInventoryBatch: (batchId: string) => ApiClient.get<ExistingInventoryBatch>(batchPath(batchId)),

  startChannelAccess: (batchId: string, channelCode: string) => ApiClient.post<ChannelAccessStart>(`${channelAccessPath(batchId, channelCode)}/start`),

  confirmChannelAccess: (batchId: string, channelCode: string) => ApiClient.post<ExistingInventoryBatch>(`${channelAccessPath(batchId, channelCode)}/confirm`),

  connectChannel: (batchId: string, channelCode: string, request: ConnectChannelRequest) =>
    ApiClient.post<ExistingInventoryBatch>(`${channelPath(batchId, channelCode)}/connect`, request),

  runExistingInventoryBatch: (batchId: string, retryUnknown?: readonly string[]) =>
    ApiClient.post<ExistingInventoryBatch>(`${batchPath(batchId)}/run`, retryUnknown && retryUnknown.length > 0 ? { retryUnknown } : {}),

  continueExistingInventoryBatch: (batchId: string, options: { leaveForLater?: readonly string[]; retryUnknown?: readonly string[] } = {}) =>
    ApiClient.post<ExistingInventoryBatch>(`${batchPath(batchId)}/continue`, {
      ...(options.leaveForLater && options.leaveForLater.length > 0 ? { leaveForLater: options.leaveForLater } : {}),
      ...(options.retryUnknown && options.retryUnknown.length > 0 ? { retryUnknown: options.retryUnknown } : {}),
    }),

  getInventoryIntents: () => ApiClient.get<InventoryIntent[]>('/octorate/inventory-intents'),

  setInventoryIntents: (assignments: readonly InventoryIntentAssignment[]) => ApiClient.put<InventoryIntent[]>('/octorate/inventory-intents', { assignments }),
};
