import { ApiClient } from './client';
import type { OctorateConnection, OctorateConnectResult, OctorateConnectStart } from '@/types';

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
};
