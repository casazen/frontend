import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../client';
import { gdprApi } from '../gdpr.api';

vi.mock('../client');
beforeEach(() => vi.clearAllMocks());

describe('guest GDPR API contract (#145)', () => {
  it('reads the summary and returns the exported data without discarding fields', async () => {
    const exported = { version: 1, guest: { id: 'guest-1' } };
    vi.mocked(ApiClient.get).mockResolvedValue(exported);
    await gdprApi.getSummary('guest-1');
    expect(ApiClient.get).toHaveBeenCalledWith('/gdpr/guests/guest-1');
    expect(await gdprApi.exportData('guest-1')).toBe(exported);
    expect(ApiClient.get).toHaveBeenCalledWith('/gdpr/guests/guest-1/export');
  });

  it('encodes the erasure reason as a single query value', async () => {
    await gdprApi.deleteData('guest-1', 'Richiesta ospite & motivo=altro');
    expect(ApiClient.delete).toHaveBeenCalledWith('/gdpr/guests/guest-1?reason=Richiesta%20ospite%20%26%20motivo%3Daltro');
  });

  it('anonymizes and only withdraws marketing consent on a documented request', async () => {
    await gdprApi.anonymizeData('guest-1');
    await gdprApi.withdrawMarketingConsent('guest-1', 'Email del 20 ottobre');
    expect(ApiClient.post).toHaveBeenCalledWith('/gdpr/guests/guest-1/anonymize');
    expect(ApiClient.put).toHaveBeenCalledWith('/gdpr/guests/guest-1/consent', { marketingConsent: false, note: 'Email del 20 ottobre' });
  });

  it('preserves a cross-org 404 for the UI to handle', async () => {
    const error = { response: { status: 404 } };
    vi.mocked(ApiClient.get).mockRejectedValueOnce(error);
    await expect(gdprApi.exportData('other-org-guest')).rejects.toBe(error);
  });
});
