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
