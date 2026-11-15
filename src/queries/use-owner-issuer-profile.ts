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

/** Root of the query keys of the issuer profiles of the owners. */
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

/**
 * Saves the profile of an owner as a whole. The request holds personal data, so the mutation is dropped as soon as nothing observes it (`gcTime: 0`) and a refusal is kept without the request that was
 * sent (`withoutRequest`): the status and the body of the answer stay, which is what the form turns into words and into the fields to fix. The answer is the profile as it is now (and says what it
 * still misses).
 */
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

/** The profile of the owner accounting in force on `day` (the newest when none is in force): the one the quick creation starts from. */
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

/** What the export of the documents of an owner needs besides the period: a way to stop it. */
interface ExportRequest {
  ownerId: string;
  period: string;
  signal?: AbortSignal;
}

/**
 * Downloads the ZIP for the accountant of an owner (the documents CasaZen issued in its name in a month or a year) and saves it under the name the server gave it. The package holds documents and personal
 * data, so nothing of it is kept: the mutation is dropped as soon as nothing watches it (`gcTime: 0`), the file goes to the disk inside its function and a failure keeps only the answer of the server,
 * without the request that carried the access token. It says nothing itself: the screen tells the refusals next to the button, and a call the person stopped is not a failure.
 */
export function useExportOwnerIssuedDocuments() {
  return useMutation({
    gcTime: 0,
    mutationFn: ({ ownerId, period, signal }: ExportRequest): Promise<void> => saveDownload(exportOwnerIssuedDocuments(ownerId, period, { signal }), issuedDocumentsFileName(period)),
  });
}
