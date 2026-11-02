import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import { useAcceptInterventionProposal, useRemindIntervention } from '@/queries/use-service-requests';

const api = vi.hoisted(() => ({
  remindServiceRequest: vi.fn(),
  acceptServiceRequestProposal: vi.fn(),
}));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('@/api/service-requests.api', () => api);

function problem(status: number, data: unknown) {
  return new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, undefined, undefined, { status, data, statusText: '', headers: {}, config: {} } as unknown as AxiosResponse);
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { invalidate, wrapper };
}

describe('the steps of the host on an intervention refused by the server (SR-08)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('useAcceptInterventionProposal_RequestChangedMeanwhile409_TellsItAndReadsTheStateAgain', async () => {
    api.acceptServiceRequestProposal.mockRejectedValue(problem(409, { code: 'service_request_state_changed', detail: 'ignored' }));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useAcceptInterventionProposal(), { wrapper });

    act(() => result.current.mutate('sr-1'));

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('La richiesta è cambiata: ecco lo stato aggiornato.'));
    expect(toasts.success).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['service-requests'] });
  });

  it('useRemindIntervention_TooSoon422_ShowsTheWordsOfTheServerAndReadsTheRequestAgainToShowWhen', async () => {
    api.remindServiceRequest.mockRejectedValue(problem(422, { code: 'service_request_remind_too_soon', detail: 'Hai sollecitato da poco: puoi riprovare tra 2 ore.' }));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useRemindIntervention(), { wrapper });

    act(() => result.current.mutate('sr-1'));

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('Hai sollecitato da poco: puoi riprovare tra 2 ore.'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['service-requests'] });
  });
});
