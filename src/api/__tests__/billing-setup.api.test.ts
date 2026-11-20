import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { canChangeBillingSetup, confirmPortalTouristTaxComuni } from '../billing-setup.api';
import { ApiClient } from '../client';

vi.mock('../client');
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

/** The section the server answers a save that carries no field: the section as it is. */
const ISSUER_SECTION = { section: 'issuer', applies: true, complete: false, values: { countryCode: 'IT' }, missing: [{ key: 'legal_name_missing', section: 'issuer', reason: 'required' }] };

function refused(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, undefined, { status, statusText: '', headers: {}, config, data });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Permission rule: the setup is the organization's, and nothing of it says whose reach the person has. The wizard learns it the one way the server answers it, with a save that
// carries no field (the server changes nothing for it, and refuses with 403 `fiscal_settings_need_whole_org` before it reads anything when the reach is only some of the properties).
describe('canChangeBillingSetup: whether the reach of the person is the whole organization (E11/F02/US01/T01)', () => {
  it('CanChangeBillingSetup_AnswersYesWhenTheServerAnswersTheSectionAndSendsNoFieldAtAll', async () => {
    vi.mocked(ApiClient.put).mockResolvedValueOnce(ISSUER_SECTION);

    await expect(canChangeBillingSetup()).resolves.toBe(true);

    // One save to the issuer section with an empty body: it reads and writes nothing of the setup.
    expect(ApiClient.put).toHaveBeenCalledTimes(1);
    expect(ApiClient.put).toHaveBeenCalledWith('/billing-setup/issuer', {});
    expect(ApiClient.get).not.toHaveBeenCalled();
  });

  it('CanChangeBillingSetup_TheRefusalThatNamesTheWholeOrganization_IsAnAnswerAndTheAnswerIsNo', async () => {
    vi.mocked(ApiClient.put).mockRejectedValueOnce(refused(403, { code: 'fiscal_settings_need_whole_org', status: 403 }));

    await expect(canChangeBillingSetup()).resolves.toBe(false);
  });

  it.each([
    ['a 403 with another code', refused(403, { code: 'forbidden' })],
    ['a 403 with no body', refused(403, undefined)],
    ['a 403 of the onboarding gate', refused(403, { code: 'onboarding_required' })],
    ['a 404 (the issuance is off)', refused(404, {})],
    ['a 422', refused(422, { code: 'issuer_field_invalid' })],
    ['a 500', refused(500, { code: 'fiscal_settings_need_whole_org' })],
    ['a network error', new AxiosError('Network Error', 'ERR_NETWORK')],
    ['something that is not an axios error', new Error('boom')],
  ])('CanChangeBillingSetup_%s_IsNotAnAnswerSoItIsTheCallersToShowAndNeverANo', async (_case, error) => {
    vi.mocked(ApiClient.put).mockRejectedValueOnce(error);

    await expect(canChangeBillingSetup()).rejects.toBe(error);
  });

  it('CanChangeBillingSetup_ABodyThatIsNotASection_IsAFailedReadAndNeverAYes', async () => {
    // The `index.html` of the SPA behind a wrong rewrite is a 200 with no section in it.
    vi.mocked(ApiClient.put).mockResolvedValueOnce('<!doctype html><html></html>');

    await expect(canChangeBillingSetup()).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});

/** The section `touristTax` the server answers a confirmation with: the pairs as saved, with the questions that are left. */
const TOURIST_TAX_SECTION = {
  section: 'touristTax',
  applies: false,
  complete: true,
  values: {
    italianPortalProposals: [{ comuneIstat: '048017', comune: 'Firenze', channel: 'Airbnb', status: 'to_confirm' }],
    confirmedPortalTouristTaxComuni: [{ comuneIstat: '015146', channel: 'Airbnb' }],
    portalTouristTaxConflict: false,
  },
  missing: [],
};

// Data rule: the confirmation of a portal in a comune is the WHOLE list of the pairs (the server replaces the list it had), sent to the endpoint of the comuni, and what the server answers
// is the section as saved. An answer that is not that section is a failure: the person would be told «confirmed» for something nobody saved.
describe('confirmPortalTouristTaxComuni: the portals that collect the tourist tax in a comune (FIX/FE-IT-TOURISTTAX-PROPOSALS)', () => {
  const REQUEST = { comuni: [{ channel: 'Airbnb', comuneIstat: '015146' }] };

  it('ConfirmPortalTouristTaxComuni_SendsTheWholeListToTheEndpointOfTheComuni_AndAnswersTheSectionAsSaved', async () => {
    vi.mocked(ApiClient.put).mockResolvedValueOnce(TOURIST_TAX_SECTION);

    await expect(confirmPortalTouristTaxComuni(REQUEST)).resolves.toEqual(TOURIST_TAX_SECTION);

    expect(ApiClient.put).toHaveBeenCalledTimes(1);
    expect(ApiClient.put).toHaveBeenCalledWith('/billing-setup/touristTax/portal-comuni', REQUEST);
  });

  it('ConfirmPortalTouristTaxComuni_AnEmptyList_IsSentAsAnEmptyList', async () => {
    // It takes every confirmation away: the list is sent, never left out (a request without it is a 422).
    vi.mocked(ApiClient.put).mockResolvedValueOnce({ ...TOURIST_TAX_SECTION, values: { ...TOURIST_TAX_SECTION.values, confirmedPortalTouristTaxComuni: [] } });

    await confirmPortalTouristTaxComuni({ comuni: [] });

    expect(ApiClient.put).toHaveBeenCalledWith('/billing-setup/touristTax/portal-comuni', { comuni: [] });
  });

  it.each([
    ['a page of HTML (the SPA behind a wrong rewrite)', '<!doctype html><html></html>'],
    ['no body', undefined],
    ['a list', []],
    ['a section with no list of the confirmed portals', { ...TOURIST_TAX_SECTION, values: { italianPortalProposals: [] } }],
    ['a list of the confirmed portals that is not a list', { ...TOURIST_TAX_SECTION, values: { confirmedPortalTouristTaxComuni: 'Airbnb' } }],
    ['the section of another step', { ...TOURIST_TAX_SECTION, section: 'issuer' }],
  ])('ConfirmPortalTouristTaxComuni_%s_IsAFailureAndNeverASuccess', async (_case, body) => {
    vi.mocked(ApiClient.put).mockResolvedValueOnce(body);

    await expect(confirmPortalTouristTaxComuni(REQUEST)).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it.each([
    ['403 of the reach', refused(403, { code: 'fiscal_settings_need_whole_org' })],
    ['403 of the role', refused(403, undefined)],
    ['422 of a field', refused(422, { code: 'issuer_field_invalid' })],
    ['422 of a profile that does not exist yet', refused(422, { code: 'issuer_profile_incomplete' })],
    ['500', refused(500, {})],
  ])('ConfirmPortalTouristTaxComuni_%s_IsGivenBackAsItIsForTheCallerToTell', async (_case, error) => {
    vi.mocked(ApiClient.put).mockRejectedValueOnce(error);

    await expect(confirmPortalTouristTaxComuni(REQUEST)).rejects.toBe(error);
  });
});
