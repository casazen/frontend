import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { SiteConnectionsApi } from '@/api/site-connections.api';
import { reduceSiteConnectionError, type SiteConnectionError } from '@/lib/site-connection-error';

export const SITE_CONNECTIONS_QUERY_KEY = 'site-connections';

/**
 * The sites connected to the agency account (PLG-FE-CONSOLE, NF-203), the newest first. A site connects from WordPress, in another tab or another browser, without this page doing
 * anything: the list is read again on every visit and whenever the window comes back (`refetchOnMount: 'always'`, no stale time). While the last read failed the page shows the error and
 * never the list of an older read (`isError` comes first there): a refused read leaves the old data in the query.
 */
export function useSiteConnections(orgId: string | undefined) {
  return useQuery({
    queryKey: [SITE_CONNECTIONS_QUERY_KEY, orgId],
    queryFn: () => SiteConnectionsApi.list(orgId!),
    enabled: !!orgId,
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

/**
 * «Scollega»: the connection is revoked and the credential of the site stops working at once. Whatever the answer, the list is read again: it is the server's (a 404, the connection is not
 * there any more, leaves its row only until the list is read). The person is told in a toast, with the words of the server for a refusal it has words for. Nothing of the call stays in the
 * cache of the mutations (`gcTime: 0`), and a failure is reduced to its status, its code and its message (`SiteConnectionError`).
 */
export function useRevokeSiteConnection(orgId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<void, SiteConnectionError, string>({
    mutationFn: async (connectionId) => {
      try {
        await SiteConnectionsApi.revoke(orgId!, connectionId);
      } catch (error) {
        throw reduceSiteConnectionError(error);
      }
    },
    gcTime: 0,
    onSuccess: () => {
      toast.success(i18n.t('embed.settings.sites.revoked'));
    },
    onError: (error) => {
      toast.error(error.userMessage ?? i18n.t('embed.settings.sites.revokeFailed'));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [SITE_CONNECTIONS_QUERY_KEY, orgId] }),
  });
}
