import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { OrgTrackingApi } from '@/api/org-tracking.api';
import { normalizeGtmContainerId } from '@/features/host-tracking/gtm-loader';
import type { OrgDomainConfig } from '@/types/domain.types';
import { ORG_DOMAIN_QUERY_KEY } from '../domain/use-org-domain';

export type GtmDraft = { state: 'empty' } | { state: 'invalid' } | { state: 'valid'; id: string };

export function readGtmDraft(raw: string): GtmDraft {
  if (raw.trim() === '') return { state: 'empty' };
  const id = normalizeGtmContainerId(raw);
  return id === null ? { state: 'invalid' } : { state: 'valid', id };
}

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
