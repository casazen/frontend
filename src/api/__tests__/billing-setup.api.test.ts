import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { canChangeBillingSetup } from '../billing-setup.api';
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
