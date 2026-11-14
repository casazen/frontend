import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyMandateTemplate,
  canChangeBillingSetup,
  getBillingPreview,
  getBillingSetup,
  getChannelAccountHolders,
  getChannelCommissionRules,
  saveBillingSetupSection,
  saveChannelAccountHolders,
  saveChannelCommissionRules,
  savePortalAccountSettings,
} from '@/api/billing-setup.api';
import { touristTaxApi } from '@/api/tourist-tax.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type {
  BillingSetup,
  BillingSetupSection,
  ChannelAccountHolderChange,
  ChannelCommissionRuleInput,
  OwnerMandateTemplate,
  PortalAccountSettingsRequest,
  SaveBillingSetupSectionRequest,
} from '@/types';
import { FISCAL_DOCUMENTS_KEY } from './use-fiscal-documents';
import { invalidateOnboarding } from './use-onboarding-plan';

/** The billing setup of the organization. A save changes it, and the part «Fatturazione» of the onboarding guide counts its sections. */
export const BILLING_SETUP_KEY = ['billing-setup'] as const;
/** Not under {@link BILLING_SETUP_KEY}: a save that refreshes the setup must not ask who may change it again. */
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

/**
 * Whether the person may change the setup, for a person whose role may (`property.write`): `false` when their reach is only some of the properties. It reads and writes
 * nothing (`canChangeBillingSetup`), is asked again whenever a page opens and is not kept. A failed answer is not an answer: the wizard then lets the person write and the
 * server decides at the first save.
 */
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

/** The setup with one section replaced by the one a save answered: the answer is on screen before the whole setup is read again. */
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

/** Who holds the accounts of the portals by default and whether their commissions are recharged (`PUT api/billing-setup/channels`). */
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

/** The listings where the holder of a portal account differs from the default of the organization. Asked only while the flag `ownerInvoicing` is on. */
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

/** Writes the holders of many listings at once (`PUT api/billing-setup/channel-account-holders`). */
export function useSaveChannelAccountHolders() {
  const queryClient = useQueryClient();
  const afterSave = useAfterSave();

  return useMutation({
    gcTime: 0,
    mutationFn: async (changes: readonly ChannelAccountHolderChange[]) => {
      try {
        return await saveChannelAccountHolders(changes);
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

/** The commission rules of the portals and what applies today to each. Asked only for an agency whose role may read the statements. */
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

/** Replaces the commission rules of the portals with the whole list. */
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

/** «Applica ai proprietari senza mandato»: the standard mandate for every owner that has none. */
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

/** The tax rule in force for the issuer, for the summary of the wizard. Read again at every visit: a save of the regime changes it. */
export function useBillingPreview() {
  return useQuery({
    queryKey: PREVIEW_KEY,
    queryFn: () => getBillingPreview(),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

/** The tourist tax rates of the comuni (`GET api/tourist-tax-rates`, read by every signed-in account), for the Italian step of the tourist tax. */
export function useMunicipalTouristTaxRates(enabled: boolean) {
  return useQuery({
    queryKey: MUNICIPAL_RATES_KEY,
    queryFn: () => touristTaxApi.getAll(),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
