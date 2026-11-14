import { BILLING_STEPS, type BillingStepId } from '@/features/fiscal/billing-wizard/billing-wizard-ids';
import type { BillingSetupItemKey, BillingSetupSectionName } from '@/types/billing-setup.types';

/**
 * Where the part «Fatturazione» of the onboarding guide (E11/F02/US01/T02, NF-104, NF-118) opens its wizard: the step each item of `GET api/billing-setup` belongs to, in ONE
 * table. The reason of the part is the key of the first missing item, and the guide opens `/app/short-rent/fiscal/setup?step=<step>` at the step that fixes it. A step is where
 * the person gives the answer, not the section the server keeps it in: the Italian VAT number, the fiscal code and the Swiss UID are asked with the regime, in «IVA».
 *
 * The table is complete by construction (`Record` over every key of the contract: a key added to `BILLING_SETUP_ITEM_KEYS` with no row here does not compile), and
 * `billing-item-steps.test.ts` keeps it the same as the list the backend sends, so that an item with no step is told by a failing test and never by a dead link.
 */
export const BILLING_ITEM_STEPS: Readonly<Record<BillingSetupItemKey, BillingStepId>> = {
  country_missing: BILLING_STEPS.issuer,
  legal_name_missing: BILLING_STEPS.issuer,
  address_missing: BILLING_STEPS.issuer,
  vat_number_missing: BILLING_STEPS.vat,
  fiscal_code_missing: BILLING_STEPS.vat,
  swiss_uid_missing: BILLING_STEPS.vat,
  regime_missing: BILLING_STEPS.vat,
  regime_code_missing: BILLING_STEPS.vat,
  tax_rule_missing: BILLING_STEPS.vat,
  guest_series_unconfirmed: BILLING_STEPS.numbering,
  owner_series_unconfirmed: BILLING_STEPS.numbering,
  tourist_tax_channels_unconfirmed: BILLING_STEPS.touristTax,
  channel_commissions_unconfirmed: BILLING_STEPS.channels,
  owners_without_mandate: BILLING_STEPS.mandate,
  auto_issue_unconfirmed: BILLING_STEPS.issuing,
  conservation_agreement_unconfirmed: BILLING_STEPS.italy,
  stamp_duty_unconfirmed: BILLING_STEPS.italy,
};

/** The step of each section of the setup: where an item that the app does not know yet (an epic added it) is still opened, by the section it says it belongs to. */
export const BILLING_SECTION_STEPS: Readonly<Record<BillingSetupSectionName, BillingStepId>> = {
  issuer: BILLING_STEPS.issuer,
  vat: BILLING_STEPS.vat,
  numbering: BILLING_STEPS.numbering,
  touristTax: BILLING_STEPS.touristTax,
  channels: BILLING_STEPS.channels,
  mandates: BILLING_STEPS.mandate,
  automation: BILLING_STEPS.issuing,
  italy: BILLING_STEPS.italy,
};

/** True for an item key this version of the app knows (it has a step and a text). */
export function isBillingItemKey(value: unknown): value is BillingSetupItemKey {
  return typeof value === 'string' && Object.hasOwn(BILLING_ITEM_STEPS, value);
}

/**
 * The step that fixes a missing item: the one of its key; for a key the app does not know (the server is newer than the app) the one of its section; `null` when it knows
 * neither, and the caller then opens the wizard where it would open it without a step (at the first thing that is missing), never at a step that has nothing to do with it.
 */
export function billingStepOfItem(item: { key: unknown; section?: unknown }): BillingStepId | null {
  if (isBillingItemKey(item.key)) return BILLING_ITEM_STEPS[item.key];
  if (typeof item.section === 'string' && Object.hasOwn(BILLING_SECTION_STEPS, item.section)) return BILLING_SECTION_STEPS[item.section as BillingSetupSectionName];
  return null;
}

/** The step the guide opens for the reason of the part «Fatturazione» (the key of its first missing item); `null` for any other reason (the flag of the issuance off, a part not provided). */
export function billingStepOfReason(reason: unknown): BillingStepId | null {
  return isBillingItemKey(reason) ? BILLING_ITEM_STEPS[reason] : null;
}

/** The key of the text that says what a missing item is, in plain words (the guide and the summary of the wizard); a key the app does not know reads as a neutral line. */
export function billingItemTextKey(key: unknown): string {
  return isBillingItemKey(key) ? `billingWizard.items.${key}` : 'billingWizard.items.unknown';
}
