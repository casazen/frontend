import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, isAxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { problemCodeOf } from '../activation-wizard-model';
import { withoutRequest } from '../use-sequential-run';

const SECRET = 'Pa$$-4711-secret';

/** The error of axios for a request that carried the access data of a portal: the request that failed is in `config.data`, on the error and on its answer. */
function failedStart(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), data: JSON.stringify({ kind: 'Channel', username: 'host', password: SECRET }) } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, {}, { status, data, statusText: 'Bad Gateway', headers: {}, config });
}

/** True when `secret` is anywhere in `value`, in any text of it, however deep. */
function holds(value: unknown, secret: string, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return value.includes(secret);
  if (typeof value !== 'object' || value === null || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((item) => holds(item, secret, seen));
}

describe('the failure of a run that carried the access data of a portal', () => {
  it('withoutRequest_ErrorOfAxios_KeepsWhatTheScreenReadsAndNotTheRequestThatFailed', () => {
    const original = failedStart(502, { code: 'octorate_partner_failed' });
    // The test is a real one: the secret is in what axios gives.
    expect(holds(original, SECRET)).toBe(true);

    const kept = withoutRequest(original);

    expect(holds(kept, SECRET)).toBe(false);
    expect(isAxiosError(kept)).toBe(true);
    // What a screen turns into words is still there: the status, the code of the answer and the message of the code.
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

  it('withoutRequest_ErrorThatIsNotOneOfAxios_IsGivenBackAsItIs', () => {
    const other = new Error('no token');

    expect(withoutRequest(other)).toBe(other);
    expect(withoutRequest('text')).toBe('text');
  });
});
