import { beforeEach, describe, expect, it } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import { AuthTokenUnavailableError } from '@/lib/api-errors';
import { reduceSiteConnectionError, SiteConnectionError } from '../site-connection-error';

// Made-up values: none of them is a code, a state or a credential of anyone.
function failure(status: number, data: unknown) {
  return new AxiosError(
    'Request failed',
    AxiosError.ERR_BAD_REQUEST,
    { headers: { Authorization: 'Bearer test-access-token' }, data: JSON.stringify({ state: 'test-state', codeChallenge: 'test-challenge' }) } as never,
    undefined,
    { status, statusText: 'Error', headers: {}, config: {}, data } as unknown as AxiosResponse,
  );
}

describe('reduceSiteConnectionError (PLG-FE-CONSOLE, NF-201, NF-203)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('reduce_AnAnswerWithACode_IsItsStatusItsCodeAndTheWordsOfThatCode', () => {
    const reduced = reduceSiteConnectionError(failure(404, { code: 'site_connection_not_found' }));

    expect(reduced).toBeInstanceOf(SiteConnectionError);
    expect(reduced.status).toBe(404);
    expect(reduced.code).toBe('site_connection_not_found');
    expect(reduced.userMessage).toBe(i18n.t('apiErrors.codes.siteConnectionNotFound'));
  });

  it.each([
    [429, 'apiErrors.tooManyRequests'],
    [403, 'apiErrors.forbidden'],
  ])('reduce_Status%s_HasTheWordsOfTheStatus', (status, key) => {
    expect(reduceSiteConnectionError(failure(status, {})).userMessage).toBe(i18n.t(key));
  });

  it('reduce_AServerFailure_HasNoWordsToShow_SoTheScreenUsesItsOwnSentence', () => {
    const reduced = reduceSiteConnectionError(failure(500, { detail: 'System.InvalidOperationException at Casazen.Web' }));

    expect(reduced.status).toBe(500);
    expect(reduced.userMessage).toBeUndefined();
  });

  it('reduce_NothingOfTheRequestSurvives_NotTheHeadersNotTheBodyNotTheStack', () => {
    const reduced = reduceSiteConnectionError(failure(400, { code: 'site_connection_invalid_request', echo: 'test-state' }));

    const everything = JSON.stringify(reduced, Object.getOwnPropertyNames(reduced));
    for (const secret of ['test-access-token', 'test-state', 'test-challenge', 'Authorization']) expect(everything).not.toContain(secret);
    expect(Object.keys(reduced).sort()).toEqual(['code', 'name', 'status', 'userMessage']);
    expect(reduced.cause).toBeUndefined();
  });

  it('reduce_NoAnswerAtAll_IsTheWordsOfAConnectionThatIsDown', () => {
    const reduced = reduceSiteConnectionError(new AxiosError('Network Error', AxiosError.ERR_NETWORK));

    expect(reduced.status).toBeUndefined();
    expect(reduced.userMessage).toBe(i18n.t('apiErrors.network'));
  });

  it('reduce_NoToken_IsTheWordsOfAnExpiredSession', () => {
    expect(reduceSiteConnectionError(new AuthTokenUnavailableError('login_required')).userMessage).toBe(i18n.t('apiErrors.sessionExpired'));
  });

  it('reduce_AnythingElse_HasNothingToShow', () => {
    const reduced = reduceSiteConnectionError(new TypeError('x is not a function'));

    expect(reduced).toBeInstanceOf(SiteConnectionError);
    expect(reduced.status).toBeUndefined();
    expect(reduced.code).toBeUndefined();
    expect(reduced.userMessage).toBeUndefined();
  });

  it('reduce_AnErrorAlreadyReduced_IsTheSameOne', () => {
    const reduced = new SiteConnectionError(400, 'site_connection_invalid_request', undefined);

    expect(reduceSiteConnectionError(reduced)).toBe(reduced);
  });
});
