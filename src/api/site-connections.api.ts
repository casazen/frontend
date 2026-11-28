import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { SiteConnection, SiteConnectionAuthorizeRequest, SiteConnectionAuthorizeResponse } from '@/types/site-connection.types';
import { ApiClient } from './client';

/**
 * The sites connected to the agency account (backend `SiteConnectionsController`, PLG-BE-CONNECT, NF-201, NF-203): the confirmation of a connection that the plugin for WordPress asked for,
 * the list of the active ones and the revocation of one. All three are the org billing administrator's (`RequireOrgBillingAdmin`, the route `orgId` must be the caller's org) and answer 404
 * while the embeddable pages (`SiteEmbed`) are off. The paths are relative to the API base URL, which already ends in `/api`.
 */
export const SiteConnectionsApi = {
  authorize: async (orgId: string, payload: SiteConnectionAuthorizeRequest): Promise<SiteConnectionAuthorizeResponse> => {
    const path = `/orgs/${orgId}/site-connections/authorize`;
    const answer = await ApiClient.post<unknown>(path, payload, { localAuthRecovery: true });
    if (answer === null || typeof answer !== 'object' || typeof (answer as { redirectUrl?: unknown }).redirectUrl !== 'string') throw new UnexpectedApiResponseError(path);
    return answer as SiteConnectionAuthorizeResponse;
  },

  list: async (orgId: string): Promise<SiteConnection[]> => {
    const path = `/orgs/${orgId}/site-connections`;
    const data = await ApiClient.get<unknown>(path);
    if (!Array.isArray(data)) throw new UnexpectedApiResponseError(path);
    return data as SiteConnection[];
  },

  revoke: (orgId: string, connectionId: string): Promise<void> => ApiClient.delete<void>(`/orgs/${orgId}/site-connections/${encodeURIComponent(connectionId)}`),
};
