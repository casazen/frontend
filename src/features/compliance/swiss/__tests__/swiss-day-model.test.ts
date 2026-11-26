import { describe, expect, it } from 'vitest';
import {
  certaintyOf,
  copyAllTextOf,
  dayStateOf,
  documentKindOf,
  fieldsOf,
  firstStepOf,
  guestNameOf,
  isFutureDay,
  missingKeysOf,
  portalLinkOf,
  regimeTextKey,
  stepStateOf,
  swissDateOf,
} from '../swiss-day-model';
import { SWISS_PROPERTY_ID, declaredSwissDay, swissDay, swissGuest } from './swiss-fixtures';
import { SWISS_LAYER_KIND, parseSwissLayerId, swissLayerPath } from '../swiss-layer-address';

const WORD = { passport: 'Passaporto', identityCard: "Carta d'identità", other: 'Altro' } as const;

describe('the steps of the assisted notification (E31/F02/US02/T02, NF-131)', () => {
  it('stepStateOf_ACompleteDay_HasTheGuestsDoneAndTheOtherTwoStepsToDo', () => {
    const day = swissDay();

    expect(stepStateOf('guests', day)).toBe('done');
    expect(stepStateOf('portal', day)).toBe('todo');
    expect(stepStateOf('declare', day)).toBe('todo');
    expect(firstStepOf(day)).toBe('guests');
  });

  it('stepStateOf_AGuestThatMissesDataOrNobodyListed_NeedsAttentionOnTheGuestsStep', () => {
    const missing = swissDay({ issues: [{ bookingId: 'b', position: 0, guestName: 'Mario Rossi', missing: ['birthDate'] }] });

    expect(stepStateOf('guests', missing)).toBe('attention');
    expect(stepStateOf('guests', swissDay({ guests: [] }))).toBe('attention');
  });

  it('stepStateOf_ADeclaredDay_HasEveryStepDoneAndOpensOnTheDeclaration', () => {
    const day = declaredSwissDay();

    expect((['guests', 'portal', 'declare'] as const).map((step) => stepStateOf(step, day))).toEqual(['done', 'done', 'done']);
    expect(firstStepOf(day)).toBe('declare');
    expect(dayStateOf(day)).toBe('declared');
  });

  it('dayStateOf_NoStayOrAnOpenDay_IsToldApart', () => {
    expect(dayStateOf(swissDay({ stayCount: 0, guests: [] }))).toBe('none');
    expect(dayStateOf(swissDay())).toBe('open');
  });

  it('isFutureDay_ADayThatHasNotStartedInSwitzerland_CannotBeDeclared', () => {
    // 23:30 UTC of the 19th is already the 20th in Zurich.
    expect(isFutureDay({ day: '2026-11-20' }, new Date('2026-11-19T20:30:00Z'))).toBe(true);
    expect(isFutureDay({ day: '2026-11-20' }, new Date('2026-11-19T23:30:00Z'))).toBe(false);
    expect(isFutureDay({ day: '2026-11-19' }, new Date('2026-11-19T20:30:00Z'))).toBe(false);
  });
});

describe('the guests as fields to copy', () => {
  it('fieldsOf_AGuestWithEverything_ListsEveryFieldInTheOrderThePortalsAskThem', () => {
    const fields = fieldsOf(swissGuest(), (kind) => WORD[kind]);

    expect(fields.map((field) => field.id)).toEqual([
      'lastName',
      'firstName',
      'birthDate',
      'placeOfBirth',
      'nationality',
      'nationalityCode',
      'documentType',
      'documentNumber',
      'street',
      'postalCode',
      'city',
      'residenceCountryCode',
      'plate',
      'arrival',
      'departure',
    ]);
    // Dates as the Swiss write them, the document as a word, the rest as it was recorded.
    expect(Object.fromEntries(fields.map((field) => [field.id, field.value]))).toMatchObject({
      birthDate: '04.01.1984',
      arrival: '19.11.2026',
      departure: '22.11.2026',
      documentType: 'Passaporto',
      documentNumber: 'YA1234567',
      nationalityCode: 'ITA',
    });
  });

  it('fieldsOf_AFieldTheCheckInDidNotRecord_IsLeftOutAndNeverMadeUp', () => {
    const fields = fieldsOf(
      swissGuest({ birthDate: null, placeOfBirth: '  ', documentType: null, documentNumber: null, street: null, postalCode: null, city: null, residenceCountryCode: null, plate: null, nationalityCode: null }),
      (kind) => WORD[kind],
    );

    expect(fields.map((field) => field.id)).toEqual(['lastName', 'firstName', 'nationality', 'arrival', 'departure']);
  });

  it('documentKindOf_AKindThisVersionDoesNotKnow_IsOtherAndNeverTheRawValue', () => {
    expect(documentKindOf('passport')).toBe('passport');
    expect(documentKindOf('identityCard')).toBe('identityCard');
    expect(documentKindOf('driversLicense')).toBe('other');
    expect(documentKindOf(null)).toBeNull();
    expect(documentKindOf(' ')).toBeNull();
    const fields = fieldsOf(swissGuest({ documentType: 'driversLicense' }), (kind) => WORD[kind]);
    expect(fields.find((field) => field.id === 'documentType')?.value).toBe('Altro');
  });

  it('copyAllTextOf_AGuest_IsOneLineForEachField', () => {
    const fields = fieldsOf(swissGuest(), (kind) => WORD[kind]).slice(0, 3);

    expect(copyAllTextOf(fields, (id) => `<${id}>`)).toBe('<lastName>: Rossi\n<firstName>: Mario\n<birthDate>: 04.01.1984');
  });

  it('guestNameOf_AGuestWithNoName_IsTheFallback', () => {
    expect(guestNameOf(swissGuest(), 'Ospite 1')).toBe('Mario Rossi');
    expect(guestNameOf(swissGuest({ firstName: null, lastName: ' ' }), 'Ospite 1')).toBe('Ospite 1');
  });

  it.each([
    ['2026-11-19', '19.11.2026'],
    ['2026-11-19T00:00:00Z', '19.11.2026'],
    ['not a day', 'not a day'],
  ])('swissDateOf_%s_Is_%s', (day, expected) => {
    expect(swissDateOf(day)).toBe(expected);
  });
});

describe('what the day says of the canton', () => {
  it('portalLinkOf_OnlyAnHttpsAddress_IsALink', () => {
    expect(portalLinkOf({ portalUrl: 'https://gast.sh.ch/meldung' })).toEqual({ href: 'https://gast.sh.ch/meldung', host: 'gast.sh.ch' });
    for (const portalUrl of [null, '', '  ', 'http://gast.sh.ch', 'javascript:alert(1)', 'not a url']) expect(portalLinkOf({ portalUrl }), String(portalUrl)).toBeNull();
  });

  it('certaintyOf_ACertaintyThisVersionDoesNotKnow_IsTheMostPrudentOne', () => {
    expect(certaintyOf({ certainty: 'Verified' })).toBe('Verified');
    expect(certaintyOf({ certainty: 'Maybe' as never })).toBe('Unverified');
  });

  it('regimeTextKey_AMemberThisVersionDoesNotKnow_IsToCheckWithTheMunicipalityOrThePolice', () => {
    expect(regimeTextKey('channel', 'PortalForm')).toBe('guestRegistration.channel.PortalForm');
    expect(regimeTextKey('deadline', 'Weekly')).toBe('guestRegistration.deadline.Weekly');
    expect(regimeTextKey('channel', 'Pigeon')).toBe('guestRegistration.toVerify');
    expect(regimeTextKey('deadline', undefined)).toBe('guestRegistration.toVerify');
  });

  it('missingKeysOf_ACodeThisVersionHasNoWordsFor_IsLeftOut', () => {
    expect(missingKeysOf(['birthDate', 'shoeSize', 'documentType'])).toEqual(['swissNotification.issues.missing.birthDate', 'swissNotification.issues.missing.documentType']);
  });
});

describe('the address of the layer of the assisted notification', () => {
  it('swissLayerPath_APropertyAndADay_IsTheCockpitWithTheLayerOpenOnThatDay', () => {
    expect(swissLayerPath(SWISS_PROPERTY_ID, '2026-11-19')).toBe(`/app/short-rent/compliance?detail=${SWISS_LAYER_KIND}:${SWISS_PROPERTY_ID}:2026-11-19`);
    expect(swissLayerPath(SWISS_PROPERTY_ID)).toBe(`/app/short-rent/compliance?detail=${SWISS_LAYER_KIND}:${SWISS_PROPERTY_ID}`);
    expect(parseSwissLayerId(`${SWISS_PROPERTY_ID}:2026-11-19`)).toEqual({ propertyId: SWISS_PROPERTY_ID, day: '2026-11-19' });
    expect(parseSwissLayerId(SWISS_PROPERTY_ID)).toEqual({ propertyId: SWISS_PROPERTY_ID });
  });

  it('swissLayerPath_ADayThatIsNotADay_IsLeftOutAndTheLayerOpensOnTheFirstDayToNotify', () => {
    for (const day of ['2026-11', '2026-02-31', '2026-11-19/../x', '', null]) {
      expect(swissLayerPath(SWISS_PROPERTY_ID, day), String(day)).toBe(swissLayerPath(SWISS_PROPERTY_ID));
    }
    expect(parseSwissLayerId(`${SWISS_PROPERTY_ID}:2026-02-31`)).toEqual({ propertyId: SWISS_PROPERTY_ID });
  });

  it.each(['../admin', 'a:b:c:d', '', 'x'.repeat(65)])('parseSwissLayerId_%s_IsNotAnIdOfThisLayer', (id) => {
    expect(parseSwissLayerId(id)).toBeNull();
  });

  it('swissLayerPath_NoPropertyAnAddressCanHold_IsTheCockpitAlone', () => {
    expect(swissLayerPath(null)).toBe('/app/short-rent/compliance');
    expect(swissLayerPath('../admin', '2026-11-19')).toBe('/app/short-rent/compliance');
  });
});
