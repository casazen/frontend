import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { BillingSetup } from '@/types';
import { comuneNamesOf, italianTouristTaxOf, portalComuniFailureOf, portalComuniRequest } from '../billing-wizard-model';
import { emptySetup, italianSetup, section, setupOf, swissSetup } from './billing-fixtures';

const MILANO = { comuneIstat: '015146', comune: 'Milano', channel: 'Airbnb', status: 'to_confirm' };
const FIRENZE = { comuneIstat: '048017', comune: 'Firenze', channel: 'Airbnb', status: 'to_confirm' };
const MILANO_PAIR = { channel: 'Airbnb', comuneIstat: '015146' };
const FIRENZE_PAIR = { channel: 'Airbnb', comuneIstat: '048017' };
const COMO_PAIR = { channel: 'Airbnb', comuneIstat: '013075' };

/** An Italian setup whose section `touristTax` carries the given values (what the server sends for an Italian issuer). */
function withTouristTax(values: Record<string, unknown>): BillingSetup {
  return setupOf(italianSetup().sections.map((entry) => (entry.section === 'touristTax' ? section('touristTax', values, [], false) : entry)));
}

function refused(status: number | null, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  if (status === null) return new AxiosError('Network Error', 'ERR_NETWORK', config);
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, undefined, { status, statusText: '', headers: {}, config, data });
}

describe('italianTouristTaxOf: the proposals, the confirmed portals and the hint as the setup says them (FIX/FE-IT-TOURISTTAX-PROPOSALS)', () => {
  it('ItalianTouristTaxOf_ASetupWithoutTheMembers_SaysNothing_AnOlderServerOrACallerWhoReachesOnlySomeOfTheProperties', () => {
    // The section of an Italian issuer on an older server (or for a caller the server leaves the members out for), of a Swiss one, of an issuer with no country, and no setup at all.
    expect(italianTouristTaxOf(italianSetup())).toBeNull();
    expect(italianTouristTaxOf(withTouristTax({ defaultPlatformCollectedTouristTaxChannels: [] }))).toBeNull();
    expect(italianTouristTaxOf(swissSetup())).toBeNull();
    expect(italianTouristTaxOf(emptySetup())).toBeNull();
    expect(italianTouristTaxOf(setupOf([]))).toBeNull();
    expect(italianTouristTaxOf(undefined)).toBeNull();
  });

  it('ItalianTouristTaxOf_TheMembersOfTheServer_AreTheQuestionsTheConfirmedPairsAndTheHint', () => {
    const view = italianTouristTaxOf(
      withTouristTax({ italianPortalProposals: [MILANO, FIRENZE], confirmedPortalTouristTaxComuni: [COMO_PAIR], portalTouristTaxConflict: true }),
    );

    expect(view).toEqual({ proposals: [MILANO, FIRENZE], confirmed: [COMO_PAIR], conflict: true });
    // Without the hint it is false, and an empty answer is an answer: nothing to ask, nothing confirmed.
    expect(italianTouristTaxOf(withTouristTax({ italianPortalProposals: [], confirmedPortalTouristTaxComuni: [], portalTouristTaxConflict: false }))).toEqual({
      proposals: [],
      confirmed: [],
      conflict: false,
    });
  });

  it('ItalianTouristTaxOf_OnlyAProposalToConfirmIsAQuestion_OnceEach_AndNeverOneThatIsAlreadyConfirmed', () => {
    const view = italianTouristTaxOf(
      withTouristTax({
        italianPortalProposals: [
          MILANO,
          MILANO,
          { ...FIRENZE, status: 'confirmed' },
          { ...FIRENZE, comuneIstat: '058091', comune: 'Roma', status: 'something_new' },
          { comuneIstat: '', comune: 'Nowhere', channel: 'Airbnb', status: 'to_confirm' },
          { comuneIstat: '012345', comune: 'Varese', channel: '', status: 'to_confirm' },
          'odd',
          null,
          { ...FIRENZE, comune: '  Firenze ' },
          { comuneIstat: '013075', channel: 'Airbnb', status: 'to_confirm' },
        ],
        confirmedPortalTouristTaxComuni: [FIRENZE_PAIR],
      }),
    );

    // Milano once; Firenze is confirmed so it is no question; a status a newer server may add, an entry with no code or no portal, and what is not an entry, are not asked.
    expect(view?.proposals).toEqual([MILANO, { comuneIstat: '013075', comune: '', channel: 'Airbnb', status: 'to_confirm' }]);
  });

  // Data rule: an answer is the WHOLE list, so a list of confirmed portals that cannot be read in full must never be the base of one (it would take confirmations away).
  it.each([
    { name: 'absent', members: { italianPortalProposals: [MILANO] } },
    { name: 'not_a_list', members: { italianPortalProposals: [MILANO], confirmedPortalTouristTaxComuni: 'Airbnb' } },
    { name: 'with_an_entry_that_is_no_pair', members: { italianPortalProposals: [MILANO], confirmedPortalTouristTaxComuni: [MILANO_PAIR, { channel: 'Airbnb' }] } },
    { name: 'with_a_blank_code', members: { italianPortalProposals: [MILANO], confirmedPortalTouristTaxComuni: [{ channel: 'Airbnb', comuneIstat: '' }] } },
  ])('ItalianTouristTaxOf_ConfirmedPortalsThatCannotBeRead_OffersNothingToAnswerButStillTellsTheHint ($name)', ({ members }) => {
    const view = italianTouristTaxOf(withTouristTax({ ...members, portalTouristTaxConflict: true }));

    expect(view).toEqual({ proposals: [], confirmed: null, conflict: true });
  });

  it('ItalianTouristTaxOf_AHintThatIsNotTrue_IsNoHint', () => {
    for (const odd of [false, 'true', 1, null, undefined, {}]) {
      expect(italianTouristTaxOf(withTouristTax({ confirmedPortalTouristTaxComuni: [], portalTouristTaxConflict: odd }))?.conflict).toBe(false);
    }
  });
});

describe('portalComuniRequest: the body of a confirmation is the WHOLE list (data rule: the server replaces the list it had)', () => {
  it('PortalComuniRequest_AConfirmation_IsThePairsAlreadyConfirmedInTheirOrderPlusTheNewOne', () => {
    expect(portalComuniRequest([COMO_PAIR], { add: MILANO_PAIR })).toEqual({ comuni: [COMO_PAIR, MILANO_PAIR] });
    expect(portalComuniRequest([], { add: MILANO_PAIR })).toEqual({ comuni: [MILANO_PAIR] });
  });

  it('PortalComuniRequest_AConfirmationOfAPairThatIsAlreadyThere_ListsItOnce', () => {
    expect(portalComuniRequest([MILANO_PAIR, COMO_PAIR], { add: MILANO_PAIR })).toEqual({ comuni: [COMO_PAIR, MILANO_PAIR] });
  });

  it('PortalComuniRequest_ARemoval_IsTheListWithoutThatPair_AndTheLastOneIsAnEmptyList', () => {
    expect(portalComuniRequest([MILANO_PAIR, FIRENZE_PAIR, COMO_PAIR], { remove: FIRENZE_PAIR })).toEqual({ comuni: [MILANO_PAIR, COMO_PAIR] });
    expect(portalComuniRequest([MILANO_PAIR], { remove: MILANO_PAIR })).toEqual({ comuni: [] });
    // A portal and a comune are one pair: the same comune on another portal stays.
    expect(portalComuniRequest([MILANO_PAIR, { channel: 'BookingCom', comuneIstat: '015146' }], { remove: MILANO_PAIR })).toEqual({ comuni: [{ channel: 'BookingCom', comuneIstat: '015146' }] });
  });

  it('PortalComuniRequest_NeverCarriesMoreThanThePairs_AndDoesNotChangeTheListItIsGiven', () => {
    const confirmed = [{ ...MILANO_PAIR, extra: 'x' } as typeof MILANO_PAIR];
    const request = portalComuniRequest(confirmed, { add: { ...FIRENZE_PAIR, extra: 'y' } as typeof FIRENZE_PAIR });

    expect(request).toEqual({ comuni: [MILANO_PAIR, FIRENZE_PAIR] });
    expect(Object.keys(request.comuni[0]).sort()).toEqual(['channel', 'comuneIstat']);
    expect(confirmed).toHaveLength(1);
  });
});

describe('portalComuniFailureOf: what the answer of a failed confirmation says', () => {
  it.each([
    { name: '403WithTheReachCode', error: refused(403, { code: 'fiscal_settings_need_whole_org' }), failure: 'wholeOrg' },
    { name: '403WithAnotherCode', error: refused(403, { code: 'forbidden' }), failure: 'forbidden' },
    { name: '403WithNoBody', error: refused(403, ''), failure: 'forbidden' },
    { name: '422FieldInvalid', error: refused(422, { code: 'issuer_field_invalid', field: 'portalTouristTaxComuni' }), failure: 'invalid' },
    { name: '422ProfileIncomplete', error: refused(422, { code: 'issuer_profile_incomplete' }), failure: 'profile' },
    { name: '422WithAnotherCode', error: refused(422, { code: 'something_else' }), failure: 'failed' },
    { name: '400', error: refused(400, { code: 'issuer_field_invalid' }), failure: 'failed' },
    { name: '404', error: refused(404, {}), failure: 'failed' },
    { name: '500', error: refused(500, { code: 'fiscal_settings_need_whole_org' }), failure: 'failed' },
    { name: 'NoAnswer', error: refused(null), failure: 'failed' },
    { name: 'AnAnswerThatIsNotTheSection', error: new UnexpectedApiResponseError('/billing-setup/touristTax/portal-comuni'), failure: 'failed' },
    { name: 'SomethingThatIsNoErrorOfAxios', error: new Error('boom'), failure: 'failed' },
  ])('PortalComuniFailureOf_TheAnswer_IsTheFailureTheStepTells ($name: $failure)', ({ error, failure }) => {
    expect(portalComuniFailureOf(error)).toBe(failure);
  });
});

describe('comuneNamesOf: the name of a comune for a confirmed pair, and the code when nothing names it', () => {
  it('ComuneNamesOf_TheNameOfTheServerWins_ThenWhatWasAskedEarlier_ThenTheCityOfAProperty', () => {
    const properties = [
      { city: ' milano ', comuneIstatCode: '015146' },
      { city: 'Firenze', comuneIstatCode: '048017' },
      { city: 'Como', comuneIstatCode: null },
      { city: '', comuneIstatCode: '013075' },
      { city: 'Roma' },
    ];

    const names = comuneNamesOf(properties, [{ ...MILANO, comune: 'Milano' }, { ...FIRENZE, comune: '' }], new Map([['048017', 'Firenze (FI)'], ['058091', 'Roma Capitale']]));

    expect(names.get('015146')).toBe('Milano');
    // A proposal without a name leaves the name the step remembered, which beats the city a property carries.
    expect(names.get('048017')).toBe('Firenze (FI)');
    expect(names.get('058091')).toBe('Roma Capitale');
    // A property with no code, or with no city, names nothing: the caller shows the code.
    expect(names.has('013075')).toBe(false);
    expect(names.size).toBe(3);
  });

  it('ComuneNamesOf_APropertyThatNamesTheCode_NamesThePairWhoseProposalIsGone', () => {
    expect(comuneNamesOf([{ city: 'Milano', comuneIstatCode: '015146' }], []).get('015146')).toBe('Milano');
    expect(comuneNamesOf([], []).get('015146')).toBeUndefined();
  });
});
