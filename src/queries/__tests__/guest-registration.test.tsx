import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { guestRegistrationApi } from '@/api/guest-registration.api';
import { problemError } from '@/features/onboarding/__tests__/onboarding-fixtures';
import { card } from '@/features/properties/components/__tests__/guest-registration-fixtures';
import { guestRegistrationKey, useGuestRegistration, useSetGuestRegistrationOverride } from '../guestRegistration';

vi.mock('@/api/guest-registration.api', () => ({ guestRegistrationApi: { get: vi.fn(), setOverride: vi.fn() } }));

const PROPERTY_ID = '5b1c0e5a-7f43-4d7e-9a41-2c6f1d8a9b10';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

beforeEach(() => {
  vi.mocked(guestRegistrationApi.get).mockReset().mockResolvedValue(card());
  vi.mocked(guestRegistrationApi.setOverride).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('the queries of the regime of the registration of the guests (E29/F02/US02/T01)', () => {
  it('useGuestRegistration_Property_LivesUnderTheKeyOfThePropertySoASaveOfThePropertyReadsItAgain', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useGuestRegistration(PROPERTY_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(guestRegistrationKey(PROPERTY_ID).slice(0, 2)).toEqual(['properties', PROPERTY_ID]);
    // `useUpdateProperty` invalidates `['properties', id]`: what the card says about what is missing is read again with no call of its own.
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['properties', PROPERTY_ID] });
    });
    expect(guestRegistrationApi.get).toHaveBeenCalledTimes(2);
  });

  it('useGuestRegistration_NotEnabled_AsksNothing', async () => {
    const { wrapper } = setup();
    renderHook(() => useGuestRegistration(PROPERTY_ID, { enabled: false }), { wrapper });
    renderHook(() => useGuestRegistration(''), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(guestRegistrationApi.get).not.toHaveBeenCalled();
  });

  it('useSetGuestRegistrationOverride_TheAnswerIsSaved_TheCardTakesWhatTheServerAnswersAndTheCockpitIsMarkedStale', async () => {
    const saved = card({ effectiveDuty: 'Required', override: 'Required' });
    vi.mocked(guestRegistrationApi.setOverride).mockResolvedValue(saved);
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useSetGuestRegistrationOverride(PROPERTY_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('Required');
    });

    expect(guestRegistrationApi.setOverride).toHaveBeenCalledWith(PROPERTY_ID, 'Required');
    expect(client.getQueryData(guestRegistrationKey(PROPERTY_ID))).toEqual(saved);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['compliance'] });
  });

  // Privacy: whatever keeps a failure (the state of a mutation, the cache of the mutations) holds the answer of the server, never the request that was sent.
  it('useSetGuestRegistrationOverride_TheCallFails_TheErrorKeepsTheStatusAndTheCodeButNotTheRequestAndNothingIsKept', async () => {
    const failure = problemError(422, { code: 'guest_registration_override_not_applicable' });
    failure.config!.data = JSON.stringify({ override: 'Required' });
    vi.mocked(guestRegistrationApi.setOverride).mockRejectedValue(failure);
    const { client, wrapper } = setup();
    const { result, unmount } = renderHook(() => useSetGuestRegistrationOverride(PROPERTY_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('Required').catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error;
    expect(isAxiosError(error)).toBe(true);
    if (!isAxiosError(error)) return;
    expect(error.response?.status).toBe(422);
    expect(error.response?.data).toMatchObject({ code: 'guest_registration_override_not_applicable' });
    expect(error.config?.data).toBeUndefined();
    expect(JSON.stringify(error.config ?? {})).not.toContain('Required');

    // Not kept once nothing observes it.
    unmount();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });
});
