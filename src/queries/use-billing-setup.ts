import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyMandateTemplate,
  canChangeBillingSetup,
  confirmPortalTouristTaxComuni,
  getBillingPreview,
  getBillingSetup,
  getChannelAccountHolders,
  getChannelCommissionRules,
  saveBillingSetupSection,
  saveChannelAccountHolders,
  saveChannelCommissionRules,
  savePortalAccountSettings,
} from '@/api/billing-setup.api';
import { fiscalApi, type FiscalTaxProfileUpdate } from '@/api/fiscal.api';
import { touristTaxApi } from '@/api/tourist-tax.api';
import {
  italianTouristTaxOf,
  PortalComuniNotSentError,
  portalComuniFailureOf,
  portalComuniRequest,
  type PortalComuniChange,
} from '@/features/fiscal/billing-wizard/billing-wizard-model';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type {
  BillingSetup,
  BillingSetupSection,
  ChannelAccountHolderChange,
  ChannelCommissionRuleInput,
  OwnerMandateTemplate,
  PortalAccountSettingsRequest,
  PortalTouristTaxComune,
  SaveBillingSetupSectionRequest,
} from '@/types';
import { FISCAL_DOCUMENTS_KEY } from './use-fiscal-documents';
import { invalidateOnboarding } from './use-onboarding-plan';

/** The billing setup of the organization. A save changes it, and the part «Fatturazione» of the onboarding guide counts its sections. */
export const BILLING_SETUP_KEY = ['billing-setup'] as const;
const BILLING_ACCESS_KEY = ['billing-setup-access'] as const;
const HOLDERS_KEY = ['billing-setup-account-holders'] as const;
const COMMISSION_RULES_KEY = ['billing-setup-commission-rules'] as const;
const PREVIEW_KEY = ['billing-setup-preview'] as const;
const MUNICIPAL_RATES_KEY = ['billing-setup-municipal-tourist-tax-rates'] as const;

/**
 * The whole invoicing setup. It is read again whenever a page opens and nothing is kept once the page is left (`gcTime: 0`): it holds the name, the address and the tax ids
 * of the issuer, and the wizard must not start from a setup that another person has changed since. The wizard takes its first answers from it once, when it opens: a later
 * read (the window comes back, a save) does not change the answers under the person's hands.
 */
export function useBillingSetup() {
  return useQuery({
    queryKey: BILLING_SETUP_KEY,
    queryFn: () => getBillingSetup(),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

export function useBillingAccess(enabled: boolean) {
  return useQuery({
    queryKey: BILLING_ACCESS_KEY,
    queryFn: () => canChangeBillingSetup(),
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

function withSection(current: BillingSetup | undefined, saved: BillingSetupSection): BillingSetup | undefined {
  if (!current) return current;
  const sections = current.sections.map((section) => (section.section === saved.section ? saved : section));
  return { ...current, sections, complete: sections.some((section) => section.applies) && sections.every((section) => section.complete) };
}

/**
 * What a save of the setup touches: the setup itself (a save may change what another section is missing: a new country asks for the postal code again), the preview of the
 * rule in force, the fiscal documents (the list and what it says of the issuer read again) and the part «Fatturazione» of the guide, which counts the sections that have
 * nothing missing.
 */
function useAfterSave() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: BILLING_SETUP_KEY });
    void queryClient.invalidateQueries({ queryKey: PREVIEW_KEY });
    void queryClient.invalidateQueries({ queryKey: FISCAL_DOCUMENTS_KEY });
    invalidateOnboarding(queryClient);
  };
}

/**
 * Saves the fields of a step (`PUT api/billing-setup/{section}`). What is saved holds personal data (the name, the address, the tax ids of the issuer), so the mutation is
 * dropped as soon as nothing observes it (`gcTime: 0`, the cache of the mutations keeps results for five minutes otherwise) and a refusal is kept without the request that
 * was sent: the status and the body of the answer stay, which is what the wizard turns into words and into the fields to fix.
 */
export function useSaveBillingSection() {
  const queryClient = useQueryClient();
  const afterSave = useAfterSave();

  return useMutation({
    gcTime: 0,
    mutationFn: async ({ section, request }: { section: string; request: SaveBillingSetupSectionRequest }) => {
      try {
        return await saveBillingSetupSection(section, request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<BillingSetup | undefined>(BILLING_SETUP_KEY, (current) => withSection(current, saved));
      afterSave();
    },
  });
}

/**
 * The portals the person confirms as the ones that collect and pay the tourist tax in a comune (`PUT api/billing-setup/touristTax/portal-comuni`): the whole list of the pairs, which
 * the server takes in place of the one it had. It is an answer of its own, not saved by «Continua». What the mutation takes is what the person did (`PortalComuniChange`), and the
 * list is made HERE, from the setup read again just before the call, never from what the page kept: another window, another person, or a call whose answer was lost may have changed
 * what the server holds, and a list made from an old reading would take those confirmations away. When that reading fails or does not hold the confirmed portals in full nothing is sent
 * (`PortalComuniNotSentError`). Like the other saves of the wizard the mutation is dropped as soon as nothing observes it (`gcTime: 0`) and a failure keeps only the status and the body
 * of the answer (`withoutRequest`). The server answers the section `touristTax` as saved: it is on screen (the question that was confirmed leaves, the confirmed pair is listed) before
 * the whole setup is read again. A refusal saved nothing and the list was read just before it, so nothing on screen is old; any other failure (the read, or a call whose outcome is not
 * known) leaves the page with a list that may be old, so the setup is read again.
 */
export function useConfirmPortalTouristTaxComuni() {
  const queryClient = useQueryClient();
  const afterSave = useAfterSave();

  return useMutation({
    gcTime: 0,
    mutationFn: async (change: PortalComuniChange) => {
      let confirmed: PortalTouristTaxComune[] | null;
      try {
        // No retries: the person is waiting, and a read that fails is told as such (they can try again). The reading also replaces the setup the page shows.
        const fresh = await queryClient.fetchQuery({ queryKey: BILLING_SETUP_KEY, queryFn: () => getBillingSetup(), staleTime: 0, retry: false });
        confirmed = italianTouristTaxOf(fresh)?.confirmed ?? null;
      } catch {
        confirmed = null;
      }
      if (confirmed === null) throw new PortalComuniNotSentError();

      try {
        return await confirmPortalTouristTaxComuni(portalComuniRequest(confirmed, change));
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<BillingSetup | undefined>(BILLING_SETUP_KEY, (current) => withSection(current, saved));
      afterSave();
    },
    onError: (error) => {
      const failure = portalComuniFailureOf(error);
      if (failure === 'failed' || failure === 'notSent') void queryClient.invalidateQueries({ queryKey: BILLING_SETUP_KEY });
    },
  });
}

/**
 * The VAT number or the fiscal code of the organization, written to its tax profile (`PUT api/fiscal/tax-profile`), where they live: the step «IVA» of the wizard adds what the
 * profile does not have yet. A fiscal code is personal data, so the mutation is dropped as soon as nothing observes it (`gcTime: 0`) and a refusal is kept without the request
 * that was sent (`withoutRequest`). The tax profile and the setup are read again.
 */
export function useSaveTaxIdentity() {
  const queryClient = useQueryClient();
  const afterSave = useAfterSave();

  return useMutation({
    gcTime: 0,
    mutationFn: async (body: FiscalTaxProfileUpdate) => {
      try {
        return await fiscalApi.putTaxProfile(body);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fiscal'] });
      afterSave();
    },
  });
}

/**
 * Who holds the accounts of the portals by default and whether their commissions are recharged (`PUT api/billing-setup/channels`). A save that starts the waiver of the recharge is refused
 * (422 `recharge_waiver_not_acknowledged`) unless its request carries `acknowledgeRechargeWaiver: true`, which the caller adds only after the person confirmed.
 */
export function useSavePortalAccountSettings() {
  const afterSave = useAfterSave();

  return useMutation({
    gcTime: 0,
    mutationFn: async (request: PortalAccountSettingsRequest) => {
      try {
        return await savePortalAccountSettings(request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: afterSave,
  });
}

export function useChannelAccountHolders(enabled: boolean) {
  return useQuery({
    queryKey: HOLDERS_KEY,
    queryFn: () => getChannelAccountHolders(),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

interface SaveChannelAccountHoldersRequest {
  changes: readonly ChannelAccountHolderChange[];
  acknowledgeRechargeWaiver?: true;
}

export function useSaveChannelAccountHolders() {
  const queryClient = useQueryClient();
  const afterSave = useAfterSave();

  return useMutation({
    gcTime: 0,
    mutationFn: async ({ changes, acknowledgeRechargeWaiver }: SaveChannelAccountHoldersRequest) => {
      try {
        return acknowledgeRechargeWaiver ? await saveChannelAccountHolders(changes, true) : await saveChannelAccountHolders(changes);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(HOLDERS_KEY, saved);
      afterSave();
    },
  });
}

export function useChannelCommissionRules(enabled: boolean) {
  return useQuery({
    queryKey: COMMISSION_RULES_KEY,
    queryFn: () => getChannelCommissionRules(),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

export function useSaveChannelCommissionRules() {
  const queryClient = useQueryClient();
  const afterSave = useAfterSave();

  return useMutation({
    gcTime: 0,
    mutationFn: async (rules: readonly ChannelCommissionRuleInput[]) => {
      try {
        return await saveChannelCommissionRules(rules);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(COMMISSION_RULES_KEY, saved);
      afterSave();
    },
  });
}

export function useApplyMandateTemplate() {
  const afterSave = useAfterSave();

  return useMutation({
    gcTime: 0,
    mutationFn: async (template: OwnerMandateTemplate) => {
      try {
        return await applyMandateTemplate(template);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: afterSave,
  });
}

export function useBillingPreview() {
  return useQuery({
    queryKey: PREVIEW_KEY,
    queryFn: () => getBillingPreview(),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

export function useMunicipalTouristTaxRates(enabled: boolean) {
  return useQuery({
    queryKey: MUNICIPAL_RATES_KEY,
    queryFn: () => touristTaxApi.getAll(),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
