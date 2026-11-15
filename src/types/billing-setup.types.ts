import type { CleaningFeeTreatment, DocumentRegime, StayVatTreatment } from './fiscal-issuer.types';
import type { CommissionBase } from './owner-accounting.types';

// The billing setup of the organization (E11/F01/US01/T04, NF-82, NF-104, NF-118): what `GET api/billing-setup` and `PUT api/billing-setup/{section}` send and take,
// and the endpoints of the owner ledger that the steps «Commissioni dei canali» and «Mandato standard» of the wizard «Fatturazione» use. The API writes the enums by
// name and leaves out what is empty (a value that is not saved is not in `values`, a member that is `null` on the server is not in the answer).

/** The eight sections of the setup in the order of the wizard (backend `BillingSetupSections`): the names the API speaks, never renamed. */
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
] as const;
export type BillingSetupItemKey = (typeof BILLING_SETUP_ITEM_KEYS)[number];

/** Why an item is missing (backend `BillingSetupReasons`): a value is absent, a choice was never confirmed, or the installation lacks something the user cannot fix. */
export const BILLING_SETUP_REASONS = ['required', 'unconfirmed', 'unavailable'] as const;
export type BillingSetupReason = (typeof BILLING_SETUP_REASONS)[number];

/**
 * One thing still to do. `key` and `section` are strings and not the unions above: the server may be newer than the app, and an item the app does not know is possible
 * at run time. `count` is there when the item counts something (the owners without a mandate). Codes and counts only, no personal data.
 */
export interface BillingSetupItem {
  key: string;
  section: string;
  reason: string;
  count?: number;
}

/** One section: whether it applies to this organization, what is saved in it (by the names of its fields) and what is still missing in it. */
export interface BillingSetupSection {
  section: string;
  /** False when the section has nothing to do for this organization: it has no missing item and the guide does not count it. */
  applies: boolean;
  complete: boolean;
  /** What is saved, by field name; a value that is not saved is left out. */
  values: Record<string, unknown>;
  missing: BillingSetupItem[];
}

/** The billing setup (`GET api/billing-setup`): every section in the order of the wizard, with its values and its missing items. */
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
  /** The names of the portals (`BookingSource`) that collect the tourist tax themselves; an empty list confirms that none does. */
  platformCollectedTouristTaxChannels?: string[];
  autoIssueGuestDocuments?: boolean;
  emailGuestDocuments?: boolean;
  stampDutyReference?: string;
  conservationAgreementConfirmed?: boolean;
  virtualStampConfirmed?: boolean;
}

/** The names of the fields of a section as the API says them: `issuer_field_invalid` names them (`field`, `errors`). */
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

// ---------------------------------------------------------------------------------------------------------------------
// Who holds the accounts of the portals (E14/F01/US01/T01, ⚖ I10, I11): behind the flag `ownerInvoicing`, whole organization only.
// ---------------------------------------------------------------------------------------------------------------------

/** Who holds the account of a listing on a portal: the owner (V1, the default) or the agency (V2). */
export const PORTAL_ACCOUNT_HOLDERS = ['Owner', 'Agency'] as const;
export type PortalAccountHolder = (typeof PORTAL_ACCOUNT_HOLDERS)[number];

/** `PUT api/billing-setup/channels`: a member left out keeps its value. */
export interface PortalAccountSettingsRequest {
  portalAccountHolder?: PortalAccountHolder;
  rechargePortalCommissions?: boolean;
}

/** The holder of a listing on a portal where it differs from the default of the organization (`GET api/billing-setup/channel-account-holders`). */
export interface ChannelAccountHolder {
  propertyId: string;
  propertyName: string;
  /** The portal, by the name of `BookingSource`. */
  channel: string;
  holder: PortalAccountHolder;
  updatedAt: string;
}

/** One row of the bulk write of the holders: the listing, the portal and the holder (`null` brings the listing back to the default of the organization). */
export interface ChannelAccountHolderChange {
  propertyId: string;
  channel: string;
  holder: PortalAccountHolder | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// The owner ledger (E13/F01/US01/T01): what a portal keeps when its reservation carries no commission, and the standard mandate of the owners.
// ---------------------------------------------------------------------------------------------------------------------

/**
 * What a commission is a percentage of (backend `CommissionBase`): the gross of the stay without the tourist tax, with or without the cleaning. The type is the one of the owner ledger
 * (`owner-accounting.types.ts`, which the mandate form uses): this is the list the wizard offers, and it cannot hold a value the type does not.
 */
export const COMMISSION_BASES = ['GrossExclTouristTax', 'GrossExclTouristTaxAndCleaning'] as const satisfies readonly CommissionBase[];

/** A commission rule of a portal, as stored (`rules` of `GET api/owner-accounting/channel-commission-rules`). */
export interface ChannelCommissionRule {
  id: string;
  channel: string;
  percent: number;
  base: CommissionBase;
  /** The first check-out day the rule applies to (`YYYY-MM-DD`). */
  validFrom: string;
  /** The last check-out day, included; absent = no end. */
  validTo?: string | null;
  createdAt: string;
}

/** What applies today to the stays of a portal: the rule in force, or the configured default (`isDefault`), or nothing (no `percent`). */
export interface ChannelCommissionInForce {
  channel: string;
  percent?: number | null;
  base?: CommissionBase | null;
  isDefault: boolean;
  ruleId?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
}

/** `GET` and the answer of the `PUT` of the commission rules of the portals. */
export interface ChannelCommissionRuleSet {
  rules: ChannelCommissionRule[];
  channels: ChannelCommissionInForce[];
}

/** A rule of the whole list a `PUT` replaces: the percent is required (a rule of 0% is a choice), the base left out is the default. */
export interface ChannelCommissionRuleInput {
  channel: string;
  percent: number;
  base?: CommissionBase;
  validFrom: string;
  validTo?: string | null;
}

/** The standard mandate (`template` of `POST api/owner-mandates/apply-template`): what every owner without a mandate gets from `validFrom` on. */
export interface OwnerMandateTemplate {
  /** The first day of the version (`YYYY-MM-DD`, Europe/Rome). */
  validFrom: string;
  commissionPercent: number;
  commissionBase?: CommissionBase;
  /** `false` = the commission and the flat fees are «+ IVA» (⚖ R4); `true` = they include the VAT. */
  commissionIncludesVat: boolean;
  cleaningFlatRate?: number;
  linenFlatRate?: number;
  /** The fees of the card payments collected through CasaZen pass to the owner. */
  passthroughPaymentFees: boolean;
}

/** What the standard mandate did: how many owners got a version and how many were skipped (no ownership in force, or a mandate already). */
export interface OwnerMandateTemplateResult {
  created: number;
  skipped: number;
  createdOwnerIds: string[];
  skippedOwnerIds: string[];
}
