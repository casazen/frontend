import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConcordatoFacileApi } from '../concordatofacile.api';
import { ApiClient } from '../client';

vi.mock('../client');

const leaseId = '2aeecf5b-b367-412e-a74d-e04bb8f28f16';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConcordatoFacileApi.createCheckout', () => {
  it('posts an empty JSON object: a POST with no body has no content type and the server answers 415', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ sessionId: 'cs_test_1', sessionUrl: 'https://checkout.stripe.com/c/pay/cs_test_1' });

    await ConcordatoFacileApi.createCheckout(leaseId);

    expect(ApiClient.post).toHaveBeenCalledWith(`/leases/${leaseId}/concordatofacile/checkout`, {});
  });
});

describe('ConcordatoFacileApi.sync', () => {
  it('posts nothing to the sync of the lease and gives back where it stands and its status', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ state: 'ReadingContract', leaseStatus: 'Draft' });

    await expect(ConcordatoFacileApi.sync(leaseId)).resolves.toEqual({ state: 'ReadingContract', leaseStatus: 'Draft' });

    expect(ApiClient.post).toHaveBeenCalledWith(`/leases/${leaseId}/concordatofacile/sync`);
  });

  it.each([null, 'ok', {}, { state: 'Completed' }, { leaseStatus: 'Registered' }, { state: 1, leaseStatus: 'Registered' }, { state: 'Completed', leaseStatus: 'Unknown' }])(
    'refuses an answer that is not the state and a status of a lease (%j)',
    async (answer) => {
      vi.mocked(ApiClient.post).mockResolvedValueOnce(answer);

      await expect(ConcordatoFacileApi.sync(leaseId)).rejects.toThrow(/Unexpected response body/);
    },
  );
});
