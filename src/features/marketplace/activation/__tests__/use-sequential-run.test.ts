import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, isAxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { problemCodeOf } from '../activation-wizard-model';
import { withoutRequest } from '../use-sequential-run';

const SECRET = 'Pa$$-4711-secret';

function failedStart(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), data: JSON.stringify({ kind: 'Channel', username: 'host', password: SECRET }) } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, {}, { status, data, statusText: 'Bad Gateway', headers: {}, config });
}

function holds(value: unknown, secret: string, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return value.includes(secret);
  if (typeof value !== 'object' || value === null || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((item) => holds(item, secret, seen));
}

describe('the failure of a run that carried the access data of a portal', () => {
  it('withoutRequest_ErrorOfAxios_KeepsWhatTheScreenReadsAndNotTheRequestThatFailed', () => {
    const original = failedStart(502, { code: 'octorate_partner_failed' });
    expect(holds(original, SECRET)).toBe(true);

    const kept = withoutRequest(original);

    expect(holds(kept, SECRET)).toBe(false);
    expect(isAxiosError(kept)).toBe(true);
    expect(isAxiosError(kept) && kept.response?.status).toBe(502);
    expect(problemCodeOf(kept)).toBe('octorate_partner_failed');
    expect(isAxiosError(kept) && getProblemCode(kept.response?.data)).toBe('octorate_partner_failed');
    expect(getProblemMessage(kept, (key: string) => `«${key}»`)).toBe('«apiErrors.codes.octoratePartnerFailed»');
  });

  it('withoutRequest_ErrorWithNoAnswer_KeepsItsKindSoANetworkFailureIsStillOne', () => {
    const config = { headers: new AxiosHeaders(), data: JSON.stringify({ password: SECRET }) } as InternalAxiosRequestConfig;
    const original = new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);

    const kept = withoutRequest(original);

    expect(holds(kept, SECRET)).toBe(false);
    expect(isAxiosError(kept) && kept.code).toBe(AxiosError.ERR_NETWORK);
    expect(isAxiosError(kept) && kept.response).toBeUndefined();
  });

  it.each([401, 403])('withoutRequest_AnonymousCallRefusedWith%i_StaysAnonymousSoItIsNeverASessionThatExpired', (status) => {
    const config = { headers: new AxiosHeaders(), public: true, data: JSON.stringify({ password: SECRET }) } as InternalAxiosRequestConfig;
    const original = new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: undefined, statusText: '', headers: {}, config });
    const words = (key: string) => `«${key}»`;
    const signedIn = withoutRequest(failedStart(status, undefined));
    expect(getProblemMessage(signedIn, words)).toBe(status === 401 ? '«apiErrors.sessionExpired»' : '«apiErrors.forbidden»');

    const kept = withoutRequest(original);

    expect(holds(kept, SECRET)).toBe(false);
    expect(isAxiosError(kept) && kept.config?.public).toBe(true);
    expect(isAxiosError(kept) && kept.response?.status).toBe(status);
    expect(getProblemMessage(kept, words)).toBeUndefined();
  });

  it('withoutRequest_ErrorThatIsNotOneOfAxios_IsGivenBackAsItIs', () => {
    const other = new Error('no token');

    expect(withoutRequest(other)).toBe(other);
    expect(withoutRequest('text')).toBe('text');
  });
});
