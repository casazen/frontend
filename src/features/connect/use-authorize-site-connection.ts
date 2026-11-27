import { useMutation } from '@tanstack/react-query';
import { SiteConnectionsApi } from '@/api/site-connections.api';
import { reduceSiteConnectionError, SiteConnectionError } from '@/lib/site-connection-error';
import { safeRedirectTarget, toAuthorizeRequest, type ConnectRequest } from './connect-params';

/**
 * «Collega»: asks the server to confirm that the site of the plugin may connect to the org (`POST /orgs/{orgId}/site-connections/authorize`). It answers the address the whole window goes to,
 * which carries the one-time code: it comes from the server, is used only if it is on the origin of the site that asked (`safeRedirectTarget`) and is never built here from the `return` of the
 * address of the page. Nothing of the call stays in the cache of the mutations (`gcTime: 0`), and a failure is reduced to a `SiteConnectionError`: its status, its code and its message.
 */
export function useAuthorizeSiteConnection(orgId: string | undefined) {
  return useMutation<string, SiteConnectionError, ConnectRequest>({
    gcTime: 0,
    mutationFn: async (request) => {
      try {
        const answer = await SiteConnectionsApi.authorize(orgId!, toAuthorizeRequest(request));
        const target = safeRedirectTarget(answer.redirectUrl, request.siteUrl);
        if (target === null) throw new SiteConnectionError(undefined, 'unexpected_redirect', undefined);
        return target;
      } catch (error) {
        throw reduceSiteConnectionError(error);
      }
    },
  });
}
