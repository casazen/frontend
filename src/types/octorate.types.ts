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
