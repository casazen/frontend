import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { OrgTrackingApi } from '@/api/org-tracking.api';
import { normalizeGtmContainerId } from '@/features/host-tracking/gtm-loader';
import type { OrgDomainConfig } from '@/types/domain.types';
import { ORG_DOMAIN_QUERY_KEY } from '../domain/use-org-domain';

/** What the person typed in the field of the container: nothing (clears it), a container as the backend stores it (upper case), or something that is not one. */
export type GtmDraft = { state: 'empty' } | { state: 'invalid' } | { state: 'valid'; id: string };

/**
 * The container as `GTM-` and 4 to 12 letters or digits, after trimming and upper-casing (the rule of the backend, `GtmContainerIds`, which the page that loads the container
 * mirrors: `normalizeGtmContainerId`). The check is made before any request; the server checks it again and its refusal is shown as it says it.
 */
export function readGtmDraft(raw: string): GtmDraft {
  if (raw.trim() === '') return { state: 'empty' };
  const id = normalizeGtmContainerId(raw);
  return id === null ? { state: 'invalid' } : { state: 'valid', id };
}

/**
 * The Google Tag Manager container of the agency's pages (E41/F03/US01, NF-149). It is read from the domain settings the page already holds (`tracking.gtmContainerId`: there is no
 * endpoint of its own to read it) and written with `PUT /orgs/{id}/domain/tracking`. The answer of the server is written into the cache of the domain settings, so the field shows
 * what the server holds (the id in upper case, or nothing once it is cleared) without asking again. A refusal is not turned into a toast: it stays in `error` and the field shows it.
 */
export function useTrackingSettings(orgId: string, config: OrgDomainConfig) {
  const queryClient = useQueryClient();
  const saved = config.tracking?.gtmContainerId ?? null;

  const save = useMutation({
    mutationFn: (gtmContainerId: string | null) => OrgTrackingApi.setTracking(orgId, { gtmContainerId }),
    onSuccess: (tracking) => {
      queryClient.setQueryData<OrgDomainConfig>([ORG_DOMAIN_QUERY_KEY, orgId], (current) => (current ? { ...current, tracking } : current));
      toast.success(i18n.t(tracking.gtmContainerId ? 'embed.settings.gtm.saved' : 'embed.settings.gtm.cleared'));
    },
  });

  return { saved, save };
}
