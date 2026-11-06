import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOON_UTC, freezeClock } from '@/test/clock';
import type {
  CheckInConfirmation,
  CheckInIssue,
  CheckInWizardGuest,
  CheckInWizardState,
  StayTouristTax,
} from '@/types/checkin-wizard.types';
import {
  documentsReadyToSave,
  documentsStepSchema,
  exemptionOf,
  formValuesFromReading,
  guestValuesFromWizard,
  guestsSignature,
  guestsStepSchema,
  initialStepOf,
  issueTarget,
  mergeReading,
  octorateResultKind,
  rateEffectiveFrom,
  sortedIssues,
  statisticalFieldsOf,
  stepOfGuestField,
  taxBreakdownOf,
  taxOutlook,
  toGuestsPayload,
  wizardValuesFromState,
} from '../lib/checkin-wizard-model';

function guest(position: number, overrides: Partial<CheckInWizardGuest> = {}): CheckInWizardGuest {
  return {
    saved: true,
    position,
    type: 'SingleGuest',
    firstName: 'Giulia',
    lastName: 'Bianchi',
    gender: 'Female',
    dateOfBirth: '1992-03-08T00:00:00',
    bornInItaly: true,
    birthComuneName: 'Firenze',
    birthProvince: 'FI',
    birthCountryName: '',
    citizenshipName: 'Italia',
    documentType: 'IdentityCard',
    documentNumberMasked: '*****5AB',
    documentIssuePlaceName: 'Firenze',
    dataSource: 'Host',
    ...overrides,
  };
}

function state(overrides: Partial<CheckInWizardState> = {}): CheckInWizardState {
  return {
    booking: {
      bookingId: 'b1',
      propertyId: 'p1',
      propertyName: 'Villa Demo',
      checkIn: '2026-10-10',
      checkOut: '2026-10-12',
      nights: 2,
      source: 'Manual',
      declaredGuests: 1,
      status: 'Confirmed',
    },
    attendance: 'Expected',
    guests: [guest(0)],
    requiredGuestFields: [],
    issues: [],
    tax: null,
    sender: { alloggiatiSender: 'ChannelManager', source: 'Stored', applies: true },
    octorate: { mirrored: true, guests: [], states: [] },
    alloggiati: { status: 'DaInviareManualmente', dataComplete: true, deadlineAt: '2026-10-11T00:00:00Z', isOverdue: false },
    capabilities: { documentReading: false, canRegisterArrival: false, canMarkNoShow: false, octorateTaxValues: false },
    suggestedStep: 'guests',
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('wizardValuesFromState', () => {
  it('wizardValuesFromState_SavedGuest_KeepsTheNewFieldsAndTheExemptionAsReceived', () => {
    const values = wizardValuesFromState(
      state({
        guests: [
          guest(0, {
            residenceInItaly: true,
            residenceComuneName: 'Roma',
            residenceProvince: 'RM',
            documentIssuedOn: '2020-05-10',
            documentExpiresOn: '2030-05-09',
            tourismType: 'holiday',
            taxExemptionCode: 'resident',
          }),
        ],
      }),
    );

    expect(values.guests).toHaveLength(1);
    expect(values.guests[0]).toMatchObject({
      residenceInItaly: 'yes',
      residenceComuneName: 'Roma',
      residenceProvince: 'RM',
      documentIssuedOn: '2020-05-10',
      documentExpiresOn: '2030-05-09',
      tourismType: 'holiday',
      taxExemptionCode: 'resident',
      dateOfBirth: '1992-03-08',
      // The API masks the number: the host types it again, the mask is a hint.
      documentNumber: '',
      documentNumberOnFile: '*****5AB',
    });
  });

  it('wizardValuesFromState_FewerGuestsThanDeclared_PadsWithMembersOfTheFirstGuestKind', () => {
    const values = wizardValuesFromState(
      state({ booking: { ...state().booking, declaredGuests: 3 }, guests: [guest(0, { type: 'HeadOfFamily' })] }),
    );

    expect(values.guests.map((g) => g.type)).toEqual(['HeadOfFamily', 'FamilyMember', 'FamilyMember']);
  });

  it('wizardValuesFromState_NoGuestYet_StartsWithOneToFill', () => {
    const values = wizardValuesFromState(state({ guests: [] }));

    expect(values.guests).toHaveLength(1);
    expect(values.guests[0].type).toBe('SingleGuest');
  });

  it('guestValuesFromWizard_NoExemptionVisible_IsEmpty', () => {
    // A caller without `guest.read` gets null: nothing to echo.
    expect(guestValuesFromWizard(guest(0, { taxExemptionCode: null })).taxExemptionCode).toBe('');
  });
});

describe('initialStepOf', () => {
  it.each([
    ['guests', 'guests'],
    ['documents', 'documents'],
    ['checks', 'checks'],
    ['tax', 'tax'],
    ['send', 'send'],
  ] as const)('initialStepOf_Suggested_%s_OpensThatStep', (suggested, step) => {
    expect(initialStepOf(state({ suggestedStep: suggested }))).toBe(step);
  });

  it('initialStepOf_NothingLeftToDo_OpensTheLastStepWhereTheHostCanConfirmAgain', () => {
    expect(initialStepOf(state({ suggestedStep: 'result' }))).toBe('send');
  });
});

describe('what a save sends', () => {
  it('toGuestsPayload_HostEntry_SendsTheExemptionBackAsItCame', () => {
    const values = wizardValuesFromState(state({ guests: [guest(0, { taxExemptionCode: 'host_family' })] }));

    expect(toGuestsPayload(values, [])[0].taxExemptionCode).toBe('host_family');
  });

  it('toGuestsPayload_ExemptionTheHostRemoved_IsSentAsNullSoTheServerClearsIt', () => {
    const values = wizardValuesFromState(state({ guests: [guest(0, { taxExemptionCode: 'host_family' })] }));
    values.guests[0].taxExemptionCode = '';

    expect(toGuestsPayload(values, [])[0].taxExemptionCode).toBeNull();
  });

  it('guestsSignature_TaxExemptionChange_IsNotAChangeOfTheGuests', () => {
    const values = wizardValuesFromState(state());
    const before = guestsSignature(values, []);
    values.guests[0].taxExemptionCode = 'resident';

    expect(guestsSignature(values, [])).toBe(before);
  });

  it('guestsSignature_AFieldTyped_IsAChange', () => {
    const values = wizardValuesFromState(state());
    const before = guestsSignature(values, []);
    values.guests[0].firstName = 'Anna';

    expect(guestsSignature(values, [])).not.toBe(before);
  });

  it('exemptionOf_OneGuest_SendsOnlyThatPositionAndAnEmptyChoiceClearsIt', () => {
    expect(exemptionOf(1, 'resident')).toEqual([{ position: 1, code: 'resident' }]);
    expect(exemptionOf(0, '')).toEqual([{ position: 0, code: null }]);
  });
});

describe('the rules of the steps', () => {
  it('guestsStepSchema_GuestWithoutDocument_IsValid_TheDocumentIsTheNextStep', () => {
    freezeClock(NOON_UTC);
    const values = wizardValuesFromState(state());

    expect(guestsStepSchema([]).safeParse(values).success).toBe(true);
    expect(documentsReadyToSave(values)).toBe(false);
  });

  it('documentsReadyToSave_NumberTyped_IsTrue', () => {
    freezeClock(NOON_UTC);
    const values = wizardValuesFromState(state());
    values.guests[0].documentNumber = 'CA12345AB';

    expect(documentsReadyToSave(values)).toBe(true);
  });

  it('documentsStepSchema_NothingChanged_DoesNotAskForANumberThatIsOnlyOnFile', () => {
    freezeClock(NOON_UTC);
    const values = wizardValuesFromState(state());

    expect(documentsStepSchema(() => true).safeParse(values).success).toBe(true);
  });

  it('documentsStepSchema_SomethingChanged_AsksForTheNumberOnTheDocumentField', () => {
    freezeClock(NOON_UTC);
    const values = wizardValuesFromState(state());
    const result = documentsStepSchema(() => false).safeParse(values);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['guests.0.documentNumber']);
  });

  it('statisticalFieldsOf_RegionRequirement_IsReadFromTheState', () => {
    expect(statisticalFieldsOf(state({ requiredGuestFields: ['TravelWay'] }))).toEqual(['travelWay']);
  });
});

describe('the checks', () => {
  const issues: CheckInIssue[] = [
    { position: 0, code: 'document_expired', field: 'documentExpiresOn', blocking: false },
    { position: 0, code: 'guest_field_missing', field: 'birthComune', blocking: true },
    { position: null, code: 'guests_count_mismatch', field: null, blocking: false },
    { position: 1, code: 'octorate_field_missing', field: 'residence', blocking: true },
  ];

  it('sortedIssues_BlockingFirstThenWarnings_EachGroupInTheOrderOfTheServer', () => {
    expect(sortedIssues(issues).map((issue) => `${issue.code}:${issue.position}`)).toEqual([
      'guest_field_missing:0',
      'octorate_field_missing:1',
      'document_expired:0',
      'guests_count_mismatch:null',
    ]);
  });

  it.each([
    [{ position: 0, field: 'firstName' }, { step: 'guests', fieldId: 'guest-0-firstName' }],
    [{ position: 2, field: 'birthComune' }, { step: 'guests', fieldId: 'guest-2-birthComuneName' }],
    [{ position: 1, field: 'residence' }, { step: 'guests', fieldId: 'guest-1-residenceInItaly' }],
    [{ position: 1, field: 'residenceComune' }, { step: 'guests', fieldId: 'guest-1-residenceComuneName' }],
    [{ position: 0, field: 'citizenship' }, { step: 'guests', fieldId: 'guest-0-citizenshipName' }],
    [{ position: 0, field: 'tourismType' }, { step: 'guests', fieldId: 'guest-0-tourismType' }],
    [{ position: 0, field: 'documentNumber' }, { step: 'documents', fieldId: 'guest-0-documentNumber' }],
    [{ position: 0, field: 'documentIssuePlace' }, { step: 'documents', fieldId: 'guest-0-documentIssuePlaceName' }],
    [{ position: 0, field: 'documentExpiresOn' }, { step: 'documents', fieldId: 'guest-0-documentExpiresOn' }],
    [{ position: null, field: null }, { step: 'guests', fieldId: null }],
    [{ position: null, field: 'guests' }, { step: 'guests', fieldId: null }],
    [{ position: 0, field: 'somethingNew' }, { step: 'guests', fieldId: null }],
  ] as const)('issueTarget_%j_Opens%j', (issue, target) => {
    expect(issueTarget(issue)).toEqual(target);
  });

  it('stepOfGuestField_DocumentFieldsBelongToTheDocumentsStep', () => {
    expect(stepOfGuestField('documentNumber')).toBe('documents');
    expect(stepOfGuestField('documentIssuedOn')).toBe('documents');
    expect(stepOfGuestField('firstName')).toBe('guests');
    expect(stepOfGuestField('residenceComuneName')).toBe('guests');
  });
});

describe('the reading of a document photo', () => {
  it('formValuesFromReading_MrzFields_BecomeFormValuesAndLeaveOutWhatIsNotRead', () => {
    const values = formValuesFromReading({
      documentType: 'P',
      surname: 'BIANCHI',
      givenNames: 'GIULIA',
      documentNumber: 'ca 12345 ab',
      dateOfBirth: '1992-03-08',
      expirationDate: '2031-04-02',
      sex: 'F',
      nationality: 'ITA',
      issuingState: 'ITA',
    });

    expect(values).toEqual({
      lastName: 'BIANCHI',
      firstName: 'GIULIA',
      gender: 'Female',
      dateOfBirth: '1992-03-08',
      documentType: 'Passport',
      documentNumber: 'CA12345AB',
      documentExpiresOn: '2031-04-02',
    });
    expect(formValuesFromReading(null)).toEqual({});
    expect(formValuesFromReading({ documentNumber: 'X1' })).toEqual({ documentNumber: 'X1' });
  });

  it('mergeReading_EmptyFieldIsFilled_DifferentTypedValueIsAConflict_SameValueIsNothing', () => {
    const current = {
      firstName: '',
      lastName: 'Bianchi',
      gender: 'Female',
      dateOfBirth: '1992-03-08',
      documentType: '',
      documentNumber: 'AB1',
      documentExpiresOn: '',
    };
    const merge = mergeReading(current, {
      firstName: 'Giulia',
      lastName: 'BIANCHI',
      gender: 'Male',
      dateOfBirth: '1992-03-08',
      documentNumber: 'CA12345AB',
    });

    expect(merge.filled).toEqual(['firstName']);
    expect(merge.conflicts).toEqual([
      { field: 'gender', typed: 'Female', read: 'Male' },
      { field: 'documentNumber', typed: 'AB1', read: 'CA12345AB' },
    ]);
  });
});

describe('the result and the tax', () => {
  const octorate = (state: CheckInConfirmation['octorate']['state'], reason: string | null = null): CheckInConfirmation['octorate'] => ({
    state,
    reason,
    draft: false,
    correctionAfterSend: false,
    guests: [],
  });

  it.each([
    [octorate('Sent'), 'sent'],
    [octorate('NothingToSend'), 'nothingToSend'],
    [octorate('Failed'), 'failed'],
    [octorate('PartlyFailed'), 'partlyFailed'],
    [octorate('NotApplicable', 'sender_not_channel_manager'), 'senderNotChannelManager'],
    [octorate('NotApplicable', 'booking_not_active'), 'notActive'],
    [octorate('NotMirrored', 'not_connected'), 'notConnected'],
  ] as const)('octorateResultKind_%j_Is%s', (outcome, kind) => {
    expect(octorateResultKind(outcome)).toBe(kind);
  });

  const tax = (overrides: Partial<StayTouristTax> = {}): StayTouristTax => ({
    bookingId: 'b1',
    status: 'Calculated',
    rateSource: 'Official',
    missingRate: false,
    nights: 4,
    taxableNights: 4,
    ageRulesApply: true,
    categories: [],
    total: 12,
    amountDue: 12,
    collector: 'Host',
    collectorSource: 'Default',
    collectorNeeded: false,
    guests: [
      { position: 0, nights: 4, taxableNights: 3, amount: 6, exemptionKind: 'None' },
      { position: 1, nights: 4, taxableNights: 3, amount: 6, exemptionKind: 'None' },
      { position: 2, nights: 4, taxableNights: 0, amount: 0, exemptionKind: 'Age' },
      { position: 3, nights: 4, taxableNights: 0, amount: 0, exemptionKind: 'Host', exemptionCode: 'resident' },
    ],
    reasons: [],
    stale: false,
    ...overrides,
  });

  it('taxOutlook_EveryCase_NeverShowsZeroWhenTheRateIsMissing', () => {
    expect(taxOutlook(null)).toBe('none');
    expect(taxOutlook(tax())).toBe('toCollect');
    expect(taxOutlook(tax({ collector: 'Channel', amountDue: 0 }))).toBe('collectedByChannel');
    expect(taxOutlook(tax({ collector: null, collectorNeeded: true }))).toBe('collectorNeeded');
    expect(taxOutlook(tax({ missingRate: true, status: 'RateUnavailable', total: null, amountDue: null }))).toBe('missingRate');
    expect(taxOutlook(tax({ status: 'ChildAgesRequired', total: null }))).toBe('notCalculable');
  });

  it('taxBreakdownOf_Stay_NightsGuestsExemptRateCapAndTotal', () => {
    const breakdown = taxBreakdownOf(tax());

    expect(breakdown).toEqual({
      nights: 4,
      guests: 4,
      exemptGuests: 2,
      payingGuests: 2,
      taxableNights: 3,
      capApplied: true,
      perPersonPerNight: 2,
      total: 12,
    });
  });

  it('taxBreakdownOf_NoCapAndDifferentAmounts_HasNoUniformRate', () => {
    const breakdown = taxBreakdownOf(
      tax({
        guests: [
          { position: 0, nights: 2, taxableNights: 2, amount: 4, exemptionKind: 'None' },
          { position: 1, nights: 2, taxableNights: 2, amount: 6, exemptionKind: 'None' },
        ],
      }),
    );

    expect(breakdown.capApplied).toBe(false);
    expect(breakdown.perPersonPerNight).toBeNull();
  });
});

describe('the first day of a rate the host declares', () => {
  it('rateEffectiveFrom_StayAlreadyBegun_StartsOnTheCheckInSoTheStayHasARate', () => {
    expect(rateEffectiveFrom(undefined, '2026-10-10', '2026-11-06')).toBe('2026-10-10');
  });

  it('rateEffectiveFrom_StayStillToCome_StartsToday', () => {
    expect(rateEffectiveFrom(null, '2026-12-01', '2026-11-06')).toBe('2026-11-06');
  });

  it('rateEffectiveFrom_RateAlreadyDeclared_KeepsItsDaySoEarlierNightsStayCovered', () => {
    expect(rateEffectiveFrom('2026-09-01', '2026-10-10', '2026-11-06')).toBe('2026-09-01');
    // The day comes back from the API as a date; a time after it changes nothing.
    expect(rateEffectiveFrom('2026-09-01T00:00:00', '2026-12-01', '2026-11-06')).toBe('2026-09-01');
  });

  it('rateEffectiveFrom_RateDeclaredAfterTheCheckIn_GoesBackToTheCheckIn', () => {
    expect(rateEffectiveFrom('2026-11-01', '2026-10-10', '2026-11-06')).toBe('2026-10-10');
  });
});
