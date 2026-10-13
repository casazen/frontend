import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertiesApi } from '@/api/properties.api';
import { usePauseProperty } from '../use-properties';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(() => 'id'), info: vi.fn(), error: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock('@/api/properties.api', () => ({
  propertiesApi: { pause: vi.fn(), activate: vi.fn() },
}));

type ToastData = { action: { label: string; onClick: () => void }; duration: number };

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

/** The toast that tells the property was paused: its message and what it was given. */
function pausedToast() {
  const call = vi.mocked(toast.success).mock.calls.find(([message]) => message === 'Immobile messo in pausa');
  return call ? { data: call[1] as unknown as ToastData } : undefined;
}

describe('usePauseProperty: the toast that can be undone (UI-07, toastUndo)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    vi.mocked(propertiesApi.pause).mockResolvedValue({ isPaused: true, pausedAt: '2026-10-09T08:00:00Z' });
    vi.mocked(propertiesApi.activate).mockResolvedValue({ isPaused: false, pausedAt: null });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('pause_Done_TheToastOffersAnnullaForSixSeconds', async () => {
    const { result } = renderHook(() => usePauseProperty(), { wrapper });

    await act(() => result.current.mutateAsync('prop-1'));

    expect(propertiesApi.pause).toHaveBeenCalledWith('prop-1');
    const shown = pausedToast();
    expect(shown?.data.action.label).toBe('Annulla');
    expect(shown?.data.duration).toBe(6000);
    // Nothing has been reverted yet.
    expect(propertiesApi.activate).not.toHaveBeenCalled();
  });

  it('pause_Annulla_ReallyReactivatesTheProperty_RefreshesTheListsAndSaysSo', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => usePauseProperty(), { wrapper });
    await act(() => result.current.mutateAsync('prop-1'));
    invalidate.mockClear();

    act(() => pausedToast()?.data.action.onClick());

    await waitFor(() => expect(propertiesApi.activate).toHaveBeenCalledWith('prop-1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Immobile riattivato'));
    // The row, the detail page and the badges read the new state without a manual reload.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['properties'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['properties', 'prop-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['properties', 'prop-1', 'detail'] });
  });

  it('pause_AnnullaThatFails_TellsTheUserAndDoesNotClaimItWasReactivated', async () => {
    vi.mocked(propertiesApi.activate).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePauseProperty(), { wrapper });
    await act(() => result.current.mutateAsync('prop-1'));

    act(() => pausedToast()?.data.action.onClick());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Non è stato possibile annullare.'));
    expect(toast.success).not.toHaveBeenCalledWith('Immobile riattivato');
  });

  it('pause_Fails_NoToastOffersToUndoAnythingThatDidNotHappen', async () => {
    vi.mocked(propertiesApi.pause).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePauseProperty(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('prop-1').catch(() => undefined);
    });

    expect(pausedToast()).toBeUndefined();
    expect(toast.error).toHaveBeenCalled();
  });
});
