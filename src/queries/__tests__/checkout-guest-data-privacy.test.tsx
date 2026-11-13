import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { createElement } from 'react';
import { checkInWizardApi } from '@/api/checkin-wizard.api';
import { saveCheckoutProgress } from '@/api/compliance.api';
import { useSaveCheckoutProgress } from '@/features/compliance/use-compliance';
import type { CheckoutWizardProgressCommand } from '@/types/compliance.types';
import type { StayGuestSubmit } from '@/types/public-checkin.types';
import { useSaveCheckInGuests } from '../use-checkin-wizard';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/checkin-wizard.api', () => ({ checkInWizardApi: { saveGuests: vi.fn() } }));
vi.mock('@/api/compliance.api', () => ({ saveCheckoutProgress: vi.fn() }));

const DOCUMENT_NUMBER = 'AB1234567';
const NOTE = 'Il codice del cancello e 4821';

const guests = [{ firstName: 'Giulia', lastName: 'Bianchi', documentNumber: DOCUMENT_NUMBER }] as unknown as StayGuestSubmit[];
const progress = { currentStep: 'alloggiati', propertyNotes: NOTE } as unknown as CheckoutWizardProgressCommand;

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

/** A refusal of the API as axios keeps it: with the request that was sent, whose body holds what the host typed. */
function refusal(status: number, body: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), data: JSON.stringify(body) } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: { status }, statusText: '', headers: {}, config });
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Privacy (NF-45): the check-out wizard saves the guests of the stay through the editor of the check-in wizard and its own progress. A mutation keeps what it was
 * given and the request of a failure in the cache of the mutations for five minutes by default, after the panel or the wizard is gone.
 */
describe('what the check-out wizard saves is not kept once it is gone', () => {
  it('useSaveCheckInGuests_Refused_KeepsNoPersonalDataAndNothingOnceTheEditorIsGone', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(checkInWizardApi.saveGuests).mockRejectedValue(refusal(400, guests));
    const { result, unmount } = renderHook(() => useSaveCheckInGuests('b-1'), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(guests)).rejects.toMatchObject({ response: { status: 400 } });
    });

    // What the form turns into words on the fields stays (the status and the body of the answer); the request, with the guests in it, does not.
    const kept = queryClient.getMutationCache().getAll()[0]?.state.error as AxiosError;
    expect(kept.response?.status).toBe(400);
    expect(JSON.stringify(kept.config ?? {})).not.toContain(DOCUMENT_NUMBER);
    expect(JSON.stringify(kept.response?.config ?? {})).not.toContain(DOCUMENT_NUMBER);

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it('useSaveCheckInGuests_Saved_LeavesNothingInTheMutationCacheOnceTheEditorIsGone', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(checkInWizardApi.saveGuests).mockResolvedValue({ guests: [] } as never);
    const { result, unmount } = renderHook(() => useSaveCheckInGuests('b-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(guests);
    });
    expect(checkInWizardApi.saveGuests).toHaveBeenCalledWith('b-1', guests);

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it('useSaveCheckoutProgress_Refused_KeepsNoNotesAndNothingOnceTheWizardIsGone', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(saveCheckoutProgress).mockRejectedValue(refusal(409, progress));
    const { result, unmount } = renderHook(() => useSaveCheckoutProgress('b-1'), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(progress)).rejects.toMatchObject({ response: { status: 409 } });
    });

    const kept = queryClient.getMutationCache().getAll()[0]?.state.error as AxiosError;
    expect(kept.response?.status).toBe(409);
    expect(JSON.stringify(kept.config ?? {})).not.toContain(NOTE);

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });
});
