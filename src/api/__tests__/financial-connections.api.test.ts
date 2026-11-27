import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from '../client';
import { bankLinkApi, rentBankLinkPath, transferAwaitingConfirmation } from '../financial-connections.api';

vi.mock('../client');

const account = { linked: true, accountId: 'fca_1', institutionName: 'Banca', last4: '6789', displayName: null };
const started = {
  paymentId: 'pay-1',
  paymentIntentId: 'pi_1',
  clientSecret: 'pi_secret',
  stripeStatus: 'processing',
  paymentMethodType: 'us_bank_account',
  dueSettled: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bankLinkApi', () => {
  it('createOrgSession_PostsTheOrgSessionPath', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ sessionId: 'fcsess_1', clientSecret: 'fcsess_secret' });

    await expect(bankLinkApi.createOrgSession()).resolves.toEqual({
      sessionId: 'fcsess_1',
      clientSecret: 'fcsess_secret',
      publishableKey: null,
    });
    expect(ApiClient.post).toHaveBeenCalledWith('/orgs/me/bank-links/sessions', {});
  });

  it('getOrgAccount_ReadsTheLinkedAccountWithoutAnIban', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce(account);

    await expect(bankLinkApi.getOrgAccount()).resolves.toEqual(account);
    expect(ApiClient.get).toHaveBeenCalledWith('/orgs/me/bank-links');
  });

  it('attachOrgAccount_PostsTheFinancialConnectionsId', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce(account);

    await bankLinkApi.attachOrgAccount('fca_1');

    expect(ApiClient.post).toHaveBeenCalledWith('/orgs/me/bank-links', { accountId: 'fca_1' });
  });

  it('startOrgPayment_PostsTheUsdDueAndKeepsItUnsettled', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce(started);

    const result = await bankLinkApi.startOrgPayment(
      { amountCents: 105000, currency: 'eur', leaseId: 'lease-1', installmentId: 'due-1' },
      'key-1',
    );

    expect(ApiClient.post).toHaveBeenCalledWith(
      '/orgs/me/bank-links/payments',
      { amountCents: 105000, currency: 'eur', leaseId: 'lease-1', installmentId: 'due-1' },
      { headers: { 'Idempotency-Key': 'key-1' } },
    );
    expect(result.dueSettled).toBe(false);
    expect(transferAwaitingConfirmation(result)).toBe(true);
    expect(transferAwaitingConfirmation({ stripeStatus: 'succeeded' })).toBe(true);
    expect(transferAwaitingConfirmation({ stripeStatus: 'canceled' })).toBe(false);
  });

  it('rentPayment_UsesThePublicBankLinkPathsAndTheToken', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ sessionId: 'fcsess_1', clientSecret: 'fcsess_secret' });
    await bankLinkApi.createRentSession('due 1', 'tok');
    expect(ApiClient.post).toHaveBeenCalledWith(rentBankLinkPath('due 1', 'session'), { token: 'tok' }, { public: true });

    vi.mocked(ApiClient.post).mockResolvedValueOnce(account);
    await bankLinkApi.attachRentAccount('due 1', 'tok', 'fca_1');
    expect(ApiClient.post).toHaveBeenCalledWith(rentBankLinkPath('due 1'), { token: 'tok', accountId: 'fca_1' }, { public: true });

    vi.mocked(ApiClient.post).mockResolvedValueOnce(started);
    await bankLinkApi.startRentPayment('due 1', 'tok', 'key-1');
    expect(rentBankLinkPath('due 1', 'payment')).toBe('/public/rent-payments/due%201/bank-link/payment');
    expect(ApiClient.post).toHaveBeenCalledWith(
      '/public/rent-payments/due%201/bank-link/payment',
      { token: 'tok' },
      { public: true, headers: { 'Idempotency-Key': 'key-1' } },
    );
  });

  it.each([undefined, {}, { linked: 'yes' }])('getOrgAccount_BodyThatIsNotTheAccount_IsALoadError (%j)', async (body) => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce(body);
    await expect(bankLinkApi.getOrgAccount()).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});
