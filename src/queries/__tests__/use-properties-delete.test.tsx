import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertiesApi } from '@/api/properties.api';
import { useDeleteProperty } from '../use-properties';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(() => 'id'), info: vi.fn(), error: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock('@/api/properties.api', () => ({
  propertiesApi: { delete: vi.fn() },
}));

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

/** A failed call as the API client rejects it: status and ProblemDetails body. */
function problem(status: number, data: Record<string, unknown>) {
  return new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: {} as InternalAxiosRequestConfig,
  } as AxiosResponse);
}

describe('useDeleteProperty', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('delete_Done_CallsTheApiInvalidatesListsAndShowsTheSuccessToast', async () => {
    vi.mocked(propertiesApi.delete).mockResolvedValue(undefined);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteProperty(), { wrapper });

    await act(() => result.current.mutateAsync('prop-1'));

    expect(propertiesApi.delete).toHaveBeenCalledWith('prop-1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['properties'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['bookings'] });
    expect(toast.success).toHaveBeenCalledWith(i18n.t('toast.propertyDeleted'));
  });

  it('delete_Done_DropsTheCachedDetailOfTheDeletedProperty', async () => {
    vi.mocked(propertiesApi.delete).mockResolvedValue(undefined);
    queryClient.setQueryData(['properties', 'prop-1'], { id: 'prop-1' });
    const { result } = renderHook(() => useDeleteProperty(), { wrapper });

    await act(() => result.current.mutateAsync('prop-1'));

    expect(queryClient.getQueryData(['properties', 'prop-1'])).toBeUndefined();
  });

  it('delete_ConflictUpcomingBookings_ShowsTheDedicatedMessage', async () => {
    vi.mocked(propertiesApi.delete).mockRejectedValue(problem(409, { code: 'property_has_upcoming_bookings' }));
    const { result } = renderHook(() => useDeleteProperty(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('prop-1').catch(() => undefined);
    });

    expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.propertyHasUpcomingBookings'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('delete_ConflictActiveLeases_ShowsTheDedicatedMessage', async () => {
    vi.mocked(propertiesApi.delete).mockRejectedValue(problem(409, { code: 'property_has_active_leases' }));
    const { result } = renderHook(() => useDeleteProperty(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('prop-1').catch(() => undefined);
    });

    expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.propertyHasActiveLeases'));
  });

  it('delete_UnexpectedFailure_ShowsTheGenericToastAndKeepsTheLists', async () => {
    vi.mocked(propertiesApi.delete).mockRejectedValue(new Error('boom'));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteProperty(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('prop-1').catch(() => undefined);
    });

    expect(toast.error).toHaveBeenCalledWith(i18n.t('toast.propertyDeleteFailed'));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
