/**
 * The connection of an org to its channel manager (E02/F01, ADR-023). The shapes mirror the backend `api/octorate` endpoints
 * (`OctorateConnectionDtos`): enums travel as member names, dates as UTC ISO strings. Never a token, a code or a state.
 */

/** Where the connection stands. `Disconnected` is also what an org that never connected has; `Error` is a connection that exists but cannot be used. */
export type OctorateConnectionStatus = 'Connected' | 'Disconnected' | 'Error';

/** The environment of the channel manager this CasaZen works with: the sandbox on the test environment, the real one in production. */
export type OctorateEnvironment = 'Test' | 'Production';

/** `GET /api/octorate/connection`. */
export interface OctorateConnection {
  status: OctorateConnectionStatus;
  environment: OctorateEnvironment;
  /** Which account or network the consent covers, for display, when known. */
  accountId: string | null;
  /** When CasaZen last read the account (UTC). */
  lastSyncedAt: string | null;
  /** The quota of calls the channel manager reports, while connected and when it answered. */
  quotaLimit: number | null;
  quotaRemaining: number | null;
  /** True when a tenth of the quota or less is left. */
  quotaWarning: boolean;
}

/** `POST /api/octorate/connect/start`: the page of the channel manager where the host gives the consent. The single-use state of the consent travels inside it. */
export interface OctorateConnectStart {
  authorizationUrl: string;
}

/** `POST /api/octorate/connect/complete`: how many properties the consent covers. */
export interface OctorateConnectResult {
  status: OctorateConnectionStatus;
  environment: OctorateEnvironment;
  propertyCount: number;
}

/**
 * Where the mapping of a listing found on the channel manager to a CasaZen property stands (backend `OctorateMappingStatus`, E02/F01/US02).
 * `Proposed` is one clear candidate (or none: the listing is then offered for import), `Ambiguous` close or tied candidates a person must
 * choose from, `Confirmed` the only state in which CasaZen writes to the listing, `Rejected` a listing the person said is not theirs.
 */
export type OctorateMappingStatus = 'Proposed' | 'Confirmed' | 'Ambiguous' | 'Rejected';

/** A CasaZen property as the mapping screen names it (backend `OctoratePropertySummaryDto`). */
export interface OctoratePropertySummary {
  id: string;
  name: string;
  address: string;
  city: string;
}

/**
 * A channel of a listing (backend `OctorateChannelDto`): its code (142 Booking.com, 274 Airbnb, 235 Vrbo, 4 Expedia, ...), the id of the
 * listing on it exactly as the channel manager gives it, and its state (`Connected` when the channel manager holds a connection of the
 * listing to the channel).
 */
export interface OctorateChannel {
  channelId: string;
  externalId: string;
  state: string;
}

/** A room of a listing (backend `OctorateRoomDto`): the id the channel manager gives it, its name and the guests it takes. */
export interface OctorateRoom {
  id: string;
  name: string | null;
  maxGuests: number | null;
}

/**
 * `GET /api/octorate/properties` and `POST /api/octorate/properties/refresh` (backend `OctorateListingDto`): a listing found on the channel
 * manager with the proposal, the candidates, the channels and the rooms. No personal data. The key of the mapping endpoints is
 * `octorateAccommodationId`.
 */
export interface OctorateListing {
  octorateAccommodationId: string;
  name: string | null;
  address: string | null;
  city: string | null;
  /** The most guests a room of the listing takes, when known. */
  maxGuests: number | null;
  status: OctorateMappingStatus;
  /** The score of the best candidate, 0 to 100. */
  score: number;
  /** The proposed property, or the confirmed one; `null` for an ambiguous listing or one offered for import. */
  proposedProperty: OctoratePropertySummary | null;
  /** The candidates of an ambiguous listing that the caller reaches. */
  candidates: OctoratePropertySummary[];
  channels: OctorateChannel[];
  /** The rooms of the listing, when they were read. */
  rooms: OctorateRoom[];
  /** The chosen room, `null` until it is set. */
  octorateProductId: string | null;
  /** No CasaZen property matches: the host can import the listing as a new property. */
  offeredForImport: boolean;
  /** When a person confirmed the mapping (UTC). */
  confirmedAt: string | null;
}

/** Body of `PUT /api/octorate/mapping/{octorateAccommodationId}`: the property of the listing and, for a listing with several rooms, its room. */
export interface ConfirmMappingRequest {
  propertyId: string;
  octorateProductId?: string;
}

/** Body of `PUT /api/octorate/mapping/{octorateAccommodationId}/room`. */
export interface SetRoomRequest {
  octorateProductId: string;
}

/** `POST /api/octorate/mapping/{octorateAccommodationId}/import`: the CasaZen property created from the listing (nothing is created on the channel manager). */
export interface ImportListingResult {
  propertyId: string;
}

// ---------------------------------------------------------------------------------------------------------------------
// The listings that already exist on OTAs or in another channel manager (E02/F01/US03, D6, ADR-023): the scenario the host declares, the import
// batch and the access to each channel in the panel. They mirror the backend `OctorateExistingInventoryDtos` field for field, in camelCase.
// The scenario travels as its code (`onOctorate`, `onOtas`, `newInventory`); the other enums as their member names. The server never sends or
// takes a credential, a token or a payload of Octorate or of an OTA: only ids, codes, counts and instants.
// ---------------------------------------------------------------------------------------------------------------------

/** Where the listings of a property are today, the first question of the connect wizard (backend `OctorateInventoryScenarioCodes`). */
export const INVENTORY_SCENARIO_CODES = ['onOctorate', 'onOtas', 'newInventory'] as const;
export type InventoryScenarioCode = (typeof INVENTORY_SCENARIO_CODES)[number];

/**
 * Where an import of existing inventory stands, for a batch and for each of its channels (backend `OctorateInventoryImportStatus`). The first
 * seven are the steps in the order they run; the last three end or stop a channel (`NeedsAttention` waits for a person or for time).
 */
export type ExistingImportStatus =
  | 'Draft'
  | 'AwaitingChannelAccess'
  | 'ImportingRooms'
  | 'AwaitingMapping'
  | 'ImportingReservations'
  | 'ImportingCalendar'
  | 'MarkingConnected'
  | 'Completed'
  | 'Failed'
  | 'NeedsAttention';

/** Where the access to a channel in the panel stands (backend `ChannelAccessState`). */
export type ChannelAccessState = 'NotStarted' | 'Waiting' | 'Verifying' | 'NeedsConfirmation' | 'Verified' | 'Confirmed' | 'NotValid';

/** Which properties a batch is about: all the inventory, the properties named, or a named group of a mixed portfolio (backend `OctorateInventoryScopeKind`). */
export type InventoryScopeKind = 'AllInventory' | 'Properties' | 'Group';

/** The counts of the listings of a channel. */
export interface ExistingInventoryCounts {
  found: number;
  roomsImported: number;
  confirmed: number;
  pending: number;
  leftForLater: number;
  rejected: number;
  outOfScope: number;
  reservationsImported: number;
  calendarImported: number;
  connected: number;
  failed: number;
}

/** Which operations of the import are verified for the channel: one that is not stops with `d6_operation_unverified` and the step stays guided. */
export interface ExistingInventoryCapabilities {
  importRooms: boolean;
  importReservations: boolean;
  importCalendar: boolean;
  markConnected: boolean;
}

/** A listing of a channel with its progress: the ids Octorate gave and the state of its mapping; never a name, an address or a payload. */
export interface ExistingInventoryItem {
  octorateAccommodationId: string;
  octorateConnectionId: string;
  mappingStatus: OctorateMappingStatus | null;
  leftForLater: boolean;
  roomsImported: boolean;
  roomCount: number;
  reservationsImported: boolean;
  calendarImported: boolean;
  connected: boolean;
  /** A stable code (`d6_result_unknown`, `d6_operation_unverified`, ...) the screen translates. */
  errorCode: string | null;
}

/** A channel of a batch: where it stands, the counts of its listings and the listings themselves. */
export interface ExistingInventoryChannel {
  channelCode: string;
  status: ExistingImportStatus;
  errorCode: string | null;
  accessState: ChannelAccessState;
  accessCompletedAt: string | null;
  roomsImportedAt: string | null;
  completedAt: string | null;
  counts: ExistingInventoryCounts;
  capabilities: ExistingInventoryCapabilities;
  items: ExistingInventoryItem[];
  /**
   * The accommodation ids (`octorateAccommodationId`) whose id on the portal CasaZen gave to the channel manager with `connect`: the access then waits
   * only for the approval on the portal's own site. Absent or empty when nothing was connected that way.
   */
  connectedAccommodationIds?: string[];
}

/** `GET api/octorate/existing-inventory/batches/{id}`: progress, counts and stable error codes of an import; never a credential or a payload. */
export interface ExistingInventoryBatch {
  id: string;
  scenario: InventoryScenarioCode;
  scopeKind: InventoryScopeKind;
  group: string | null;
  propertyIds: string[];
  status: ExistingImportStatus;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  channels: ExistingInventoryChannel[];
}

/**
 * Body of `POST api/octorate/existing-inventory/batches`: the OTA channels (portal codes) and the properties it is about. Without `propertyIds` and
 * `group` it is the whole inventory; one narrows it; both is a 422, and so is an empty `propertyIds` (never «all»).
 */
export interface CreateExistingInventoryBatchRequest {
  channels: string[];
  propertyIds?: string[];
  group?: string;
}

/** `POST .../channels/{code}/access/start`: how to open the panel for a channel (the only answer that carries its address). */
export interface ChannelAccessStart {
  channelCode: string;
  alreadyComplete: boolean;
  handoffMode: 'redirectCallback' | 'managedWindow' | null;
  panelUrl: string | null;
}

/** A structure of the channel manager and the id it has on the portal (the id of the hotel, of the property): an identifier, never a credential. */
export interface ConnectChannelAccommodation {
  accommodationId: string;
  hotelId: string;
}

/** Body of `POST .../channels/{code}/connect`: only the structures that are on the portal, each with its id there. */
export interface ConnectChannelRequest {
  accommodations: ConnectChannelAccommodation[];
}

/** The scenario declared for a property, or for a named group with no property yet (`GET` and `PUT api/octorate/inventory-intents`). */
export interface InventoryIntent {
  propertyId: string | null;
  scenario: InventoryScenarioCode;
  group: string | null;
  updatedAt: string;
}

/** One assignment of a scenario: a property (or, with none, a named group) and what the host declared. */
export interface InventoryIntentAssignment {
  propertyId?: string;
  scenario: InventoryScenarioCode;
  group?: string;
}
