import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import {
  INVOICE_ERROR_MESSAGES,
  createInvoiceDataSchema,
  emptyInvoiceDataForm,
  hasTypedInvoiceData,
  invoiceDataFormOf,
  invoiceErrorMessageOf,
  invoiceFailuresOfZod,
  invoiceFieldErrorsOf,
  missingIdentification,
  normalizeInvoiceData,
  readInvoiceDataProblems,
  sameInvoiceData,
  toSaveInvoiceDataRequest,
  validateInvoiceData,
  type InvoiceDataFormValues,
} from '../invoice-data-schema';
import { INVOICE_DATA_ERROR_CODES, INVOICE_DATA_FIELDS, type InvoiceDataFailure } from '@/types';

const FISCAL_CODE = 'RSSMRA80A01H501U';
const VAT_NUMBER = 'IT12345678903';

const form = (overrides: Partial<InvoiceDataFormValues> = {}): InvoiceDataFormValues => ({ ...emptyInvoiceDataForm(), ...overrides });
const HOST = { requireIdentification: true } as const;

function failuresOf(overrides: Partial<InvoiceDataFormValues>, options: { requireIdentification: boolean; onlyWhenTyped?: boolean } = HOST) {
  return validateInvoiceData(form(overrides), options);
}

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

/**
 * The rules of the invoice data of a booking (FIS-01, NF-81), mirror of the backend `InvoiceDataFormats.Validate`: the same normalization, the same
 * order of the failures and the same codes, for the host in the booking and for the guest at the check-in.
 */
describe('validateInvoiceData - who must be identified', () => {
  it('validateInvoiceData_PrivatePersonInItalyWithAFiscalCode_IsValid', () => {
    expect(failuresOf({ name: 'Mario Rossi', fiscalCode: FISCAL_CODE })).toEqual([]);
  });

  it('validateInvoiceData_PrivatePersonInItalyWithoutAFiscalCode_NeedsOne', () => {
    expect(failuresOf({ name: 'Mario Rossi' })).toEqual([{ field: 'fiscalCode', code: 'invoice_data_recipient_required' }]);
    // A VAT number does not stand for the fiscal code of a person.
    expect(failuresOf({ name: 'Mario Rossi', vatNumber: VAT_NUMBER })).toEqual([{ field: 'fiscalCode', code: 'invoice_data_recipient_required' }]);
  });

  it('validateInvoiceData_CompanyInItalyWithAVatNumberOrAFiscalCode_IsValid', () => {
    expect(failuresOf({ recipientKind: 'Company', vatNumber: VAT_NUMBER })).toEqual([]);
    expect(failuresOf({ recipientKind: 'Company', fiscalCode: FISCAL_CODE })).toEqual([]);
    expect(failuresOf({ recipientKind: 'Company', fiscalCode: '12345678903' })).toEqual([]);
  });

  it('validateInvoiceData_CompanyInItalyWithNeither_NeedsAVatNumber', () => {
    expect(failuresOf({ recipientKind: 'Company', name: 'Rossi S.r.l.' })).toEqual([{ field: 'vatNumber', code: 'invoice_data_recipient_required' }]);
  });

  it('validateInvoiceData_OutsideItaly_NeedsNeitherAFiscalCodeNorAVatNumber', () => {
    expect(failuresOf({ countryCode: 'DE', name: 'Hans Meier' })).toEqual([]);
    expect(failuresOf({ countryCode: 'FR', recipientKind: 'Company', name: 'Dupont SA' })).toEqual([]);
    expect(missingIdentification(form({ countryCode: 'DE' }))).toBeNull();
  });

  it('validateInvoiceData_OutsideItaly_TheFiscalCodeIsNotCheckedAsAnItalianOne', () => {
    expect(failuresOf({ countryCode: 'DE', fiscalCode: '12/345/678/90' })).toEqual([]);
    expect(failuresOf({ countryCode: 'IT', fiscalCode: 'ABC123' })).toEqual([{ field: 'fiscalCode', code: 'invoice_data_fiscal_code_invalid' }]);
  });

  it('validateInvoiceData_VatNumberOfAnotherCountryWrittenWithoutItsPrefix_GetsThePrefixOfTheCountryBeforeTheCheck', () => {
    expect(failuresOf({ countryCode: 'DE', recipientKind: 'Company', vatNumber: '123456789' })).toEqual([]);
    // The same digits in Italy are an Italian number with a check digit, which they do not have.
    expect(failuresOf({ countryCode: 'IT', recipientKind: 'Company', vatNumber: '123456789' })).toEqual([
      { field: 'vatNumber', code: 'invoice_data_vat_number_invalid' },
    ]);
  });

  it('validateInvoiceData_NothingIsRequiredOfAnImport_SoTheIdentificationIsAskedOnlyWhenTheCallerSaysSo', () => {
    expect(failuresOf({ name: 'Mario Rossi' }, { requireIdentification: false })).toEqual([]);
  });
});

describe('validateInvoiceData - formats', () => {
  it('validateInvoiceData_FiscalCodeWithAWrongCheckCharacter_IsRefusedOnTheField', () => {
    expect(failuresOf({ fiscalCode: 'RSSMRA80A01H501X' })).toEqual([{ field: 'fiscalCode', code: 'invoice_data_fiscal_code_invalid' }]);
  });

  it('validateInvoiceData_FiscalCodeInLowerCaseWithSpaces_IsNormalizedBeforeTheCheck', () => {
    expect(failuresOf({ fiscalCode: ' rssmra80a01 h501u ' })).toEqual([]);
  });

  it('validateInvoiceData_VatNumberWithAWrongCheckDigit_IsRefusedOnTheField', () => {
    expect(failuresOf({ recipientKind: 'Company', vatNumber: 'IT12345678901' })).toEqual([{ field: 'vatNumber', code: 'invoice_data_vat_number_invalid' }]);
  });

  it('validateInvoiceData_RecipientCode_SevenLettersOrDigitsInAnyCase', () => {
    expect(failuresOf({ fiscalCode: FISCAL_CODE, sdiRecipientCode: 'abc1234' })).toEqual([]);
    expect(failuresOf({ fiscalCode: FISCAL_CODE, sdiRecipientCode: 'ABC12' })).toEqual([
      { field: 'sdiRecipientCode', code: 'invoice_data_recipient_code_invalid' },
    ]);
  });

  it('validateInvoiceData_Pec_MustBeAnAddress', () => {
    expect(failuresOf({ fiscalCode: FISCAL_CODE, pec: 'Nome@Pec.it' })).toEqual([]);
    expect(failuresOf({ fiscalCode: FISCAL_CODE, pec: 'nome.pec.it' })).toEqual([{ field: 'pec', code: 'invoice_data_pec_invalid' }]);
  });

  it('validateInvoiceData_PostalCodeProvinceAndCountry_FollowTheRulesOfTheServer', () => {
    const base = { fiscalCode: FISCAL_CODE };
    expect(failuresOf({ ...base, postalCode: '00100', province: 'rm' })).toEqual([]);
    expect(failuresOf({ ...base, postalCode: '001 00' })).toEqual([]);
    expect(failuresOf({ ...base, postalCode: '1234' })).toEqual([{ field: 'postalCode', code: 'invoice_data_field_invalid' }]);
    expect(failuresOf({ ...base, postalCode: 'SW1A 1AA', countryCode: 'GB' })).toEqual([]);
    expect(failuresOf({ ...base, province: 'ROM' })).toEqual([{ field: 'province', code: 'invoice_data_field_invalid' }]);
    expect(failuresOf({ ...base, countryCode: 'ITA' })).toEqual([{ field: 'countryCode', code: 'invoice_data_field_invalid' }]);
  });

  it('validateInvoiceData_TextsLongerThanTheServerKeeps_AreRefusedOnTheirField', () => {
    const base = { fiscalCode: FISCAL_CODE };
    expect(failuresOf({ ...base, name: 'a'.repeat(200) })).toEqual([]);
    expect(failuresOf({ ...base, name: 'a'.repeat(201) })).toEqual([{ field: 'name', code: 'invoice_data_field_invalid' }]);
    expect(failuresOf({ ...base, addressStreet: 'a'.repeat(201) })).toEqual([{ field: 'addressStreet', code: 'invoice_data_field_invalid' }]);
    expect(failuresOf({ ...base, addressCivic: 'a'.repeat(21) })).toEqual([{ field: 'addressCivic', code: 'invoice_data_field_invalid' }]);
    expect(failuresOf({ ...base, city: 'a'.repeat(101) })).toEqual([{ field: 'city', code: 'invoice_data_field_invalid' }]);
  });

  it('validateInvoiceData_EverythingWrongAtOnce_NamesEveryFieldInTheOrderOfTheServerAndSkipsTheIdentification', () => {
    const failures = failuresOf({
      fiscalCode: 'XYZ',
      vatNumber: '1',
      sdiRecipientCode: 'AB',
      pec: 'no',
      name: 'a'.repeat(201),
      postalCode: '9',
      province: 'ROM',
    });

    expect(failures.map((failure) => failure.field)).toEqual(['fiscalCode', 'vatNumber', 'sdiRecipientCode', 'pec', 'name', 'postalCode', 'province']);
    expect(failures.every((failure) => failure.code !== 'invoice_data_recipient_required')).toBe(true);
  });

  it('validateInvoiceData_EveryCodeItSaysIsACodeOfTheServer', () => {
    const codes = new Set(
      [
        failuresOf({ fiscalCode: 'X' }),
        failuresOf({ vatNumber: '1' }),
        failuresOf({ sdiRecipientCode: '1' }),
        failuresOf({ pec: '1' }),
        failuresOf({}),
        failuresOf({ province: 'ROM' }),
      ]
        .flat()
        .map((failure) => failure.code),
    );
    expect([...codes].every((code) => (INVOICE_DATA_ERROR_CODES as readonly string[]).includes(code))).toBe(true);
    expect(codes.size).toBe(INVOICE_DATA_ERROR_CODES.length);
  });
});

describe('a «yes» of the guest with nothing written', () => {
  it('hasTypedInvoiceData_TheKindAndTheCountryAlone_AreNoDataToCheck', () => {
    expect(hasTypedInvoiceData(form())).toBe(false);
    expect(hasTypedInvoiceData(form({ recipientKind: 'Company', countryCode: 'DE' }))).toBe(false);
    expect(hasTypedInvoiceData(form({ name: '   ' }))).toBe(false);
  });

  it('hasTypedInvoiceData_AnyTextWritten_IsData', () => {
    expect(hasTypedInvoiceData(form({ city: 'Roma' }))).toBe(true);
    expect(hasTypedInvoiceData(form({ pec: 'a@b.it' }))).toBe(true);
  });

  it('validateInvoiceData_OnlyWhenTyped_LeavesAnEmptyFormAloneAndChecksOneThatHasAnything', () => {
    const options = { requireIdentification: true, onlyWhenTyped: true };
    expect(failuresOf({}, options)).toEqual([]);
    expect(failuresOf({ recipientKind: 'Company', countryCode: 'IT' }, options)).toEqual([]);
    expect(failuresOf({ name: 'Mario Rossi' }, options)).toEqual([{ field: 'fiscalCode', code: 'invoice_data_recipient_required' }]);
  });
});

describe('normalizeInvoiceData', () => {
  it('normalizeInvoiceData_WritesEachFieldTheWayTheServerStoresIt', () => {
    expect(
      normalizeInvoiceData(
        form({
          name: '  Mario   Rossi ',
          fiscalCode: ' rssmra80a01 h501u',
          vatNumber: '123 456.789-03',
          addressStreet: ' Via  Roma ',
          addressCivic: ' 12 ',
          postalCode: '001 00',
          city: ' Roma ',
          province: 'rm',
          countryCode: ' it ',
          sdiRecipientCode: ' abc1234 ',
          pec: ' Nome@PEC.it ',
        }),
      ),
    ).toEqual({
      recipientKind: 'Guest',
      name: 'Mario Rossi',
      fiscalCode: FISCAL_CODE,
      vatNumber: VAT_NUMBER,
      addressStreet: 'Via Roma',
      addressCivic: '12',
      postalCode: '00100',
      city: 'Roma',
      province: 'RM',
      countryCode: 'IT',
      sdiRecipientCode: 'ABC1234',
      pec: 'nome@pec.it',
    });
  });

  it('normalizeInvoiceData_NoCountry_IsItalyAndAForeignPostalCodeKeepsItsSpace', () => {
    expect(normalizeInvoiceData(form({ countryCode: '' })).countryCode).toBe('IT');
    expect(normalizeInvoiceData(form({ countryCode: 'gb', postalCode: ' sw1a  1aa ' })).postalCode).toBe('SW1A 1AA');
  });

  it('toSaveInvoiceDataRequest_SendsEveryFieldNormalized_SoAFieldTheHostEmptiedIsCleared', () => {
    const request = toSaveInvoiceDataRequest(form({ name: ' Mario ', fiscalCode: 'rssmra80a01h501u' }));
    expect(request).toMatchObject({ recipientKind: 'Guest', name: 'Mario', fiscalCode: FISCAL_CODE, vatNumber: '', pec: '', countryCode: 'IT' });
    expect(Object.keys(request).sort()).toEqual([...INVOICE_DATA_FIELDS].sort());
  });

  it('sameInvoiceData_TheSameThingWrittenAnotherWay_IsTheSame', () => {
    expect(sameInvoiceData(form({ fiscalCode: FISCAL_CODE, name: 'Mario Rossi' }), form({ fiscalCode: ' rssmra80a01h501u', name: 'Mario  Rossi ' }))).toBe(true);
    expect(sameInvoiceData(form({ fiscalCode: FISCAL_CODE }), form({ fiscalCode: FISCAL_CODE, city: 'Roma' }))).toBe(false);
  });
});

describe('invoiceDataFormOf', () => {
  it('invoiceDataFormOf_NoDataOrTheEmptyObject_IsAPrivatePersonInItalyWithNothingWritten', () => {
    expect(invoiceDataFormOf(undefined)).toEqual(emptyInvoiceDataForm());
    expect(invoiceDataFormOf({ bookingId: 'b1', invoiceRequested: false })).toEqual(emptyInvoiceDataForm());
  });

  it('invoiceDataFormOf_DataFromTheServer_FillsTheFieldsItHas', () => {
    expect(
      invoiceDataFormOf({
        bookingId: 'b1',
        invoiceRequested: true,
        recipientKind: 'Company',
        name: 'Rossi S.r.l.',
        vatNumber: VAT_NUMBER,
        countryCode: 'IT',
        city: 'Roma',
        source: 'Octorate',
      }),
    ).toEqual({ ...emptyInvoiceDataForm(), recipientKind: 'Company', name: 'Rossi S.r.l.', vatNumber: VAT_NUMBER, city: 'Roma' });
  });
});

describe('the schema', () => {
  it('createInvoiceDataSchema_AFailure_HasTheFieldAsPathAndTheCodeAsMessage', () => {
    const checked = createInvoiceDataSchema(HOST).safeParse(form({ name: 'Mario Rossi' }));

    expect(checked.success).toBe(false);
    if (checked.success) return;
    expect(checked.error.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual([['fiscalCode', 'invoice_data_recipient_required']]);
    expect(invoiceFailuresOfZod(checked.error)).toEqual([{ field: 'fiscalCode', code: 'invoice_data_recipient_required' }]);
  });

  it('createInvoiceDataSchema_ValidData_Passes', () => {
    expect(createInvoiceDataSchema(HOST).safeParse(form({ name: 'Mario Rossi', fiscalCode: FISCAL_CODE })).success).toBe(true);
  });

  it('invoiceFieldErrorsOf_TwoFailuresOfOneField_KeepsTheFirst', () => {
    expect(
      invoiceFieldErrorsOf([
        { field: 'pec', code: 'invoice_data_pec_invalid' },
        { field: 'pec', code: 'invoice_data_field_invalid' },
        { field: 'name', code: 'invoice_data_field_invalid' },
      ]),
    ).toEqual({ pec: 'invoice_data_pec_invalid', name: 'invoice_data_field_invalid' });
  });
});

describe('a refusal of the server (422)', () => {
  it('readInvoiceDataProblems_TheListOfErrors_GivesEveryFailureAtOnce', () => {
    const error = httpError(422, {
      status: 422,
      code: 'invoice_data_fiscal_code_invalid',
      field: 'fiscalCode',
      errors: [
        { field: 'fiscalCode', code: 'invoice_data_fiscal_code_invalid' },
        { field: 'pec', code: 'invoice_data_pec_invalid' },
      ],
    });

    expect(readInvoiceDataProblems(error)).toEqual<InvoiceDataFailure[]>([
      { field: 'fiscalCode', code: 'invoice_data_fiscal_code_invalid' },
      { field: 'pec', code: 'invoice_data_pec_invalid' },
    ]);
  });

  it('readInvoiceDataProblems_OnlyTheFirstFailureAsCodeAndField_GivesThatOne', () => {
    expect(readInvoiceDataProblems(httpError(422, { code: 'invoice_data_recipient_required', field: 'vatNumber' }))).toEqual([
      { field: 'vatNumber', code: 'invoice_data_recipient_required' },
    ]);
  });

  it('readInvoiceDataProblems_AnyOtherAnswer_GivesNothing', () => {
    expect(readInvoiceDataProblems(httpError(422, { code: 'document_issuer_conflict' }))).toEqual([]);
    expect(readInvoiceDataProblems(httpError(422, { code: 'invoice_data_pec_invalid', field: 'somethingElse' }))).toEqual([]);
    expect(readInvoiceDataProblems(httpError(400, { code: 'invoice_data_pec_invalid', field: 'pec' }))).toEqual([]);
    expect(readInvoiceDataProblems(httpError(422, { errors: { Guests: ['x'] } }))).toEqual([]);
    expect(readInvoiceDataProblems(httpError(422, undefined))).toEqual([]);
    expect(readInvoiceDataProblems(new Error('network'))).toEqual([]);
  });
});

describe('invoiceErrorMessageOf', () => {
  it.each<[InvoiceDataFailure, string]>([
    [{ field: 'fiscalCode', code: 'invoice_data_fiscal_code_invalid' }, 'fiscalCodeInvalid'],
    [{ field: 'vatNumber', code: 'invoice_data_vat_number_invalid' }, 'vatNumberInvalid'],
    [{ field: 'sdiRecipientCode', code: 'invoice_data_recipient_code_invalid' }, 'recipientCodeInvalid'],
    [{ field: 'pec', code: 'invoice_data_pec_invalid' }, 'pecInvalid'],
    [{ field: 'fiscalCode', code: 'invoice_data_recipient_required' }, 'fiscalCodeRequired'],
    [{ field: 'vatNumber', code: 'invoice_data_recipient_required' }, 'vatNumberRequired'],
    [{ field: 'postalCode', code: 'invoice_data_field_invalid' }, 'postalCodeInvalid'],
    [{ field: 'province', code: 'invoice_data_field_invalid' }, 'provinceInvalid'],
    [{ field: 'countryCode', code: 'invoice_data_field_invalid' }, 'countryInvalid'],
    [{ field: 'recipientKind', code: 'invoice_data_field_invalid' }, 'kindInvalid'],
    [{ field: 'name', code: 'invoice_data_field_invalid' }, 'tooLong'],
    [{ field: 'addressStreet', code: 'invoice_data_field_invalid' }, 'tooLong'],
    [{ field: 'addressCivic', code: 'invoice_data_field_invalid' }, 'tooLong'],
    [{ field: 'city', code: 'invoice_data_field_invalid' }, 'tooLong'],
  ])('invoiceErrorMessageOf_%j_Says_%s', (failure, message) => {
    expect(invoiceErrorMessageOf(failure)).toBe(message);
  });

  it('invoiceErrorMessageOf_EveryMessageThereIs_IsReachedByACodeAndAField', () => {
    const reached = new Set(
      INVOICE_DATA_ERROR_CODES.flatMap((code) => INVOICE_DATA_FIELDS.map((field) => invoiceErrorMessageOf({ field, code }))),
    );
    expect([...reached].sort()).toEqual([...INVOICE_ERROR_MESSAGES].sort());
  });
});
