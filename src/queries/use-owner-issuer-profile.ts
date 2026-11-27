import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exportOwnerIssuedDocuments, getOwnerIssuerProfile, issuedDocumentsFileName, saveOwnerIssuerProfile } from '@/api/owner-issuer-profiles.api';
import { ownerAccountingApi } from '@/api/owner-accounting.api';
import { issuerRequestFromOwnerData } from '@/features/owners/owner-issuer-model';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { todayInRome } from '@/lib/stay-dates';
import type { OwnerFiscalProfile, OwnerIssuerProfile, OwnerIssuerProfileRequest, PropertyOwnerSummary } from '@/types';
import { BILLING_SETUP_KEY } from './use-billing-setup';
import { invalidateOnboarding } from './use-onboarding-plan';
import { saveDownload } from './save-download';

export const OWNER_ISSUER_KEY = 'owner-issuer-profile';

const keyOf = (ownerId: string) => [OWNER_ISSUER_KEY, ownerId] as const;

/**
 * The issuer profile of an owner. It holds the name, the fiscal code, the VAT number and the address of a person (in clear for who may change it), so it is kept only while a screen shows it
 * (`gcTime: 0`) and read again every time one opens (`refetchOnMount: 'always'`, a read more than half a minute old is stale): the list of the step of the wizard, the page of the owner and a
 * dialog of the step see the same answer, and a save of one is read by the others at once. `null` when the server refuses it to the caller (403); a 404 is an owner that is not there, whatever
 * an earlier answer left (the screens ask `isError` first).
 */
export function useOwnerIssuerProfile(ownerId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keyOf(ownerId ?? ''),
    queryFn: () => getOwnerIssuerProfile(ownerId ?? ''),
    enabled: enabled && Boolean(ownerId),
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
    gcTime: 0,
  });
}

/**
 * What a save of an issuer profile changes beyond the profile: the owners that still miss one are counted by the billing setup (the item `owner_issuer_missing`) and by the part «Fatturazione» of the
 * onboarding guide, so both are read again.
 */
function useAfterSave() {
  const queryClient = useQueryClient();
  return (ownerId: string, saved: OwnerIssuerProfile) => {
    queryClient.setQueryData<OwnerIssuerProfile | null>(keyOf(ownerId), saved);
    void queryClient.invalidateQueries({ queryKey: BILLING_SETUP_KEY });
    invalidateOnboarding(queryClient);
  };
}

export function useSaveOwnerIssuerProfile(ownerId: string) {
  const afterSave = useAfterSave();
  return useMutation({
    gcTime: 0,
    mutationFn: async (request: OwnerIssuerProfileRequest) => {
      try {
        return await saveOwnerIssuerProfile(ownerId, request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (saved) => afterSave(ownerId, saved),
  });
}

/** The data of the owner accounting come masked to this caller: there is nothing to make a profile from, and the person is told so instead of a profile made of asterisks. */
export class OwnerDataMaskedError extends Error {
  constructor() {
    super('The data of the owner are masked for this caller');
    this.name = 'OwnerDataMaskedError';
  }
}

function inForce(profiles: readonly OwnerFiscalProfile[], day: string): OwnerFiscalProfile | null {
  return profiles.find((candidate) => candidate.validFrom <= day && (candidate.validTo === null || candidate.validTo >= day)) ?? profiles[0] ?? null;
}

/**
 * The quick creation of the issuer profile of an owner (E17/F03/US01/T01): the profile in force of the owner accounting and the billing address are read (in clear, which only who manages the finances of
 * the owners is given: a masked profile has no data to start from, so the creation stops with an `OwnerDataMaskedError` and never saves a profile made of asterisks), and the profile is saved from
 * them. Nothing is made up for what they do not say: the answer says what the profile still misses.
 */
export function useCreateOwnerIssuerFromOwnerData(owner: PropertyOwnerSummary) {
  const afterSave = useAfterSave();
  return useMutation({
    gcTime: 0,
    mutationFn: async () => {
      try {
        const [profiles, address] = await Promise.all([ownerAccountingApi.listFiscalProfiles(owner.id), ownerAccountingApi.getAddress(owner.id)]);
        const profile = inForce(profiles, todayInRome());
        if (profile?.masked) throw new OwnerDataMaskedError();
        return await saveOwnerIssuerProfile(owner.id, issuerRequestFromOwnerData({ owner, profile, address }));
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (saved) => afterSave(owner.id, saved),
  });
}

interface ExportRequest {
  ownerId: string;
  period: string;
  signal?: AbortSignal;
}

export function useExportOwnerIssuedDocuments() {
  return useMutation({
    gcTime: 0,
    mutationFn: ({ ownerId, period, signal }: ExportRequest): Promise<void> => saveDownload(exportOwnerIssuedDocuments(ownerId, period, { signal }), issuedDocumentsFileName(period)),
  });
}
