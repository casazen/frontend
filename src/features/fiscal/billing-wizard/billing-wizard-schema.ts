import { z, type RefinementCtx, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { PARTITA_IVA, compactIdentifier } from '@/features/fiscal/tax-profile-changes';
import { isValidFiscalCode } from '@/lib/fiscal-code';
import {
  ACCOUNTANT_OWNER_FOLDERS,
  ACCOUNTANT_PACKAGE_FOLDERS,
  ACCOUNTANT_SEND_DAYS,
  CLEANING_FEE_TREATMENTS,
  COMMISSION_BASES,
  PORTAL_ACCOUNT_HOLDERS,
  STAY_VAT_TREATMENTS,
  type AccountantPackageFolder,
  type AccountantPackageSettings,
  type CleaningFeeTreatment,
  type CommissionBase,
  type PortalAccountHolder,
  type StayVatTreatment,
} from '@/types';

export const BILLING_WIZARD_ID = 'fiscal-billing-setup';

/** The two countries a document can be issued from today: the regimes, the VAT and the stamp follow the country. */
export const BILLING_COUNTRIES = ['IT', 'CH'] as const;
export type BillingCountry = (typeof BILLING_COUNTRIES)[number];

/** The regimes an Italian issuer chooses among; a Swiss one answers «iscritto all'IVA» yes or no. */
export const ITALIAN_REGIMES = ['PrivatePerson', 'VatOrdinary', 'VatFlatRate'] as const;
export type ItalianRegime = (typeof ITALIAN_REGIMES)[number];

export const PORTAL_SOURCES = ['Airbnb', 'BookingCom', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda', 'OtherChannel'] as const;

export const ACCOUNT_HOLDER_PORTALS = ['Airbnb', 'BookingCom', 'Expedia', 'Vrbo'] as const;

export const TOURIST_TAX_COLLECTORS = ['portal', 'host'] as const;
export type TouristTaxCollector = (typeof TOURIST_TAX_COLLECTORS)[number];

export type HolderChoice = 'default' | PortalAccountHolder;

/** What the person answers in the wizard: the answers of every step, as text or one of the fixed answers, so that nothing in it is anything but plain data. */
export interface BillingWizardValues {
  countryCode: '' | BillingCountry;
  legalName: string;
  addressStreet: string;
  addressCivic: string;
  postalCode: string;
  city: string;
  province: string;
  swissVatRegistered: '' | 'yes' | 'no';
  regime: '' | ItalianRegime;
  swissVatNumber: string;
  /** The Italian VAT number and the fiscal code are those of the tax profile of the organization: written there, never in the setup. */
  vatNumber: string;
  fiscalCode: string;
  fatturaPaRegimeCode: string;
  stayVatTreatment: StayVatTreatment;
  cleaningFeeTreatment: CleaningFeeTreatment;
  guestDocumentSeries: string;
  ownerInvoiceSeries: string;
  touristTaxCollectors: Record<string, '' | TouristTaxCollector>;
  portalAccountHolder: PortalAccountHolder;
  rechargePortalCommissions: boolean;
  holderChanges: Record<string, HolderChoice>;
  commissionPercents: Record<string, string>;
  mandateValidFrom: string;
  mandateCommissionPercent: string;
  mandateCommissionBase: CommissionBase;
  mandateCleaningFlatRate: string;
  mandateLinenFlatRate: string;
  mandatePassthroughPaymentFees: boolean;
  mandateCommissionIncludesVat: boolean;
  autoIssueGuestDocuments: boolean;
  emailGuestDocuments: boolean;
  conservationAgreementConfirmed: boolean;
  virtualStampConfirmed: boolean;
  stampDutyReference: string;
  // 9 «Commercialista» (facoltativo): the settings of the send to the accountant, as far as the person changed them. `null` is «not touched»: the step then shows what the server has,
  // and neither «Continua» nor a draft saves it again, so that nothing the person did not answer is ever saved as an answer. The address of a third party is only ever here, in the
  // form: never in the address of the page or in the browser's storage.
  accountantEmail: string | null;
  accountantMonthly: boolean | null;
  accountantDay: number | null;
  accountantContents: string[] | null;
}

export interface BillingIdentityOnRecord {
  vatNumber: boolean;
  fiscalCode: boolean;
}

export const BILLING_ERROR_KEYS = {
  accountantContents: 'billingWizard.errors.accountantContents',
  accountantDay: 'billingWizard.errors.accountantDay',
  accountantEmail: 'billingWizard.errors.accountantEmail',
  accountantEmailMissing: 'billingWizard.errors.accountantEmailMissing',
  accountantEmailNeeded: 'billingWizard.errors.accountantEmailNeeded',
  accountantOwnerAccounting: 'billingWizard.errors.accountantOwnerAccounting',
  country: 'billingWizard.errors.country',
  legalName: 'billingWizard.errors.legalName',
  addressStreet: 'billingWizard.errors.addressStreet',
  addressCivic: 'billingWizard.errors.addressCivic',
  postalCodeIt: 'billingWizard.errors.postalCodeIt',
  postalCodeCh: 'billingWizard.errors.postalCodeCh',
  city: 'billingWizard.errors.city',
  provinceIt: 'billingWizard.errors.provinceIt',
  provinceCh: 'billingWizard.errors.provinceCh',
  regime: 'billingWizard.errors.regime',
  swissVatRegistered: 'billingWizard.errors.swissVatRegistered',
  swissVatNumber: 'billingWizard.errors.swissVatNumber',
  vatNumber: 'billingWizard.errors.vatNumber',
  fiscalCode: 'billingWizard.errors.fiscalCode',
  fatturaPaRegimeCode: 'billingWizard.errors.fatturaPaRegimeCode',
  series: 'billingWizard.errors.series',
  collector: 'billingWizard.errors.collector',
  percent: 'billingWizard.errors.percent',
  amount: 'billingWizard.errors.amount',
  date: 'billingWizard.errors.date',
  stampDutyReference: 'billingWizard.errors.stampDutyReference',
} as const;

const LEGAL_NAME_MAX = 200;
const STREET_MAX = 200;
const CIVIC_MAX = 20;
const CITY_MAX = 100;
const STAMP_REFERENCE_MAX = 60;
/** The longest series: the number of a document, `{series}/{n}`, must fit the 20 characters of FatturaPA. */
export const SERIES_MAX = 10;

const REGIME_CODE = /^[A-Za-z0-9]{1,4}$/;
const ITALIAN_POSTAL_CODE = /^\d{5}$/;
const SWISS_POSTAL_CODE = /^\d{4}$/;
const PROVINCE = /^[A-Za-z]{2}$/;
const SERIES_CHARACTERS = /^[A-Za-z0-9._/-]+$/;
/** The UID of a Swiss company: `CHE-123.456.789`, with or without the separators and the suffix the Federal Statistical Office allows (MWST, TVA, IVA). */
const SWISS_UID = /^CHE-?\d{3}\.?\d{3}\.?\d{3}(\s?(MWST|TVA|IVA))?$/i;
const PERCENT = /^\d{1,3}([.,]\d{1,2})?$/;
const AMOUNT = /^\d{1,9}([.,]\d{1,2})?$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const SERIES_YEAR_PLACEHOLDER = '{year}';

export function seriesOf(pattern: string, year: number): string {
  return pattern.trim().split(SERIES_YEAR_PLACEHOLDER).join(String(year));
}

export function parseDecimal(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (text === '' || !/^\d+(\.\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

const isBlank = (value: string) => value.trim() === '';

type StepSchema = ZodType<unknown, FieldValues>;

function check(context: RefinementCtx, valid: boolean, path: string | readonly (string | number)[], message: string): void {
  if (!valid) context.addIssue({ code: 'custom', path: typeof path === 'string' ? [path] : [...path], message });
}

export function isPercent(value: string): boolean {
  const text = value.trim();
  if (!PERCENT.test(text)) return false;
  const parsed = parseDecimal(text);
  return parsed !== null && parsed <= 100;
}

function isAmount(value: string): boolean {
  return AMOUNT.test(value.trim());
}

export const issuerStepSchema: StepSchema = z
  .object({
    countryCode: z.enum(BILLING_COUNTRIES, BILLING_ERROR_KEYS.country),
    legalName: z.string(),
    addressStreet: z.string(),
    addressCivic: z.string(),
    postalCode: z.string(),
    city: z.string(),
    province: z.string(),
  })
  .superRefine((value, context) => {
    const legalName = value.legalName.trim();
    check(context, legalName.length > 0 && legalName.length <= LEGAL_NAME_MAX, 'legalName', BILLING_ERROR_KEYS.legalName);
    const street = value.addressStreet.trim();
    check(context, street.length > 0 && street.length <= STREET_MAX, 'addressStreet', BILLING_ERROR_KEYS.addressStreet);
    check(context, value.addressCivic.trim().length <= CIVIC_MAX, 'addressCivic', BILLING_ERROR_KEYS.addressCivic);
    const city = value.city.trim();
    check(context, city.length > 0 && city.length <= CITY_MAX, 'city', BILLING_ERROR_KEYS.city);

    const postalCode = value.postalCode.replace(/\s+/g, '');
    const province = value.province.trim();
    if (value.countryCode === 'CH') {
      check(context, SWISS_POSTAL_CODE.test(postalCode), 'postalCode', BILLING_ERROR_KEYS.postalCodeCh);
      check(context, province === '' || PROVINCE.test(province), 'province', BILLING_ERROR_KEYS.provinceCh);
    } else {
      check(context, ITALIAN_POSTAL_CODE.test(postalCode), 'postalCode', BILLING_ERROR_KEYS.postalCodeIt);
      check(context, PROVINCE.test(province), 'province', BILLING_ERROR_KEYS.provinceIt);
    }
  });

/**
 * The second step «IVA». Switzerland: registered for the VAT yes or no, and the UID of whoever is. Italy: the regime, and the VAT number or the fiscal code the regime needs
 * when the tax profile does not have it yet (the server checks the fiscal code with its check character: `isValidFiscalCode` is its mirror, so a slip of the pen stops
 * here, on the field). The regime code may be left empty: empty means «the one of my regime».
 */
export function vatStepSchema(onRecord: BillingIdentityOnRecord): StepSchema {
  return z
    .object({
      countryCode: z.string(),
      swissVatRegistered: z.string(),
      regime: z.string(),
      swissVatNumber: z.string(),
      vatNumber: z.string(),
      fiscalCode: z.string(),
      fatturaPaRegimeCode: z.string(),
      stayVatTreatment: z.enum(STAY_VAT_TREATMENTS),
      cleaningFeeTreatment: z.enum(CLEANING_FEE_TREATMENTS),
    })
    .superRefine((value, context) => {
      if (value.countryCode === 'CH') {
        check(context, value.swissVatRegistered === 'yes' || value.swissVatRegistered === 'no', 'swissVatRegistered', BILLING_ERROR_KEYS.swissVatRegistered);
        if (value.swissVatRegistered === 'yes') check(context, SWISS_UID.test(value.swissVatNumber.trim()), 'swissVatNumber', BILLING_ERROR_KEYS.swissVatNumber);
        return;
      }

      check(context, (ITALIAN_REGIMES as readonly string[]).includes(value.regime), 'regime', BILLING_ERROR_KEYS.regime);
      if ((value.regime === 'VatOrdinary' || value.regime === 'VatFlatRate') && !onRecord.vatNumber) {
        check(context, PARTITA_IVA.test(compactIdentifier(value.vatNumber)), 'vatNumber', BILLING_ERROR_KEYS.vatNumber);
      }
      if (value.regime === 'PrivatePerson' && !onRecord.fiscalCode) {
        check(context, isValidFiscalCode(value.fiscalCode), 'fiscalCode', BILLING_ERROR_KEYS.fiscalCode);
      }
      const regimeCode = value.fatturaPaRegimeCode.trim();
      check(context, regimeCode === '' || REGIME_CODE.test(regimeCode), 'fatturaPaRegimeCode', BILLING_ERROR_KEYS.fatturaPaRegimeCode);
    });
}

export const numberingStepSchema: StepSchema = z
  .object({ guestDocumentSeries: z.string(), ownerInvoiceSeries: z.string() })
  .superRefine((value, context) => {
    for (const field of ['guestDocumentSeries', 'ownerInvoiceSeries'] as const) {
      const series = seriesOf(value[field], 2000);
      check(context, series.length > 0 && series.length <= SERIES_MAX && SERIES_CHARACTERS.test(series), field, BILLING_ERROR_KEYS.series);
    }
  });

/** The fourth step «Tassa di soggiorno», for a Swiss issuer: who collects it for every portal; none is left unanswered, so that nobody confirms a choice by not making it. */
export const touristTaxStepSchema: StepSchema = z
  .object({ touristTaxCollectors: z.record(z.string(), z.string()) })
  .superRefine((value, context) => {
    for (const portal of PORTAL_SOURCES) {
      check(context, (TOURIST_TAX_COLLECTORS as readonly string[]).includes(value.touristTaxCollectors[portal] ?? ''), ['touristTaxCollectors', portal], BILLING_ERROR_KEYS.collector);
    }
  });

export const channelsStepSchema: StepSchema = z
  .object({
    portalAccountHolder: z.enum(PORTAL_ACCOUNT_HOLDERS),
    rechargePortalCommissions: z.boolean(),
    commissionPercents: z.record(z.string(), z.string()),
  })
  .superRefine((value, context) => {
    for (const [portal, percent] of Object.entries(value.commissionPercents)) {
      check(context, isBlank(percent) || isPercent(percent), ['commissionPercents', portal], BILLING_ERROR_KEYS.percent);
    }
  });

export const mandateStepSchema: StepSchema = z
  .object({
    mandateValidFrom: z.string(),
    mandateCommissionPercent: z.string(),
    mandateCommissionBase: z.enum(COMMISSION_BASES),
    mandateCleaningFlatRate: z.string(),
    mandateLinenFlatRate: z.string(),
  })
  .superRefine((value, context) => {
    check(context, isBlank(value.mandateCommissionPercent) || isPercent(value.mandateCommissionPercent), 'mandateCommissionPercent', BILLING_ERROR_KEYS.percent);
    check(context, isBlank(value.mandateCleaningFlatRate) || isAmount(value.mandateCleaningFlatRate), 'mandateCleaningFlatRate', BILLING_ERROR_KEYS.amount);
    check(context, isBlank(value.mandateLinenFlatRate) || isAmount(value.mandateLinenFlatRate), 'mandateLinenFlatRate', BILLING_ERROR_KEYS.amount);
    check(context, ISO_DAY.test(value.mandateValidFrom.trim()), 'mandateValidFrom', BILLING_ERROR_KEYS.date);
  });

export const italyStepSchema: StepSchema = z
  .object({ stampDutyReference: z.string() })
  .superRefine((value, context) => {
    check(context, value.stampDutyReference.trim().length <= STAMP_REFERENCE_MAX, 'stampDutyReference', BILLING_ERROR_KEYS.stampDutyReference);
  });

export const ACCOUNTANT_EMAIL_MAX = 254;

const PLAIN_EMAIL = /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/;

export function isPlainEmail(value: string): boolean {
  const text = value.trim();
  return text.length > 0 && text.length <= ACCOUNTANT_EMAIL_MAX && PLAIN_EMAIL.test(text);
}

export interface AccountantAnswers {
  email: string;
  enabled: boolean;
  sendDay: number;
  contents: string[];
}

type AccountantFields = Pick<BillingWizardValues, 'accountantEmail' | 'accountantMonthly' | 'accountantDay' | 'accountantContents'>;

export function accountantUntouched(values: AccountantFields): boolean {
  return values.accountantEmail === null && values.accountantMonthly === null && values.accountantDay === null && values.accountantContents === null;
}

const OWNER_FOLDER_KEYS: ReadonlySet<string> = new Set(ACCOUNTANT_OWNER_FOLDERS);

export function accountantFoldersFor(ownerAccounting: boolean): readonly AccountantPackageFolder[] {
  return ownerAccounting ? ACCOUNTANT_PACKAGE_FOLDERS : ACCOUNTANT_PACKAGE_FOLDERS.filter((folder) => !OWNER_FOLDER_KEYS.has(folder));
}

/**
 * The settings of the send as THIS person sees them: what the server has, without the folders they may not choose (`accountantFoldersFor`). Every check, every comparison and every save of the
 * step works on this view, so that what the person never saw is neither ticked, nor counted as «a folder chosen», nor sent: a save replaces the folders as a whole, so what a person who
 * may not choose the owner folders saves holds none of them (what the backend says). `null` while the settings cannot be read.
 */
export function accountantSettingsFor(settings: AccountantPackageSettings, ownerAccounting: boolean): AccountantPackageSettings;
export function accountantSettingsFor(settings: AccountantPackageSettings | null | undefined, ownerAccounting: boolean): AccountantPackageSettings | null;
export function accountantSettingsFor(settings: AccountantPackageSettings | null | undefined, ownerAccounting: boolean): AccountantPackageSettings | null {
  if (!settings) return null;
  return ownerAccounting ? settings : { ...settings, contents: settings.contents.filter((folder) => !OWNER_FOLDER_KEYS.has(folder)) };
}

export function accountantAnswersOf(current: Pick<AccountantPackageSettings, 'email' | 'enabled' | 'sendDay' | 'contents'>, values: AccountantFields): AccountantAnswers {
  return {
    email: values.accountantEmail ?? current.email ?? '',
    enabled: values.accountantMonthly ?? current.enabled,
    sendDay: values.accountantDay ?? current.sendDay,
    contents: values.accountantContents ?? current.contents,
  };
}

/** Whether a day is one the monthly send can be due on: a whole number from 1 to 28, so that every month has it. */
export function isSendDay(day: number): boolean {
  return Number.isInteger(day) && day >= ACCOUNTANT_SEND_DAYS.min && day <= ACCOUNTANT_SEND_DAYS.max;
}

export interface AccountantProblem {
  field: 'accountantEmail' | 'accountantDay' | 'accountantContents';
  messageKey: string;
}

/**
 * What the server would refuse in the settings of the send (`accountant_package_recipient_invalid`, `..._recipient_missing`, `..._send_day_invalid`, `..._contents_invalid`), told before it is
 * asked: an address that is not a plain one; the send every month turned on with no address to send it to (a blank address is no address, never a send that goes nowhere); a day outside 1 to 28; no
 * folder at all (an empty list never means «all of them»). At most one problem for each field.
 */
export function accountantProblems(answers: AccountantAnswers): AccountantProblem[] {
  const problems: AccountantProblem[] = [];
  const email = answers.email.trim();
  if (email !== '' && !isPlainEmail(email)) problems.push({ field: 'accountantEmail', messageKey: BILLING_ERROR_KEYS.accountantEmail });
  else if (email === '' && answers.enabled) problems.push({ field: 'accountantEmail', messageKey: BILLING_ERROR_KEYS.accountantEmailMissing });
  if (!isSendDay(answers.sendDay)) problems.push({ field: 'accountantDay', messageKey: BILLING_ERROR_KEYS.accountantDay });
  if (answers.contents.length === 0) problems.push({ field: 'accountantContents', messageKey: BILLING_ERROR_KEYS.accountantContents });
  return problems;
}

export function accountantStepSchema(current: AccountantPackageSettings | null | undefined): StepSchema {
  return z
    .object({
      accountantEmail: z.string().nullable(),
      accountantMonthly: z.boolean().nullable(),
      accountantDay: z.number().nullable(),
      accountantContents: z.array(z.string()).nullable(),
    })
    .superRefine((value, context) => {
      if (!current || accountantUntouched(value)) return;
      for (const problem of accountantProblems(accountantAnswersOf(current, value))) check(context, false, problem.field, problem.messageKey);
    });
}

export function mandateTemplateProblems(values: Pick<BillingWizardValues, 'mandateCommissionPercent' | 'mandateValidFrom' | 'mandateCleaningFlatRate' | 'mandateLinenFlatRate'>): Array<
  'mandateCommissionPercent' | 'mandateValidFrom' | 'mandateCleaningFlatRate' | 'mandateLinenFlatRate'
> {
  const problems: Array<'mandateCommissionPercent' | 'mandateValidFrom' | 'mandateCleaningFlatRate' | 'mandateLinenFlatRate'> = [];
  if (!isPercent(values.mandateCommissionPercent)) problems.push('mandateCommissionPercent');
  if (!ISO_DAY.test(values.mandateValidFrom.trim())) problems.push('mandateValidFrom');
  if (!isBlank(values.mandateCleaningFlatRate) && !isAmount(values.mandateCleaningFlatRate)) problems.push('mandateCleaningFlatRate');
  if (!isBlank(values.mandateLinenFlatRate) && !isAmount(values.mandateLinenFlatRate)) problems.push('mandateLinenFlatRate');
  return problems;
}
