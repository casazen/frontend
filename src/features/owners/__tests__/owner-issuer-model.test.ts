import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import type { OwnerAddress, OwnerFiscalProfile, OwnerIssuerProfile } from '@/types';
import { followedForm, formOf, isChanged, issuerRequestFromOwnerData, issuerStateOf, refusedFieldsOf, requestOf } from '../owner-issuer-model';

const profile = (overrides: Partial<OwnerIssuerProfile> = {}): OwnerIssuerProfile => ({
  ownerId: 'o1',
  exists: true,
  canIssue: true,
  masked: false,
  regime: 'PrivatePerson',
  legalName: 'Marta Rossi',
  fiscalCode: 'RSSMRT80A41F205X',
  vatNumber: null,
  addressStreet: 'Via Roma',
  addressCivic: '12',
  postalCode: '22100',
  city: 'Como',
  province: 'CO',
  countryCode: 'IT',
  fatturaPaRegimeCode: null,
  effectiveRegimeCode: null,
  stayVatTreatment: 'Standard',
  guestDocumentSeries: null,
  defaultGuestDocumentSeries: '{year}',
  stampDutyReference: null,
  issuerSdiRecipientCode: null,
  issuerPec: null,
  missingFields: [],
  stayRatePercent: null,
  ...overrides,
});

const fiscal = (overrides: Partial<OwnerFiscalProfile> = {}): OwnerFiscalProfile => ({
  id: 'p1',
  propertyOwnerId: 'o1',
  validFrom: '2020-01-01',
  validTo: null,
  entityKind: 'NaturalPerson',
  legalName: 'Marta Rossi',
  taxResidenceCountry: 'IT',
  legalAddress: null,
  fiscalCode: 'rssmrt80a41f205x',
  vatNumber: null,
  foreignTaxId: null,
  settlementCurrency: 'EUR',
  bankAccountReference: null,
  mandateRole: null,
  mandateFrom: null,
  mandateTo: null,
  revenueRecognitionRule: null,
  expenseCommissionModel: null,
  workingCapitalRule: null,
  taxJurisdiction: null,
  accountingPolicyId: null,
  masked: false,
  ...overrides,
});

const address: OwnerAddress = { ownerId: 'o1', street: 'Via Roma', buildingNumber: '12', postalCode: '22100', town: 'Como', province: 'co', country: 'IT' };

function refusal(status: number, body: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('refused', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: body, statusText: '', headers: {}, config });
}

describe('the issuer profile of an owner as the form holds it (E17/F03/US01/T01)', () => {
  it('requestOf_IsTheWholeProfileInItaly_WithBlanksLeftOutAndTheCodesInCapitals', () => {
    const form = { ...formOf(profile({ legalName: null, fiscalCode: null, regime: null })), regime: 'VatOrdinary' as const, legalName: '  Casa Mia Srl ', vatNumber: ' 01234567890 ', province: 'co', fiscalCode: 'abc', issuerSdiRecipientCode: '  ', stampDutyReference: ' AUT-77 ' };

    expect(requestOf(form)).toMatchObject({ regime: 'VatOrdinary', legalName: 'Casa Mia Srl', vatNumber: '01234567890', province: 'CO', fiscalCode: 'ABC', countryCode: 'IT', stayVatTreatment: 'Standard', stampDutyReference: 'AUT-77' });
    expect(requestOf(form).issuerSdiRecipientCode).toBeUndefined();
    // No regime chosen is no regime sent (the server says what is missing), never a guess.
    expect(requestOf({ ...form, regime: '' }).regime).toBeUndefined();
  });

  it('isChanged_ComparesTheTextsCutAtTheirEnds_SoALookAtTheFormIsNotAChange', () => {
    const saved = formOf(profile());
    expect(isChanged(saved, saved)).toBe(false);
    expect(isChanged({ ...saved, legalName: ` ${saved.legalName} ` }, saved)).toBe(false);
    expect(isChanged({ ...saved, city: 'Lecco' }, saved)).toBe(true);
    expect(isChanged({ ...saved, stayVatTreatment: 'ExemptArt10' }, saved)).toBe(true);
  });

  it('followedForm_KeepsWhatWasTypedAndLetsEveryOtherFieldFollowTheServer', () => {
    const base = formOf(profile());
    // The person typed the name; meanwhile another person wrote the city and the province on the server.
    const typed = { ...base, legalName: 'Marta Bianchi' };
    const stored = { ...base, city: 'Lecco', province: 'LC' };

    expect(followedForm(typed, base, stored)).toEqual({ ...base, legalName: 'Marta Bianchi', city: 'Lecco', province: 'LC' });
    // Nothing typed: the form is what the server holds. The same data: the form is what it was.
    expect(followedForm(base, base, stored)).toEqual(stored);
    expect(followedForm(typed, base, base)).toEqual(typed);
    // A text cut at its ends is not a change of the person, so the server's value is followed.
    expect(followedForm({ ...base, city: ` ${base.city} ` }, base, stored).city).toBe('Lecco');
  });

  it('issuerStateOf_TellsNoProfileFromAProfileThatMissesSomething', () => {
    expect(issuerStateOf({ exists: false, canIssue: false })).toBe('none');
    expect(issuerStateOf({ exists: true, canIssue: false })).toBe('incomplete');
    expect(issuerStateOf({ exists: true, canIssue: true })).toBe('ready');
  });

  it('refusedFieldsOf_NamesTheFieldsOfTheFormThatTheServerRefused_AndNothingForAnyOtherAnswer', () => {
    expect(refusedFieldsOf(refusal(422, { code: 'issuer_field_invalid', field: 'vatNumber', errors: [{ field: 'vatNumber', code: 'x' }, { field: 'postalCode', code: 'y' }, { field: 'unknownThing', code: 'z' }] }))).toEqual(['vatNumber', 'postalCode']);
    expect(refusedFieldsOf(refusal(422, { code: 'issuer_field_invalid', field: 'regime' }))).toEqual(['regime']);
    expect(refusedFieldsOf(refusal(403, { code: 'fiscal_settings_need_whole_org' }))).toEqual([]);
    expect(refusedFieldsOf(new Error('x'))).toEqual([]);
  });
});

describe('the quick creation of the profile from the data of the owner (E17/F03/US01/T01)', () => {
  it('issuerRequestFromOwnerData_APersonWithoutAVatNumber_IsAPrivatePersonWithTheAddressOfTheOwner', () => {
    const request = issuerRequestFromOwnerData({ owner: { id: 'o1', firstName: 'Marta', lastName: 'Rossi' }, profile: fiscal(), address });

    expect(request).toMatchObject({ regime: 'PrivatePerson', legalName: 'Marta Rossi', fiscalCode: 'RSSMRT80A41F205X', addressStreet: 'Via Roma', addressCivic: '12', postalCode: '22100', city: 'Como', province: 'CO', countryCode: 'IT', stayVatTreatment: 'Standard' });
    expect(request.vatNumber).toBeUndefined();
  });

  it('issuerRequestFromOwnerData_AVatNumberSaysAnInvoice_AndACompanyWithNoneLeavesTheRegimeToThePerson', () => {
    const withVat = issuerRequestFromOwnerData({ owner: null, profile: fiscal({ entityKind: 'LegalEntity', legalName: 'Casa Mia Srl', vatNumber: '01234567890' }), address });
    expect(withVat).toMatchObject({ regime: 'VatOrdinary', vatNumber: '01234567890', legalName: 'Casa Mia Srl' });

    // A company without a VAT number: the data do not say whether it is ordinary or flat-rate, so nothing is decided for it.
    const without = issuerRequestFromOwnerData({ owner: null, profile: fiscal({ entityKind: 'LegalEntity', legalName: 'Casa Mia Srl' }), address });
    expect(without.regime).toBeUndefined();
  });

  it('issuerRequestFromOwnerData_WithNothingKnown_MakesNothingUp', () => {
    const request = issuerRequestFromOwnerData({ owner: { id: 'o1', firstName: 'Marta', lastName: 'Rossi' }, profile: null, address: null });

    expect(request).toEqual({ regime: undefined, legalName: 'Marta Rossi', fiscalCode: undefined, vatNumber: undefined, addressStreet: undefined, addressCivic: undefined, postalCode: undefined, city: undefined, province: undefined, countryCode: 'IT', stayVatTreatment: 'Standard' });
  });
});
