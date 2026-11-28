import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NO_SWISS_RULES,
  createPublicCheckInFormSchema,
  createStayGuestListSchema,
  createStayGuestsFormSchema,
  documentLevelsOf,
  hostVehiclePlateOf,
  isValidVehiclePlate,
  normalizeVehiclePlate,
  notifiedGuestIndexes,
  stayGuestDefaults,
  swissRulesOf,
  toPublicCheckInSubmitRequest,
  toStayGuestSubmit,
  toStayGuestSubmits,
  type StayGuestFormValues,
} from '../schemas/checkin.schema';
import { NOON_UTC, freezeClock } from '@/test/clock';

const ARRIVAL = '2026-10-10';

const TICINO_FIELDS = ['DocumentType', 'DocumentNumber', 'ResidenceStreet', 'ResidencePostalCode', 'ResidenceCityName', 'ResidenceCountryName'];

const ticino = swissRulesOf(TICINO_FIELDS, ARRIVAL);

/** A guest who passes every rule of the Alloggiati record (the day is the 24th of September 2026, noon UTC). */
function guest(overrides: Partial<StayGuestFormValues> = {}): StayGuestFormValues {
  return {
    ...stayGuestDefaults('SingleGuest'),
    firstName: 'Giulia',
    lastName: 'Bianchi',
    gender: 'Female',
    dateOfBirth: '1990-03-08',
    bornInItaly: 'no',
    birthCountryName: 'Svizzera',
    citizenshipName: 'Svizzera',
    documentType: 'Passport',
    documentNumber: 'X1234567',
    documentIssuePlaceName: 'Zurigo',
    ...overrides,
  };
}

function member(overrides: Partial<StayGuestFormValues> = {}): StayGuestFormValues {
  return guest({
    type: 'FamilyMember',
    firstName: 'Marco',
    documentType: '',
    documentNumber: '',
    documentIssuePlaceName: '',
    ...overrides,
  });
}

function issuesOf(guests: StayGuestFormValues[], swiss = ticino) {
  const result = createStayGuestListSchema([], 'all', swiss).safeParse(guests);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('swissRulesOf', () => {
  it('swissRulesOf_ApiNamesOfTheTicinoList_AreReadWhicheverTheCase', () => {
    expect([...ticino.asked].sort()).toEqual(
      ['documentNumber', 'documentType', 'residenceCityName', 'residenceCountryName', 'residencePostalCode', 'residenceStreet'],
    );
    expect([...swissRulesOf(['documentNumber', 'residenceStreet'], ARRIVAL).asked].sort()).toEqual(['documentNumber', 'residenceStreet']);
    expect(ticino.arrivalDate).toBe(ARRIVAL);
  });

  it('swissRulesOf_NothingOrOnlyStatisticalFields_IsNotASwissStay', () => {
    expect(swissRulesOf(undefined, ARRIVAL).asked.size).toBe(0);
    expect(swissRulesOf([], ARRIVAL).asked.size).toBe(0);
    expect(swissRulesOf(['TourismType', 'TravelWay'], ARRIVAL).asked.size).toBe(0);
  });
});

describe('notifiedGuestIndexes (the rule of the Swiss police file)', () => {
  it('notifiedGuestIndexes_AdultsAndAMinor_NotifiesTheAdultsOnly', () => {
    const guests = [guest({ type: 'HeadOfFamily' }), member(), member({ dateOfBirth: '2015-05-05' })];

    expect([...notifiedGuestIndexes(guests, ARRIVAL)]).toEqual([0, 1]);
  });

  it('notifiedGuestIndexes_AGuestOfEighteenOnTheArrivalDay_IsAnAdult', () => {
    const turnsEighteen = member({ dateOfBirth: '2008-10-10' });
    const dayBefore = member({ dateOfBirth: '2008-10-11' });

    expect([...notifiedGuestIndexes([guest({ type: 'HeadOfFamily' }), turnsEighteen, dayBefore], ARRIVAL)]).toEqual([0, 1]);
  });

  it('notifiedGuestIndexes_StayOfMinorsOnly_NotifiesEveryMinor', () => {
    const guests = [guest({ dateOfBirth: '2009-01-01' }), guest({ dateOfBirth: '2011-01-01' })];

    expect([...notifiedGuestIndexes(guests, ARRIVAL)]).toEqual([0, 1]);
  });

  it('notifiedGuestIndexes_GroupOfSixOrMore_NotifiesTheLeaderOnly', () => {
    const group = [guest({ type: 'HeadOfGroup' }), ...Array.from({ length: 5 }, () => member({ type: 'GroupMember' }))];

    expect([...notifiedGuestIndexes(group, ARRIVAL)]).toEqual([0]);
  });

  it('notifiedGuestIndexes_GroupOfFive_KeepsTheRuleOfTheAdults', () => {
    const group = [guest({ type: 'HeadOfGroup' }), ...Array.from({ length: 4 }, () => member({ type: 'GroupMember' }))];

    expect([...notifiedGuestIndexes(group, ARRIVAL)]).toEqual([0, 1, 2, 3, 4]);
  });

  it('notifiedGuestIndexes_SixGuestsThatAreNotOneGroup_KeepTheRuleOfTheAdults', () => {
    const guests = [
      guest({ type: 'HeadOfGroup' }),
      guest({ type: 'HeadOfGroup' }),
      ...Array.from({ length: 4 }, () => member({ type: 'GroupMember' })),
    ];

    expect(notifiedGuestIndexes(guests, ARRIVAL).size).toBe(6);
  });

  it('notifiedGuestIndexes_NoDateOfBirthOrNoArrival_AsksNobodyYet', () => {
    expect(notifiedGuestIndexes([guest({ dateOfBirth: '' })], ARRIVAL).size).toBe(0);
    expect(notifiedGuestIndexes([guest()], undefined).size).toBe(0);
  });
});

describe('documentLevelsOf', () => {
  it('documentLevelsOf_ItalianStay_IsTheDocumentOfTheHeadOnly', () => {
    const guests = [guest({ type: 'HeadOfFamily' }), member(), member({ dateOfBirth: '2015-05-05' })];

    expect(documentLevelsOf(guests)).toEqual(['full', null, null]);
    expect(documentLevelsOf(guests, NO_SWISS_RULES)).toEqual(['full', null, null]);
  });

  it('documentLevelsOf_SwissStay_AdultMembersGiveTypeAndNumberAndMinorsNothing', () => {
    const guests = [guest({ type: 'HeadOfFamily' }), member(), member({ dateOfBirth: '2015-05-05' })];

    expect(documentLevelsOf(guests, ticino)).toEqual(['full', 'basic', null]);
  });

  it('documentLevelsOf_SwissRegimeWithoutTheDocument_KeepsTheRuleOfTheHead', () => {
    const homeOnly = swissRulesOf(['ResidenceStreet'], ARRIVAL);

    expect(documentLevelsOf([guest({ type: 'HeadOfFamily' }), member()], homeOnly)).toEqual(['full', null]);
  });
});

describe('the list schema of a Swiss stay (NF-132)', () => {
  it('createStayGuestListSchema_SwissAdultMemberWithoutDocument_IsAskedItsTypeAndNumber', () => {
    freezeClock(NOON_UTC);

    expect(issuesOf([guest({ type: 'HeadOfFamily' }), member()])).toEqual([
      '1.documentType: checkin.validation.documentType.required',
      '1.documentNumber: checkin.validation.documentNumber.required',
    ]);
  });

  it('createStayGuestListSchema_ItalianStay_NeverAsksTheDocumentOfAMember', () => {
    freezeClock(NOON_UTC);

    expect(issuesOf([guest({ type: 'HeadOfFamily' }), member()], NO_SWISS_RULES)).toEqual([]);
  });

  it('createStayGuestListSchema_SwissMemberWithTypeAndNumber_NeedsNeitherPlaceNorDates', () => {
    freezeClock(NOON_UTC);
    const complete = member({ documentType: 'IdentityCard', documentNumber: 'ca 12345 ab' });

    expect(issuesOf([guest({ type: 'HeadOfFamily' }), complete])).toEqual([]);
  });

  it('createStayGuestListSchema_SwissMinorMember_IsNotAskedADocument', () => {
    freezeClock(NOON_UTC);

    expect(issuesOf([guest({ type: 'HeadOfFamily' }), member({ dateOfBirth: '2015-05-05' })])).toEqual([]);
  });

  it('createStayGuestListSchema_PersonalScope_LeavesTheMembersDocumentToTheNextStep', () => {
    freezeClock(NOON_UTC);
    const list = [guest({ type: 'HeadOfFamily', documentNumber: '' }), member()];

    expect(createStayGuestListSchema([], 'personal', ticino).safeParse(list).success).toBe(true);
    expect(createStayGuestListSchema([], 'document', ticino).safeParse(list).success).toBe(false);
  });

  it('createStayGuestListSchema_HomeOfTheGuest_IsNeverRequiredOnlyItsLengthsAreChecked', () => {
    freezeClock(NOON_UTC);

    expect(issuesOf([guest()])).toEqual([]);
    expect(issuesOf([guest({ residenceStreet: 'x'.repeat(201) })])).toEqual(['0.residenceStreet: checkin.validation.residenceStreet.maxLength']);
    expect(issuesOf([guest({ residencePostalCode: '1'.repeat(21) })])).toEqual([
      '0.residencePostalCode: checkin.validation.residencePostalCode.maxLength',
    ]);
    expect(issuesOf([guest({ residenceCityName: 'x'.repeat(101) })])).toEqual(['0.residenceCityName: checkin.validation.label.maxLength']);
  });

  it('createPublicCheckInFormSchema_SwissMemberNumber_HasToLookLikeADocumentNumberToo', () => {
    freezeClock(NOON_UTC);
    const schema = createPublicCheckInFormSchema([], ticino);
    const implausible = member({ documentType: 'IdentityCard', documentNumber: 'AB' });

    const refused = schema.safeParse({ guests: [guest({ type: 'HeadOfFamily' }), implausible] });
    const accepted = schema.safeParse({ guests: [guest({ type: 'HeadOfFamily' }), { ...implausible, documentNumber: 'AB1234' }] });

    expect(refused.success).toBe(false);
    expect(refused.error?.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)).toContain(
      'guests.1.documentNumber: checkin.documentNumberPlausibility',
    );
    expect(accepted.success).toBe(true);
  });
});

describe('the plate of the car (NF-132)', () => {
  it('normalizeVehiclePlate_SpacesAndCase_AreTheApisToNormalize', () => {
    expect(normalizeVehiclePlate(' ti 123 456 ')).toBe('TI123456');
    expect(normalizeVehiclePlate('   ')).toBe('');
  });

  it.each(['TI 123 456', 'ZH-123456', 'MÜ AB 12', 'A', ''])('isValidVehiclePlate_%j_IsAPlateOrNone', (plate) => {
    expect(isValidVehiclePlate(plate)).toBe(true);
  });

  it.each(['!!!', '---', 'TI/123', 'A'.repeat(21)])('isValidVehiclePlate_%j_IsNotAPlate', (plate) => {
    expect(isValidVehiclePlate(plate)).toBe(false);
  });

  it('createStayGuestsFormSchema_PlateOfTheHost_IsCheckedWhenTyped', () => {
    freezeClock(NOON_UTC);
    const schema = createStayGuestsFormSchema([], ticino);
    const guests = [guest()];

    expect(schema.safeParse({ guests }).success).toBe(true);
    expect(schema.safeParse({ guests, vehiclePlate: '' }).success).toBe(true);
    expect(schema.safeParse({ guests, vehiclePlate: 'ti 123 456' }).success).toBe(true);
    const refused = schema.safeParse({ guests, vehiclePlate: 'no/plate' });
    expect(refused.success).toBe(false);
    expect(refused.error?.issues[0]).toMatchObject({ path: ['vehiclePlate'], message: 'checkin.validation.vehiclePlate.invalid' });
  });

  it('hostVehiclePlateOf_FormWithoutAPlate_SendsNothingSoTheStoredOneStays', () => {
    expect(hostVehiclePlateOf({})).toBeUndefined();
    expect(hostVehiclePlateOf({ vehiclePlate: ' ti 123 ' })).toBe('TI123');
    expect(hostVehiclePlateOf({ vehiclePlate: '' })).toBe('');
  });
});

describe('what the requests send (NF-132)', () => {
  it('toStayGuestSubmit_SwissStay_AlwaysSendsTheHomeAnEmptyOneAsNull', () => {
    const filled = toStayGuestSubmit(
      guest({ residenceStreet: ' Via Nassa 5 ', residencePostalCode: '6900', residenceCityName: ' Lugano ' }),
      { swiss: ticino },
    );
    const empty = toStayGuestSubmit(guest(), { swiss: ticino });

    expect(filled).toMatchObject({ residenceStreet: 'Via Nassa 5', residencePostalCode: '6900', residenceCityName: 'Lugano' });
    expect(empty.residenceStreet).toBeNull();
    expect(empty.residencePostalCode).toBeNull();
    expect(empty.residenceCityName).toBeNull();
  });

  it('toStayGuestSubmit_ItalianStay_HasNoKeyOfTheHomeAtAll', () => {
    const body = toStayGuestSubmit(guest());

    expect(body).not.toHaveProperty('residenceStreet');
    expect(body).not.toHaveProperty('residencePostalCode');
    expect(body).not.toHaveProperty('residenceCityName');
  });

  it('toStayGuestSubmit_HostEntryHoldingTheHome_SendsItBackWhateverTheRegimeSays', () => {
    const held = guest({ residenceStreet: 'Via Nassa 5', residenceCityName: 'Lugano' });

    const host = toStayGuestSubmit(held, { keepResidenceAddress: true });
    expect(host).toMatchObject({ residenceStreet: 'Via Nassa 5', residenceCityName: 'Lugano' });
    expect(host).not.toHaveProperty('residencePostalCode');
    expect(toStayGuestSubmit(held)).not.toHaveProperty('residenceStreet');
  });

  it('toStayGuestSubmits_SwissAdultMember_SendsItsDocumentAndAnItalianMemberDoesNot', () => {
    const family = [guest({ type: 'HeadOfFamily' }), member({ documentType: 'IdentityCard', documentNumber: 'ca 12345 ab', documentIssuePlaceName: '' })];

    const swiss = toStayGuestSubmits(family, { swiss: ticino });
    const italian = toStayGuestSubmits(family);

    expect(swiss[1]).toMatchObject({ documentType: 'IdentityCard', documentNumber: 'CA12345AB' });
    expect(italian[1]).toMatchObject({ documentType: null, documentNumber: null });
  });

  it('toStayGuestSubmits_SwissMinorMember_SendsNoDocument', () => {
    const family = [guest({ type: 'HeadOfFamily' }), member({ dateOfBirth: '2015-05-05', documentNumber: 'XX999' })];

    expect(toStayGuestSubmits(family, { swiss: ticino })[1]).toMatchObject({ documentType: null, documentNumber: null });
  });

  it('toStayGuestSubmit_StateOfResidenceChosenAbroad_IsSentWithItsCode', () => {
    const body = toStayGuestSubmit(
      guest({ residenceInItaly: 'no', residenceCountryName: 'SVIZZERA', residenceCountryCode: '100000236', residenceComuneName: 'Roma' }),
      { swiss: ticino },
    );

    expect(body).toMatchObject({ residenceInItaly: false, residenceCountryName: 'SVIZZERA', residenceCountryCode: '100000236', residenceComuneName: null });
  });

  it('toPublicCheckInSubmitRequest_PlateTyped_IsSentNormalizedAndNotTypedIsNotSent', () => {
    freezeClock(NOON_UTC);
    const schema = createPublicCheckInFormSchema([], ticino);
    const withPlate = schema.parse({ guests: [guest()], vehiclePlate: ' ti 123 456 ' });
    const without = schema.parse({ guests: [guest()], vehiclePlate: '  ' });
    const never = schema.parse({ guests: [guest()] });

    expect(toPublicCheckInSubmitRequest(withPlate, { swiss: ticino }).vehiclePlate).toBe('TI123456');
    expect(toPublicCheckInSubmitRequest(without, { swiss: ticino })).not.toHaveProperty('vehiclePlate');
    expect(toPublicCheckInSubmitRequest(never)).not.toHaveProperty('vehiclePlate');
  });

  it('stayGuestDefaults_HomeOnFile_IsPutBackInTheFormSoASaveDoesNotClearIt', () => {
    const values = stayGuestDefaults('SingleGuest', {
      type: 'SingleGuest',
      firstName: 'Giulia',
      lastName: 'Bianchi',
      birthComuneName: '',
      birthCountryName: '',
      citizenshipName: '',
      documentIssuePlaceName: '',
      residenceStreet: 'Via Nassa 5',
      residencePostalCode: '6900',
      residenceCityName: 'Lugano',
    });

    expect(values).toMatchObject({ residenceStreet: 'Via Nassa 5', residencePostalCode: '6900', residenceCityName: 'Lugano' });
    expect(stayGuestDefaults('SingleGuest')).toMatchObject({ residenceStreet: '', residencePostalCode: '', residenceCityName: '' });
  });
});
