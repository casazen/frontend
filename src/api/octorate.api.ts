import { ApiClient } from './client';
import type {
  ChannelAccessStart,
  ConfirmMappingRequest,
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

/** The mapping endpoints are keyed by the accommodation id the channel manager gives; it travels in the path, so it is encoded. */
const mappingPath = (octorateAccommodationId: string) => `/octorate/mapping/${encodeURIComponent(octorateAccommodationId)}`;

/** The import of the listings that already exist on OTAs: a batch, and the channels of a batch by the portal code. */
const batchPath = (batchId: string) => `/octorate/existing-inventory/batches/${encodeURIComponent(batchId)}`;
const channelAccessPath = (batchId: string, channelCode: string) => `${batchPath(batchId)}/channels/${encodeURIComponent(channelCode)}/access`;

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

  // ---- The listings that already exist on OTAs or in another channel manager (E02/F01/US03, D6). Nothing here creates or publishes a listing:
  // no endpoint takes a username, a password, a cookie or an OTA token, and the access to a channel is given on the panel of the channel manager.

  /**
   * Starts an import for the OTA channels the host uses (`onOtas`), for the whole inventory or the properties or the group named (201). Nothing is
   * called on the channel manager. 403 `existing_inventory_needs_whole_org`; 404 `octorate_property_not_found`; 422
   * `existing_inventory_channels_required`, `existing_inventory_channel_not_supported`, `existing_inventory_scope_invalid`.
   */
  createExistingInventoryBatch: (request: CreateExistingInventoryBatchRequest) =>
    ApiClient.post<ExistingInventoryBatch>('/octorate/existing-inventory/batches', request),

  /** The batch as stored: the steps, the counts and the stable error codes of each channel. Reading it also reads the result of the channel access when it is due. */
  getExistingInventoryBatch: (batchId: string) => ApiClient.get<ExistingInventoryBatch>(batchPath(batchId)),

  /**
   * Starts (or reuses) the handoff to the panel for the access to a channel: the step and the point to come back to are stored before the answer,
   * which carries how and where to open the panel (a channel already given answers `alreadyComplete`). 409 `octorate_panel_url_missing`.
   */
  startChannelAccess: (batchId: string, channelCode: string) => ApiClient.post<ChannelAccessStart>(`${channelAccessPath(batchId, channelCode)}/start`),

  /**
   * The host says the access was given: accepted only after a check stored that CasaZen cannot tell. 409 `panel_step_verification_required`,
   * `panel_step_not_valid`.
   */
  confirmChannelAccess: (batchId: string, channelCode: string) => ApiClient.post<ExistingInventoryBatch>(`${channelAccessPath(batchId, channelCode)}/confirm`),

  /**
   * Imports the rooms of every channel whose access is given and stops at `AwaitingMapping`; repeating it is safe. `retryUnknown` names the
   * listings (by accommodation id) whose last operation has an unknown result and that the host checked in the panel. 409
   * `existing_inventory_access_pending` while no channel has its access.
   */
  runExistingInventoryBatch: (batchId: string, retryUnknown?: readonly string[]) =>
    ApiClient.post<ExistingInventoryBatch>(`${batchPath(batchId)}/run`, retryUnknown && retryUnknown.length > 0 ? { retryUnknown } : {}),

  /**
   * Goes on for the listings the host confirmed (reservations, calendars, «mark connected»); `leaveForLater` names the listings left for later
   * (by accommodation id): they stay write-blocked and are not marked connected. 409 `existing_inventory_mapping_pending`,
   * `existing_inventory_not_ready`.
   */
  continueExistingInventoryBatch: (batchId: string, options: { leaveForLater?: readonly string[]; retryUnknown?: readonly string[] } = {}) =>
    ApiClient.post<ExistingInventoryBatch>(`${batchPath(batchId)}/continue`, {
      ...(options.leaveForLater && options.leaveForLater.length > 0 ? { leaveForLater: options.leaveForLater } : {}),
      ...(options.retryUnknown && options.retryUnknown.length > 0 ? { retryUnknown: options.retryUnknown } : {}),
    }),

  /** The scenario declared for each property or group of the org the caller reaches. */
  getInventoryIntents: () => ApiClient.get<InventoryIntent[]>('/octorate/inventory-intents'),

  /**
   * Declares the scenario of each property (or named group with no property yet) of a mixed portfolio. `newInventory` is refused while an import or a
   * mapping exists for the property (409 `inventory_intent_change_refused`); 422 `inventory_scenario_invalid`, `inventory_group_required`,
   * `inventory_intent_duplicate`; 404 for a property of another org or out of reach.
   */
  setInventoryIntents: (assignments: readonly InventoryIntentAssignment[]) => ApiClient.put<InventoryIntent[]>('/octorate/inventory-intents', { assignments }),
};
