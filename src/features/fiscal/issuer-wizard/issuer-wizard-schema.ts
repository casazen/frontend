import { z, type RefinementCtx, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { FISCAL_CODE, PARTITA_IVA, compactIdentifier } from '@/features/fiscal/tax-profile-changes';
import {
  DOCUMENT_ISSUER_MODES,
  type DocumentIssuerMode,
  type DocumentRegime,
  type FiscalIssuerField,
} from '@/types';

/** The name of the flow: the draft of the wizard (the answers and the step) is kept under it. */
export const ISSUER_WIZARD_ID = 'fiscal-issuer';

/** Raise it when the shape of `IssuerWizardValues` changes: a draft written for the old shape is ignored. */
export const ISSUER_DRAFT_VERSION = 1;

/** The steps of the wizard, by the name `?step=` carries. `issuer` and `address` exist only when CasaZen is the one that issues. */
export const ISSUER_STEPS = {
  who: 'who',
  regime: 'regime',
  issuer: 'issuer',
  address: 'address',
  summary: 'summary',
} as const;

export type IssuerStepId = (typeof ISSUER_STEPS)[keyof typeof ISSUER_STEPS];

/** First question of the regime: does the issuer have a VAT number? */
export const VAT_ANSWERS = ['yes', 'no'] as const;
export type VatAnswer = (typeof VAT_ANSWERS)[number];

/** Second question, asked only of who has a VAT number: the ordinary regime or the flat-rate one (forfettario). */
export const VAT_REGIME_ANSWERS = ['ordinary', 'flatRate'] as const;
export type VatRegimeAnswer = (typeof VAT_REGIME_ANSWERS)[number];

/**
 * What the person answers in the wizard. The wizard (`WizardShell`) holds it as the values of its form and keeps it as a draft in the tab.
 * Everything is text or one of the fixed answers, so the draft is plain data. `vatNumber` and `fiscalCode` are those of the tax profile of
 * the organization: they are never written to the draft (`ISSUER_DRAFT_EXCLUDE`) and never sent with the setting.
 */
export interface IssuerWizardValues {
  /** `null` until the person chooses. */
  mode: DocumentIssuerMode | null;
  hasVatNumber: VatAnswer | null;
  vatRegime: VatRegimeAnswer | null;
  legalName: string;
  vatNumber: string;
  fiscalCode: string;
  fatturaPaRegimeCode: string;
  issuerSdiRecipientCode: string;
  issuerPec: string;
  defaultSeries: string;
  addressStreet: string;
  addressCivic: string;
  postalCode: string;
  city: string;
  province: string;
  /** Not asked (Italy): kept as the server has it, so a save does not change it. */
  countryCode: string;
}

/** The fields that never go in the draft: the identifiers of the tax profile. */
export const ISSUER_DRAFT_EXCLUDE = ['vatNumber', 'fiscalCode'] as const;

/** What the choices of the first step depend on: what this environment and this organization can do today. */
export interface IssuerAvailability {
  /** The flag `Features:FiscalDocumentIssuance` is on: «CasaZen issues» can be chosen. */
  casazenIssuanceEnabled: boolean;
  /** The organization has an active connection with the channel manager: «the channel manager issues» can be chosen. */
  octorateConnected: boolean;
}

/** What of the tax profile the organization has already: the wizard asks only for what is missing. */
export interface IssuerIdentityOnRecord {
  vatNumber: boolean;
  fiscalCode: boolean;
}

/** The regime the two answers lead to, or `null` while they do not lead to one. */
export function regimeOfAnswers(answers: Pick<IssuerWizardValues, 'hasVatNumber' | 'vatRegime'>): DocumentRegime | null {
  if (answers.hasVatNumber === 'no') return 'PrivatePerson';
  if (answers.hasVatNumber === 'yes') {
    if (answers.vatRegime === 'ordinary') return 'VatOrdinary';
    if (answers.vatRegime === 'flatRate') return 'VatFlatRate';
  }
  return null;
}

/** A regime with a VAT number: the ordinary one and the flat-rate one. */
export function regimeHasVatNumber(regime: DocumentRegime | null): boolean {
  return regime === 'VatOrdinary' || regime === 'VatFlatRate';
}

/**
 * The messages of the checks are i18n keys, translated where they are shown. They are written out so that the i18n test finds a missing
 * one, and they are also what a field the server refused says (`SERVER_FIELD_MESSAGES`).
 */
export const ISSUER_ERROR_KEYS = {
  modeRequired: 'fiscalDocuments.issuer.errors.modeRequired',
  casazenUnavailable: 'fiscalDocuments.issuer.errors.casazenUnavailable',
  octorateUnavailable: 'fiscalDocuments.issuer.errors.octorateUnavailable',
  hasVatNumber: 'fiscalDocuments.issuer.errors.hasVatNumber',
  vatRegime: 'fiscalDocuments.issuer.errors.vatRegime',
  regime: 'fiscalDocuments.issuer.errors.regime',
  legalName: 'fiscalDocuments.issuer.errors.legalName',
  vatNumber: 'fiscalDocuments.issuer.errors.vatNumber',
  fiscalCode: 'fiscalDocuments.issuer.errors.fiscalCode',
  fatturaPaRegimeCode: 'fiscalDocuments.issuer.errors.fatturaPaRegimeCode',
  issuerSdiRecipientCode: 'fiscalDocuments.issuer.errors.issuerSdiRecipientCode',
  issuerPec: 'fiscalDocuments.issuer.errors.issuerPec',
  defaultSeries: 'fiscalDocuments.issuer.errors.defaultSeries',
  addressStreet: 'fiscalDocuments.issuer.errors.addressStreet',
  addressCivic: 'fiscalDocuments.issuer.errors.addressCivic',
  postalCode: 'fiscalDocuments.issuer.errors.postalCode',
  city: 'fiscalDocuments.issuer.errors.city',
  province: 'fiscalDocuments.issuer.errors.province',
} as const;

/**
 * The words for a field the server refused or said is missing (`issuer_profile_incomplete`, `issuer_field_invalid`): the same as the check of
 * the form, which says what the field wants. `countryCode` has none: it is not asked, and the server never refuses the one it gave.
 */
export const SERVER_FIELD_MESSAGES: Readonly<Partial<Record<FiscalIssuerField, string>>> = {
  mode: ISSUER_ERROR_KEYS.modeRequired,
  regime: ISSUER_ERROR_KEYS.regime,
  legalName: ISSUER_ERROR_KEYS.legalName,
  vatNumber: ISSUER_ERROR_KEYS.vatNumber,
  fiscalCode: ISSUER_ERROR_KEYS.fiscalCode,
  fatturaPaRegimeCode: ISSUER_ERROR_KEYS.fatturaPaRegimeCode,
  issuerSdiRecipientCode: ISSUER_ERROR_KEYS.issuerSdiRecipientCode,
  issuerPec: ISSUER_ERROR_KEYS.issuerPec,
  defaultSeries: ISSUER_ERROR_KEYS.defaultSeries,
  addressStreet: ISSUER_ERROR_KEYS.addressStreet,
  addressCivic: ISSUER_ERROR_KEYS.addressCivic,
  postalCode: ISSUER_ERROR_KEYS.postalCode,
  city: ISSUER_ERROR_KEYS.city,
  province: ISSUER_ERROR_KEYS.province,
};

/** The step where each field of the setting is asked: a problem the server names is shown there. */
export const STEP_OF_FIELD: Readonly<Record<FiscalIssuerField, IssuerStepId>> = {
  mode: ISSUER_STEPS.who,
  regime: ISSUER_STEPS.regime,
  legalName: ISSUER_STEPS.issuer,
  vatNumber: ISSUER_STEPS.issuer,
  fiscalCode: ISSUER_STEPS.issuer,
  fatturaPaRegimeCode: ISSUER_STEPS.issuer,
  issuerSdiRecipientCode: ISSUER_STEPS.issuer,
  issuerPec: ISSUER_STEPS.issuer,
  defaultSeries: ISSUER_STEPS.issuer,
  addressStreet: ISSUER_STEPS.address,
  addressCivic: ISSUER_STEPS.address,
  postalCode: ISSUER_STEPS.address,
  city: ISSUER_STEPS.address,
  province: ISSUER_STEPS.address,
  countryCode: ISSUER_STEPS.address,
};

// The limits of the server (`OrgFiscalIssuerProfile`, `DocumentIssuerService`): the form refuses what the server would refuse, in simple words.
// When the checks of the invoice data (E06/F02/US03/T01) exist they replace the plain checks below.
const LEGAL_NAME_MAX = 200;
const STREET_MAX = 200;
const CIVIC_MAX = 20;
const CITY_MAX = 100;
const PEC_MAX = 254;
const POSTAL_CODE_MAX = 10;

const REGIME_CODE = /^[A-Za-z0-9]{1,4}$/;
const RECIPIENT_CODE = /^[A-Za-z0-9]{7}$/;
const SERIES = /^[A-Za-z0-9._/-]{1,20}$/;
const PEC = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ITALIAN_POSTAL_CODE = /^\d{5}$/;
const PROVINCE = /^[A-Za-z]{2}$/;

const isBlank = (value: string) => value.trim() === '';
const isItaly = (countryCode: string) => isBlank(countryCode) || countryCode.trim().toUpperCase() === 'IT';

type StepSchema = ZodType<unknown, FieldValues>;

/** Adds the problem of `path` when `valid` is false. */
function check(context: RefinementCtx, valid: boolean, path: string, message: string): void {
  if (!valid) context.addIssue({ code: 'custom', path: [path], message });
}

/**
 * The first step: a choice, and one that can be taken today. A choice that cannot (CasaZen while the flag is off, the channel manager
 * before it is connected) is shown and blocked with its reason, and a draft or a saved setting that holds it is sent back to the question.
 */
export function whoIssuesSchema(availability: IssuerAvailability): StepSchema {
  return z.object({
    mode: z
      .enum(DOCUMENT_ISSUER_MODES, ISSUER_ERROR_KEYS.modeRequired)
      .refine((mode) => mode !== 'CasaZenDirectOnly' || availability.casazenIssuanceEnabled, ISSUER_ERROR_KEYS.casazenUnavailable)
      .refine((mode) => mode !== 'Octorate' || availability.octorateConnected, ISSUER_ERROR_KEYS.octorateUnavailable),
  });
}

/** The second step: the two questions lead to a regime. The second one is asked only of who has a VAT number. */
export const regimeStepSchema: StepSchema = z
  .object({
    hasVatNumber: z.enum(VAT_ANSWERS, ISSUER_ERROR_KEYS.hasVatNumber),
    vatRegime: z.enum(VAT_REGIME_ANSWERS).nullable(),
  })
  .superRefine((value, context) => {
    check(context, value.hasVatNumber !== 'yes' || value.vatRegime !== null, 'vatRegime', ISSUER_ERROR_KEYS.vatRegime);
  });

/**
 * The issuer (CasaZen only): the name on the documents, the VAT number or the fiscal code the regime needs when the tax profile does not have
 * it yet, and the options nobody has to touch (the regime code, the recipient code and the PEC of the issuer, the series). Every check is made
 * together, so that the person sees all the problems of the step at once; each is a plain format check with the limits of the server.
 */
export function issuerStepSchema(onRecord: IssuerIdentityOnRecord): StepSchema {
  return z
    .object({
      legalName: z.string(),
      hasVatNumber: z.enum(VAT_ANSWERS).nullable(),
      vatRegime: z.enum(VAT_REGIME_ANSWERS).nullable(),
      vatNumber: z.string(),
      fiscalCode: z.string(),
      fatturaPaRegimeCode: z.string(),
      issuerSdiRecipientCode: z.string(),
      issuerPec: z.string(),
      defaultSeries: z.string(),
    })
    .superRefine((value, context) => {
      const legalName = value.legalName.trim();
      check(context, legalName.length > 0 && legalName.length <= LEGAL_NAME_MAX, 'legalName', ISSUER_ERROR_KEYS.legalName);

      const regime = regimeOfAnswers(value);
      if (regime === 'PrivatePerson' && !onRecord.fiscalCode) {
        check(context, FISCAL_CODE.test(compactIdentifier(value.fiscalCode).toUpperCase()), 'fiscalCode', ISSUER_ERROR_KEYS.fiscalCode);
      }
      if (regimeHasVatNumber(regime) && !onRecord.vatNumber) {
        check(context, PARTITA_IVA.test(compactIdentifier(value.vatNumber)), 'vatNumber', ISSUER_ERROR_KEYS.vatNumber);
      }

      // The options may be left empty: empty is valid, and what is written follows its rule.
      const regimeCode = value.fatturaPaRegimeCode.trim();
      check(context, regimeCode === '' || REGIME_CODE.test(regimeCode), 'fatturaPaRegimeCode', ISSUER_ERROR_KEYS.fatturaPaRegimeCode);
      const recipientCode = value.issuerSdiRecipientCode.trim();
      check(context, recipientCode === '' || RECIPIENT_CODE.test(recipientCode), 'issuerSdiRecipientCode', ISSUER_ERROR_KEYS.issuerSdiRecipientCode);
      const pec = value.issuerPec.trim();
      check(context, pec === '' || (pec.length <= PEC_MAX && PEC.test(pec)), 'issuerPec', ISSUER_ERROR_KEYS.issuerPec);
      const series = value.defaultSeries.trim();
      check(context, series === '' || SERIES.test(series), 'defaultSeries', ISSUER_ERROR_KEYS.defaultSeries);
    });
}

/**
 * The address (CasaZen only): street, number, postal code, city and province, as the electronic invoice wants them. In Italy the postal code
 * is five digits and the province two letters; for an issuer of another country (kept as the server has it) both are looser.
 */
export const addressStepSchema: StepSchema = z
  .object({
    addressStreet: z.string(),
    addressCivic: z.string(),
    postalCode: z.string(),
    city: z.string(),
    province: z.string(),
    countryCode: z.string(),
  })
  .superRefine((value, context) => {
    const street = value.addressStreet.trim();
    check(context, street.length > 0 && street.length <= STREET_MAX, 'addressStreet', ISSUER_ERROR_KEYS.addressStreet);
    check(context, value.addressCivic.trim().length <= CIVIC_MAX, 'addressCivic', ISSUER_ERROR_KEYS.addressCivic);
    const city = value.city.trim();
    check(context, city.length > 0 && city.length <= CITY_MAX, 'city', ISSUER_ERROR_KEYS.city);

    const italy = isItaly(value.countryCode);
    const postalCode = value.postalCode.replace(/\s+/g, '');
    check(
      context,
      italy ? ITALIAN_POSTAL_CODE.test(postalCode) : postalCode.length > 0 && postalCode.length <= POSTAL_CODE_MAX,
      'postalCode',
      ISSUER_ERROR_KEYS.postalCode,
    );
    const province = value.province.trim();
    check(context, italy ? PROVINCE.test(province) : province === '' || PROVINCE.test(province), 'province', ISSUER_ERROR_KEYS.province);
  });
