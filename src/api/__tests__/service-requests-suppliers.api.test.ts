import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMarketplaceSuppliers } from '../service-requests.api';
import { ApiClient } from '../client';

vi.mock('../client');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ApiClient.get).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 0 });
});

describe('fetchMarketplaceSuppliers (SP-REL): the order of the list', () => {
  it('does not ask for the ranking by name: it is the order of the server, and an old server would answer 400 to it', async () => {
    await fetchMarketplaceSuppliers({ propertyId: 'p1', category: 'cleaning', sort: 'recommended' });
    await fetchMarketplaceSuppliers({ propertyId: 'p1' });

    expect(ApiClient.get).toHaveBeenNthCalledWith(1, '/suppliers', { propertyId: 'p1', category: 'cleaning' });
    expect(ApiClient.get).toHaveBeenNthCalledWith(2, '/suppliers', { propertyId: 'p1' });
  });

  it('asks for any other order by its name, with the words to look for', async () => {
    await fetchMarketplaceSuppliers({ propertyId: 'p1', q: 'pulizie', sort: 'price' });

    expect(ApiClient.get).toHaveBeenCalledWith('/suppliers', { propertyId: 'p1', q: 'pulizie', sort: 'price' });
  });
});
