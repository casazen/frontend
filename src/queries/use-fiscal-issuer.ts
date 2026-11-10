import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getIssuerPreview, getIssuerSettings, saveIssuerSettings } from '@/api/fiscal-issuer.api';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import type { SaveFiscalDocumentSettingsRequest } from '@/types';

/** Under `fiscal`, so that a change to the tax profile (the VAT number and the fiscal code the issuer reads from it) reads the setting again. */
export const FISCAL_ISSUER_KEY = ['fiscal', 'documents', 'settings'] as const;

/**
 * Who issues the fiscal documents of the organization (FIS-02, NF-82). It is read again whenever a page opens and nothing is kept once the
 * page is left (`gcTime: 0`): the wizard takes its first answers from it, and it must not start from a setting that another person has
 * changed since.
 */
export function useIssuerSettings() {
  return useQuery({
    queryKey: FISCAL_ISSUER_KEY,
    queryFn: () => getIssuerSettings(),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Saves the answers of the wizard «Come emetti i documenti?». The setting that comes back is the one on screen from then on, and it is read
 * again; a refusal says why with the message of the API (CasaZen is not available yet, the data of the issuer is incomplete, the channel
 * manager is not connected) and reads the setting again too, since what was refused may have changed meanwhile. The 422 that names fields
 * stays readable by the caller, which shows them on the right step.
 */
export function useSaveIssuerSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SaveFiscalDocumentSettingsRequest) => saveIssuerSettings(request),
    onSuccess: async (saved) => {
      queryClient.setQueryData(FISCAL_ISSUER_KEY, saved);
      await queryClient.invalidateQueries({ queryKey: FISCAL_ISSUER_KEY });
      toast.success(i18n.t('fiscalDocuments.issuer.saved'));
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: FISCAL_ISSUER_KEY });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('fiscalDocuments.issuer.saveFailed'));
    },
  });
}

/** Who would issue the documents of a booking and why (a stable code). Not asked until there is a booking to ask about. */
export function useIssuerPreview(bookingId: string | undefined) {
  return useQuery({
    queryKey: [...FISCAL_ISSUER_KEY, 'preview', bookingId],
    queryFn: () => getIssuerPreview(bookingId ?? ''),
    enabled: Boolean(bookingId),
  });
}
