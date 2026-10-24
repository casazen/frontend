import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { leasesApi } from '@/api/leases.api';
import { getProblemMessage } from '@/lib/api-errors';
import type { LeaseContractType, LeaseOrigin, OfflineSignatureInput } from '@/types';

const DRAFT_KEY = 'lease-draft';
const LEASES_KEY = 'leases';

/**
 * The guided draft of a lease, read once when the wizard opens. The wizard owns it from then on: it does not read it again when the
 * window gets the focus (the answers on the screen would change under the person's hands), only when the person asks to reload after
 * a conflict. It holds names, fiscal codes and residences in clear: it is not kept once the page is closed (`gcTime: 0`).
 */
export function useLeaseDraft(id: string) {
  return useQuery({
    queryKey: [DRAFT_KEY, id],
    queryFn: () => leasesApi.getDraft(id),
    enabled: !!id,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });
}

/**
 * What the wizard saved changes what the sheet of the lease and the lists say, and the app does not read a query again on mount
 * (`refetchOnMount: false`): after a save the wizard drops what it knows of this lease (nobody is looking at it: the wizard is on the
 * screen) so that the next page that opens reads it from the server, and marks the lists stale.
 */
export function useForgetLeaseReads(leaseId: string) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.removeQueries({ queryKey: [LEASES_KEY, leaseId] });
    void queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
  }, [queryClient, leaseId]);
}

/**
 * Brings in a contract already signed elsewhere (`POST /leases/:id/import`, LR-13). It cannot be taken back: the lease is Signed from
 * then on, no longer a draft, and the PDF and the day cannot be corrected. What is known of the lease is dropped, so the pages that
 * read it next ask the server again. The step that calls it tells what went wrong (no toast): the person is looking at it.
 */
export function useImportSignedLease(leaseId: string) {
  const forgetReads = useForgetLeaseReads(leaseId);
  return useMutation({
    mutationFn: (input: OfflineSignatureInput) => leasesApi.importSigned(leaseId, input),
    onSuccess: () => forgetReads(),
  });
}

/**
 * The checks of the review of a draft, read again every time the review is opened: they depend on what was saved a moment ago.
 * `gcTime: 0`: nothing of it is kept once the page is closed.
 */
export function useLeaseReview(id: string, enabled = true) {
  return useQuery({
    queryKey: [DRAFT_KEY, id, 'review'],
    queryFn: () => leasesApi.getReview(id),
    enabled: enabled && !!id,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

/** The figures of the long-term area (terms, notice, deposit limit, types): read from the server, never written in the interface. */
export function useLongRentRules() {
  return useQuery({
    queryKey: ['long-rent', 'rules'],
    queryFn: () => leasesApi.getRules(),
  });
}

/**
 * The landlord the wizard starts the parties from. Personal data in clear: not kept after the page (`gcTime: 0`). `enabled`: only a
 * draft that has no landlord yet needs it.
 */
export function useLandlordDefaults(enabled: boolean) {
  return useQuery({
    queryKey: ['long-rent', 'landlord-defaults'],
    queryFn: () => leasesApi.getLandlordDefaults(),
    enabled,
    staleTime: Infinity,
    gcTime: 0,
    // A landlord that cannot be read is a wizard that starts empty, not a reason to wait or to retry.
    retry: false,
  });
}

/**
 * Creates the draft of a new contract with its property, its origin and the type chosen as the first question of «Nuovo contratto»
 * (`POST /leases/drafts`, LR-12). The type is written at once (the same save as step ③): a contract made in CasaZen is that type from
 * the start (step ③ shows it as chosen, the concordato is prepared with the partner, see `useCreateConcordatoDraft`), one already
 * signed has it preselected there and can still correct it. If only the second call fails the draft exists all the same and that step
 * asks for the type: a retry never makes a second contract. Resolves with the id.
 */
export function useCreateLeaseDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, origin, contractType }: { propertyId: string; origin: LeaseOrigin; contractType: LeaseContractType }) => {
      const created = await leasesApi.createDraft(propertyId, origin);
      try {
        await leasesApi.saveDraft(created.id, { version: created.version, step: 3, values: { contractType } });
      } catch {
        // The step of the conditions asks for the type.
      }
      return created.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.leaseCreateFailed'));
    },
  });
}
