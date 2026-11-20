import { isAxiosError } from 'axios';
import { UnexpectedApiResponseError, getProblemCode } from '@/lib/api-errors';
import type {
  BillingSetup,
  BillingSetupSection,
  ChannelAccountHolder,
  ChannelAccountHolderChange,
  ChannelCommissionRuleInput,
  ChannelCommissionRuleSet,
  ConfirmPortalTouristTaxComuniRequest,
  FiscalIssuerPreview,
  OwnerMandateTemplate,
  OwnerMandateTemplateResult,
  PortalAccountSettingsRequest,
  SaveBillingSetupSectionRequest,
} from '@/types';
import { ApiClient } from './client';

const SETUP_PATH = '/billing-setup';
const PORTAL_COMUNI_PATH = `${SETUP_PATH}/touristTax/portal-comuni`;
const HOLDERS_PATH = `${SETUP_PATH}/channel-account-holders`;
const COMMISSION_RULES_PATH = '/owner-accounting/channel-commission-rules';
const APPLY_TEMPLATE_PATH = '/owner-mandates/apply-template';
const PREVIEW_PATH = '/fiscal/documents/issuer-preview';

/** The code of the 403 a caller gets when it reaches only some of the properties: the setup is the whole organization's. */
const NEEDS_WHOLE_ORG = 'fiscal_settings_need_whole_org';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A body that is not a section (the SPA's `index.html` behind a wrong rewrite) is a load error, never an empty form. */
function ensureSection(data: unknown, path: string): BillingSetupSection {
  if (!isRecord(data) || typeof data.section !== 'string' || !isRecord(data.values) || !Array.isArray(data.missing)) {
    throw new UnexpectedApiResponseError(path);
  }
  return data as unknown as BillingSetupSection;
}

/** A body that is not the setup is a load error too. */
function ensureSetup(data: unknown): BillingSetup {
  if (!isRecord(data) || !Array.isArray(data.sections)) throw new UnexpectedApiResponseError(SETUP_PATH);
  for (const section of data.sections) ensureSection(section, SETUP_PATH);
  return data as unknown as BillingSetup;
}

function ensureList<T>(data: unknown, path: string): T[] {
  if (!Array.isArray(data)) throw new UnexpectedApiResponseError(path);
  return data as T[];
}

/**
 * The whole invoicing setup in one read (`GET api/billing-setup`, `payment.read`): every section with its values and what is still missing in it, in the order of the
 * wizard. 404 while the issuance of fiscal documents is off.
 */
export async function getBillingSetup(): Promise<BillingSetup> {
  return ensureSetup(await ApiClient.get<unknown>(SETUP_PATH));
}

/**
 * Saves the fields of one section and answers the section as saved (`PUT api/billing-setup/{section}`, `property.write` and the whole organization). A partial payload is a
 * draft: what it does not carry stays, and saving the same answers again changes nothing. 422 `issuer_field_invalid` (with the `field` and the list of `errors`),
 * `issuer_regime_country_mismatch`, `billing_setup_field_not_in_section`; 403 `fiscal_settings_need_whole_org` for a caller who reaches only some of the properties.
 */
export async function saveBillingSetupSection(section: string, request: SaveBillingSetupSectionRequest): Promise<BillingSetupSection> {
  const path = `${SETUP_PATH}/${encodeURIComponent(section)}`;
  return ensureSection(await ApiClient.put<unknown>(path, request), path);
}

/**
 * The portals the organization confirms as the ones that collect and pay the tourist tax in a comune (`PUT api/billing-setup/touristTax/portal-comuni`, `property.write` and the
 * whole organization): the WHOLE list of the pairs, which replaces the previous one (the pairs already confirmed go in it again; an empty list takes every confirmation away).
 * It counts only for the properties in that comune and never touches the list of the portals that collect it everywhere. Answers the section `touristTax` as saved, with
 * `confirmedPortalTouristTaxComuni`: an answer that is not that section is a failure and never a success (the person would be told «confirmed» for what nobody saved). 422
 * `issuer_field_invalid` (a portal that is not one, a code that is not six digits, a Swiss issuer), `issuer_profile_incomplete` (before the issuer step created the profile); 403
 * `fiscal_settings_need_whole_org` for a caller who reaches only some of the properties.
 */
export async function confirmPortalTouristTaxComuni(request: ConfirmPortalTouristTaxComuniRequest): Promise<BillingSetupSection> {
  const saved = ensureSection(await ApiClient.put<unknown>(PORTAL_COMUNI_PATH, request), PORTAL_COMUNI_PATH);
  if (saved.section !== 'touristTax' || !Array.isArray(saved.values.confirmedPortalTouristTaxComuni)) throw new UnexpectedApiResponseError(PORTAL_COMUNI_PATH);
  return saved;
}

/**
 * Whether the caller may change the setup: `false` for a caller who reaches only some of the properties, whom the server refuses (403 `fiscal_settings_need_whole_org`)
 * before it reads anything. The setup carries no field that tells the reach, so it is asked the only way the server answers it: a save that carries no field. The server
 * answers such a save with the section as it is and changes nothing (the same answers saved twice leave the same setting), so this reads and writes nothing; any other
 * failure is the caller's to show, never an answer.
 */
export async function canChangeBillingSetup(): Promise<boolean> {
  try {
    await saveBillingSetupSection('issuer', {});
    return true;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403 && getProblemCode(error.response.data) === NEEDS_WHOLE_ORG) return false;
    throw error;
  }
}

/**
 * The defaults of the portal accounts (`PUT api/billing-setup/channels`): who holds the accounts of the portals and whether their commissions are recharged to the owners
 * (⚖ I10, I11). Behind the flag `ownerInvoicing` (404 while it is off). 422 `billing_channels_invalid`; 403 `fiscal_settings_need_whole_org`.
 */
export async function savePortalAccountSettings(request: PortalAccountSettingsRequest): Promise<BillingSetupSection> {
  const path = `${SETUP_PATH}/channels`;
  return ensureSection(await ApiClient.put<unknown>(path, request), path);
}

/** The holders of the portal accounts of the listings where they differ from the default (`GET api/billing-setup/channel-account-holders`, the whole organization only). */
export async function getChannelAccountHolders(): Promise<ChannelAccountHolder[]> {
  return ensureList<ChannelAccountHolder>(await ApiClient.get<unknown>(HOLDERS_PATH), HOLDERS_PATH);
}

/**
 * Writes the holders of the listings named, in bulk (`PUT api/billing-setup/channel-account-holders`): `holder: null` brings a listing back to the default; the listings
 * not named keep theirs. Answers the whole list as saved. 422 `channel_account_holders_invalid` (an empty list, a portal that is not one, a listing named twice), 409
 * `channel_account_holders_conflict`.
 */
export async function saveChannelAccountHolders(changes: readonly ChannelAccountHolderChange[]): Promise<ChannelAccountHolder[]> {
  return ensureList<ChannelAccountHolder>(await ApiClient.put<unknown>(HOLDERS_PATH, changes), HOLDERS_PATH);
}

/**
 * The commission rules of the portals and, for each portal, what applies today (`GET api/owner-accounting/channel-commission-rules`, `agency.statement.view`, the whole
 * organization only).
 */
export async function getChannelCommissionRules(): Promise<ChannelCommissionRuleSet> {
  const data = await ApiClient.get<unknown>(COMMISSION_RULES_PATH);
  if (!isRecord(data) || !Array.isArray(data.rules) || !Array.isArray(data.channels)) throw new UnexpectedApiResponseError(COMMISSION_RULES_PATH);
  return data as unknown as ChannelCommissionRuleSet;
}

/**
 * Replaces the commission rules with the whole list (`PUT`, `agency.owner.financial.manage`): a rule that lines of the owner ledger already name can be closed but not
 * removed nor given another percent (409 `channel_commission_rule_in_use`); 422 `channel_commission_rules_invalid` (with the `index` and the `field`).
 */
export async function saveChannelCommissionRules(rules: readonly ChannelCommissionRuleInput[]): Promise<ChannelCommissionRuleSet> {
  const data = await ApiClient.put<unknown>(COMMISSION_RULES_PATH, rules);
  if (!isRecord(data) || !Array.isArray(data.rules) || !Array.isArray(data.channels)) throw new UnexpectedApiResponseError(COMMISSION_RULES_PATH);
  return data as unknown as ChannelCommissionRuleSet;
}

/**
 * The standard mandate for every owner of the agency with an ownership not ended and no mandate (`POST api/owner-mandates/apply-template`,
 * `agency.owner.financial.manage`): the counts of the versions created and of the owners skipped. 422 `owner_mandate_invalid` (with the `field`).
 */
export async function applyMandateTemplate(template: OwnerMandateTemplate): Promise<OwnerMandateTemplateResult> {
  const data = await ApiClient.post<unknown>(APPLY_TEMPLATE_PATH, { template });
  if (!isRecord(data) || typeof data.created !== 'number' || typeof data.skipped !== 'number') throw new UnexpectedApiResponseError(APPLY_TEMPLATE_PATH);
  return data as unknown as OwnerMandateTemplateResult;
}

/**
 * Who issues and with which rule for the organization (`GET api/fiscal/documents/issuer-preview` without a booking): CasaZen, and the tax rule in force today with the VAT
 * of every line type (absent while the profile has no regime or no rule of the catalog covers it). It changes nothing.
 */
export async function getBillingPreview(): Promise<FiscalIssuerPreview> {
  const data = await ApiClient.get<unknown>(PREVIEW_PATH);
  if (!isRecord(data) || typeof data.issuer !== 'string' || typeof data.reason !== 'string') throw new UnexpectedApiResponseError(PREVIEW_PATH);
  return data as unknown as FiscalIssuerPreview;
}
