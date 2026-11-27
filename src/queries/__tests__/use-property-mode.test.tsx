import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertyModeApi } from '@/api/property-mode.api';
import { PROPERTY_ID, TOMORROW, axiosError, change, preview, state } from '@/features/properties/mode/__tests__/mode-fixtures';
import {
  useCancelPropertyModeChange,
  usePropertyModePreview,
  usePropertyModeState,
  useSchedulePropertyModeChange,
} from '../use-property-mode';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/property-mode.api', () => ({
  propertyModeApi: { getState: vi.fn(), preview: vi.fn(), schedule: vi.fn(), cancel: vi.fn() },
}));

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

const CALENDAR_KEY = ['bookings', 'calendar', PROPERTY_ID, '2026-10'];
const PROPERTY_KEY = ['properties', PROPERTY_ID];
const LIST_KEY = ['bookings', 'list'];

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.mocked(propertyModeApi.getState).mockResolvedValue(state());
  vi.mocked(propertyModeApi.preview).mockResolvedValue(preview());
});

afterEach(() => queryClient.clear());

describe('usePropertyModeState (PM-03)', () => {
  it('usePropertyModeState_AsksTheServerForTheModeOfTheProperty', async () => {
    const { result } = renderHook(() => usePropertyModeState(PROPERTY_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(propertyModeApi.getState).toHaveBeenCalledWith(PROPERTY_ID);
    expect(queryClient.getQueryData(['properties', PROPERTY_ID, 'mode'])).toEqual(state());
  });

  it('usePropertyModeState_NoPropertyOrDisabled_SendsNoRequest', async () => {
    renderHook(() => usePropertyModeState(''), { wrapper });
    renderHook(() => usePropertyModeState(PROPERTY_ID, { enabled: false }), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });
    expect(propertyModeApi.getState).not.toHaveBeenCalled();
  });

  it('usePropertyModeState_Fresh_ReadsAgainWhenThePageOpensEvenIfCached', async () => {
    queryClient.setQueryData(['properties', PROPERTY_ID, 'mode'], state({ rentalMode: 'Long' }));
    queryClient.setDefaultOptions({ queries: { staleTime: 5 * 60_000, refetchOnMount: false, retry: false } });

    renderHook(() => usePropertyModeState(PROPERTY_ID), { wrapper });
    expect(propertyModeApi.getState).not.toHaveBeenCalled();

    const { result } = renderHook(() => usePropertyModeState(PROPERTY_ID, { fresh: true }), { wrapper });
    await waitFor(() => expect(result.current.data?.rentalMode).toBe('Short'));
    expect(propertyModeApi.getState).toHaveBeenCalledTimes(1);
  });
});

describe('usePropertyModePreview (PM-03)', () => {
  it('usePropertyModePreview_AsksForTheModeAndTheDay', async () => {
    const { result } = renderHook(() => usePropertyModePreview(PROPERTY_ID, 'Long', '2026-12-01'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(propertyModeApi.preview).toHaveBeenCalledWith(PROPERTY_ID, 'Long', '2026-12-01');
    expect(queryClient.getQueryData(['properties', PROPERTY_ID, 'mode', 'preview', 'Long', '2026-12-01'])).toEqual(preview());
    expect(queryClient.getQueryData(['properties', PROPERTY_ID, 'mode', 'preview', 'Long', '2026-12-02'])).toBeUndefined();
  });

  it('usePropertyModePreview_NoDay_AsksForTheFirstDayPossible', async () => {
    const { result } = renderHook(() => usePropertyModePreview(PROPERTY_ID, 'Short', undefined), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(propertyModeApi.preview).toHaveBeenCalledWith(PROPERTY_ID, 'Short', undefined);
  });

  it('usePropertyModePreview_Disabled_SendsNoRequest', async () => {
    renderHook(() => usePropertyModePreview(PROPERTY_ID, 'Long', TOMORROW, { enabled: false }), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });
    expect(propertyModeApi.preview).not.toHaveBeenCalled();
  });

  it('usePropertyModePreview_NobodyShowsIt_IsNotKept', async () => {
    const { result, unmount } = renderHook(() => usePropertyModePreview(PROPERTY_ID, 'Long', TOMORROW), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    unmount();

    await waitFor(() => expect(queryClient.getQueryCache().findAll({ queryKey: ['properties', PROPERTY_ID, 'mode', 'preview'] })).toHaveLength(0));
  });

  it('usePropertyModePreview_TheTabRegainsTheFocus_DoesNotReplaceTheAnswerOnScreen', async () => {
    const control = vi.fn().mockResolvedValue('control');
    renderHook(() => useQuery({ queryKey: ['control'], queryFn: control, staleTime: 0 }), { wrapper });
    const { result } = renderHook(() => usePropertyModePreview(PROPERTY_ID, 'Long', TOMORROW), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(control).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(control).toHaveBeenCalledTimes(2));
    act(() => {
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(control).toHaveBeenCalledTimes(3));
    expect(propertyModeApi.preview).toHaveBeenCalledTimes(1);
  });

  it('usePropertyModePreview_Fresh_ReadsAgainOnMountWhereTheAppWouldNot', async () => {
    queryClient.setDefaultOptions({ queries: { retry: false, refetchOnMount: false } });
    const first = renderHook(() => usePropertyModePreview(PROPERTY_ID, 'Long', TOMORROW), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    expect(propertyModeApi.preview).toHaveBeenCalledTimes(1);

    renderHook(() => usePropertyModePreview(PROPERTY_ID, 'Long', TOMORROW), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    expect(propertyModeApi.preview).toHaveBeenCalledTimes(1);

    renderHook(() => usePropertyModePreview(PROPERTY_ID, 'Long', TOMORROW, { fresh: true }), { wrapper });
    await waitFor(() => expect(propertyModeApi.preview).toHaveBeenCalledTimes(2));
  });
});

describe('useSchedulePropertyModeChange (PM-03)', () => {
  function seedTheCaches() {
    queryClient.setQueryData(PROPERTY_KEY, { id: PROPERTY_ID, rentalMode: 'Short' });
    queryClient.setQueryData(CALENDAR_KEY, { items: [] });
    queryClient.setQueryData(LIST_KEY, []);
  }

  it('useSchedulePropertyModeChange_Success_SendsTheChangeAndRefreshesWhatItChanges', async () => {
    vi.mocked(propertyModeApi.schedule).mockResolvedValue(change());
    seedTheCaches();
    const { result } = renderHook(() => useSchedulePropertyModeChange(PROPERTY_ID), { wrapper });

    await act(() => result.current.mutateAsync({ to: 'Long', effectiveDate: '2026-12-01' }));

    expect(propertyModeApi.schedule).toHaveBeenCalledWith(PROPERTY_ID, { to: 'Long', effectiveDate: '2026-12-01' });
    expect(queryClient.getQueryState(PROPERTY_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(CALENDAR_KEY)).toBeUndefined();
    expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('useSchedulePropertyModeChange_Refused_RefreshesAllTheSameAndSaysNothing', async () => {
    vi.mocked(propertyModeApi.schedule).mockRejectedValue(axiosError(409, { code: 'property_mode_change_already_scheduled' }));
    seedTheCaches();
    const { result } = renderHook(() => useSchedulePropertyModeChange(PROPERTY_ID), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ to: 'Long', effectiveDate: '2026-12-01' })).rejects.toBeDefined();
    });

    expect(queryClient.getQueryState(PROPERTY_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(CALENDAR_KEY)).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('useSchedulePropertyModeChange_TheCalendarIsOnScreen_ReadsItAgain', async () => {
    vi.mocked(propertyModeApi.schedule).mockResolvedValue(change());
    const calendar = vi.fn().mockResolvedValue({ items: [] });
    renderHook(() => useQuery({ queryKey: CALENDAR_KEY, queryFn: calendar }), { wrapper });
    await waitFor(() => expect(calendar).toHaveBeenCalledTimes(1));
    const { result } = renderHook(() => useSchedulePropertyModeChange(PROPERTY_ID), { wrapper });

    await act(() => result.current.mutateAsync({ to: 'Long', effectiveDate: '2026-12-01' }));

    await waitFor(() => expect(calendar).toHaveBeenCalledTimes(2));
  });
});

describe('useCancelPropertyModeChange (PM-03)', () => {
  it('useCancelPropertyModeChange_Success_WithdrawsTheChangeSaysSoAndRefreshes', async () => {
    vi.mocked(propertyModeApi.cancel).mockResolvedValue(undefined);
    queryClient.setQueryData(PROPERTY_KEY, { id: PROPERTY_ID });
    queryClient.setQueryData(CALENDAR_KEY, { items: [] });
    const { result } = renderHook(() => useCancelPropertyModeChange(PROPERTY_ID), { wrapper });

    await act(() => result.current.mutateAsync('c1'));

    expect(propertyModeApi.cancel).toHaveBeenCalledWith(PROPERTY_ID, 'c1');
    expect(toast.success).toHaveBeenCalledWith(i18n.t('propertyMode.cancel.done'));
    expect(queryClient.getQueryState(PROPERTY_KEY)?.isInvalidated).toBe(true);
    // The nights the change had closed are open again: the months kept in the cache say otherwise.
    expect(queryClient.getQueryState(CALENDAR_KEY)).toBeUndefined();
  });

  it('useCancelPropertyModeChange_RefusedWithACode_SaysWhyInTheLanguageOfThePerson', async () => {
    vi.mocked(propertyModeApi.cancel).mockRejectedValue(axiosError(409, { code: 'property_mode_change_not_scheduled' }));
    queryClient.setQueryData(PROPERTY_KEY, { id: PROPERTY_ID });
    const { result } = renderHook(() => useCancelPropertyModeChange(PROPERTY_ID), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('c1')).rejects.toBeDefined();
    });

    expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.propertyModeChangeNotScheduled'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(PROPERTY_KEY)?.isInvalidated).toBe(true);
  });

  it('useCancelPropertyModeChange_RefusedWithoutAReason_SaysItCouldNotBeWithdrawn', async () => {
    vi.mocked(propertyModeApi.cancel).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useCancelPropertyModeChange(PROPERTY_ID), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('c1')).rejects.toBeDefined();
    });

    expect(toast.error).toHaveBeenCalledWith(i18n.t('propertyMode.cancel.failed'));
  });
});
