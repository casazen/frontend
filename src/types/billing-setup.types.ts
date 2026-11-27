import type { CleaningFeeTreatment, DocumentRegime, StayVatTreatment } from './fiscal-issuer.types';
import type { CommissionBase } from './owner-accounting.types';

// The billing setup of the organization (E11/F01/US01/T04, NF-82, NF-104, NF-118): what `GET api/billing-setup` and `PUT api/billing-setup/{section}` send and take,
// and the endpoints of the owner ledger that the steps «Commissioni dei canali» and «Mandato standard» of the wizard «Fatturazione» use. The API writes the enums by
// name and leaves out what is empty (a value that is not saved is not in `values`, a member that is `null` on the server is not in the answer).

export const BILLING_SETUP_SECTIONS = ['issuer', 'vat', 'numbering', 'touristTax', 'channels', 'mandates', 'automation', 'italy'] as const;
export type BillingSetupSectionName = (typeof BILLING_SETUP_SECTIONS)[number];

/**
 * The keys of the items that can be missing (backend `BillingSetupItemKeys` and `OwnerBillingSetupItemKeys`), copied as they stand there: stable codes, never renamed.
 * The key of the first missing item is the reason of the part «Fatturazione» of the onboarding guide, and the client opens the wizard at the step the key belongs to
 * (`BILLING_ITEM_STEPS`). A key an epic adds later (the Italian owner issuers of E17) is added here and in that table, or the test that keeps the two the same says so.
 */
export const BILLING_SETUP_ITEM_KEYS = [
  'country_missing',
  'legal_name_missing',
  'address_missing',
  'vat_number_missing',
  'fiscal_code_missing',
  'swiss_uid_missing',
  'regime_missing',
  'regime_code_missing',
  'tax_rule_missing',
  'guest_series_unconfirmed',
  'owner_series_unconfirmed',
  'tourist_tax_channels_unconfirmed',
  'channel_commissions_unconfirmed',
  'owners_without_mandate',
  'auto_issue_unconfirmed',
  'conservation_agreement_unconfirmed',
  'stamp_duty_unconfirmed',
  'owner_issuer_missing',
  'sdi_issuer_registration_pending',
] as const;
export type BillingSetupItemKey = (typeof BILLING_SETUP_ITEM_KEYS)[number];

export interface BillingSetupItem {
  key: string;
  section: string;
  reason: string;
  count?: number;
}

export interface BillingSetupSection {
  section: string;
  applies: boolean;
  complete: boolean;
  values: Record<string, unknown>;
  missing: BillingSetupItem[];
}

export interface BillingSetup {
  complete: boolean;
  sections: BillingSetupSection[];
}

/**
 * What a step saves (`PUT api/billing-setup/{section}`): only the fields it sends. A field left out keeps its saved value (a draft save never clears what the step did not
 * carry); a text sent empty clears it; a list, even an empty one, is sent. A field of another section is refused (422 `billing_setup_field_not_in_section`), except the
 * Swiss UID, which both the issuer and the VAT step take. The Italian VAT number and the fiscal code are not sent: they live on the organization (its tax profile).
 */
export interface SaveBillingSetupSectionRequest {
  countryCode?: string;
  legalName?: string;
  addressStreet?: string;
  addressCivic?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  swissVatNumber?: string;
  regime?: DocumentRegime;
  vatRegistered?: boolean;
  fatturaPaRegimeCode?: string;
  stayVatTreatment?: StayVatTreatment;
  cleaningFeeTreatment?: CleaningFeeTreatment;
  guestDocumentSeries?: string;
  ownerInvoiceSeries?: string;
  platformCollectedTouristTaxChannels?: string[];
  autoIssueGuestDocuments?: boolean;
  emailGuestDocuments?: boolean;
  stampDutyReference?: string;
  conservationAgreementConfirmed?: boolean;
  virtualStampConfirmed?: boolean;
}

export const BILLING_SETUP_FIELDS = [
  'countryCode',
  'legalName',
  'addressStreet',
  'addressCivic',
  'postalCode',
  'city',
  'province',
  'swissVatNumber',
  'regime',
  'vatRegistered',
  'fatturaPaRegimeCode',
  'stayVatTreatment',
  'cleaningFeeTreatment',
  'guestDocumentSeries',
  'ownerInvoiceSeries',
  'platformCollectedTouristTaxChannels',
  'autoIssueGuestDocuments',
  'emailGuestDocuments',
  'stampDutyReference',
  'conservationAgreementConfirmed',
  'virtualStampConfirmed',
] as const;
export type BillingSetupField = (typeof BILLING_SETUP_FIELDS)[number];

export interface ItalianPortalProposal {
  comuneIstat: string;
  comune: string;
  channel: string;
  status: string;
}

export interface PortalTouristTaxComune {
  channel: string;
  comuneIstat: string;
}

export interface ConfirmPortalTouristTaxComuniRequest {
  comuni: PortalTouristTaxComune[];
}

export const PORTAL_ACCOUNT_HOLDERS = ['Owner', 'Agency'] as const;
export type PortalAccountHolder = (typeof PORTAL_ACCOUNT_HOLDERS)[number];

/**
 * `PUT api/billing-setup/channels`: a member left out keeps its value. `acknowledgeRechargeWaiver` is the explicit confirmation of the waiver of the recharge (FIX/BE-V2-NO-RECHARGE): a save that
 * turns the recharge off while the agency holds an account, or makes the agency the default holder while the recharge is off, is refused (422 `recharge_waiver_not_acknowledged`) without it. It is
 * sent ONLY after the person confirmed in the dialog that says what the waiver is, never by default and never in the first request of a save.
 */
export interface PortalAccountSettingsRequest {
  portalAccountHolder?: PortalAccountHolder;
  rechargePortalCommissions?: boolean;
  acknowledgeRechargeWaiver?: boolean;
}

export interface ChannelAccountHolder {
  propertyId: string;
  propertyName: string;
  channel: string;
  holder: PortalAccountHolder;
  updatedAt: string;
}

export interface ChannelAccountHolderChange {
  propertyId: string;
  channel: string;
  holder: PortalAccountHolder | null;
}

export const COMMISSION_BASES = ['GrossExclTouristTax', 'GrossExclTouristTaxAndCleaning'] as const satisfies readonly CommissionBase[];

interface ChannelCommissionRule {
  id: string;
  channel: string;
  percent: number;
  base: CommissionBase;
  validFrom: string;
  validTo?: string | null;
  createdAt: string;
}

export interface ChannelCommissionInForce {
  channel: string;
  percent?: number | null;
  base?: CommissionBase | null;
  isDefault: boolean;
  ruleId?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
}

export interface ChannelCommissionRuleSet {
  rules: ChannelCommissionRule[];
  channels: ChannelCommissionInForce[];
}

export interface ChannelCommissionRuleInput {
  channel: string;
  percent: number;
  base?: CommissionBase;
  validFrom: string;
  validTo?: string | null;
}

export interface OwnerMandateTemplate {
  validFrom: string;
  commissionPercent: number;
  commissionBase?: CommissionBase;
  /** `false` = the commission and the flat fees are «+ IVA» (⚖ R4); `true` = they include the VAT. */
  commissionIncludesVat: boolean;
  cleaningFlatRate?: number;
  linenFlatRate?: number;
  passthroughPaymentFees: boolean;
}

export interface OwnerMandateTemplateResult {
  created: number;
  skipped: number;
  createdOwnerIds: string[];
  skippedOwnerIds: string[];
}
