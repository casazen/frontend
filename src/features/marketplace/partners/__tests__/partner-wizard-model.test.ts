import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import type { MarketplacePartnerPropertyData } from '@/types';
import { readMarketplaceReturnTo } from '../../lib/return-to';
import {
  BRIEF_FIELDS,
  PARTNER_STEP,
  briefRows,
  dayText,
  declaredDayOf,
  declaredDayProblem,
  declarationLabel,
  partnerDefaults,
  partnerProblemOf,
  partnerWizardId,
  welcomeBackPath,
} from '../partner-wizard-model';

function refusal(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

const DATA: MarketplacePartnerPropertyData = {
  name: 'Casa Rosa',
  address: 'Via Roma 12',
  city: 'Milano',
  postalCode: '20100',
  bedrooms: 0,
  bathrooms: 1,
  maxGuests: 4,
  cinCode: 'IT015146C2ABCDEFGH',
};

describe('the wizard of a partner', () => {
  it('partnerWizardId_TwoPartners_KeepTheirDraftsApart', () => {
    expect(partnerWizardId('beds24')).not.toBe(partnerWizardId('smoobu'));
  });

  it('partnerDefaults_ActivationDay_IsTodayUntilThePersonSaysAnotherOne', () => {
    expect(partnerDefaults('2026-11-12')).toEqual({ declaredOn: '2026-11-12' });
  });
});

describe('the brief of the partner', () => {
  it('briefRows_PropertyData_IsTheFixedListOfFieldsInTheOrderTheyAreAskedFor', () => {
    const rows = briefRows(DATA);

    expect(rows.map((row) => row.field)).toEqual([...BRIEF_FIELDS]);
    expect(rows.find((row) => row.field === 'address')?.value).toBe('Via Roma 12');
    // A studio flat has 0 bedrooms: it is a value to copy, not an empty one.
    expect(rows.find((row) => row.field === 'bedrooms')?.value).toBe('0');
    expect(rows.find((row) => row.field === 'cinCode')?.value).toBe('IT015146C2ABCDEFGH');
  });

  it('briefRows_CinThatIsNotValid_HasNoValueToCopy', () => {
    expect(briefRows({ ...DATA, cinCode: null }).find((row) => row.field === 'cinCode')?.value).toBeNull();
  });

  it('briefRows_NoProperty_HasNoRowsAndNothingElseOfTheDataLeaks', () => {
    expect(briefRows(null)).toEqual([]);
    expect(briefRows(undefined)).toEqual([]);
    // A field the brief does not list is never a row, whatever the data carries.
    const withGuest = { ...DATA, guestName: 'Mario Rossi', bookingId: 'b-1' } as MarketplacePartnerPropertyData;
    expect(JSON.stringify(briefRows(withGuest))).not.toContain('Mario');
    expect(JSON.stringify(briefRows(withGuest))).not.toContain('b-1');
  });
});

describe('the step the person comes back to', () => {
  it('welcomeBackPath_PropertyAndReturnTo_AreInTheAddressSoTheyLiveThroughTheTripToThePartnersSite', () => {
    const path = welcomeBackPath('beds24', 'prop-1', '/app/short-rent/properties/prop-1?tab=channels');

    expect(path.startsWith('/app/short-rent/marketplace/partners/beds24/activate?')).toBe(true);
    const params = new URLSearchParams(path.slice(path.indexOf('?') + 1));
    expect(params.get('step')).toBe(PARTNER_STEP.welcomeBack);
    expect(params.get('propertyId')).toBe('prop-1');
    // The returnTo comes back unchanged from the address: the wizard reads it with the same helper as ever.
    expect(readMarketplaceReturnTo(path.slice(path.indexOf('?')))).toBe('/app/short-rent/properties/prop-1?tab=channels');
  });

  it('welcomeBackPath_NoPropertyAndNoReturnTo_CarriesOnlyTheStep', () => {
    expect(welcomeBackPath('beds24', undefined, null)).toBe('/app/short-rent/marketplace/partners/beds24/activate?step=welcome-back');
  });

  it('welcomeBackPath_ReturnToThatIsNotAPageOfTheApp_IsNotCarried', () => {
    expect(welcomeBackPath('beds24', 'prop-1', 'https://evil.example/app/')).not.toContain('returnTo');
  });
});

describe('the day of the activation', () => {
  it.each([
    ['', 'missing'],
    ['  ', 'missing'],
    ['not a day', 'invalid'],
    ['2026-13-45', 'invalid'],
    ['2026-11-13', 'future'],
    ['2027-01-01', 'future'],
  ] as const)('declaredDayProblem_%s_Is_%s', (value, problem) => {
    expect(declaredDayProblem(value, '2026-11-12')).toBe(problem);
  });

  it('declaredDayProblem_TodayOrADayInThePast_IsFine', () => {
    expect(declaredDayProblem('2026-11-12', '2026-11-12')).toBeNull();
    expect(declaredDayProblem('2026-01-01', '2026-11-12')).toBeNull();
  });

  it('declaredDayOf_MidnightUtcOfTheDay_IsThatDay', () => {
    expect(declaredDayOf('2026-11-10T00:00:00Z')).toBe('2026-11-10');
    expect(declaredDayOf(null)).toBeNull();
    expect(declaredDayOf('nonsense')).toBeNull();
  });

  it('dayText_ADay_IsWrittenInTheLanguageOfThePage', () => {
    expect(dayText('2026-11-10', 'it')).toBe('10 novembre 2026');
    expect(dayText('2026-11-10', 'en')).toContain('November');
    expect(dayText(null, 'it')).toBe('');
  });
});

describe('how the activation is labelled', () => {
  it('declarationLabel_OnlyTheHostsWord_IsDeclaredByYouWithTheDay', () => {
    expect(declarationLabel({ isDeclared: true, declaredAt: '2026-11-10T00:00:00Z', verifiedAt: null })).toEqual({ kind: 'declared', day: '2026-11-10' });
  });

  it('declarationLabel_BackendRecordedAVerification_IsTheOnlyTimeItIsVerified', () => {
    expect(declarationLabel({ isDeclared: false, declaredAt: '2026-11-10T00:00:00Z', verifiedAt: '2026-11-11T08:00:00Z' }).kind).toBe('verified');
  });

  it('declarationLabel_VerifiedAtOnAnActivationThatIsStillOnlyDeclared_IsNotVerified', () => {
    // «Verified» is the backend's word, said by the pair «not declared + verified»: a half of it is not enough.
    expect(declarationLabel({ isDeclared: true, declaredAt: '2026-11-10T00:00:00Z', verifiedAt: '2026-11-11T08:00:00Z' }).kind).toBe('declared');
    expect(declarationLabel({ isDeclared: false, declaredAt: '2026-11-10T00:00:00Z', verifiedAt: null }).kind).toBe('declared');
  });
});

describe('what stops a read or a declaration', () => {
  it.each([
    ['marketplace_entry_not_found', 'notFound'],
    ['marketplace_property_not_found', 'propertyNotFound'],
    ['marketplace_partner_needs_whole_org', 'needsWholeOrg'],
    ['marketplace_declared_date_invalid', 'dateInvalid'],
    ['something_else', 'other'],
  ] as const)('partnerProblemOf_Code_%s_Is_%s', (code, problem) => {
    expect(partnerProblemOf(refusal(404, { code }))).toBe(problem);
  });

  it('partnerProblemOf_NoError_IsNoProblem', () => {
    expect(partnerProblemOf(null)).toBeNull();
    expect(partnerProblemOf(new Error('no answer'))).toBe('other');
  });
});
