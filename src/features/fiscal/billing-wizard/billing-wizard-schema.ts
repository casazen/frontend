import { z, type RefinementCtx, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { PARTITA_IVA, compactIdentifier } from '@/features/fiscal/tax-profile-changes';
import { isValidFiscalCode } from '@/lib/fiscal-code';
import {
  CLEANING_FEE_TREATMENTS,
  COMMISSION_BASES,
  PORTAL_ACCOUNT_HOLDERS,
  STAY_VAT_TREATMENTS,
  type CleaningFeeTreatment,
  type CommissionBase,
  type PortalAccountHolder,
  type StayVatTreatment,
} from '@/types';

/** The name of the flow, for the shell (`WizardShell` asks for one): the answers are not kept in the browser, the setup on the server is the draft. */
export const BILLING_WIZARD_ID = 'fiscal-billing-setup';

/** The two countries a document can be issued from today: the regimes, the VAT and the stamp follow the country. */
export const BILLING_COUNTRIES = ['IT', 'CH'] as const;
export type BillingCountry = (typeof BILLING_COUNTRIES)[number];

/** The regimes an Italian issuer chooses among; a Swiss one answers «iscritto all'IVA» yes or no. */
export const ITALIAN_REGIMES = ['PrivatePerson', 'VatOrdinary', 'VatFlatRate'] as const;
export type ItalianRegime = (typeof ITALIAN_REGIMES)[number];

/** The portals a booking can come from (backend `BookingSource` where a portal is one): a tourist tax is collected by the portal or by the host for each. */
export const PORTAL_SOURCES = ['Airbnb', 'BookingCom', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda', 'OtherChannel'] as const;

/** The portals of the table of the account holders: the four the agencies run their listings on. */
export const ACCOUNT_HOLDER_PORTALS = ['Airbnb', 'BookingCom', 'Expedia', 'Vrbo'] as const;

/** Who collects the tourist tax of the bookings of a portal: the portal itself, or the host (so the document of the stay carries the line). */
export const TOURIST_TAX_COLLECTORS = ['portal', 'host'] as const;
export type TouristTaxCollector = (typeof TOURIST_TAX_COLLECTORS)[number];

/** What a listing is set to in the table of the account holders: the default of the organization, or the holder it was given. */
export type HolderChoice = 'default' | PortalAccountHolder;

/** What the person answers in the wizard: the answers of every step, as text or one of the fixed answers, so that nothing in it is anything but plain data. */
export interface BillingWizardValues {
  // 1 «Chi emette»
  countryCode: '' | BillingCountry;
  legalName: string;
  addressStreet: string;
  addressCivic: string;
  postalCode: string;
  city: string;
  province: string;
  // 2 «IVA»
  swissVatRegistered: '' | 'yes' | 'no';
  regime: '' | ItalianRegime;
  swissVatNumber: string;
  /** The Italian VAT number and the fiscal code are those of the tax profile of the organization: written there, never in the setup. */
  vatNumber: string;
  fiscalCode: string;
  fatturaPaRegimeCode: string;
  stayVatTreatment: StayVatTreatment;
  cleaningFeeTreatment: CleaningFeeTreatment;
  // 3 «Numerazione»
  guestDocumentSeries: string;
  ownerInvoiceSeries: string;
  // 4 «Tassa di soggiorno» (Switzerland), by portal; empty until answered
  touristTaxCollectors: Record<string, '' | TouristTaxCollector>;
  // 5 «Commissioni dei canali»
  portalAccountHolder: PortalAccountHolder;
  rechargePortalCommissions: boolean;
  /** What the table of the holders changed and the server does not have yet: `<propertyId>|<portal>` → the choice. */
  holderChanges: Record<string, HolderChoice>;
  /** The percent a portal keeps when its reservation carries no commission, by portal, as typed. */
  commissionPercents: Record<string, string>;
  // 6 «Mandato standard»
  mandateValidFrom: string;
  mandateCommissionPercent: string;
  mandateCommissionBase: CommissionBase;
  mandateCleaningFlatRate: string;
  mandateLinenFlatRate: string;
  mandatePassthroughPaymentFees: boolean;
  mandateCommissionIncludesVat: boolean;
  // 7 «Emissione»
  autoIssueGuestDocuments: boolean;
  emailGuestDocuments: boolean;
  // 8 «Italia»
  conservationAgreementConfirmed: boolean;
  virtualStampConfirmed: boolean;
  stampDutyReference: string;
}

/** What of the tax profile the organization has already: the wizard asks only for what is missing. */
export interface BillingIdentityOnRecord {
  vatNumber: boolean;
  fiscalCode: boolean;
}

/** The messages of the checks are i18n keys, translated where they are shown (the shell and `Field` translate them). */
export const BILLING_ERROR_KEYS = {
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

// The limits of the server (`OrgFiscalIssuerProfile`, `FiscalNumberFormat`): the form refuses what the server would refuse, in simple words.
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

/** The placeholder of the year of the issue in a series (`{year}`, backend `FiscalNumberFormat.YearPlaceholder`). */
export const SERIES_YEAR_PLACEHOLDER = '{year}';

/** The series a document issued in `year` gets from a pattern: `{year}` replaced by the year, as the server does it. */
export function seriesOf(pattern: string, year: number): string {
  return pattern.trim().split(SERIES_YEAR_PLACEHOLDER).join(String(year));
}

/** A decimal as typed (comma or point) as a number; `null` for what is not one. */
export function parseDecimal(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (text === '' || !/^\d+(\.\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

const isBlank = (value: string) => value.trim() === '';

type StepSchema = ZodType<unknown, FieldValues>;

/** Adds the problem of `path` when `valid` is false. */
function check(context: RefinementCtx, valid: boolean, path: string | readonly (string | number)[], message: string): void {
  if (!valid) context.addIssue({ code: 'custom', path: typeof path === 'string' ? [path] : [...path], message });
}

/** Whether a text is a percent from 0 to 100 with at most two decimals. */
function isPercent(value: string): boolean {
  const text = value.trim();
  if (!PERCENT.test(text)) return false;
  const parsed = parseDecimal(text);
  return parsed !== null && parsed <= 100;
}

/** Whether a text is an amount of money with at most two decimals. */
function isAmount(value: string): boolean {
  return AMOUNT.test(value.trim());
}

/** The first step «Chi emette»: the country, the name on the documents and the address, as the documents want them. */
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
      // The canton is the two letters of the canton and is not asked of a Swiss address by the server: it may be left out.
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

/** The third step «Numerazione»: both series, written as the document will carry them: letters, digits, `._/-` and the year, at most ten characters once the year is in. */
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

/**
 * The fifth step «Commissioni dei canali» (agencies): the account holder of the portals and the percent each portal keeps when it sends none. A percent may be left empty (the
 * portal has no rule of its own then); one that is written is from 0 to 100 with at most two decimals.
 */
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

/** The sixth step «Mandato standard» (agencies): what is written is a percent, amounts and a day; the step may be left empty, the action that applies it asks for the percent. */
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

/** The eighth step «Italia»: the stamp reference is at most sixty characters; the two ticks are reminders and may be left. */
export const italyStepSchema: StepSchema = z
  .object({ stampDutyReference: z.string() })
  .superRefine((value, context) => {
    check(context, value.stampDutyReference.trim().length <= STAMP_REFERENCE_MAX, 'stampDutyReference', BILLING_ERROR_KEYS.stampDutyReference);
  });

/** What the template of the mandate needs to be applied: the percent (from 0 to 100) and the day it is valid from. The flat fees are optional, but valid when written. */
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
