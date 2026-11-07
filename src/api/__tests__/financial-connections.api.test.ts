import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from '../client';
import { financialConnectionsApi, transferAwaitingConfirmation, transferPath } from '../financial-connections.api';

vi.mock('../client');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('financialConnectionsApi', () => {
  it('createSession_PostsTheSessionPath', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ clientSecret: 'fcsess_secret', publishableKey: 'pk_test' });

    await expect(financialConnectionsApi.createSession()).resolves.toEqual({
      clientSecret: 'fcsess_secret',
      publishableKey: 'pk_test',
    });
    expect(ApiClient.post).toHaveBeenCalledWith('/stripe/financial-connections/session', {});
  });

  it('listAccounts_ReadsTheLinkedAccounts', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce({
      accounts: [{ id: 'fca_1', institutionName: 'Banca', last4: '6789', displayName: null }],
    });

    await expect(financialConnectionsApi.listAccounts()).resolves.toEqual([
      { id: 'fca_1', institutionName: 'Banca', last4: '6789', displayName: null },
    ]);
    expect(ApiClient.get).toHaveBeenCalledWith('/stripe/financial-connections/accounts');
  });

  it('startTransfer_PostsTheDueWithAmountAndReference', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ id: 'tr_1', status: 'Processing' });

    const result = await financialConnectionsApi.startTransfer(
      'lease/1',
      'due 1',
      { financialConnectionsAccountId: 'fca_1', amount: 1050, reference: 'CZ-2026-11-ABC' },
      'key-1',
    );

    expect(transferPath('lease/1', 'due 1')).toBe('/leases/lease%2F1/dues/due%201/stripe-transfer');
    expect(ApiClient.post).toHaveBeenCalledWith(
      '/leases/lease%2F1/dues/due%201/stripe-transfer',
      { financialConnectionsAccountId: 'fca_1', amount: 1050, reference: 'CZ-2026-11-ABC' },
      { headers: { 'Idempotency-Key': 'key-1' } },
    );
    expect(result).toEqual({ id: 'tr_1', status: 'Processing' });
  });

  it.each([undefined, {}, { accounts: 'no' }, { clientSecret: 'x' }])(
    'listAccounts_BodyThatIsNotTheList_IsALoadError (%j)',
    async (body) => {
      vi.mocked(ApiClient.get).mockResolvedValueOnce(body);
      await expect(financialConnectionsApi.listAccounts()).rejects.toBeInstanceOf(UnexpectedApiResponseError);
    },
  );

  it('aPaidAnswerStillWaitsForTheDueItself', () => {
    expect(transferAwaitingConfirmation('Paid')).toBe(true);
    expect(transferAwaitingConfirmation('Processing')).toBe(true);
    expect(transferAwaitingConfirmation('Failed')).toBe(false);
    expect(transferAwaitingConfirmation('Cancelled')).toBe(false);
  });
});
