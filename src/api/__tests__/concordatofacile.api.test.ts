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
