import { describe, expect, it } from 'vitest';
import sample from './fixtures/public-checkin-submit.sample.json';
import {
  emptyInvoiceStep,
  initialInvoiceStep,
  publicCheckInFormSchema,
  stayGuestDefaults,
  toPublicCheckInInvoice,
  toPublicCheckInSubmitRequest,
  type InvoiceStepValues,
  type PublicCheckInFormValues,
} from '../schemas/checkin.schema';

const FISCAL_CODE = 'RSSMRA80A01H501U';

const step = (overrides: Partial<InvoiceStepValues> = {}): InvoiceStepValues => ({ ...emptyInvoiceStep('yes'), ...overrides });

function form(invoice?: InvoiceStepValues): PublicCheckInFormValues {
  return {
    guests: [
      {
        ...stayGuestDefaults('SingleGuest'),
        firstName: 'Giulia',
        lastName: 'Bianchi',
        gender: 'Female',
        dateOfBirth: '1992-03-08',
        bornInItaly: 'yes',
        birthComuneName: 'Firenze',
        birthProvince: 'FI',
        citizenshipName: 'Italia',
        documentType: 'IdentityCard',
        documentNumber: 'CA12345AB',
        documentIssuePlaceName: 'Firenze',
      },
    ],
    ...(invoice ? { invoice } : {}),
  };
}

describe('invoice block of the check-in request', () => {
  it('toPublicCheckInInvoice_NoAnswerOrANo_IsNoBlock', () => {
    expect(toPublicCheckInInvoice(undefined)).toBeUndefined();
    expect(toPublicCheckInInvoice(emptyInvoiceStep())).toBeUndefined();
    expect(toPublicCheckInInvoice(emptyInvoiceStep('no'))).toBeUndefined();
    expect(toPublicCheckInInvoice(step({ answer: 'no', name: 'Mario Rossi', fiscalCode: FISCAL_CODE }))).toBeUndefined();
  });

  it('toPublicCheckInInvoice_AYesWithNothingWritten_IsTheYesAlone', () => {
    expect(toPublicCheckInInvoice(step())).toEqual({ needInvoice: true });
    expect(toPublicCheckInInvoice(step({ recipientKind: 'Company', countryCode: 'DE' }))).toEqual({ needInvoice: true });
    expect(toPublicCheckInInvoice(step({ name: '   ' }))).toEqual({ needInvoice: true });
  });

  it('toPublicCheckInInvoice_AYesWithData_CarriesTheNonEmptyTextsNormalizedWithTheKindAndTheCountry', () => {
    expect(
      toPublicCheckInInvoice(
        step({ name: ' Mario  Rossi ', fiscalCode: ' rssmra80a01 h501u', city: 'Roma', postalCode: '001 00', province: 'rm', pec: ' Mario@PEC.it ' }),
      ),
    ).toEqual({
      needInvoice: true,
      recipientKind: 'Guest',
      countryCode: 'IT',
      name: 'Mario Rossi',
      fiscalCode: FISCAL_CODE,
      city: 'Roma',
      postalCode: '00100',
      province: 'RM',
      pec: 'mario@pec.it',
    });
  });

  it('toPublicCheckInSubmitRequest_NoInvoiceStep_HasNoInvoiceKeyAndIsTheBackendSample', () => {
    const request = toPublicCheckInSubmitRequest(form());

    expect(Object.keys(request)).not.toContain('invoice');
    expect(Object.keys(toPublicCheckInSubmitRequest(form(emptyInvoiceStep('no'))))).not.toContain('invoice');
    expect(Object.keys(sample)).not.toContain('invoice');
  });

  it('toPublicCheckInSubmitRequest_AYes_AddsTheBlockAndChangesNothingElse', () => {
    const without = toPublicCheckInSubmitRequest(form());
    const request = toPublicCheckInSubmitRequest(form(step({ name: 'Mario Rossi', fiscalCode: FISCAL_CODE })));

    expect(request.invoice).toEqual({ needInvoice: true, recipientKind: 'Guest', countryCode: 'IT', name: 'Mario Rossi', fiscalCode: FISCAL_CODE });
    expect({ ...request, invoice: undefined }).toEqual({ ...without, invoice: undefined });
  });
});

describe('invoice step of the form', () => {
  const issuesOf = (invoice?: InvoiceStepValues) => {
    const checked = publicCheckInFormSchema.safeParse(form(invoice));
    return checked.success ? [] : checked.error.issues.map((issue) => [issue.path.join('.'), issue.message]);
  };

  it('schema_NoStepOrNoAnswerOrANo_IsNeverCheckedSoItNeverBlocksTheCheckIn', () => {
    expect(issuesOf()).toEqual([]);
    expect(issuesOf(emptyInvoiceStep())).toEqual([]);
    expect(issuesOf(step({ answer: 'no', fiscalCode: 'XYZ', pec: 'no' }))).toEqual([]);
  });

  it('schema_AYesWithNothingWritten_IsValid', () => {
    expect(issuesOf(step())).toEqual([]);
  });

  it('schema_AYesWithData_IsCheckedWithTheSharedRulesAndEachFailureIsOnItsField', () => {
    expect(issuesOf(step({ name: 'Mario Rossi' }))).toEqual([['invoice.fiscalCode', 'invoice_data_recipient_required']]);
    expect(issuesOf(step({ fiscalCode: 'XYZ', pec: 'no' }))).toEqual([
      ['invoice.fiscalCode', 'invoice_data_fiscal_code_invalid'],
      ['invoice.pec', 'invoice_data_pec_invalid'],
    ]);
    expect(issuesOf(step({ name: 'Mario Rossi', fiscalCode: FISCAL_CODE }))).toEqual([]);
    expect(issuesOf(step({ recipientKind: 'Company', name: 'Rossi S.r.l.', vatNumber: '12345678903' }))).toEqual([]);
    expect(issuesOf(step({ countryCode: 'DE', name: 'Hans Meier' }))).toEqual([]);
  });

  it('initialInvoiceStep_TheGuestSaidYesBeforeAndTheBookingHasNoData_StartsWithTheYes', () => {
    expect(initialInvoiceStep({ invoiceRequested: true, hasInvoiceData: false }).answer).toBe('yes');
    expect(initialInvoiceStep({ invoiceRequested: true }).answer).toBe('yes');
  });

  it('initialInvoiceStep_AnyOtherContext_StartsWithNoAnswerAndNothingWritten', () => {
    expect(initialInvoiceStep({ invoiceRequested: true, hasInvoiceData: true })).toEqual(emptyInvoiceStep());
    expect(initialInvoiceStep({ invoiceRequested: false })).toEqual(emptyInvoiceStep());
    expect(initialInvoiceStep(undefined)).toEqual(emptyInvoiceStep());
  });
});
