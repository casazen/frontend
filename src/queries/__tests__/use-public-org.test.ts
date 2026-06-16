import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { usePublicOrg, useOrgProperties, useOrgPublicProperty } from '../use-public-org';
import { publicOrgApi } from '@/api/public-org.api';
import type { PublicOrgDto, PublicPropertyDetailDto, PublicPropertyDto } from '@/types';

vi.mock('@/api/public-org.api');

const mockOrg: PublicOrgDto = {
  slug: 'demo-org',
  displayName: 'Demo Stays',
  logoUrl: 'https://cdn.example.com/logo.png',
  themeColor: '#2563eb',
  contactEmail: 'info@demo.example',
};

const mockProperty: PublicPropertyDto = {
  id: 'prop-1',
  name: 'Roma Loft',
  description: 'Luminoso appartamento.',
  city: 'Roma',
  postalCode: '00184',
  bedrooms: 2,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 120,
  cleaningFee: 40,
  amenities: ['Wifi'],
  photoUrls: [],
  cinCode: 'IT-00000-0000000000',
  cinStatus: 'Valid',
  timezone: 'Europe/Rome',
};

const mockPropertyDetail: PublicPropertyDetailDto = {
  ...mockProperty,
  houseRules: 'No smoking.',
  cancellationPolicySummary: 'Flexible',
  minNights: 2,
  currency: 'EUR',
};

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePublicOrg', () => {
  it('fetches org branding for a known slug', async () => {
    vi.mocked(publicOrgApi.getPublicOrg).mockResolvedValueOnce(mockOrg);

    const { result } = renderHook(() => usePublicOrg('demo-org'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(publicOrgApi.getPublicOrg).toHaveBeenCalledWith('demo-org');
    expect(result.current.data).toEqual(mockOrg);
  });

  it('does not fetch when slug is undefined', () => {
    const { result } = renderHook(() => usePublicOrg(undefined), {
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(publicOrgApi.getPublicOrg).not.toHaveBeenCalled();
  });

  it('does not fetch when slug is empty string', () => {
    const { result } = renderHook(() => usePublicOrg(''), {
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(publicOrgApi.getPublicOrg).not.toHaveBeenCalled();
  });

  it('surfaces error on 404 (unknown org)', async () => {
    vi.mocked(publicOrgApi.getPublicOrg).mockRejectedValueOnce(new Error('Not found'));

    const { result } = renderHook(() => usePublicOrg('unknown-slug'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useOrgProperties', () => {
  it('fetches properties for a known org slug', async () => {
    vi.mocked(publicOrgApi.getOrgProperties).mockResolvedValueOnce([mockProperty]);

    const { result } = renderHook(() => useOrgProperties('demo-org'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(publicOrgApi.getOrgProperties).toHaveBeenCalledWith('demo-org');
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Roma Loft');
  });

  it('does not fetch when slug is undefined', () => {
    const { result } = renderHook(() => useOrgProperties(undefined), {
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(publicOrgApi.getOrgProperties).not.toHaveBeenCalled();
  });

  it('returns empty array on empty listing', async () => {
    vi.mocked(publicOrgApi.getOrgProperties).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useOrgProperties('empty-org'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('useOrgPublicProperty', () => {
  it('fetches property detail when both slug and propertyId are provided', async () => {
    vi.mocked(publicOrgApi.getOrgProperty).mockResolvedValueOnce(mockPropertyDetail);

    const { result } = renderHook(() => useOrgPublicProperty('demo-org', 'prop-1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(publicOrgApi.getOrgProperty).toHaveBeenCalledWith('demo-org', 'prop-1');
    expect(result.current.data?.houseRules).toBe('No smoking.');
  });

  it('does not fetch when slug is undefined', () => {
    const { result } = renderHook(() => useOrgPublicProperty(undefined, 'prop-1'), {
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(publicOrgApi.getOrgProperty).not.toHaveBeenCalled();
  });

  it('does not fetch when propertyId is undefined', () => {
    const { result } = renderHook(() => useOrgPublicProperty('demo-org', undefined), {
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(publicOrgApi.getOrgProperty).not.toHaveBeenCalled();
  });
});
