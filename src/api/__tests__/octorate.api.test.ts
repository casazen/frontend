import { beforeEach, describe, expect, it, vi } from 'vitest';
import { octorateApi } from '../octorate.api';
import { ApiClient } from '../client';
import type { OctorateConnection, OctorateConnectResult } from '@/types';

vi.mock('../client');

const CONNECTION: OctorateConnection = {
  status: 'Connected',
  environment: 'Test',
  accountId: 'network-1',
  lastSyncedAt: '2026-11-05T10:00:00Z',
  quotaLimit: 180,
  quotaRemaining: 120,
  quotaWarning: false,
};

const RESULT: OctorateConnectResult = { status: 'Connected', environment: 'Test', propertyCount: 3 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('octorateApi (E02/F01 endpoints of api/octorate)', () => {
  it('getConnectionStatus_ReadsTheConnectionOfTheOrg', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce(CONNECTION);

    const result = await octorateApi.getConnectionStatus();

    expect(ApiClient.get).toHaveBeenCalledWith('/octorate/connection');
    expect(result).toEqual(CONNECTION);
  });

  it('startConnect_AsksForANewConsentWithNothingToSend', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ authorizationUrl: 'https://consent.example.test/oauth' });

    const result = await octorateApi.startConnect();

    expect(ApiClient.post).toHaveBeenCalledWith('/octorate/connect/start');
    expect(result).toEqual({ authorizationUrl: 'https://consent.example.test/oauth' });
  });

  it('completeConnect_SendsTheCodeAndTheStateInTheBodyAndNeverInTheAddress', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce(RESULT);

    const result = await octorateApi.completeConnect('the-code', 'the-state');

    expect(ApiClient.post).toHaveBeenCalledWith('/octorate/connect/complete', { code: 'the-code', state: 'the-state' });
    // Single-use secrets: not in the URL, where a log or a history would keep them.
    const [url] = vi.mocked(ApiClient.post).mock.calls[0];
    expect(url).not.toContain('the-code');
    expect(url).not.toContain('the-state');
    expect(result).toEqual(RESULT);
  });

  it('disconnect_DeletesTheConnection', async () => {
    vi.mocked(ApiClient.delete).mockResolvedValueOnce(undefined);

    await octorateApi.disconnect();

    expect(ApiClient.delete).toHaveBeenCalledWith('/octorate/connection');
  });
});
