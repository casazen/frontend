import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { OrgsApi } from '@/api/orgs.api';
import i18n from '@/i18n/config';
import type { BrandingImageKind, OrgBranding, UpdateOrgBrandingRequest } from '@/types';
import { brandingErrorMessage } from './branding-rules';

export const ORG_BRANDING_QUERY_KEY = ['org-branding'] as const;

/** BK-12: public-site branding of the caller's org. Org billing admin only (403 otherwise). */
export function useOrgBranding(enabled = true) {
  return useQuery({
    queryKey: ORG_BRANDING_QUERY_KEY,
    queryFn: () => OrgsApi.getBranding(),
    enabled,
    retry: false,
  });
}

/** After a change: the console copy, and the anonymous public-site read model if it is cached in this tab. */
function useApplyBranding() {
  const queryClient = useQueryClient();
  return (branding: OrgBranding) => {
    queryClient.setQueryData(ORG_BRANDING_QUERY_KEY, branding);
    void queryClient.invalidateQueries({ queryKey: ['public-org', branding.slug] });
  };
}

export function useUpdateOrgBranding() {
  const applyBranding = useApplyBranding();
  return useMutation({
    mutationFn: (payload: UpdateOrgBrandingRequest) => OrgsApi.updateBranding(payload),
    onSuccess: (branding) => {
      applyBranding(branding);
      toast.success(i18n.t('siteAppearance.saved'));
    },
    onError: (error) => toast.error(brandingErrorMessage(error, i18n.t, 'siteAppearance.saveFailed')),
  });
}

export function useUploadBrandingImage(kind: BrandingImageKind) {
  const applyBranding = useApplyBranding();
  return useMutation({
    mutationFn: (file: File) => OrgsApi.uploadBrandingImage(kind, file),
    onSuccess: (branding) => {
      applyBranding(branding);
      toast.success(i18n.t(`siteAppearance.images.${kind}.uploaded`));
    },
    onError: (error) => toast.error(brandingErrorMessage(error, i18n.t, 'siteAppearance.images.uploadFailed', kind)),
  });
}

export function useRemoveBrandingImage(kind: BrandingImageKind) {
  const applyBranding = useApplyBranding();
  return useMutation({
    mutationFn: () => OrgsApi.removeBrandingImage(kind),
    onSuccess: (branding) => {
      applyBranding(branding);
      toast.success(i18n.t(`siteAppearance.images.${kind}.removed`));
    },
    onError: (error) => toast.error(brandingErrorMessage(error, i18n.t, 'siteAppearance.images.removeFailed', kind)),
  });
}
