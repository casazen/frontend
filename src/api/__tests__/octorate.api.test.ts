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

describe('octorateApi (E02/F01/US02 endpoints of the listings and their mapping)', () => {
  it('getFoundListings_ReadsWhatIsStoredWithoutAskingTheChannelManager', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce([]);

    await octorateApi.getFoundListings();

    expect(ApiClient.get).toHaveBeenCalledWith('/octorate/properties');
  });

  it('refreshListings_AsksToReadTheChannelManagerAgainWithNothingToSend', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce([]);

    await octorateApi.refreshListings();

    expect(ApiClient.post).toHaveBeenCalledWith('/octorate/properties/refresh');
  });

  it('confirmMapping_SendsThePropertyAndTheRoomOnlyWhenThereIsOne', async () => {
    vi.mocked(ApiClient.put).mockResolvedValue(undefined);

    await octorateApi.confirmMapping('acc-1', 'prop-1');
    await octorateApi.confirmMapping('acc-1', 'prop-1', 'room-2');

    expect(ApiClient.put).toHaveBeenNthCalledWith(1, '/octorate/mapping/acc-1', { propertyId: 'prop-1' });
    expect(ApiClient.put).toHaveBeenNthCalledWith(2, '/octorate/mapping/acc-1', { propertyId: 'prop-1', octorateProductId: 'room-2' });
  });

  it('mappingEndpoints_AnIdThatIsNotPlain_TravelsEncodedInThePath', async () => {
    vi.mocked(ApiClient.put).mockResolvedValue(undefined);
    vi.mocked(ApiClient.delete).mockResolvedValue(undefined);
    vi.mocked(ApiClient.post).mockResolvedValue({ propertyId: 'prop-9' });

    await octorateApi.confirmMapping('a/b c', 'prop-1');
    await octorateApi.rejectMapping('a/b c');
    await octorateApi.importListing('a/b c');

    expect(ApiClient.put).toHaveBeenCalledWith('/octorate/mapping/a%2Fb%20c', { propertyId: 'prop-1' });
    expect(ApiClient.delete).toHaveBeenCalledWith('/octorate/mapping/a%2Fb%20c');
    expect(ApiClient.post).toHaveBeenCalledWith('/octorate/mapping/a%2Fb%20c/import');
  });

  it('setMappingRoom_ChoosesTheRoomOfAListingThatIsConfirmed', async () => {
    vi.mocked(ApiClient.put).mockResolvedValueOnce(undefined);

    await octorateApi.setMappingRoom('acc-1', 'room-2');

    expect(ApiClient.put).toHaveBeenCalledWith('/octorate/mapping/acc-1/room', { octorateProductId: 'room-2' });
  });

  it('importListing_CreatesTheCasazenPropertyOnlyAndAnswersItsId', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ propertyId: 'prop-9' });

    const result = await octorateApi.importListing('acc-1');

    expect(ApiClient.post).toHaveBeenCalledWith('/octorate/mapping/acc-1/import');
    expect(result).toEqual({ propertyId: 'prop-9' });
  });
});
