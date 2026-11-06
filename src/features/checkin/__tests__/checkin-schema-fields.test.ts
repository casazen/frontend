import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPublicCheckInFormSchema,
  createStayGuestFormSchema,
  requiredStatisticalFields,
  stayGuestDefaults,
  stayGuestFormSchema,
  toPublicCheckInSubmitRequest,
  toStayGuestSubmit,
  type StayGuestFormValues,
} from '../schemas/checkin.schema';
import { NOON_UTC, freezeClock } from '@/test/clock';

/** A guest who passes every rule with no statistical field required (the day is the 24th of September 2026, noon UTC). */
function validGuest(overrides: Partial<StayGuestFormValues> = {}): StayGuestFormValues {
  return {
    ...stayGuestDefaults('SingleGuest'),
    firstName: 'Giulia',
    lastName: 'Bianchi',
    gender: 'Female',
    dateOfBirth: '1992-03-08',
    bornInItaly: 'no',
    birthCountryName: 'Francia',
    citizenshipName: 'Francia',
    documentType: 'IdentityCard',
    documentNumber: 'AB1234567',
    documentIssuePlaceName: 'Parigi',
    ...overrides,
  };
}

function issuesOf(guest: StayGuestFormValues, required: Parameters<typeof createStayGuestFormSchema>[0] = []) {
  const result = createStayGuestFormSchema(required).safeParse(guest);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('requiredStatisticalFields', () => {
  it('requiredStatisticalFields_ApiNames_AreReadWhicheverTheCase', () => {
    expect(requiredStatisticalFields(['TourismType', 'travelWay'])).toEqual(['tourismType', 'travelWay']);
    expect(requiredStatisticalFields(['EducationLevel'])).toEqual(['educationLevel']);
  });

  it('requiredStatisticalFields_NothingOrUnknown_AsksNothing', () => {
    expect(requiredStatisticalFields(undefined)).toEqual([]);
    expect(requiredStatisticalFields([])).toEqual([]);
    expect(requiredStatisticalFields(['Religion'])).toEqual([]);
  });
});

describe('stayGuestFormSchema with the new fields (NF-40)', () => {
  it('stayGuestFormSchema_NothingNewFilled_IsValid_NothingElseBecomesMandatory', () => {
    freezeClock(NOON_UTC);

    expect(issuesOf(validGuest())).toEqual([]);
  });

  it('stayGuestFormSchema_IssueDateInTheFuture_IsRefused', () => {
    freezeClock(NOON_UTC);

    expect(issuesOf(validGuest({ documentIssuedOn: '2026-09-25' }))).toEqual([
      'documentIssuedOn: checkin.validation.documentIssuedOn.future',
    ]);
    expect(issuesOf(validGuest({ documentIssuedOn: '2026-09-24' }))).toEqual([]);
  });

  it('stayGuestFormSchema_IssueDateBefore1900_IsRefused', () => {
    freezeClock(NOON_UTC);

    expect(issuesOf(validGuest({ documentIssuedOn: '1899-12-31' }))).toEqual([
      'documentIssuedOn: checkin.validation.documentIssuedOn.invalid',
    ]);
  });

  it('stayGuestFormSchema_ExpiryBeforeIssue_IsRefused_ExpiryWithoutIssueIsFine', () => {
    freezeClock(NOON_UTC);

    expect(issuesOf(validGuest({ documentIssuedOn: '2020-05-10', documentExpiresOn: '2020-05-09' }))).toEqual([
      'documentExpiresOn: checkin.validation.documentExpiresOn.beforeIssue',
    ]);
    expect(issuesOf(validGuest({ documentIssuedOn: '2020-05-10', documentExpiresOn: '2020-05-10' }))).toEqual([]);
    // An expired document is accepted: the check-in only warns about it.
    expect(issuesOf(validGuest({ documentExpiresOn: '2001-01-01' }))).toEqual([]);
  });

  it('stayGuestFormSchema_DocumentDatesOfAMember_AreNotChecked', () => {
    freezeClock(NOON_UTC);

    const member = validGuest({ type: 'FamilyMember', documentIssuedOn: '2999-01-01' });

    expect(issuesOf(member)).toEqual([]);
  });

  it('stayGuestFormSchema_ResidenceProvince_IsTwoLettersWhenGiven_AndNeverRequired', () => {
    freezeClock(NOON_UTC);

    expect(issuesOf(validGuest({ residenceInItaly: 'yes', residenceProvince: 'R' }))).toEqual([
      'residenceProvince: checkin.validation.residenceProvince.invalid',
    ]);
    expect(issuesOf(validGuest({ residenceInItaly: 'yes' }))).toEqual([]);
    expect(issuesOf(validGuest({ residenceInItaly: 'yes', residenceComuneName: 'Roma', residenceProvince: 'rm' }))).toEqual([]);
    expect(issuesOf(validGuest({ residenceInItaly: 'no' }))).toEqual([]);
  });

  it('stayGuestFormSchema_StatisticalFieldTheRegionRequires_MustBeChosen', () => {
    freezeClock(NOON_UTC);

    expect(issuesOf(validGuest(), ['tourismType', 'educationLevel'])).toEqual([
      'tourismType: checkin.validation.tourismType.required',
      'educationLevel: checkin.validation.educationLevel.required',
    ]);
    expect(issuesOf(validGuest({ tourismType: 'holiday', educationLevel: 'degree' }), ['tourismType', 'educationLevel'])).toEqual([]);
    // A value outside the closed list is not a choice.
    expect(issuesOf(validGuest({ tourismType: 'tourism' }), ['tourismType'])).toEqual([
      'tourismType: checkin.validation.tourismType.required',
    ]);
  });

  it('createStayGuestFormSchema_PersonalScope_LeavesTheDocumentToTheNextStep', () => {
    freezeClock(NOON_UTC);
    const withoutDocument = validGuest({ documentType: '', documentNumber: '', documentIssuePlaceName: '' });

    expect(createStayGuestFormSchema([], 'personal').safeParse(withoutDocument).success).toBe(true);
    expect(createStayGuestFormSchema([], 'document').safeParse(withoutDocument).success).toBe(false);
    expect(createStayGuestFormSchema([], 'all').safeParse(withoutDocument).success).toBe(false);
  });
});

describe('what the guest page sends (NF-40)', () => {
  it('toStayGuestSubmit_StatisticalFieldNotRequired_IsNotSentAtAll', () => {
    const body = toStayGuestSubmit(validGuest({ tourismType: 'holiday' }));

    expect(body).not.toHaveProperty('tourismType');
    expect(body).not.toHaveProperty('travelWay');
    expect(body).not.toHaveProperty('educationLevel');
  });

  it('toStayGuestSubmit_HostEntryHoldingAStatisticalField_SendsItBackSoASaveDoesNotEraseIt', () => {
    const guest = validGuest({ tourismType: 'holiday' });

    const body = toStayGuestSubmit(guest, { keepStatistical: true });
    // What the guest has is sent back; what is empty and not required is not sent.
    expect(body.tourismType).toBe('holiday');
    expect(body).not.toHaveProperty('travelWay');
    // The guest portal never sends back a field the region does not require.
    expect(toStayGuestSubmit(guest)).not.toHaveProperty('tourismType');
  });

  it('toStayGuestSubmit_StatisticalFieldTheRegionRequires_IsSentAndTheOthersAreNot', () => {
    const body = toStayGuestSubmit(validGuest({ tourismType: 'business', travelWay: 'train' }), { statisticalFields: ['tourismType'] });

    expect(body.tourismType).toBe('business');
    expect(body).not.toHaveProperty('travelWay');
  });

  it('toStayGuestSubmit_TaxExemption_IsNeverOnTheGuestPortalAndIsTheHostsWhenAsked', () => {
    const guest = validGuest({ taxExemptionCode: 'resident' });

    expect(toStayGuestSubmit(guest)).not.toHaveProperty('taxExemptionCode');
    expect(toStayGuestSubmit(guest, { withTaxExemption: true }).taxExemptionCode).toBe('resident');
    expect(toStayGuestSubmit(validGuest(), { withTaxExemption: true }).taxExemptionCode).toBeNull();
  });

  it('toStayGuestSubmit_ResidenceAndDocumentDates_FollowTheShapeOfTheAnswer', () => {
    const inItaly = toStayGuestSubmit(
      validGuest({
        residenceInItaly: 'yes',
        residenceComuneName: ' Roma ',
        residenceComuneCode: '058091',
        residenceProvince: 'rm',
        residenceCountryName: 'Francia',
        documentIssuedOn: '2020-05-10',
        documentExpiresOn: '2030-05-09',
      }),
    );
    const abroad = toStayGuestSubmit(validGuest({ residenceInItaly: 'no', residenceCountryName: 'Francia', residenceComuneName: 'Roma' }));
    const unsaid = toStayGuestSubmit(validGuest());

    expect(inItaly).toMatchObject({
      residenceInItaly: true,
      residenceComuneName: 'Roma',
      residenceComuneCode: '058091',
      residenceProvince: 'RM',
      residenceCountryName: null,
      documentIssuedOn: '2020-05-10',
      documentExpiresOn: '2030-05-09',
    });
    expect(abroad).toMatchObject({ residenceInItaly: false, residenceCountryName: 'Francia', residenceComuneName: null, residenceProvince: null });
    expect(unsaid).toMatchObject({ residenceInItaly: null, residenceComuneName: null, residenceCountryName: null, documentIssuedOn: null });
  });

  it('toStayGuestSubmit_MemberOfAFamily_SendsNoDocumentDates', () => {
    const body = toStayGuestSubmit(validGuest({ type: 'FamilyMember', documentIssuedOn: '2020-05-10', documentExpiresOn: '2030-05-09' }));

    expect(body.documentIssuedOn).toBeNull();
    expect(body.documentExpiresOn).toBeNull();
  });

  it('toPublicCheckInSubmitRequest_CarriesOnlyTheFieldsTheRegionRequires', () => {
    freezeClock(NOON_UTC);
    const schema = createPublicCheckInFormSchema(['travelWay']);
    const values = schema.parse({ guests: [validGuest({ travelWay: 'plane', tourismType: 'holiday' })] });

    const request = toPublicCheckInSubmitRequest(values, { statisticalFields: ['travelWay'] });

    expect(request.guests[0].travelWay).toBe('plane');
    expect(request.guests[0]).not.toHaveProperty('tourismType');
    expect(request.guests[0]).not.toHaveProperty('taxExemptionCode');
  });

  it('stayGuestFormSchema_IsTheSchemaWithNoStatisticalFieldRequired', () => {
    freezeClock(NOON_UTC);

    expect(stayGuestFormSchema.safeParse(validGuest()).success).toBe(true);
  });
});
