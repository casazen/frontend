import { describe, it, expect, vi, beforeEach } from 'vitest';
import { propertiesApi } from '../properties.api';
import { ApiClient } from '../client';
import type { Property, PublicPropertyDetailDto, PublicPropertyDto } from '@/types';

vi.mock('../client');

const mockListItem: PublicPropertyDto = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Trastevere Loft',
  description: 'Bright apartment',
  city: 'Rome',
  postalCode: '00153',
  bedrooms: 2,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 145,
  cleaningFee: 50,
  amenities: ['Wifi'],
  photoUrls: ['https://cdn.example.com/photo.jpg'],
  cinCode: 'IT-12345-0123456789',
  cinStatus: 'Valid',
  timezone: 'Europe/Rome',
};

const mockDetail: PublicPropertyDetailDto = {
  ...mockListItem,
  houseRules: 'No smoking',
  cancellationPolicySummary: 'Flexible',
  minNights: null,
  currency: 'EUR',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('propertiesApi public read-model (#212)', () => {
  it('AC10: search maps minBedrooms to bedrooms and returns PublicPropertyDto[]', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce([mockListItem]);

    const result = await propertiesApi.search({ city: 'Rome', minBedrooms: 2, maxPrice: 200 });

    expect(ApiClient.get).toHaveBeenCalledWith('/properties/search', {
      city: 'Rome',
      bedrooms: 2,
      maxPrice: 200,
    });
    expect(result).toEqual([mockListItem]);
    expect(result[0]).not.toHaveProperty('ownerId');
  });

  it('AC10: getPublicProperty calls GET /properties/:id/public', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce(mockDetail);

    const result = await propertiesApi.getPublicProperty(mockListItem.id);

    expect(ApiClient.get).toHaveBeenCalledWith(`/properties/${mockListItem.id}/public`);
    expect(result.currency).toBe('EUR');
    expect(result).not.toHaveProperty('ownerId');
  });
});

describe('propertiesApi update (#26)', () => {
  it('uses PUT /properties/:id to match backend PropertiesController', async () => {
    vi.mocked(ApiClient.put).mockResolvedValueOnce({} as Property);

    await propertiesApi.update(mockListItem.id, { name: 'Updated name' });

    expect(ApiClient.put).toHaveBeenCalledWith(`/properties/${mockListItem.id}`, { name: 'Updated name' });
    expect(ApiClient.patch).not.toHaveBeenCalled();
  });
});
