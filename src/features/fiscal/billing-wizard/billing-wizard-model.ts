import { isAxiosError } from 'axios';
import type { FiscalTaxProfileUpdate } from '@/api/fiscal.api';
import { defaultPeriod, periodParam } from '@/features/owner-accounting/owner-accounting-model';
import { compactIdentifier } from '@/features/fiscal/tax-profile-changes';
import { getProblemCode } from '@/lib/api-errors';
import { billingStepOfItem } from '@/lib/onboarding-billing';
import { addDays } from '@/lib/stay-dates';
import type {
  AccountantPackageSettings,
  BillingSetup,
  BillingSetupField,
  BillingSetupItem,
  BillingSetupSection,
  BillingSetupSectionName,
  ChannelAccountHolder,
  ChannelAccountHolderChange,
  ChannelCommissionInForce,
  ChannelCommissionRuleInput,
  ChannelCommissionRuleSet,
  CommissionBase,
  ConfirmPortalTouristTaxComuniRequest,
  DocumentRegime,
  FiscalTaxRule,
  ItalianPortalProposal,
  OwnerMandateTemplate,
  PortalAccountHolder,
  PortalTouristTaxComune,
  SaveAccountantPackageSettingsRequest,
  SaveBillingSetupSectionRequest,
} from '@/types';
import { BILLING_STEPS, BILLING_STEP_ORDER, type BillingStepId } from './billing-wizard-ids';
import {
  BILLING_ERROR_KEYS,
  ITALIAN_REGIMES,
  PORTAL_SOURCES,
  accountantAnswersOf,
  accountantProblems,
  accountantUntouched,
  channelsStepSchema,
  isPlainEmail,
  isSendDay,
  issuerStepSchema,
  italyStepSchema,
  mandateTemplateProblems,
  numberingStepSchema,
  parseDecimal,
  touristTaxStepSchema,
  vatStepSchema,
  type AccountantAnswers,
  type BillingCountry,
  type BillingIdentityOnRecord,
  type BillingWizardValues,
  type HolderChoice,
  type ItalianRegime,
} from './billing-wizard-schema';

export function currencyOfCountry(countryCode: string | null | undefined): string | null {
  switch ((countryCode ?? '').trim().toUpperCase()) {
    case 'CH':
      return 'CHF';
    case 'IT':
      return 'EUR';
    default:
      return null;
  }
}

export function amountLocale(language: string): string {
  return language.startsWith('en') ? 'en-GB' : 'it-IT';
}

export function plainAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function sectionOf(setup: BillingSetup | undefined, name: BillingSetupSectionName): BillingSetupSection | undefined {
  return setup?.sections.find((section) => section.section === name);
}

export function textOf(values: Record<string, unknown> | undefined, key: string): string {
  const value = values?.[key];
  return typeof value === 'string' ? value : '';
}

export function flagOf(values: Record<string, unknown> | undefined, key: string, fallback = false): boolean {
  const value = values?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

function listOf(values: Record<string, unknown> | undefined, key: string): string[] | null {
  const value = values?.[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : null;
}

function isMissing(setup: BillingSetup | undefined, key: string): boolean {
  return Boolean(setup?.sections.some((section) => section.missing.some((item) => item.key === key)));
}

/**
 * The portals the step «Tassa di soggiorno» proposes as the ones that collect the tourist tax, for an issuer that has not said its own answer yet: the ones the server lists in
 * `defaultPlatformCollectedTouristTaxChannels` of the section `touristTax` (the shipped default of the Swiss tourist tax, which is what the guest documents assume until the issuer confirms:
 * the wizard and the documents never disagree). It is a proposal and never an answer: it is read, never saved by itself (the issuer's own list is `platformCollectedTouristTaxChannels`), and
 * once the issuer has confirmed a list, even an empty one, nothing is proposed and what the issuer saved is what the step shows. Only the portals the step asks about are kept.
 */
export function platformDefaultsOf(setup: BillingSetup | undefined): Array<(typeof PORTAL_SOURCES)[number]> {
  const tourist = sectionOf(setup, 'touristTax')?.values;
  if (flagOf(tourist, 'confirmed') || listOf(tourist, 'platformCollectedTouristTaxChannels') !== null) return [];
  const proposed = listOf(tourist, 'defaultPlatformCollectedTouristTaxChannels') ?? [];
  return PORTAL_SOURCES.filter((portal) => proposed.includes(portal));
}

/**
 * The answers of the wizard as they stand for a person who has not touched the step «Tassa di soggiorno»: the ones it opened with, and the proposal (`proposed`, from `platformDefaultsOf` of the
 * setup as it is now) in the portals that have no answer. The proposal may arrive after the wizard opened (the country is chosen in it), and it is not something the person wrote: a draft
 * that leaves the step as it is must not take it for an answer (nothing is saved for it), nor tell the person that something they wrote was left out.
 */
export function withProposal(values: BillingWizardValues, proposed: readonly string[]): BillingWizardValues {
  if (proposed.length === 0) return values;
  const touristTaxCollectors = { ...values.touristTaxCollectors };
  for (const portal of PORTAL_SOURCES) {
    if (proposed.includes(portal) && touristTaxCollectors[portal] === '') touristTaxCollectors[portal] = 'portal';
  }
  return { ...values, touristTaxCollectors };
}

const PROPOSALS_KEY = 'italianPortalProposals';
const CONFIRMED_KEY = 'confirmedPortalTouristTaxComuni';
const CONFLICT_KEY = 'portalTouristTaxConflict';

const TO_CONFIRM = 'to_confirm';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameComune(a: PortalTouristTaxComune, b: PortalTouristTaxComune): boolean {
  return a.channel === b.channel && a.comuneIstat === b.comuneIstat;
}

function pairsOf(value: unknown): PortalTouristTaxComune[] | null {
  if (!Array.isArray(value)) return null;
  const pairs: PortalTouristTaxComune[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.channel !== 'string' || entry.channel === '' || typeof entry.comuneIstat !== 'string' || entry.comuneIstat === '') return null;
    const pair = { channel: entry.channel, comuneIstat: entry.comuneIstat };
    if (!pairs.some((known) => sameComune(known, pair))) pairs.push(pair);
  }
  return pairs;
}

function proposalsOf(value: unknown, confirmed: readonly PortalTouristTaxComune[]): ItalianPortalProposal[] {
  if (!Array.isArray(value)) return [];
  const proposals: ItalianPortalProposal[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || entry.status !== TO_CONFIRM) continue;
    const { channel, comuneIstat, comune } = entry;
    if (typeof channel !== 'string' || channel === '' || typeof comuneIstat !== 'string' || comuneIstat === '') continue;
    const pair = { channel, comuneIstat };
    if (confirmed.some((known) => sameComune(known, pair)) || proposals.some((known) => sameComune(known, pair))) continue;
    proposals.push({ comuneIstat, comune: typeof comune === 'string' ? comune.trim() : '', channel, status: TO_CONFIRM });
  }
  return proposals;
}

/** What the step «Tassa di soggiorno» of an Italian issuer says of the portals that collect the tourist tax, as the server sent it. */
export interface ItalianTouristTaxView {
  proposals: ItalianPortalProposal[];
  /**
   * The portals the organization already confirmed, one pair for each comune. `null` when the server did not send them, or sent a list that cannot be read: nothing can be answered
   * or taken away then, because an answer is the whole list and one built on a part of it would take confirmations away.
   */
  confirmed: PortalTouristTaxComune[] | null;
  conflict: boolean;
}

/**
 * The tourist tax of the Italian portals as the section `touristTax` of the setup says it. `null` when the section carries none of the three members: an older server, an issuer that is
 * not Italian, or a person who does not reach the whole organization (the server leaves them out for them: nothing is shown, and never an error). The reading is tolerant: a member that
 * is missing or odd leaves its part empty and the rest as it was.
 */
export function italianTouristTaxOf(setup: BillingSetup | undefined): ItalianTouristTaxView | null {
  const values = sectionOf(setup, 'touristTax')?.values;
  if (!values || !(PROPOSALS_KEY in values || CONFIRMED_KEY in values || CONFLICT_KEY in values)) return null;

  const confirmed = pairsOf(values[CONFIRMED_KEY]);
  return { proposals: confirmed === null ? [] : proposalsOf(values[PROPOSALS_KEY], confirmed), confirmed, conflict: values[CONFLICT_KEY] === true };
}

export type PortalComuniChange = { add: PortalTouristTaxComune } | { remove: PortalTouristTaxComune };

/**
 * The body of the confirmation (`PUT api/billing-setup/touristTax/portal-comuni`): the WHOLE list of the pairs the organization confirms, because the server replaces the list it
 * had. A confirmation is the pairs already confirmed plus the new one; a removal is the pairs already confirmed without that one (an empty list takes every confirmation away).
 */
export function portalComuniRequest(confirmed: readonly PortalTouristTaxComune[], change: PortalComuniChange): ConfirmPortalTouristTaxComuniRequest {
  const target = 'add' in change ? change.add : change.remove;
  const others = confirmed.filter((pair) => !sameComune(pair, target));
  return { comuni: [...others, ...('add' in change ? [target] : [])].map(({ channel, comuneIstat }) => ({ channel, comuneIstat })) };
}

export type PortalComuniFailure = 'wholeOrg' | 'forbidden' | 'invalid' | 'profile' | 'notSent' | 'failed';

export class PortalComuniNotSentError extends Error {
  constructor() {
    super('The portals confirmed for the comuni could not be read, so nothing was sent.');
    this.name = 'PortalComuniNotSentError';
  }
}

export function portalComuniFailureOf(error: unknown): PortalComuniFailure {
  if (error instanceof PortalComuniNotSentError) return 'notSent';
  if (isAxiosError(error) && error.response) {
    const { status, data } = error.response;
    const code = getProblemCode(data);
    if (status === 403) return code === 'fiscal_settings_need_whole_org' ? 'wholeOrg' : 'forbidden';
    if (status === 422 && code === 'issuer_field_invalid') return 'invalid';
    if (status === 422 && code === 'issuer_profile_incomplete') return 'profile';
  }
  return 'failed';
}

/**
 * The names of the comuni by ISTAT code, for the pairs the organization confirmed (a confirmed pair is no proposal any more, and its comune must still be named): the name the
 * properties of the organization carry for the code, then the one a proposal gave (the server's), and last the ones a proposal gave earlier in this step (`remembered`). A code with
 * none of them has no name here: the caller shows the code.
 */
export function comuneNamesOf(
  properties: ReadonlyArray<{ city?: string | null; comuneIstatCode?: string | null }>,
  proposals: readonly ItalianPortalProposal[],
  remembered: ReadonlyMap<string, string> = new Map(),
): Map<string, string> {
  const names = new Map<string, string>();
  for (const property of properties) {
    const code = property.comuneIstatCode?.trim();
    const city = property.city?.trim();
    if (code && city && !names.has(code)) names.set(code, city);
  }
  for (const [code, name] of remembered) if (name !== '') names.set(code, name);
  for (const proposal of proposals) if (proposal.comune !== '') names.set(proposal.comuneIstat, proposal.comune);
  return names;
}

/** What of the tax profile the organization has already: the VAT number and the fiscal code the server read from it. */
export function identityOnRecord(setup: BillingSetup | undefined): BillingIdentityOnRecord {
  const values = sectionOf(setup, 'issuer')?.values;
  return { vatNumber: textOf(values, 'vatNumber') !== '', fiscalCode: textOf(values, 'fiscalCode') !== '' };
}

function isCountry(value: string): value is BillingCountry {
  return value === 'IT' || value === 'CH';
}

function isItalianRegime(value: string): value is ItalianRegime {
  return (ITALIAN_REGIMES as readonly string[]).includes(value);
}

/**
 * What the wizard starts from: the setup as the server has it, and what CasaZen knows besides (the name of the organization for the name on the documents, the defaults of the
 * series the server sends). The person confirms rather than types. The country is preselected only once the issuer has said it (the server answers Italy for an issuer that
 * has saved nothing: that is its default, not an answer), so that nobody confirms a country by not choosing one. `today` is the day of Rome.
 */
export function initialValues(setup: BillingSetup, context: { organizationName: string; today: string }): BillingWizardValues {
  const issuer = sectionOf(setup, 'issuer')?.values;
  const vat = sectionOf(setup, 'vat')?.values;
  const numbering = sectionOf(setup, 'numbering')?.values;
  const tourist = sectionOf(setup, 'touristTax')?.values;
  const channels = sectionOf(setup, 'channels')?.values;
  const automation = sectionOf(setup, 'automation')?.values;
  const italy = sectionOf(setup, 'italy')?.values;

  const country = textOf(issuer, 'countryCode').toUpperCase();
  const countryChosen = isCountry(country) && !isMissing(setup, 'country_missing');
  const regime = textOf(vat, 'regime');
  const collected = listOf(tourist, 'platformCollectedTouristTaxChannels');
  const proposed = platformDefaultsOf(setup);
  const holder = textOf(channels, 'portalAccountHolder');
  const stay = textOf(vat, 'stayVatTreatment');
  const cleaning = textOf(vat, 'cleaningFeeTreatment');

  return {
    countryCode: countryChosen ? country : '',
    legalName: textOf(issuer, 'legalName') || context.organizationName,
    addressStreet: textOf(issuer, 'addressStreet'),
    addressCivic: textOf(issuer, 'addressCivic'),
    postalCode: textOf(issuer, 'postalCode'),
    city: textOf(issuer, 'city'),
    province: textOf(issuer, 'province'),
    swissVatRegistered: regime === 'SwissVatRegistered' ? 'yes' : regime === 'SwissNotRegistered' ? 'no' : '',
    regime: isItalianRegime(regime) ? regime : '',
    swissVatNumber: textOf(vat, 'swissVatNumber') || textOf(issuer, 'swissVatNumber'),
    vatNumber: '',
    fiscalCode: '',
    fatturaPaRegimeCode: textOf(vat, 'fatturaPaRegimeCode'),
    stayVatTreatment: stay === 'ExemptArt10' ? 'ExemptArt10' : 'Standard',
    cleaningFeeTreatment: cleaning === 'Service' ? 'Service' : 'FollowsStay',
    guestDocumentSeries: textOf(numbering, 'guestDocumentSeries') || textOf(numbering, 'defaultGuestDocumentSeries'),
    ownerInvoiceSeries: textOf(numbering, 'ownerInvoiceSeries') || textOf(numbering, 'defaultOwnerInvoiceSeries'),
    touristTaxCollectors: Object.fromEntries(
      PORTAL_SOURCES.map((portal) => [portal, collected !== null ? (collected.includes(portal) ? 'portal' : 'host') : proposed.includes(portal) ? 'portal' : '']),
    ),
    portalAccountHolder: holder === 'Agency' ? 'Agency' : 'Owner',
    rechargePortalCommissions: flagOf(channels, 'rechargePortalCommissions', true),
    holderChanges: {},
    commissionPercents: {},
    mandateValidFrom: context.today,
    mandateCommissionPercent: '',
    mandateCommissionBase: 'GrossExclTouristTax',
    mandateCleaningFlatRate: '',
    mandateLinenFlatRate: '',
    mandatePassthroughPaymentFees: false,
    mandateCommissionIncludesVat: false,
    autoIssueGuestDocuments: flagOf(automation, 'autoIssueGuestDocuments'),
    emailGuestDocuments: flagOf(automation, 'emailGuestDocuments'),
    conservationAgreementConfirmed: flagOf(italy, 'conservationAgreementConfirmed'),
    virtualStampConfirmed: flagOf(italy, 'virtualStampConfirmed'),
    stampDutyReference: textOf(italy, 'stampDutyReference'),
    accountantEmail: null,
    accountantMonthly: null,
    accountantDay: null,
    accountantContents: null,
  };
}

/** The steps that exist only where something Italian asks for them (E17/F03/US01): the owners who issue the documents of their stays, and the sending to the SDI. */
export interface ItalianSteps {
  ownerIssuers?: boolean;
  sdi?: boolean;
}

/**
 * The steps of the wizard for what is known: «Commissioni dei canali» and «Mandato standard» only for an agency, «Italia» only for an Italian issuer (it follows the first
 * answer, so a person who has not chosen the country yet does not see it), «Commercialista» only while the package of the accountant is on (`accountant`, the flag `accountantPackage`:
 * with it off the wizard is the one it was). «Proprietari che emettono» only for an agency with Italian owners that still miss a profile (`italian.ownerIssuers`), and «Invio allo SDI» only for an Italian
 * issuer while the sending to the SDI is on (`italian.sdi`: with the flag off the wizard is the one it was). The others are always there.
 */
export function stepIdsFor(country: string, agency: boolean, accountant = false, italian: ItalianSteps = {}): BillingStepId[] {
  return BILLING_STEP_ORDER.filter((id) => {
    if (id === BILLING_STEPS.channels || id === BILLING_STEPS.mandate) return agency;
    if (id === BILLING_STEPS.italy) return country === 'IT';
    if (id === BILLING_STEPS.ownerIssuers) return agency && italian.ownerIssuers === true;
    if (id === BILLING_STEPS.sdi) return country === 'IT' && italian.sdi === true;
    if (id === BILLING_STEPS.accountant) return accountant;
    return true;
  });
}

export function ownerIssuersMissing(setup: BillingSetup | undefined): number {
  return missingItemsOf(setup).find((item) => item.key === 'owner_issuer_missing')?.count ?? 0;
}

/**
 * Where the connection of CasaZen to the SDI stands, from what the server says and whether the sending is on (E17/F03/US01/T02). `connected`: a channel is connected, the invoices go by themselves.
 * `waitingCredentials`: the sending is on and no channel is connected yet (the credentials are CasaZen's to put in the environment): the invoices wait «da inviare» and the issuer uploads the XML by hand and
 * declares it. `notConnected`: the sending is off, so no channel is used whatever the environment has (the same hand upload, and nothing to wait for). Nothing is claimed while the server has not said.
 */
export type SdiConnection = 'connected' | 'waitingCredentials' | 'notConnected';

export function sdiConnectionOf(input: { providerConfigured: boolean; sendingOn: boolean }): SdiConnection {
  if (!input.sendingOn) return 'notConnected';
  return input.providerConfigured ? 'connected' : 'waitingCredentials';
}

export function missingItemsOf(setup: BillingSetup | undefined): BillingSetupItem[] {
  return setup?.sections.flatMap((section) => section.missing) ?? [];
}

export function firstMissingStep(setup: BillingSetup | undefined, steps: readonly BillingStepId[]): BillingStepId | null {
  const missing = missingItemsOf(setup).map((item) => billingStepOfItem(item));
  return steps.find((id) => missing.includes(id)) ?? null;
}

export interface StepSave {
  section: BillingSetupSectionName;
  request: SaveBillingSetupSectionRequest;
}

const text = (value: string) => value.trim();

/** The fields of a step whose answer does not pass its own checks: a draft leaves them out, so that what is valid is saved and what is not waits for the person. */
function invalidFieldsOf(step: BillingStepId, values: BillingWizardValues, onRecord: BillingIdentityOnRecord): ReadonlySet<string> {
  const schema =
    step === BILLING_STEPS.issuer
      ? issuerStepSchema
      : step === BILLING_STEPS.vat
        ? vatStepSchema(onRecord)
        : step === BILLING_STEPS.numbering
          ? numberingStepSchema
          : step === BILLING_STEPS.touristTax
            ? touristTaxStepSchema
            : step === BILLING_STEPS.italy
              ? italyStepSchema
              : null;
  const result = schema?.safeParse(values);
  if (!result || result.success) return new Set();
  return new Set(result.error.issues.map((issue) => String(issue.path[0])));
}

function sameAnswer(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * What the step saves (`PUT api/billing-setup/{section}`), or `null` for a step that saves nothing in that section (the steps of the portals and of the mandate have their own
 * calls; the Italian tourist tax has nothing to save). A step that was checked sends every field it asks. A DRAFT (what «Salva ed esci» keeps) sends only what is valid and
 * not empty: nothing the person has not answered is saved as an answer, and a field that is not valid does not stop the others from being kept. When the page says what the
 * step started from (`initial`), a draft also leaves out every field the person did not change: a proposal left as it was (the name of the organization as the name on the
 * documents, the series the server proposes, a choice that is «no» until it is answered) is not an answer, and leaving the step must not turn it into one.
 */
export function stepSave(
  step: BillingStepId,
  values: BillingWizardValues,
  options: { draft?: boolean; onRecord?: BillingIdentityOnRecord; initial?: BillingWizardValues } = {},
): StepSave | null {
  const draft = options.draft === true;
  const invalid = draft ? invalidFieldsOf(step, values, options.onRecord ?? { vatNumber: false, fiscalCode: false }) : new Set<string>();
  const initial = options.initial;
  const untouched = (field: keyof BillingWizardValues): boolean => draft && initial !== undefined && sameAnswer(values[field], initial[field]);
  const put = (request: SaveBillingSetupSectionRequest, field: BillingSetupField, value: string): void => {
    if (draft && (value === '' || invalid.has(field) || untouched(field as keyof BillingWizardValues))) return;
    (request as Record<string, unknown>)[field] = value;
  };

  switch (step) {
    case BILLING_STEPS.issuer: {
      const request: SaveBillingSetupSectionRequest = {};
      put(request, 'countryCode', values.countryCode);
      put(request, 'legalName', text(values.legalName));
      put(request, 'addressStreet', text(values.addressStreet));
      put(request, 'addressCivic', text(values.addressCivic));
      put(request, 'postalCode', values.postalCode.replace(/\s+/g, ''));
      put(request, 'city', text(values.city));
      put(request, 'province', text(values.province).toUpperCase());
      return { section: 'issuer', request };
    }
    case BILLING_STEPS.vat: {
      const request: SaveBillingSetupSectionRequest = {};
      if (values.countryCode === 'CH') {
        if (values.swissVatRegistered !== '' && !invalid.has('swissVatRegistered')) {
          const registered = values.swissVatRegistered === 'yes';
          if (!untouched('swissVatRegistered')) {
            request.regime = registered ? 'SwissVatRegistered' : 'SwissNotRegistered';
            request.vatRegistered = registered;
          }
          if (registered) put(request, 'swissVatNumber', text(values.swissVatNumber).toUpperCase());
        }
      } else {
        if (values.regime !== '' && !invalid.has('regime') && !untouched('regime')) request.regime = values.regime;
        put(request, 'fatturaPaRegimeCode', text(values.fatturaPaRegimeCode).toUpperCase());
        if (!untouched('stayVatTreatment')) request.stayVatTreatment = values.stayVatTreatment;
      }
      if (!untouched('cleaningFeeTreatment')) request.cleaningFeeTreatment = values.cleaningFeeTreatment;
      return { section: 'vat', request };
    }
    case BILLING_STEPS.numbering: {
      const request: SaveBillingSetupSectionRequest = {};
      put(request, 'guestDocumentSeries', text(values.guestDocumentSeries));
      put(request, 'ownerInvoiceSeries', text(values.ownerInvoiceSeries));
      return { section: 'numbering', request };
    }
    case BILLING_STEPS.touristTax: {
      if (values.countryCode !== 'CH') return null;
      const answered = PORTAL_SOURCES.every((portal) => values.touristTaxCollectors[portal] === 'portal' || values.touristTaxCollectors[portal] === 'host');
      if (!answered || untouched('touristTaxCollectors')) return null;
      return { section: 'touristTax', request: { platformCollectedTouristTaxChannels: PORTAL_SOURCES.filter((portal) => values.touristTaxCollectors[portal] === 'portal') } };
    }
    case BILLING_STEPS.issuing: {
      const request: SaveBillingSetupSectionRequest = {};
      if (!untouched('autoIssueGuestDocuments')) request.autoIssueGuestDocuments = values.autoIssueGuestDocuments;
      if (!untouched('emailGuestDocuments')) request.emailGuestDocuments = values.emailGuestDocuments;
      return { section: 'automation', request };
    }
    case BILLING_STEPS.italy: {
      const request: SaveBillingSetupSectionRequest = {};
      if (!untouched('conservationAgreementConfirmed')) request.conservationAgreementConfirmed = values.conservationAgreementConfirmed;
      if (!untouched('virtualStampConfirmed')) request.virtualStampConfirmed = values.virtualStampConfirmed;
      // A reference the person cleared is an answer too (no reference), unless it is not valid.
      if (!untouched('stampDutyReference') && !invalid.has('stampDutyReference')) request.stampDutyReference = text(values.stampDutyReference);
      return { section: 'italy', request };
    }
    default:
      return null;
  }
}

const MANDATE_FIELDS = [
  'mandateValidFrom',
  'mandateCommissionPercent',
  'mandateCommissionBase',
  'mandateCleaningFlatRate',
  'mandateLinenFlatRate',
  'mandatePassthroughPaymentFees',
  'mandateCommissionIncludesVat',
] as const satisfies readonly (keyof BillingWizardValues)[];

/**
 * What the person wrote in the step on screen that a draft («Salva ed esci») does NOT keep, by the names of the fields: an answer that is not valid (a draft keeps what is valid and
 * leaves the rest out), the percents of the portals that are not percents, and every term of the standard mandate that was changed (the step saves none of them: they are
 * applied by their own action). A field the person left as it started, or left empty, is not something they wrote. The page says so when it is not empty, so that a draft with
 * part of the input left out is never told as «saved». For the step «Commercialista» `options.accountant` is the settings of the send the server has (`null` when it cannot be read): the
 * answers a draft keeps are the ones that hold together with them (`accountantChange`).
 */
export function draftLeftOut(
  step: BillingStepId,
  values: BillingWizardValues,
  options: { initial: BillingWizardValues; onRecord: BillingIdentityOnRecord; accountant?: AccountantPackageSettings | null },
): string[] {
  const written = (field: keyof BillingWizardValues): boolean => {
    const value = values[field];
    if (typeof value === 'string' && value.trim() === '') return false;
    return !sameAnswer(value, options.initial[field]);
  };

  if (step === BILLING_STEPS.accountant) return accountantChange(options.accountant, values, 'draft').leftOut;
  if (step === BILLING_STEPS.mandate) return MANDATE_FIELDS.filter(written);
  if (step === BILLING_STEPS.channels) {
    const result = channelsStepSchema.safeParse(values);
    return result.success ? [] : [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
  }
  return [...invalidFieldsOf(step, values, options.onRecord)].filter((field) => written(field as keyof BillingWizardValues));
}

/**
 * What the step «IVA» adds to the tax profile of the organization: the VAT number (a regime with a VAT number) or the fiscal code (a private person) that the profile does
 * not have yet and the person wrote. Never a change to what is already on record, and `null` when there is nothing to add: the setup itself cannot carry them, they live
 * on the organization.
 */
export function taxProfileAddition(values: BillingWizardValues, onRecord: BillingIdentityOnRecord, options: { draft?: boolean } = {}): FiscalTaxProfileUpdate | null {
  if (values.countryCode === 'CH') return null;
  const update: FiscalTaxProfileUpdate = {};
  if ((values.regime === 'VatOrdinary' || values.regime === 'VatFlatRate') && !onRecord.vatNumber) {
    const vatNumber = compactIdentifier(values.vatNumber);
    if (/^\d{11}$/.test(vatNumber) || (!options.draft && vatNumber !== '')) {
      update.hasPartitaIva = true;
      update.partitaIvaNumber = vatNumber;
    }
  }
  if (values.regime === 'PrivatePerson' && !onRecord.fiscalCode) {
    const fiscalCode = compactIdentifier(values.fiscalCode).toUpperCase();
    if (fiscalCode !== '' && (!options.draft || /^([A-Z0-9]{16}|\d{11})$/.test(fiscalCode))) update.fiscalCode = fiscalCode;
  }
  return Object.keys(update).length > 0 ? update : null;
}

export function holderKey(propertyId: string, channel: string): string {
  return `${propertyId}|${channel}`;
}

export function holderChoiceOf(
  propertyId: string,
  channel: string,
  changes: Record<string, HolderChoice>,
  overrides: readonly ChannelAccountHolder[],
): HolderChoice {
  const changed = changes[holderKey(propertyId, channel)];
  if (changed) return changed;
  return overrides.find((row) => row.propertyId === propertyId && row.channel === channel)?.holder ?? 'default';
}

export function holderChangesRequest(changes: Record<string, HolderChoice>, overrides: readonly ChannelAccountHolder[]): ChannelAccountHolderChange[] | null {
  const rows: ChannelAccountHolderChange[] = [];
  for (const [key, choice] of Object.entries(changes)) {
    const [propertyId, channel] = key.split('|');
    if (!propertyId || !channel) continue;
    const saved = overrides.find((row) => row.propertyId === propertyId && row.channel === channel)?.holder ?? null;
    const wanted: PortalAccountHolder | null = choice === 'default' ? null : choice;
    if (wanted !== saved) rows.push({ propertyId, channel, holder: wanted });
  }
  return rows.length > 0 ? rows : null;
}

type PortalSettings = Pick<BillingWizardValues, 'portalAccountHolder' | 'rechargePortalCommissions'>;

/**
 * Whether the person changed who holds the accounts of the portals, or whether their commissions are recharged to the owners, since the step opened. A draft saves them only
 * then: the owner and the recharge «on» are proposals until the person answers (⚖ I10, I11), and leaving the step must not answer for them.
 */
export function portalSettingsChanged(values: PortalSettings, initial: PortalSettings): boolean {
  return values.portalAccountHolder !== initial.portalAccountHolder || values.rechargePortalCommissions !== initial.rechargePortalCommissions;
}

export function commissionPercentText(row: Pick<ChannelCommissionInForce, 'channel' | 'percent'>, typed: Record<string, string>): string {
  const own = typed[row.channel];
  if (own !== undefined) return own;
  return row.percent === null || row.percent === undefined ? '' : String(row.percent);
}

/**
 * The whole list of the commission rules a save sends (the `PUT` replaces the list): every rule the organization has stays, and for each portal with a percent on screen
 * that no stored rule in force already says, a rule from `today` on. A percent the person left at the default is saved as the agency's rule (accepting the default is what
 * confirms the step); a rule in force that gets another percent is closed the day before `today`, or changed in place when it starts today; a portal with no percent gets no
 * rule. `null` when nothing differs from what is stored: nothing is sent. A DRAFT (what «Salva ed esci» keeps) takes only the percents the person typed: the ones that are
 * only shown (the default of the configuration, which nobody confirmed) are not saved as the agency's rules by leaving the step.
 * The new percents start from `today`, as the wizard always did; `options.validFrom` is the first check-out day the page of the channel commissions lets the person choose instead, so that
 * the stays of a month that is still open (the ones held back for a missing commission) are covered ({@link commissionStartTooEarly} says when a day cannot be used).
 */
export function commissionRulesRequest(
  current: ChannelCommissionRuleSet,
  typed: Record<string, string>,
  today: string,
  options: { draft?: boolean; validFrom?: string } = {},
): ChannelCommissionRuleInput[] | null {
  const start = options.validFrom ?? today;
  const rules: ChannelCommissionRuleInput[] = current.rules.map((rule) => ({
    channel: rule.channel,
    percent: rule.percent,
    base: rule.base,
    validFrom: rule.validFrom,
    validTo: rule.validTo ?? null,
  }));
  let changed = false;

  for (const row of current.channels) {
    if (options.draft && typed[row.channel] === undefined) continue;
    const percent = parseDecimal(commissionPercentText(row, typed));
    if (percent === null) continue;

    const stored = row.ruleId ? current.rules.findIndex((rule) => rule.id === row.ruleId) : -1;
    if (stored >= 0) {
      if (rules[stored].percent === percent) continue;
      if (rules[stored].validFrom >= start) {
        rules[stored] = { ...rules[stored], percent };
      } else {
        rules[stored] = { ...rules[stored], validTo: addDays(start, -1) };
        rules.push({ channel: row.channel, percent, base: row.base ?? undefined, validFrom: start });
      }
    } else {
      rules.push({ channel: row.channel, percent, base: row.base ?? undefined, validFrom: start });
    }
    changed = true;
  }

  return changed ? rules : null;
}

export function commissionStartTooEarly(current: ChannelCommissionRuleSet, typed: Record<string, string>, start: string): string | null {
  let latest: string | null = null;
  for (const row of current.channels) {
    if (typed[row.channel] === undefined || !row.ruleId) continue;
    const percent = parseDecimal(commissionPercentText(row, typed));
    const rule = current.rules.find((candidate) => candidate.id === row.ruleId);
    if (percent === null || !rule || rule.percent === percent || rule.validFrom <= start) continue;
    if (latest === null || rule.validFrom > latest) latest = rule.validFrom;
  }
  return latest;
}

/**
 * The standard mandate as the form says it: a percent, a base, the flat fees when written, who bears the payment fees and «+ IVA» or VAT included (⚖ R4). `null` while the form
 * does not say a mandate that can be applied (no percent, a percent or an amount that is not one, no day): a blank percent is never 0%, which would give every owner without a
 * mandate a commission of nothing.
 */
export function mandateTemplateOf(values: BillingWizardValues): OwnerMandateTemplate | null {
  const percent = parseDecimal(values.mandateCommissionPercent);
  if (percent === null || mandateTemplateProblems(values).length > 0) return null;
  const cleaning = parseDecimal(values.mandateCleaningFlatRate);
  const linen = parseDecimal(values.mandateLinenFlatRate);
  const base: CommissionBase = values.mandateCommissionBase;
  return {
    validFrom: values.mandateValidFrom.trim(),
    commissionPercent: percent,
    commissionBase: base,
    commissionIncludesVat: values.mandateCommissionIncludesVat,
    ...(cleaning === null ? {} : { cleaningFlatRate: cleaning }),
    ...(linen === null ? {} : { linenFlatRate: linen }),
    passthroughPaymentFees: values.mandatePassthroughPaymentFees,
  };
}

export type AccountantField = 'accountantEmail' | 'accountantMonthly' | 'accountantDay' | 'accountantContents';

export interface AccountantChange {
  request: SaveAccountantPackageSettingsRequest | null;
  leftOut: AccountantField[];
}

const ACCOUNTANT_UNTOUCHED = { accountantEmail: null, accountantMonthly: null, accountantDay: null, accountantContents: null } as const;

function accountantRequestOf(answers: AccountantAnswers): SaveAccountantPackageSettingsRequest {
  const email = answers.email.trim();
  return { enabled: answers.enabled, email: email === '' ? null : email, sendDay: answers.sendDay, contents: [...answers.contents] };
}

function accountantUnchanged(current: AccountantPackageSettings, request: SaveAccountantPackageSettingsRequest): boolean {
  return (
    (current.email ?? '').toLowerCase() === (request.email ?? '').toLowerCase() &&
    current.enabled === request.enabled &&
    current.sendDay === request.sendDay &&
    current.contents.length === request.contents.length &&
    request.contents.every((folder) => current.contents.includes(folder))
  );
}

/**
 * What a save of the step sends. The settings go to the server as a whole, so the person's answers are laid over what the server has (`current`) and the result is sent; nothing is sent when it
 * is what the server already has, or when the person touched nothing (the step is optional: it is left as it is, never saved as an answer). A WHOLE save (the step was checked, «Continua») sends
 * what the form says, and refuses what does not hold together (the problems come back as `leftOut`, with no request): the page checks the step first, so that never happens there. A DRAFT
 * («Salva ed esci») keeps what holds together and leaves out the rest: an address that is not a plain one, a day outside 1 to 28, no folder at all, and, because the monthly send cannot be on with
 * no address, the «on» asked with none (or the address emptied while the send stays on). `current` is `null` while the settings cannot be read: nothing is saved then.
 */
export function accountantChange(current: AccountantPackageSettings | null | undefined, values: BillingWizardValues, mode: 'whole' | 'draft'): AccountantChange {
  if (!current || accountantUntouched(values)) return { request: null, leftOut: [] };

  if (mode === 'whole') {
    const answers = accountantAnswersOf(current, values);
    const problems = accountantProblems(answers);
    if (problems.length > 0) return { request: null, leftOut: problems.map((problem) => problem.field) };
    const request = accountantRequestOf(answers);
    return { request: accountantUnchanged(current, request) ? null : request, leftOut: [] };
  }

  const kept = accountantAnswersOf(current, ACCOUNTANT_UNTOUCHED);
  const leftOut: AccountantField[] = [];
  const typedEmail = values.accountantEmail;
  if (typedEmail !== null) {
    if (typedEmail.trim() === '' || isPlainEmail(typedEmail)) kept.email = typedEmail.trim();
    else leftOut.push('accountantEmail');
  }
  if (values.accountantDay !== null) {
    if (isSendDay(values.accountantDay)) kept.sendDay = values.accountantDay;
    else leftOut.push('accountantDay');
  }
  if (values.accountantContents !== null) {
    if (values.accountantContents.length > 0) kept.contents = values.accountantContents;
    else leftOut.push('accountantContents');
  }
  if (values.accountantMonthly !== null) kept.enabled = values.accountantMonthly;
  if (kept.enabled && kept.email.trim() === '') {
    if (values.accountantMonthly === true) {
      kept.enabled = current.enabled;
      leftOut.push('accountantMonthly');
    } else {
      kept.email = current.email ?? '';
      leftOut.push('accountantEmail');
    }
  }
  if (kept.contents.length === 0) return { request: null, leftOut: leftOut.includes('accountantContents') ? leftOut : [...leftOut, 'accountantContents'] };
  const request = accountantRequestOf(kept);
  return { request: accountantUnchanged(current, request) ? null : request, leftOut };
}

const ACCOUNTANT_PROBLEM_CODES: ReadonlyMap<string, FormProblem> = new Map([
  ['accountant_package_recipient_invalid', { name: 'accountantEmail', messageKey: BILLING_ERROR_KEYS.accountantEmail }],
  ['accountant_package_recipient_missing', { name: 'accountantEmail', messageKey: BILLING_ERROR_KEYS.accountantEmailMissing }],
  ['accountant_package_send_day_invalid', { name: 'accountantDay', messageKey: BILLING_ERROR_KEYS.accountantDay }],
  ['accountant_package_contents_invalid', { name: 'accountantContents', messageKey: BILLING_ERROR_KEYS.accountantContents }],
  ['accountant_package_owner_accounting_required', { name: 'accountantContents', messageKey: BILLING_ERROR_KEYS.accountantOwnerAccounting }],
]);

export function accountantProblemsOf(error: unknown): FormProblem[] {
  if (!isAxiosError(error) || error.response?.status !== 422) return [];
  const code = getProblemCode(error.response.data);
  const problem = code === undefined ? undefined : ACCOUNTANT_PROBLEM_CODES.get(code);
  return problem ? [problem] : [];
}

export function isAccountantRefused(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 403;
}

export function lastMonthOf(today: string): string {
  return periodParam(defaultPeriod(today));
}

export function periodLabel(period: string, locale: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!match) return period;
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

/** The words of each code a failed send is recorded with (`lastSend.error`): the keys are written out so that a missing translation is found. */
const LAST_SEND_ERROR_KEYS: ReadonlyMap<string, string> = new Map([
  ['package_too_large', 'billingWizard.accountant.lastSend.errors.packageTooLarge'],
  ['package_failed', 'billingWizard.accountant.lastSend.errors.packageFailed'],
  ['storage_failed', 'billingWizard.accountant.lastSend.errors.storageFailed'],
  ['link_not_configured', 'billingWizard.accountant.lastSend.errors.linkNotConfigured'],
  ['email_not_configured', 'billingWizard.accountant.lastSend.errors.emailNotConfigured'],
  ['email_not_queued', 'billingWizard.accountant.lastSend.errors.emailNotQueued'],
]);

export function lastSendErrorKey(code: string | null | undefined): string {
  return (code ? LAST_SEND_ERROR_KEYS.get(code) : undefined) ?? 'billingWizard.accountant.lastSend.errors.unknown';
}

export interface FormProblem {
  name: string;
  messageKey: string;
}

export function isNeedsWholeOrg(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 403 && getProblemCode(error.response.data) === 'fiscal_settings_need_whole_org';
}

export function isRechargeWaiverNotAcknowledged(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 422 && getProblemCode(error.response.data) === 'recharge_waiver_not_acknowledged';
}

function problemOfField(field: string, country: string): FormProblem | null {
  switch (field as BillingSetupField) {
    case 'countryCode':
      return { name: 'countryCode', messageKey: BILLING_ERROR_KEYS.country };
    case 'legalName':
      return { name: 'legalName', messageKey: BILLING_ERROR_KEYS.legalName };
    case 'addressStreet':
      return { name: 'addressStreet', messageKey: BILLING_ERROR_KEYS.addressStreet };
    case 'addressCivic':
      return { name: 'addressCivic', messageKey: BILLING_ERROR_KEYS.addressCivic };
    case 'postalCode':
      return { name: 'postalCode', messageKey: country === 'CH' ? BILLING_ERROR_KEYS.postalCodeCh : BILLING_ERROR_KEYS.postalCodeIt };
    case 'city':
      return { name: 'city', messageKey: BILLING_ERROR_KEYS.city };
    case 'province':
      return { name: 'province', messageKey: country === 'CH' ? BILLING_ERROR_KEYS.provinceCh : BILLING_ERROR_KEYS.provinceIt };
    case 'swissVatNumber':
      return { name: 'swissVatNumber', messageKey: BILLING_ERROR_KEYS.swissVatNumber };
    case 'regime':
      return country === 'CH' ? { name: 'swissVatRegistered', messageKey: BILLING_ERROR_KEYS.swissVatRegistered } : { name: 'regime', messageKey: BILLING_ERROR_KEYS.regime };
    case 'vatRegistered':
      return { name: 'swissVatRegistered', messageKey: BILLING_ERROR_KEYS.swissVatRegistered };
    case 'fatturaPaRegimeCode':
      return { name: 'fatturaPaRegimeCode', messageKey: BILLING_ERROR_KEYS.fatturaPaRegimeCode };
    case 'guestDocumentSeries':
      return { name: 'guestDocumentSeries', messageKey: BILLING_ERROR_KEYS.series };
    case 'ownerInvoiceSeries':
      return { name: 'ownerInvoiceSeries', messageKey: BILLING_ERROR_KEYS.series };
    case 'stampDutyReference':
      return { name: 'stampDutyReference', messageKey: BILLING_ERROR_KEYS.stampDutyReference };
    default:
      return null;
  }
}

export function problemsOf(error: unknown, country: string): FormProblem[] {
  if (!isAxiosError(error) || error.response?.status !== 422) return [];
  const data: unknown = error.response.data;
  if (typeof data !== 'object' || data === null || getProblemCode(data) !== 'issuer_field_invalid') return [];
  const body = data as Record<string, unknown>;
  const listed = Array.isArray(body.errors)
    ? body.errors.map((entry) => (typeof entry === 'object' && entry !== null ? (entry as { field?: unknown }).field : undefined))
    : [];
  const names = listed.length > 0 ? listed : [body.field];
  const found = names.flatMap((name) => (typeof name === 'string' ? [problemOfField(name, country)] : []));
  return found.filter((problem, index): problem is FormProblem => problem !== null && found.findIndex((other) => other?.name === problem.name) === index);
}

export const EXAMPLE_LINES: ReadonlyArray<{ lineType: string; amount: number }> = [
  { lineType: 'Accommodation', amount: 200 },
  { lineType: 'Cleaning', amount: 50 },
];

/** One line of the example document: what it is for, the amount without VAT, the rate, the VAT and the amount with it. All amounts are plain numbers: the currency is the issuer's. */
export interface ExampleLine {
  lineType: string;
  net: number;
  percent: number;
  vat: number;
  gross: number;
}

export interface ExampleDocument {
  lines: ExampleLine[];
  net: number;
  vat: number;
  /** The stamp duty added to the total (the rule has one, the amounts without VAT pass its threshold and it is charged to the guest); 0 when there is none. */
  stamp: number;
  total: number;
}

function cents(amount: number): number {
  return Math.round(amount * 100 + Number.EPSILON) / 100;
}

/**
 * The example document of the summary: the lines of a test stay whose type the rule gives a rate for, each with the VAT at that rate, rounded to the cent. `null` when the rule
 * has no rate for the accommodation (nothing to show with a rate that nobody approved). The stamp duty is added only where the rule charges it to the guest and the amounts
 * that carry no VAT pass its threshold.
 */
export function exampleDocument(rule: FiscalTaxRule | undefined): ExampleDocument | null {
  if (!rule) return null;
  const rateOf = (lineType: string) => rule.rates.find((rate) => rate.lineType === lineType);
  if (!rateOf('Accommodation')) return null;

  const lines: ExampleLine[] = [];
  for (const sample of EXAMPLE_LINES) {
    const rate = rateOf(sample.lineType);
    if (!rate) continue;
    const vat = cents((sample.amount * rate.percent) / 100);
    lines.push({ lineType: sample.lineType, net: sample.amount, percent: rate.percent, vat, gross: cents(sample.amount + vat) });
  }

  const net = cents(lines.reduce((sum, line) => sum + line.net, 0));
  const vat = cents(lines.reduce((sum, line) => sum + line.vat, 0));
  const withoutVat = lines.filter((line) => line.percent === 0).reduce((sum, line) => sum + line.net, 0);
  const stamp = rule.stampDuty && rule.stampDuty.chargedToRecipient && withoutVat > rule.stampDuty.threshold ? rule.stampDuty.amount : 0;
  return { lines, net, vat, stamp, total: cents(net + vat + stamp) };
}

export function addressLine(values: Pick<BillingWizardValues, 'addressStreet' | 'addressCivic' | 'postalCode' | 'city' | 'province'>): string {
  const street = [values.addressStreet.trim(), values.addressCivic.trim()].filter(Boolean).join(' ');
  const town = [values.postalCode.replace(/\s+/g, ''), values.city.trim()].filter(Boolean).join(' ');
  const province = values.province.trim().toUpperCase();
  return [street, province ? `${town} (${province})` : town].filter(Boolean).join(', ');
}

export function regimeOfValues(values: Pick<BillingWizardValues, 'countryCode' | 'swissVatRegistered' | 'regime'>): DocumentRegime | null {
  if (values.countryCode === 'CH') {
    if (values.swissVatRegistered === 'yes') return 'SwissVatRegistered';
    if (values.swissVatRegistered === 'no') return 'SwissNotRegistered';
    return null;
  }
  return values.regime === '' ? null : values.regime;
}
