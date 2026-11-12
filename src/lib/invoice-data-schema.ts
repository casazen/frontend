import { isAxiosError } from 'axios';
import { z, type RefinementCtx } from 'zod';
import { getProblemCode } from '@/lib/api-errors';
import { isValidFiscalCode, normalizeFiscalCode } from '@/lib/fiscal-code';
import {
  DEFAULT_COUNTRY_CODE,
  PEC_MAX_LENGTH,
  compactCode,
  isValidPec,
  isValidRecipientCode,
  isValidVatNumber,
  normalizePec,
  normalizeRecipientCode,
  normalizeVatNumber,
} from '@/lib/vat-number';
import {
  INVOICE_DATA_ERROR_CODES,
  INVOICE_DATA_FIELDS,
  INVOICE_RECIPIENT_KINDS,
  type BookingInvoiceData,
  type InvoiceDataErrorCode,
  type InvoiceDataFailure,
  type InvoiceDataField,
  type InvoiceDataTextField,
  type InvoiceRecipientKind,
  type SaveInvoiceDataRequest,
} from '@/types';

/**
 * The rules of the invoice data of a booking (FIS-01, NF-81), as one schema for the two places where a person writes it: the host in the sub-step
 * of the booking and the guest in the check-in page. Mirror of the backend `InvoiceDataFormats.Validate`: the same normalization before the
 * checks, the same order of the failures and the same codes, so that a failure of the form and a 422 of the server are the same thing to the
 * screen that shows it (`invoiceErrorMessageOf`). The fiscal code is checked by `@/lib/fiscal-code` and never again here.
 *
 * The rules, in short: the formats of what is written (fiscal code, VAT number, code of the recipient, PEC, the length of the texts, the postal
 * code and the province); and, when the data is asked of a person, that the recipient is identified: a private person in Italy needs a fiscal
 * code, a company in Italy a VAT number or a fiscal code, and outside Italy neither.
 */

/** What the person has typed: every member is text, so the draft of a form is plain data. */
export interface InvoiceDataFormValues {
  recipientKind: InvoiceRecipientKind;
  name: string;
  fiscalCode: string;
  vatNumber: string;
  addressStreet: string;
  addressCivic: string;
  postalCode: string;
  city: string;
  province: string;
  countryCode: string;
  sdiRecipientCode: string;
  pec: string;
}

/** The longest text the server keeps for each field (`BookingInvoiceData`): the form refuses what the server would refuse. */
export const INVOICE_DATA_LIMITS: Readonly<Record<InvoiceDataTextField, number>> = {
  name: 200,
  fiscalCode: 16,
  vatNumber: 28,
  addressStreet: 200,
  addressCivic: 20,
  postalCode: 10,
  city: 100,
  province: 2,
  countryCode: 2,
  sdiRecipientCode: 7,
  pec: PEC_MAX_LENGTH,
};

const FIELD_INVALID: InvoiceDataErrorCode = 'invoice_data_field_invalid';
const TWO_LETTERS = /^[A-Za-z]{2}$/;
const ITALIAN_POSTAL_CODE = /^\d{5}$/;

/** The values of a form with nothing in it: a private person in Italy. */
export function emptyInvoiceDataForm(): InvoiceDataFormValues {
  return {
    recipientKind: 'Guest',
    name: '',
    fiscalCode: '',
    vatNumber: '',
    addressStreet: '',
    addressCivic: '',
    postalCode: '',
    city: '',
    province: '',
    countryCode: DEFAULT_COUNTRY_CODE,
    sdiRecipientCode: '',
    pec: '',
  };
}

/** The values of a form from the data the server has: what is not there is empty, the kind and the country have their default. */
export function invoiceDataFormOf(data: BookingInvoiceData | null | undefined): InvoiceDataFormValues {
  const empty = emptyInvoiceDataForm();
  if (!data) return empty;

  return {
    recipientKind: data.recipientKind ?? empty.recipientKind,
    name: data.name ?? '',
    fiscalCode: data.fiscalCode ?? '',
    vatNumber: data.vatNumber ?? '',
    addressStreet: data.addressStreet ?? '',
    addressCivic: data.addressCivic ?? '',
    postalCode: data.postalCode ?? '',
    city: data.city ?? '',
    province: data.province ?? '',
    countryCode: data.countryCode || empty.countryCode,
    sdiRecipientCode: data.sdiRecipientCode ?? '',
    pec: data.pec ?? '',
  };
}

/** Trimmed, with every run of white space collapsed into one space (the server's `Text`). */
const plainText = (value: string) => value.trim().replace(/\s+/g, ' ');

/**
 * The values the way the server stores them (`InvoiceDataFormats.Normalize`): the fiscal code upper case without spaces, the VAT number with its
 * country prefix, the country, the province and the code of the recipient upper case, the PEC lower case, the other texts trimmed. The checks
 * are made on this form, so what the server accepts is what the form accepts.
 */
export function normalizeInvoiceData(values: InvoiceDataFormValues): InvoiceDataFormValues {
  const country = compactCode(values.countryCode) || DEFAULT_COUNTRY_CODE;

  return {
    recipientKind: values.recipientKind,
    name: plainText(values.name),
    fiscalCode: normalizeFiscalCode(values.fiscalCode),
    vatNumber: normalizeVatNumber(values.vatNumber, country),
    addressStreet: plainText(values.addressStreet),
    addressCivic: plainText(values.addressCivic),
    postalCode: country === 'IT' ? compactCode(values.postalCode) : plainText(values.postalCode).toUpperCase(),
    city: plainText(values.city),
    province: compactCode(values.province),
    countryCode: country,
    sdiRecipientCode: normalizeRecipientCode(values.sdiRecipientCode),
    pec: normalizePec(values.pec),
  };
}

/**
 * True when the person has written something about the recipient: any text but the country (which has a default and is only a way to read the
 * rest). A guest who says «yes» and writes nothing has asked for an invoice and left the data to the host: that is no data to check.
 */
export function hasTypedInvoiceData(values: InvoiceDataFormValues): boolean {
  const written: readonly InvoiceDataTextField[] = [
    'name',
    'fiscalCode',
    'vatNumber',
    'addressStreet',
    'addressCivic',
    'postalCode',
    'city',
    'province',
    'sdiRecipientCode',
    'pec',
  ];
  return written.some((field) => values[field].trim() !== '');
}

/**
 * The field that is missing for the recipient to be identified, or null when it is (`InvoiceDataFormats.MissingIdentification`): outside Italy
 * nothing is needed; a company in Italy needs a VAT number or a fiscal code, a private person in Italy a fiscal code.
 */
export function missingIdentification(values: InvoiceDataFormValues): InvoiceDataField | null {
  const data = normalizeInvoiceData(values);
  if (data.countryCode !== 'IT') return null;

  if (data.recipientKind === 'Company') return data.vatNumber === '' && data.fiscalCode === '' ? 'vatNumber' : null;
  return data.fiscalCode === '' ? 'fiscalCode' : null;
}

/** What the checks are asked: when the identification is needed, and whether a form with nothing written is to be left alone. */
export interface InvoiceDataValidationOptions {
  /**
   * The data is what a person typed (the host in the booking, the guest at the check-in), so the recipient must be identified. The partial data
   * of an import is not asked for it, and this form is never used for one.
   */
  requireIdentification: boolean;
  /** Check nothing while nothing is written: the guest's «yes» with no data, which leaves the data to the host. */
  onlyWhenTyped?: boolean;
}

/**
 * What is wrong with the values, as the server would say it: each failure with its field, in the order fiscal code, VAT number, code of the
 * recipient, PEC, the other fields, and the identification of the recipient last and only when nothing else is wrong. Empty when the values are
 * valid.
 */
export function validateInvoiceData(values: InvoiceDataFormValues, options: InvoiceDataValidationOptions): InvoiceDataFailure[] {
  if (options.onlyWhenTyped && !hasTypedInvoiceData(values)) return [];

  const data = normalizeInvoiceData(values);
  const italy = data.countryCode === 'IT';
  const failures: InvoiceDataFailure[] = [];
  const fail = (field: InvoiceDataField, code: InvoiceDataErrorCode) => failures.push({ field, code });
  const tooLong = (field: InvoiceDataTextField) => {
    if (data[field].length > INVOICE_DATA_LIMITS[field]) fail(field, FIELD_INVALID);
  };

  if (!(INVOICE_RECIPIENT_KINDS as readonly string[]).includes(data.recipientKind)) fail('recipientKind', FIELD_INVALID);

  if (data.fiscalCode !== '' && (data.fiscalCode.length > INVOICE_DATA_LIMITS.fiscalCode || (italy && !isValidFiscalCode(data.fiscalCode)))) {
    fail('fiscalCode', 'invoice_data_fiscal_code_invalid');
  }
  if (data.vatNumber !== '' && (data.vatNumber.length > INVOICE_DATA_LIMITS.vatNumber || !isValidVatNumber(data.vatNumber))) {
    fail('vatNumber', 'invoice_data_vat_number_invalid');
  }
  if (data.sdiRecipientCode !== '' && !isValidRecipientCode(data.sdiRecipientCode)) fail('sdiRecipientCode', 'invoice_data_recipient_code_invalid');
  if (data.pec !== '' && !isValidPec(data.pec)) fail('pec', 'invoice_data_pec_invalid');

  tooLong('name');
  tooLong('addressStreet');
  tooLong('addressCivic');
  tooLong('city');
  if (data.postalCode !== '' && (data.postalCode.length > INVOICE_DATA_LIMITS.postalCode || (italy && !ITALIAN_POSTAL_CODE.test(data.postalCode)))) {
    fail('postalCode', FIELD_INVALID);
  }
  if (data.province !== '' && !TWO_LETTERS.test(data.province)) fail('province', FIELD_INVALID);
  if (!TWO_LETTERS.test(data.countryCode)) fail('countryCode', FIELD_INVALID);

  if (options.requireIdentification && failures.length === 0) {
    const missing = missingIdentification(data);
    if (missing) fail(missing, 'invoice_data_recipient_required');
  }

  return failures;
}

/** The fields of the form as a Zod shape: every text is a string, the kind is one of the two kinds (a message of the schema is the code). */
export const invoiceDataFormShape = {
  recipientKind: z.enum(INVOICE_RECIPIENT_KINDS, FIELD_INVALID),
  name: z.string(),
  fiscalCode: z.string(),
  vatNumber: z.string(),
  addressStreet: z.string(),
  addressCivic: z.string(),
  postalCode: z.string(),
  city: z.string(),
  province: z.string(),
  countryCode: z.string(),
  sdiRecipientCode: z.string(),
  pec: z.string(),
};

/**
 * Adds the failures of `validateInvoiceData` to a Zod refinement: the path is the field and the message is the code of the failure (the same code
 * the server sends), which the screen turns into words with `invoiceErrorMessageOf`.
 */
export function addInvoiceDataIssues(values: InvoiceDataFormValues, options: InvoiceDataValidationOptions, context: RefinementCtx): void {
  for (const failure of validateInvoiceData(values, options)) {
    context.addIssue({ code: 'custom', path: [failure.field], message: failure.code });
  }
}

/** The schema of the invoice data: the host's sub-step (`requireIdentification`), shared with the guest check-in page through `addInvoiceDataIssues`. */
export function createInvoiceDataSchema(options: InvoiceDataValidationOptions) {
  return z.object(invoiceDataFormShape).superRefine((values, context) => addInvoiceDataIssues(values, options, context));
}

/** The failure of each field, by the code: what a form keeps to show the words under the field. */
export type InvoiceDataFieldErrors = Partial<Record<InvoiceDataField, InvoiceDataErrorCode>>;

function isField(value: unknown): value is InvoiceDataField {
  return typeof value === 'string' && (INVOICE_DATA_FIELDS as readonly string[]).includes(value);
}

function isErrorCode(value: unknown): value is InvoiceDataErrorCode {
  return typeof value === 'string' && (INVOICE_DATA_ERROR_CODES as readonly string[]).includes(value);
}

/** The first failure of each field (a form shows one message under a field). */
export function invoiceFieldErrorsOf(failures: readonly InvoiceDataFailure[]): InvoiceDataFieldErrors {
  const errors: InvoiceDataFieldErrors = {};
  for (const failure of failures) errors[failure.field] ??= failure.code;
  return errors;
}

/**
 * The failure of each field from the errors of a form library, which keeps the message of each field: here the code of the failure, as the schema
 * and a 422 of the server both write it. A message that is no code of the invoice data (written by something else) is left out.
 */
export function invoiceFieldErrorsOfForm(errors: Partial<Record<InvoiceDataField, { message?: string } | undefined>> | undefined): InvoiceDataFieldErrors {
  const failures: InvoiceDataFieldErrors = {};
  for (const field of INVOICE_DATA_FIELDS) {
    const message = errors?.[field]?.message;
    if (isErrorCode(message)) failures[field] = message;
  }
  return failures;
}

/** The failures of a Zod error of the schema above (the path is the field, the message the code). */
export function invoiceFailuresOfZod(error: z.ZodError): InvoiceDataFailure[] {
  return error.issues.flatMap((issue) => {
    const field = issue.path[issue.path.length - 1];
    return isField(field) && isErrorCode(issue.message) ? [{ field, code: issue.message }] : [];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The failures a 422 of the invoice data carries: the list `errors` (`[{ field, code }]`, every failure at once) or, for an answer that has only
 * the first one, its `code` and `field`. Empty for any other answer: a 422 of another kind, a 400, a network error.
 */
export function readInvoiceDataProblems(error: unknown): InvoiceDataFailure[] {
  if (!isAxiosError(error) || error.response?.status !== 422) return [];

  const data: unknown = error.response.data;
  if (!isRecord(data)) return [];

  const listed = Array.isArray(data.errors)
    ? data.errors.flatMap((entry: unknown): InvoiceDataFailure[] =>
        isRecord(entry) && isField(entry.field) && isErrorCode(entry.code) ? [{ field: entry.field, code: entry.code }] : [],
      )
    : [];
  if (listed.length > 0) return listed;

  const code = getProblemCode(data);
  return isErrorCode(code) && isField(data.field) ? [{ field: data.field, code }] : [];
}

/**
 * The words of a failure, as the name of a text under the `errors` of a set of texts: the code and the field give one of eleven messages
 * (`fiscalCodeRequired` and `vatNumberRequired` are the same code on two fields, `tooLong` is the code of a field that holds free text).
 */
export const INVOICE_ERROR_MESSAGES = [
  'fiscalCodeInvalid',
  'vatNumberInvalid',
  'recipientCodeInvalid',
  'pecInvalid',
  'fiscalCodeRequired',
  'vatNumberRequired',
  'tooLong',
  'postalCodeInvalid',
  'provinceInvalid',
  'countryInvalid',
  'kindInvalid',
] as const;

export type InvoiceErrorMessage = (typeof INVOICE_ERROR_MESSAGES)[number];

export function invoiceErrorMessageOf(failure: InvoiceDataFailure): InvoiceErrorMessage {
  switch (failure.code) {
    case 'invoice_data_fiscal_code_invalid':
      return 'fiscalCodeInvalid';
    case 'invoice_data_vat_number_invalid':
      return 'vatNumberInvalid';
    case 'invoice_data_recipient_code_invalid':
      return 'recipientCodeInvalid';
    case 'invoice_data_pec_invalid':
      return 'pecInvalid';
    case 'invoice_data_recipient_required':
      return failure.field === 'vatNumber' ? 'vatNumberRequired' : 'fiscalCodeRequired';
    case 'invoice_data_field_invalid':
      if (failure.field === 'postalCode') return 'postalCodeInvalid';
      if (failure.field === 'province') return 'provinceInvalid';
      if (failure.field === 'countryCode') return 'countryInvalid';
      if (failure.field === 'recipientKind') return 'kindInvalid';
      return 'tooLong';
  }
}

/**
 * What the host saves: every field, normalized, because the host's save is the whole truth of the form (a field sent empty clears it, and the
 * server keeps one that is left out). The server normalizes again: it is the one that decides.
 */
export function toSaveInvoiceDataRequest(values: InvoiceDataFormValues): SaveInvoiceDataRequest {
  return normalizeInvoiceData(values);
}

/** True when two forms say the same thing once normalized: a save that would change nothing is not made. */
export function sameInvoiceData(a: InvoiceDataFormValues, b: InvoiceDataFormValues): boolean {
  const left = normalizeInvoiceData(a);
  const right = normalizeInvoiceData(b);
  return INVOICE_DATA_FIELDS.every((field) => left[field] === right[field]);
}
