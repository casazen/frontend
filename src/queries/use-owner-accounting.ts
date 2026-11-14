import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ownerAccountingApi } from '@/api/owner-accounting.api';
import { profileFactsOf } from '@/features/owner-accounting/owner-accounting-model';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { saveBlobAs } from '@/lib/file-download';
import { todayInRome } from '@/lib/stay-dates';
import type {
  OwnerAccountingPolicyCommand,
  OwnerAddressCommand,
  OwnerFiscalProfileCommand,
  OwnerMandateCommand,
  OwnerPayoutCommand,
  TaxFilingCommand,
} from '@/types';

/** Root of the query keys of the owner accounting: a write that changes the ledger invalidates everything under it. */
export const OWNER_ACCOUNTING_KEY = 'owner-accounting';
const WITHHOLDING_KEY = 'withholding';

export const ownerAccountingKeys = {
  owners: [OWNER_ACCOUNTING_KEY, 'owners'] as const,
  mandates: (ownerId: string) => [OWNER_ACCOUNTING_KEY, 'mandates', ownerId] as const,
  address: (ownerId: string) => [OWNER_ACCOUNTING_KEY, 'address', ownerId] as const,
  profileFacts: (ownerId: string) => [OWNER_ACCOUNTING_KEY, 'profile-facts', ownerId] as const,
  onboarding: [OWNER_ACCOUNTING_KEY, 'onboarding-readiness'] as const,
  readiness: (year: number, month: number) => [OWNER_ACCOUNTING_KEY, 'readiness', year, month] as const,
  versions: (year: number, month: number, ownerId: string) => [OWNER_ACCOUNTING_KEY, 'versions', year, month, ownerId] as const,
  version: (versionId: string) => [OWNER_ACCOUNTING_KEY, 'version', versionId] as const,
  payouts: (ownerId: string | undefined) => [OWNER_ACCOUNTING_KEY, 'payouts', ownerId ?? 'all'] as const,
  payout: (payoutId: string) => [OWNER_ACCOUNTING_KEY, 'payout', payoutId] as const,
  externalDocuments: (versionId: string) => [OWNER_ACCOUNTING_KEY, 'external-documents', versionId] as const,
  evidence: (year: number, month: number, ownerId: string) => [OWNER_ACCOUNTING_KEY, 'evidence', year, month, ownerId] as const,
  fxRates: [OWNER_ACCOUNTING_KEY, 'fx-rates'] as const,
  profiles: (ownerId: string) => [OWNER_ACCOUNTING_KEY, 'profiles', ownerId] as const,
  fiscalReadiness: (ownerId: string, day: string) => [OWNER_ACCOUNTING_KEY, 'fiscal-readiness', ownerId, day] as const,
  policies: [OWNER_ACCOUNTING_KEY, 'policies'] as const,
  taxReconciliation: (year: number) => [WITHHOLDING_KEY, 'reconciliation', year] as const,
  f24: (month: number, year: number) => [WITHHOLDING_KEY, 'f24-record', month, year] as const,
  annual: (year: number) => [WITHHOLDING_KEY, 'annual', year] as const,
};

/** Whatever a write changed: the ledger, the versions and the tax files read again on their next view (and now, where they are open). */
function invalidateAll(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [OWNER_ACCOUNTING_KEY] }),
    queryClient.invalidateQueries({ queryKey: [WITHHOLDING_KEY] }),
  ]);
}

// ── Reads ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The owners of the agency's registry: their names. A list that other pages change (the activation adds owners), read again every time a page asks for it. */
export function useOwnerNames() {
  return useQuery({ queryKey: ownerAccountingKeys.owners, queryFn: () => ownerAccountingApi.listOwners(), refetchOnMount: 'always' as const });
}

/**
 * The versions of an owner's mandate, the newest first. The mandates change on this page and from the standard mandate of the wizard: read again every time a page asks for them, and
 * soon after (`staleTime`), so a page that stays open shows the terms in force.
 */
export function useOwnerMandates(ownerId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ownerAccountingKeys.mandates(ownerId ?? ''),
    queryFn: () => ownerAccountingApi.listMandates(ownerId ?? ''),
    enabled: enabled && Boolean(ownerId),
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

/**
 * The kind and the settlement currency of an owner, from the profile in force: what the list of the owners shows. The profile is read whole (it comes with the identifiers, the address and the
 * bank account) and reduced to these two facts in the query itself, so only they are kept by the cache.
 */
export function useOwnerProfileFacts(ownerId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ownerAccountingKeys.profileFacts(ownerId ?? ''),
    queryFn: async () => profileFactsOf(await ownerAccountingApi.listFiscalProfiles(ownerId ?? ''), todayInRome()),
    enabled: enabled && Boolean(ownerId),
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

/**
 * The billing address of an owner, in clear: personal data, read only by who manages the owners' finances (`enabled`), and dropped as soon as the page that shows it is left
 * (`gcTime: 0`), so no address outlives the screen in the cache. `null` when the server does not give it to this caller.
 */
export function useOwnerAddress(ownerId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ownerAccountingKeys.address(ownerId ?? ''),
    queryFn: () => ownerAccountingApi.getAddress(ownerId ?? ''),
    enabled: enabled && Boolean(ownerId),
    refetchOnMount: 'always' as const,
    gcTime: 0,
  });
}

/** What is missing on each owner and property (the activation); `null` while that module is off. */
export function useOwnerOnboardingReadiness() {
  return useQuery({ queryKey: ownerAccountingKeys.onboarding, queryFn: () => ownerAccountingApi.getOnboardingReadiness(), refetchOnMount: 'always' as const });
}

/** The readiness of the month. It only reads: nothing is posted or recalculated by opening the page. */
export function useCloseReadiness(year: number, month: number) {
  return useQuery({
    queryKey: ownerAccountingKeys.readiness(year, month),
    queryFn: () => ownerAccountingApi.getReadiness(year, month),
    refetchOnMount: 'always' as const,
  });
}

/** The versions of an owner's month, the newest first. */
export function useOwnerVersions(year: number, month: number, ownerId: string, enabled = true) {
  return useQuery({
    queryKey: ownerAccountingKeys.versions(year, month, ownerId),
    queryFn: () => ownerAccountingApi.listVersions(year, month, ownerId),
    enabled,
    refetchOnMount: 'always' as const,
  });
}

/** A version with its ledger lines. */
export function useVersionDetail(versionId: string | undefined) {
  return useQuery({
    queryKey: ownerAccountingKeys.version(versionId ?? ''),
    queryFn: () => ownerAccountingApi.getVersion(versionId ?? ''),
    enabled: Boolean(versionId),
    refetchOnMount: 'always' as const,
  });
}

/** The payouts of an owner (without their evidence). */
export function useOwnerPayouts(ownerId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ownerAccountingKeys.payouts(ownerId),
    queryFn: () => ownerAccountingApi.listPayouts(ownerId),
    enabled: enabled && Boolean(ownerId),
    refetchOnMount: 'always' as const,
  });
}

/** A payout with its withholding evidence: a detail, read again every time it is shown (a reversal adds to its evidence). */
export function useOwnerPayout(payoutId: string | undefined) {
  return useQuery({
    queryKey: ownerAccountingKeys.payout(payoutId ?? ''),
    queryFn: () => ownerAccountingApi.getPayout(payoutId ?? ''),
    enabled: Boolean(payoutId),
    refetchOnMount: 'always' as const,
  });
}

/** The links of a version to the invoices issued outside CasaZen, the removed ones included. */
export function useExternalDocuments(versionId: string | undefined) {
  return useQuery({
    queryKey: ownerAccountingKeys.externalDocuments(versionId ?? ''),
    queryFn: () => ownerAccountingApi.listExternalDocuments(versionId ?? ''),
    enabled: Boolean(versionId),
    refetchOnMount: 'always' as const,
  });
}

/** The evidence of an owner's month (it holds every published file: read it when the person asks for it). */
export function useOwnerEvidence(year: number, month: number, ownerId: string, enabled: boolean) {
  return useQuery({
    queryKey: ownerAccountingKeys.evidence(year, month, ownerId),
    queryFn: () => ownerAccountingApi.getEvidence(year, month, ownerId),
    enabled,
    refetchOnMount: 'always' as const,
  });
}

export function useFxRates(enabled = true) {
  return useQuery({ queryKey: ownerAccountingKeys.fxRates, queryFn: () => ownerAccountingApi.listFxRates(), enabled });
}

/**
 * The fiscal profiles of an owner, the newest first (masked unless the caller manages the owners' finances, who receive the identifiers, the address and the bank account in
 * full). They are personal data: the answer is dropped as soon as the page that shows it is left (`gcTime: 0`), so no profile outlives the screen in the cache.
 */
export function useFiscalProfiles(ownerId: string | undefined) {
  return useQuery({
    queryKey: ownerAccountingKeys.profiles(ownerId ?? ''),
    queryFn: () => ownerAccountingApi.listFiscalProfiles(ownerId ?? ''),
    enabled: Boolean(ownerId),
    refetchOnMount: 'always' as const,
    gcTime: 0,
  });
}

/**
 * Which profile and approved rule set apply to the owner on a day, as the server decides it: ids and codes only, so a payout chooses its rule without reading the profiles.
 * A 422 is the verdict (what blocks), not a failure to retry. While the day changes the last answer stays on screen, marked as a placeholder.
 */
export function useFiscalReadiness(ownerId: string | undefined, day: string) {
  return useQuery({
    queryKey: ownerAccountingKeys.fiscalReadiness(ownerId ?? '', day),
    queryFn: () => ownerAccountingApi.getFiscalReadiness(ownerId ?? '', day),
    enabled: Boolean(ownerId) && /^\d{4}-\d{2}-\d{2}$/.test(day),
    refetchOnMount: 'always' as const,
    placeholderData: keepPreviousData,
  });
}

/** The rule sets of the agency. */
export function useAccountingPolicies(enabled = true) {
  return useQuery({ queryKey: ownerAccountingKeys.policies, queryFn: () => ownerAccountingApi.listPolicies(), enabled, refetchOnMount: 'always' as const });
}

/** The obligations of the year against the F24 of each month and the annual data. */
export function useTaxReconciliation(year: number, enabled = true) {
  return useQuery({
    queryKey: ownerAccountingKeys.taxReconciliation(year),
    queryFn: () => ownerAccountingApi.getTaxReconciliation(year),
    enabled,
    refetchOnMount: 'always' as const,
  });
}

/** The F24 of a month, read only when the reconciliation says one exists (the endpoint builds it when there is none). */
export function useF24Record(month: number, year: number, enabled: boolean) {
  return useQuery({
    queryKey: ownerAccountingKeys.f24(month, year),
    queryFn: () => ownerAccountingApi.getF24(month, year),
    enabled,
    refetchOnMount: 'always' as const,
  });
}

/** The annual tax data of the year; `null` while there is none. */
export function useAnnualDataset(year: number) {
  return useQuery({ queryKey: ownerAccountingKeys.annual(year), queryFn: () => ownerAccountingApi.getAnnualDataset(year), refetchOnMount: 'always' as const });
}

// ── Writes: each is one explicit action of the person, none runs by itself ──────────────────────────────────────

/** Posts the ledger lines of the month from their sources (idempotent). */
export function usePostPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) => ownerAccountingApi.postPeriod(year, month),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/** A new version of the owner's statement: the one it replaces is superseded and stays readable. */
export function useGenerateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ year, month, ownerId }: { year: number; month: number; ownerId: string }) => ownerAccountingApi.generateVersion(year, month, ownerId),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useApproveVersion() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (versionId: string) => ownerAccountingApi.approveVersion(versionId), onSuccess: () => invalidateAll(queryClient) });
}

export function usePublishVersion() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (versionId: string) => ownerAccountingApi.publishVersion(versionId), onSuccess: () => invalidateAll(queryClient) });
}

/** Closes the owner's month; the reason of a waiver is sent only when the balance does not reconcile. */
export function useCloseMonth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ year, month, ownerId, waiverReason }: { year: number; month: number; ownerId: string; waiverReason?: string }) =>
      ownerAccountingApi.closeMonth(year, month, ownerId, waiverReason),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useSetLegalHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ year, month, ownerId, hold, reason }: { year: number; month: number; ownerId: string; hold: boolean; reason?: string }) =>
      ownerAccountingApi.setLegalHold(year, month, ownerId, hold, reason),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useAddFxRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: Parameters<typeof ownerAccountingApi.addFxRate>[0]) => ownerAccountingApi.addFxRate(command),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function usePostCorrection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: Parameters<typeof ownerAccountingApi.postCorrection>[0]) => ownerAccountingApi.postCorrection(command),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/** Confirms a payout: the only operation that decides a withholding. */
export function useConfirmPayout() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (command: OwnerPayoutCommand) => ownerAccountingApi.confirmPayout(command), onSuccess: () => invalidateAll(queryClient) });
}

export function useReversePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payoutId, reason }: { payoutId: string; reason: string }) => ownerAccountingApi.reversePayout(payoutId, reason),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/** Links a version to the invoice the agency's external system issued. */
export function useAddExternalDocument(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: Parameters<typeof ownerAccountingApi.addExternalDocument>[1]) => ownerAccountingApi.addExternalDocument(versionId, command),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useVerifyExternalDocument() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (referenceId: string) => ownerAccountingApi.verifyExternalDocument(referenceId), onSuccess: () => invalidateAll(queryClient) });
}

export function useRemoveExternalDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ referenceId, reason }: { referenceId: string; reason: string }) => ownerAccountingApi.removeExternalDocument(referenceId, reason),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/**
 * A new profile of the owner from a day: the one in force ends the day before. The command holds the identifiers, the address and the bank account of the owner, so the
 * mutation is dropped as soon as nothing watches it (`gcTime: 0`) and what it keeps of a failure is the failure without its request (`withoutRequest`): the status, the
 * code and the body of the answer, which the form turns into words, and no body that was sent.
 */
export function useSaveFiscalProfile(ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (command: OwnerFiscalProfileCommand) => {
      try {
        return await ownerAccountingApi.saveFiscalProfile(ownerId, command);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => invalidateAll(queryClient),
  });
}

/**
 * A new version of the owner's mandate from a day: the one in force ends the day before, and nothing already posted changes. The mutation is dropped as soon as nothing watches it
 * (`gcTime: 0`) and what it keeps of a failure is the failure without its request (`withoutRequest`): the command may name where the signed mandate is.
 */
export function useCreateOwnerMandate(ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (command: OwnerMandateCommand) => {
      try {
        return await ownerAccountingApi.createMandate(ownerId, command);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => invalidateAll(queryClient),
  });
}

/** Replaces the billing address of the owner: personal data, so the mutation is dropped as soon as nothing watches it and keeps of a failure the answer without the request. */
export function useSaveOwnerAddress(ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (command: OwnerAddressCommand) => {
      try {
        return await ownerAccountingApi.saveAddress(ownerId, command);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (command: OwnerAccountingPolicyCommand) => ownerAccountingApi.createPolicy(command), onSuccess: () => invalidateAll(queryClient) });
}

/** Records the approval of the qualified accountant. */
export function useApprovePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ policyId, approvedByName }: { policyId: string; approvedByName: string }) => ownerAccountingApi.approvePolicy(policyId, approvedByName),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/** Builds the F24 of a month from the evidence (while it is only generated). */
export function useGenerateF24() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) => ownerAccountingApi.generateF24(month, year),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/** Moves an F24 along its filing states. */
export function useSetF24FilingState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ f24Id, command }: { f24Id: string; command: TaxFilingCommand }) => ownerAccountingApi.setF24FilingState(f24Id, command),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useGenerateAnnualDataset() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (year: number) => ownerAccountingApi.generateAnnualDataset(year), onSuccess: () => invalidateAll(queryClient) });
}

export function useSetDatasetFilingState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ datasetId, command }: { datasetId: string; command: TaxFilingCommand }) => ownerAccountingApi.setDatasetFilingState(datasetId, command),
    onSuccess: () => invalidateAll(queryClient),
  });
}

// ── Downloads ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Saves the published file of a version exactly as the owner received it. */
export function useDownloadPublishedFile() {
  return useMutation({
    mutationFn: async ({ versionId, fileName }: { versionId: string; fileName: string }) => {
      saveBlobAs(await ownerAccountingApi.downloadPublishedFile(versionId), fileName);
    },
  });
}

/** Saves the stored F24 data of a month as a PDF. */
export function useDownloadF24Pdf() {
  return useMutation({
    mutationFn: async ({ month, year, fileName }: { month: number; year: number; fileName: string }) => {
      saveBlobAs(await ownerAccountingApi.downloadF24Pdf(month, year), fileName);
    },
  });
}
