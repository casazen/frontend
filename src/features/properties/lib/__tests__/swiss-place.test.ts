import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import type { SwissLocality } from '@/types/swiss-places.types';
import {
  fourDigitPostalCode,
  isSwissPlacesUnavailable,
  normalizeSwissName,
  proposeSwissPlace,
  swissLocalityKey,
  swissLocalityLabel,
} from '../swiss-place';

// Rows as `GET /api/swiss/localities` gives them. The BFS numbers of Lugano and Locarno are the official ones; the others are invented.
const locality = (postalCode: string, name: string, municipalityCode: string, municipalityName: string, cantonCode = 'TI'): SwissLocality => ({
  postalCode,
  name,
  municipalityCode,
  municipalityName,
  cantonCode,
});

const LUGANO = locality('6900', 'Lugano', '5192', 'Lugano');
const MASSAGNO = locality('6900', 'Massagno', '5189', 'Massagno');
const PARADISO = locality('6900', 'Paradiso', '5195', 'Paradiso');

function problem(status: number, code: string) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { status, title: 'Problem', code },
  } as AxiosResponse);
}

describe('fourDigitPostalCode', () => {
  it.each([
    ['6900', '6900'],
    ['CH-6900', '6900'],
    ['ch 6900', '6900'],
    ['CH6900', '6900'],
    ['6 900', '6900'],
    ['690000', '6900'],
    [' 1950 ', '1950'],
  ])('fourDigitPostalCode_%s_Is%s', (value, expected) => {
    expect(fourDigitPostalCode(value)).toBe(expected);
  });

  it.each(['', '   ', '69', '690', '20121', '0123', 'abcd', '6900X', 'CH-', '69001'])(
    'fourDigitPostalCode_NotAWholeSwissPostalCode_IsNull (%s)',
    (value) => {
      expect(fourDigitPostalCode(value)).toBeNull();
    },
  );

  it('fourDigitPostalCode_NothingTyped_IsNull', () => {
    expect(fourDigitPostalCode(undefined)).toBeNull();
    expect(fourDigitPostalCode(null)).toBeNull();
  });
});

describe('normalizeSwissName', () => {
  it('normalizeSwissName_CaseAccentsApostrophesAndSpaces_AreIgnored', () => {
    expect(normalizeSwissName('Zürich')).toBe('zurich');
    expect(normalizeSwissName('  Brè   sopra Lugano ')).toBe('bre sopra lugano');
    expect(normalizeSwissName('L’Auberson')).toBe("l'auberson");
  });

  it('normalizeSwissName_BlankOrMissing_IsEmpty', () => {
    expect(normalizeSwissName('   ')).toBe('');
    expect(normalizeSwissName(undefined)).toBe('');
    expect(normalizeSwissName(null)).toBe('');
  });

  it('normalizeSwissName_AbbreviationsStayDifferent', () => {
    expect(normalizeSwissName('San Vittore')).not.toBe(normalizeSwissName('S. Vittore'));
  });
});

describe('swissLocalityLabel and swissLocalityKey', () => {
  it('swissLocalityLabel_Locality_IsPostalCodeNameAndCanton', () => {
    expect(swissLocalityLabel(LUGANO)).toBe('6900 Lugano · TI');
  });

  it('swissLocalityKey_ALocalityInTwoMunicipalities_IsTwoKeys', () => {
    const inLocarno = locality('6600', 'Locarno', '5113', 'Locarno');
    const inMuralto = locality('6600', 'Locarno', '5115', 'Muralto');
    expect(swissLocalityKey(inLocarno)).not.toBe(swissLocalityKey(inMuralto));
  });
});

describe('proposeSwissPlace (the rules the server places a property by)', () => {
  it('proposeSwissPlace_NothingInTheDirectory_IsNone', () => {
    expect(proposeSwissPlace([], 'Lugano')).toEqual({ kind: 'none' });
  });

  it('proposeSwissPlace_OneMunicipality_IsProposedWhateverTheCity', () => {
    const viganello = locality('6962', 'Viganello', '5192', 'Lugano');
    expect(proposeSwissPlace([viganello], '')).toEqual({ kind: 'single', locality: viganello });
    expect(proposeSwissPlace([viganello], 'Altrove')).toEqual({ kind: 'single', locality: viganello });
  });

  it('proposeSwissPlace_SeveralMunicipalitiesAndNoCity_ChoosesNone', () => {
    // 6900 is Lugano, Massagno and Paradiso: the form lists them and the host chooses.
    expect(proposeSwissPlace([LUGANO, MASSAGNO, PARADISO], '')).toEqual({ kind: 'ambiguous', candidates: [LUGANO, MASSAGNO, PARADISO] });
    expect(proposeSwissPlace([LUGANO, MASSAGNO, PARADISO], '   ')).toEqual({ kind: 'ambiguous', candidates: [LUGANO, MASSAGNO, PARADISO] });
  });

  it.each([
    ['Lugano', LUGANO],
    ['  lugano ', LUGANO],
    ['MASSAGNO', MASSAGNO],
    ['Paradiso', PARADISO],
  ])('proposeSwissPlace_6900WithTheCity_%s_ProposesThatMunicipality', (city, expected) => {
    expect(proposeSwissPlace([LUGANO, MASSAGNO, PARADISO], city)).toEqual({ kind: 'single', locality: expected });
  });

  it('proposeSwissPlace_ACityThatIsNotACandidate_ChoosesNone', () => {
    expect(proposeSwissPlace([LUGANO, MASSAGNO, PARADISO], 'Comano').kind).toBe('ambiguous');
  });

  it('proposeSwissPlace_TheNameOfTheMunicipalityDecidesBeforeTheOneOfTheLocality', () => {
    // 6600 «Locarno» lies in Locarno and in Muralto: the city Locarno is the municipality of Locarno.
    const locarnoInLocarno = locality('6600', 'Locarno', '5113', 'Locarno');
    const locarnoInMuralto = locality('6600', 'Locarno', '5115', 'Muralto');
    const muralto = locality('6600', 'Muralto', '5115', 'Muralto');
    expect(proposeSwissPlace([locarnoInLocarno, locarnoInMuralto, muralto], 'Locarno')).toEqual({ kind: 'single', locality: locarnoInLocarno });
    expect(proposeSwissPlace([locarnoInLocarno, locarnoInMuralto, muralto], 'Muralto')).toEqual({ kind: 'single', locality: muralto });
  });

  it('proposeSwissPlace_APostalCodeInTwoCantons_IsNeverDecidedOnTheNameOfAMunicipality', () => {
    // 6533 lies in Lumino (TI) and in San Vittore (GR): the choice changes the legal regime, so a name that is both a locality
    // of the two municipalities decides nothing.
    const luminoInLumino = locality('6533', 'Lumino', '5099', 'Lumino', 'TI');
    const luminoInSanVittore = locality('6533', 'Lumino', '3834', 'San Vittore', 'GR');
    expect(proposeSwissPlace([luminoInLumino, luminoInSanVittore], 'Lumino').kind).toBe('ambiguous');
  });

  it('proposeSwissPlace_APostalCodeInTwoCantons_IsDecidedOnALocalityNamedInOneMunicipalityOnly', () => {
    const luminoInLumino = locality('6533', 'Lumino', '5099', 'Lumino', 'TI');
    const sanVittore = locality('6533', 'San Vittore', '3834', 'San Vittore', 'GR');
    expect(proposeSwissPlace([luminoInLumino, sanVittore], 'San Vittore')).toEqual({ kind: 'single', locality: sanVittore });
  });
});

describe('isSwissPlacesUnavailable', () => {
  it('isSwissPlacesUnavailable_The422OfADirectoryThatIsNotLoaded_IsTrue', () => {
    expect(isSwissPlacesUnavailable(problem(422, 'swiss_places_unavailable'))).toBe(true);
  });

  it('isSwissPlacesUnavailable_AnyOtherFailure_IsFalse', () => {
    expect(isSwissPlacesUnavailable(problem(404, 'swiss_municipality_unknown'))).toBe(false);
    expect(isSwissPlacesUnavailable(problem(422, 'swiss_municipality_not_applicable'))).toBe(false);
    expect(isSwissPlacesUnavailable(problem(500, 'swiss_places_unavailable'))).toBe(false);
    expect(isSwissPlacesUnavailable(new Error('network'))).toBe(false);
    expect(isSwissPlacesUnavailable(null)).toBe(false);
  });
});
