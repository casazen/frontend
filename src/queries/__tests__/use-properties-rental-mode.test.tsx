import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { propertiesApi } from '@/api/properties.api';
import type { CreatePropertyDto } from '@/types';
import { useCreateProperty, useProperties } from '../use-properties';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(() => 'id'), info: vi.fn(), error: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock('@/api/properties.api', () => ({
  propertiesApi: { create: vi.fn(), getAll: vi.fn() },
}));

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

const DTO: CreatePropertyDto = {
  name: 'Bilocale',
  description: '',
  address: 'Via Roma 1',
  city: 'Milano',
  postalCode: '20100',
  bedrooms: 1,
  bathrooms: 1,
  maxGuests: 0,
  nightlyRate: 0,
};

describe('rental mode of the properties: one section never sees the other (PM-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });

  afterEach(() => queryClient.clear());

  it.each([['Short' as const], ['Long' as const]])(
    'useCreateProperty_%s_SendsTheModeOfTheSectionEvenWithoutGuestsAndRate',
    async (mode) => {
      vi.mocked(propertiesApi.create).mockResolvedValue({} as never);
      const { result } = renderHook(() => useCreateProperty(mode), { wrapper });

      await act(() => result.current.mutateAsync(DTO));

      expect(propertiesApi.create).toHaveBeenCalledWith({ ...DTO, rentalMode: mode });
    },
  );

  it('useProperties_WithMode_AsksTheServerForThatSectionOnly', async () => {
    vi.mocked(propertiesApi.getAll).mockResolvedValue([]);
    const { result } = renderHook(() => useProperties({ mode: 'long' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(propertiesApi.getAll).toHaveBeenCalledWith({ mode: 'long' });
  });
});
