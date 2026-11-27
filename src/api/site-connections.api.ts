import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { SiteConnection, SiteConnectionAuthorizeRequest, SiteConnectionAuthorizeResponse } from '@/types/site-connection.types';
import { ApiClient } from './client';

/**
 * The sites connected to the agency account (backend `SiteConnectionsController`, PLG-BE-CONNECT, NF-201, NF-203): the confirmation of a connection that the plugin for WordPress asked for,
 * the list of the active ones and the revocation of one. All three are the org billing administrator's (`RequireOrgBillingAdmin`, the route `orgId` must be the caller's org) and answer 404
 * while the embeddable pages (`SiteEmbed`) are off. The paths are relative to the API base URL, which already ends in `/api`.
 */
export const SiteConnectionsApi = {
  /**
   * The administrator confirms that a site may connect: the answer is the address the browser goes back to on the site (`redirectUrl`, with the one-time code and the state added).
   * 400 `site_connection_invalid_request` for any request that breaks a rule of the contract; 429 past ten in ten minutes for the same person. A refusal of the account (401, 403) stays on
   * the page that asked, which says that only an administrator of the agency can connect a site (`localAuthRecovery`).
   */
  authorize: async (orgId: string, payload: SiteConnectionAuthorizeRequest): Promise<SiteConnectionAuthorizeResponse> => {
    const path = `/orgs/${orgId}/site-connections/authorize`;
    const answer = await ApiClient.post<unknown>(path, payload, { localAuthRecovery: true });
    if (answer === null || typeof answer !== 'object' || typeof (answer as { redirectUrl?: unknown }).redirectUrl !== 'string') throw new UnexpectedApiResponseError(path);
    return answer as SiteConnectionAuthorizeResponse;
  },

  /** The active connected sites of the org, the newest first (the revoked ones are not listed). */
  list: async (orgId: string): Promise<SiteConnection[]> => {
    const path = `/orgs/${orgId}/site-connections`;
    const data = await ApiClient.get<unknown>(path);
    if (!Array.isArray(data)) throw new UnexpectedApiResponseError(path);
    return data as SiteConnection[];
  },

  /** «Scollega»: the credential of the site stops working at once. 204; 404 `site_connection_not_found` for a connection that is not one of the org. */
  revoke: (orgId: string, connectionId: string): Promise<void> => ApiClient.delete<void>(`/orgs/${orgId}/site-connections/${encodeURIComponent(connectionId)}`),
};
