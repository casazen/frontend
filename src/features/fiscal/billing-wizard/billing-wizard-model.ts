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
  DocumentRegime,
  FiscalTaxRule,
  OwnerMandateTemplate,
  PortalAccountHolder,
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

// ---------------------------------------------------------------------------------------------------------------------
// Money: the currency of the issuer
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The currency of the documents and of the amounts of an issuer, from the country it issues from: Switzerland issues in francs, Italy in euros. `null` while the issuer has
 * not said the country: an amount is then shown without a symbol, and the page says that the currency is not known yet (never a euro that nobody chose).
 */
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

/** The locale an amount is written in, for the language of the app. */
export function amountLocale(language: string): string {
  return language.startsWith('en') ? 'en-GB' : 'it-IT';
}

/** An amount without a currency, written the way the app writes amounts (two decimals): for an issuer whose country, and so whose currency, is not known yet. */
export function plainAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

// ---------------------------------------------------------------------------------------------------------------------
// The setup as the server sent it
// ---------------------------------------------------------------------------------------------------------------------

/** A section of the setup by its name; `undefined` while the server sends none (a section no epic provides). */
export function sectionOf(setup: BillingSetup | undefined, name: BillingSetupSectionName): BillingSetupSection | undefined {
  return setup?.sections.find((section) => section.section === name);
}

/** A saved text; empty when the value is absent or is not a text. */
export function textOf(values: Record<string, unknown> | undefined, key: string): string {
  const value = values?.[key];
  return typeof value === 'string' ? value : '';
}

/** A saved yes or no; `fallback` when the value is absent or is not one. */
export function flagOf(values: Record<string, unknown> | undefined, key: string, fallback = false): boolean {
  const value = values?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

/** A saved list of texts; `null` when the value is absent (never confirmed) or is not a list. */
function listOf(values: Record<string, unknown> | undefined, key: string): string[] | null {
  const value = values?.[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : null;
}

function isMissing(setup: BillingSetup | undefined, key: string): boolean {
  return Boolean(setup?.sections.some((section) => section.missing.some((item) => item.key === key)));
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
    touristTaxCollectors: Object.fromEntries(PORTAL_SOURCES.map((portal) => [portal, collected === null ? '' : collected.includes(portal) ? 'portal' : 'host'])),
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
    // The settings of the send to the accountant are not part of the setup: they are read on their own, and the step shows them until the person changes one.
    accountantEmail: null,
    accountantMonthly: null,
    accountantDay: null,
    accountantContents: null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The steps
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The steps of the wizard for what is known: «Commissioni dei canali» and «Mandato standard» only for an agency, «Italia» only for an Italian issuer (it follows the first
 * answer, so a person who has not chosen the country yet does not see it), «Commercialista» only while the package of the accountant is on (`accountant`, the flag `accountantPackage`:
 * with it off the wizard is the one it was). The others are always there.
 */
export function stepIdsFor(country: string, agency: boolean, accountant = false): BillingStepId[] {
  return BILLING_STEP_ORDER.filter((id) => {
    if (id === BILLING_STEPS.channels || id === BILLING_STEPS.mandate) return agency;
    if (id === BILLING_STEPS.italy) return country === 'IT';
    if (id === BILLING_STEPS.accountant) return accountant;
    return true;
  });
}

/** Every item that is missing, in the order of the sections of the setup (the order of the wizard). */
export function missingItemsOf(setup: BillingSetup | undefined): BillingSetupItem[] {
  return setup?.sections.flatMap((section) => section.missing) ?? [];
}

/** The first step of `steps` that has an item missing; `null` when none has (everything is set, or what is missing belongs to a step this person does not have). */
export function firstMissingStep(setup: BillingSetup | undefined, steps: readonly BillingStepId[]): BillingStepId | null {
  const missing = missingItemsOf(setup).map((item) => billingStepOfItem(item));
  return steps.find((id) => missing.includes(id)) ?? null;
}

// ---------------------------------------------------------------------------------------------------------------------
// What a step saves
// ---------------------------------------------------------------------------------------------------------------------

/** What a step saves on the server: the section and the fields of the request. */
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

/** Two answers of the form are the same answer (the text of a field, a choice, or the list of the portals that say who collects the tourist tax). */
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
  /** A draft of a step the person left as it started: that field is not an answer. */
  const untouched = (field: keyof BillingWizardValues): boolean => draft && initial !== undefined && sameAnswer(values[field], initial[field]);
  /** A text field: sent when it is asked; in a draft only when it is filled, valid and changed. */
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
        // A draft that left the regime code empty does not clear a code the accountant gave.
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
      // A list is an answer, an empty one included: «no portal collects it». A draft with a portal still unanswered says nothing about the others.
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

/** The fields of the form of the standard mandate: the step saves none of them, the terms are applied by their own action. */
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

// ---------------------------------------------------------------------------------------------------------------------
// The step «Commissioni dei canali»
// ---------------------------------------------------------------------------------------------------------------------

/** The key of a cell of the table of the account holders: the listing and the portal. */
export function holderKey(propertyId: string, channel: string): string {
  return `${propertyId}|${channel}`;
}

/** What the table shows in a cell: what the person changed, else the holder the listing was given, else the default of the organization. */
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

/**
 * The rows of the bulk write of the holders: only the cells that differ from what the server has (a cell back at the default is a `null` holder, and one that already was
 * at the default sends nothing). `null` when there is nothing to write: the write refuses an empty list.
 */
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

/** The percent shown for a portal: what the person typed, else the one that applies today (the rule in force, or the default of the configuration). */
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

    // The rule in force is one of the stored ones, at the same place in the list: what is added below goes after them.
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

/**
 * The first day of the latest rule in force that starts AFTER `start`, among the portals whose percent the person changed, or `null` when none does. A rule that starts on or after the day the
 * new percent is asked to start from is changed in place, and the days between `start` and its first day would stay without a rule: the day cannot be used, the person chooses that one or a later one.
 */
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

// ---------------------------------------------------------------------------------------------------------------------
// The step «Mandato standard»
// ---------------------------------------------------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------------------------------------------------
// The step «Commercialista»
// ---------------------------------------------------------------------------------------------------------------------

/** A setting of the send to the accountant, by the field of the form that holds the person's answer to it. */
export type AccountantField = 'accountantEmail' | 'accountantMonthly' | 'accountantDay' | 'accountantContents';

/** What a save of the step does with the answers of the person. */
export interface AccountantChange {
  /** The whole settings to send (`PUT api/accountant-package/settings` takes them as a whole), or `null` when there is nothing to save: nothing was touched, or what is on screen is what the server has. */
  request: SaveAccountantPackageSettingsRequest | null;
  /** The settings the person changed that this save does NOT keep. Only a draft leaves any out (a whole save is checked first, and refuses). */
  leftOut: AccountantField[];
}

/** Every answer of the step «not touched»: the server's settings, as they are. */
const ACCOUNTANT_UNTOUCHED = { accountantEmail: null, accountantMonthly: null, accountantDay: null, accountantContents: null } as const;

/** The settings as the server takes them: the address cut at its ends, and none (`null`) when it is empty. */
function accountantRequestOf(answers: AccountantAnswers): SaveAccountantPackageSettingsRequest {
  const email = answers.email.trim();
  return { enabled: answers.enabled, email: email === '' ? null : email, sendDay: answers.sendDay, contents: [...answers.contents] };
}

/** Whether a request would leave the settings as the server has them: the address does not count its capitals (the server keeps it in lower case) and the folders do not count their order. */
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
    // An address emptied is an answer (no address); one that is not a plain address is not kept.
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
  // The monthly send cannot be on with no address to send it to: whichever answer would leave it so is not kept.
  if (kept.enabled && kept.email.trim() === '') {
    if (values.accountantMonthly === true) {
      kept.enabled = current.enabled;
      leftOut.push('accountantMonthly');
    } else {
      kept.email = current.email ?? '';
      leftOut.push('accountantEmail');
    }
  }
  // The folders this person sees can be none (the settings hold only folders they may not choose: `accountantSettingsFor`), and a list with no folder is refused by the server: nothing is sent
  // until they choose one, and the draft says it left that out.
  if (kept.contents.length === 0) return { request: null, leftOut: leftOut.includes('accountantContents') ? leftOut : [...leftOut, 'accountantContents'] };
  const request = accountantRequestOf(kept);
  return { request: accountantUnchanged(current, request) ? null : request, leftOut };
}

/** The 422 codes of the settings of the send that name a field of the form, with the words that say what the field wants (`accountant_package_settings_invalid` names none). */
const ACCOUNTANT_PROBLEM_CODES: ReadonlyMap<string, FormProblem> = new Map([
  ['accountant_package_recipient_invalid', { name: 'accountantEmail', messageKey: BILLING_ERROR_KEYS.accountantEmail }],
  ['accountant_package_recipient_missing', { name: 'accountantEmail', messageKey: BILLING_ERROR_KEYS.accountantEmailMissing }],
  ['accountant_package_send_day_invalid', { name: 'accountantDay', messageKey: BILLING_ERROR_KEYS.accountantDay }],
  ['accountant_package_contents_invalid', { name: 'accountantContents', messageKey: BILLING_ERROR_KEYS.accountantContents }],
  ['accountant_package_owner_accounting_required', { name: 'accountantContents', messageKey: BILLING_ERROR_KEYS.accountantOwnerAccounting }],
]);

/**
 * The field of the form a refused save of the settings of the send names: the server refuses an address that is not a plain one, a send turned on with no address, a day outside 1 to 28, no folder
 * and, from a caller who may not read the owner accounting, the folders that carry it. Any other answer names no field: its words are the message of the whole save.
 */
export function accountantProblemsOf(error: unknown): FormProblem[] {
  if (!isAxiosError(error) || error.response?.status !== 422) return [];
  const code = getProblemCode(error.response.data);
  const problem = code === undefined ? undefined : ACCOUNTANT_PROBLEM_CODES.get(code);
  return problem ? [problem] : [];
}

/** The 403 the settings of the send answer to a caller whose role does not allow them or whose reach is only some of the properties: they are the whole organization's. */
export function isAccountantRefused(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 403;
}

/** The month a test send is about: the one that is over (the month before today, Europe/Rome), as `yyyy-MM` — the very month the server makes the package of. */
export function lastMonthOf(today: string): string {
  return periodParam(defaultPeriod(today));
}

/** A month `yyyy-MM` as «ottobre 2026» in the locale given, or the text as it came when it is not a month. */
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

/** The key of the sentence that says why the last send failed; a code the app does not know (the server is newer) reads as a neutral line, never as the code itself. */
export function lastSendErrorKey(code: string | null | undefined): string {
  return (code ? LAST_SEND_ERROR_KEYS.get(code) : undefined) ?? 'billingWizard.accountant.lastSend.errors.unknown';
}

// ---------------------------------------------------------------------------------------------------------------------
// What the server refused
// ---------------------------------------------------------------------------------------------------------------------

/** A field of the form the server refused, with the text that says what it wants. */
export interface FormProblem {
  name: string;
  messageKey: string;
}

/** The 403 a caller gets when it reaches only some of the properties: the setup is the whole organization's. */
export function isNeedsWholeOrg(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 403 && getProblemCode(error.response.data) === 'fiscal_settings_need_whole_org';
}

/** The form field and the words of a field of the setup the server refused; `null` for a field the wizard cannot put a message on. */
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

/**
 * The fields a refused save names: `issuer_field_invalid` lists the values that are not valid (`errors`, and the first as `field`). Names the wizard cannot put a message on are
 * left out, and any other answer names none. A refusal is shown where it can be fixed; the message of the API says the rest.
 */
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

// ---------------------------------------------------------------------------------------------------------------------
// The summary: the example document and the address
// ---------------------------------------------------------------------------------------------------------------------

/** The lines of the example document of the summary, with the amounts of a test stay: the document of a real booking carries the amounts of the booking. */
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

/** The example document computed with the rates in force. */
export interface ExampleDocument {
  lines: ExampleLine[];
  net: number;
  vat: number;
  /** The stamp duty added to the total (the rule has one, the amounts without VAT pass its threshold and it is charged to the guest); 0 when there is none. */
  stamp: number;
  total: number;
}

/** An amount rounded to the cent, away from zero, as the documents do it (the amounts here are never negative). */
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

/** The address as it will read on the documents: «Via Roma 12, 20121 Milano (MI)». */
export function addressLine(values: Pick<BillingWizardValues, 'addressStreet' | 'addressCivic' | 'postalCode' | 'city' | 'province'>): string {
  const street = [values.addressStreet.trim(), values.addressCivic.trim()].filter(Boolean).join(' ');
  const town = [values.postalCode.replace(/\s+/g, ''), values.city.trim()].filter(Boolean).join(' ');
  const province = values.province.trim().toUpperCase();
  return [street, province ? `${town} (${province})` : town].filter(Boolean).join(', ');
}

/** The regime as the regime step says it, for the summary: the Swiss answer is a regime too. */
export function regimeOfValues(values: Pick<BillingWizardValues, 'countryCode' | 'swissVatRegistered' | 'regime'>): DocumentRegime | null {
  if (values.countryCode === 'CH') {
    if (values.swissVatRegistered === 'yes') return 'SwissVatRegistered';
    if (values.swissVatRegistered === 'no') return 'SwissNotRegistered';
    return null;
  }
  return values.regime === '' ? null : values.regime;
}
