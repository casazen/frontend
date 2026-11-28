/**
 * The connection of an org to its channel manager (E02/F01, ADR-023). The shapes mirror the backend `api/octorate` endpoints
 * (`OctorateConnectionDtos`): enums travel as member names, dates as UTC ISO strings. Never a token, a code or a state.
 */

export type OctorateConnectionStatus = 'Connected' | 'Disconnected' | 'Error';

export type OctorateEnvironment = 'Test' | 'Production';

export interface OctorateConnection {
  status: OctorateConnectionStatus;
  environment: OctorateEnvironment;
  accountId: string | null;
  lastSyncedAt: string | null;
  quotaLimit: number | null;
  quotaRemaining: number | null;
  quotaWarning: boolean;
}

export interface OctorateConnectStart {
  authorizationUrl: string;
}

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
type OctorateMappingStatus = 'Proposed' | 'Confirmed' | 'Ambiguous' | 'Rejected';

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
interface OctorateChannel {
  channelId: string;
  externalId: string;
  state: string;
}

export interface OctorateRoom {
  id: string;
  name: string | null;
  maxGuests: number | null;
}

export interface OctorateListing {
  octorateAccommodationId: string;
  name: string | null;
  address: string | null;
  city: string | null;
  maxGuests: number | null;
  status: OctorateMappingStatus;
  score: number;
  proposedProperty: OctoratePropertySummary | null;
  candidates: OctoratePropertySummary[];
  channels: OctorateChannel[];
  rooms: OctorateRoom[];
  octorateProductId: string | null;
  offeredForImport: boolean;
  confirmedAt: string | null;
}

export interface ConfirmMappingRequest {
  propertyId: string;
  octorateProductId?: string;
}

export interface SetRoomRequest {
  octorateProductId: string;
}

export interface ImportListingResult {
  propertyId: string;
}

// ---------------------------------------------------------------------------------------------------------------------
// The listings that already exist on OTAs or in another channel manager (E02/F01/US03, D6, ADR-023): the scenario the host declares, the import
// batch and the access to each channel in the panel. They mirror the backend `OctorateExistingInventoryDtos` field for field, in camelCase.
// The scenario travels as its code (`onOctorate`, `onOtas`, `newInventory`); the other enums as their member names. The server never sends or
// takes a credential, a token or a payload of Octorate or of an OTA: only ids, codes, counts and instants.
// ---------------------------------------------------------------------------------------------------------------------

export const INVENTORY_SCENARIO_CODES = ['onOctorate', 'onOtas', 'newInventory'] as const;
export type InventoryScenarioCode = (typeof INVENTORY_SCENARIO_CODES)[number];

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

export type ChannelAccessState = 'NotStarted' | 'Waiting' | 'Verifying' | 'NeedsConfirmation' | 'Verified' | 'Confirmed' | 'NotValid';

type InventoryScopeKind = 'AllInventory' | 'Properties' | 'Group';

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

interface ExistingInventoryCapabilities {
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
  errorCode: string | null;
}

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

export interface ConnectChannelRequest {
  accommodations: ConnectChannelAccommodation[];
}

export interface InventoryIntent {
  propertyId: string | null;
  scenario: InventoryScenarioCode;
  group: string | null;
  updatedAt: string;
}

export interface InventoryIntentAssignment {
  propertyId?: string;
  scenario: InventoryScenarioCode;
  group?: string;
}
