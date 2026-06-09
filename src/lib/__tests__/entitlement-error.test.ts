import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { isPlanLimitError } from '../entitlement-error';

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const error = new AxiosError('request failed');
  error.response = {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

describe('isPlanLimitError (#202 AC12)', () => {
  it('is true for a 403 with code plan_limit_reached', () => {
    expect(isPlanLimitError(axiosErrorWith(403, { code: 'plan_limit_reached' }))).toBe(true);
  });

  it('is true for a 409 race with code plan_limit_reached', () => {
    expect(isPlanLimitError(axiosErrorWith(409, { code: 'plan_limit_reached' }))).toBe(true);
  });

  it('is false for a 403 that is not a plan-limit (e.g. missing permission)', () => {
    expect(isPlanLimitError(axiosErrorWith(403, { code: 'no_org_context' }))).toBe(false);
  });

  it('is false for a 400 validation error even if the code matches', () => {
    expect(isPlanLimitError(axiosErrorWith(400, { code: 'plan_limit_reached' }))).toBe(false);
  });

  it('is false for non-axios errors', () => {
    expect(isPlanLimitError(new Error('boom'))).toBe(false);
    expect(isPlanLimitError(null)).toBe(false);
    expect(isPlanLimitError(undefined)).toBe(false);
  });
});
