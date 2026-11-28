import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { completeComplianceActivation, fetchComplianceSummary } from '@/api/compliance.api';
import type { ComplianceSummaryResult } from '@/types/compliance.types';
import {
  COMPLIANCE_KEY,
  lightsCouldNotBeRead,
  lightsOf,
  useCompleteComplianceActivation,
  useComplianceLights,
  useComplianceLightsOn,
} from '../use-compliance';

vi.mock('@/api/compliance.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/compliance.api')>()),
  completeComplianceActivation: vi.fn(),
  fetchComplianceSummary: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

function httpError(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

async function completeAndFail(error: unknown) {
  vi.mocked(completeComplianceActivation).mockRejectedValueOnce(error);
  const { result } = renderHook(() => useCompleteComplianceActivation('prop-1'), { wrapper });
  await act(async () => {
    result.current.mutate({ tosAccepted: true });
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCompleteComplianceActivation onError (A5-18)', () => {
  it('onError_ActivationBlocked409_NoToastTheWizardListsTheBlockers', async () => {
    await completeAndFail(
      httpError(409, {
        code: 'property_activation_blocked',
        detail: "L'immobile non può ancora essere attivato: completa i punti obbligatori elencati.",
        blockers: [{ step: 'cin', code: 'activation_cin_missing', message: 'x' }],
      }),
    );

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('onError_TermsRequired409_TranslatedCodeMessage', async () => {
    await completeAndFail(httpError(409, { code: 'activation_tos_required', detail: 'Devi accettare i termini di servizio.' }));

    expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.activationTosRequired'));
  });

  it('onError_ServerError_GenericTranslatedMessage', async () => {
    await completeAndFail(httpError(500, { detail: 'System.NullReferenceException at ...' }));

    expect(toast.error).toHaveBeenCalledWith(i18n.t('compliance.activation.completeFailed'));
  });
});

describe('the reads of the compliance lights', () => {
  const none = { count: 0, items: [] };
  const summary = (light?: 'Green' | 'Yellow' | 'Red'): ComplianceSummaryResult => ({
    propertiesPending: none,
    guestCheckInsIncomplete: none,
    checkoutsDue: none,
    alloggiatiFailures: none,
    alloggiatiManualRequired: none,
    turnoversPending: none,
    receiptsToUpload: { count: 1, items: [{ id: 'b1', label: 'Mario Rossi', action: 'UploadAlloggiatiReceipt', propertyId: null, bookingId: 'b1', light }] },
  });
  const sharedClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const withClient = (client: QueryClient) => ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);

  it('useComplianceLights_NotEnabled_NeverReadsTheSummary', async () => {
    const { result } = renderHook(() => useComplianceLights(false), { wrapper: withClient(sharedClient()) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchComplianceSummary).not.toHaveBeenCalled();
  });

  it('useComplianceLights_EveryTimeThePageOpens_ReadsAgain', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summary('Red'));
    const client = sharedClient();

    const first = renderHook(() => useComplianceLights(true), { wrapper: withClient(client) });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();
    const second = renderHook(() => useComplianceLights(true), { wrapper: withClient(client) });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    await waitFor(() => expect(fetchComplianceSummary).toHaveBeenCalledTimes(2));
  });

  it('useComplianceLights_AFailedRead_IsNotRetriedAndSaysNothing', async () => {
    vi.mocked(fetchComplianceSummary).mockRejectedValue(httpError(500));
    const { result } = renderHook(() => useComplianceLights(true), { wrapper: withClient(sharedClient()) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(fetchComplianceSummary).toHaveBeenCalledTimes(1);
  });

  it('lightsOf_A404WithAnOldAnswerInTheCache_IsNoAnswerAndIsNotAFailure', async () => {
    const client = sharedClient();
    client.setQueryData([COMPLIANCE_KEY, 'summary'], summary('Red'));
    vi.mocked(fetchComplianceSummary).mockRejectedValue(httpError(404));
    const { result } = renderHook(() => useComplianceLights(true), { wrapper: withClient(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(lightsOf(result.current)).toBeUndefined();
    expect(lightsCouldNotBeRead(result.current)).toBe(false);
  });

  it.each([[500], [403], [undefined]])('lightsCouldNotBeRead_ReadThatFailedWith_%s_IsAFailureAndNeverTheLightsOff', async (status) => {
    vi.mocked(fetchComplianceSummary).mockRejectedValue(status === undefined ? new Error('Network Error') : httpError(status));
    const { result } = renderHook(() => useComplianceLights(true), { wrapper: withClient(sharedClient()) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(lightsCouldNotBeRead(result.current)).toBe(true);
    expect(lightsOf(result.current)).toBeUndefined();
  });

  it('lightsCouldNotBeRead_NotAskedOrRead_IsNotAFailure', async () => {
    const idle = renderHook(() => useComplianceLights(false), { wrapper: withClient(sharedClient()) });
    expect(lightsCouldNotBeRead(idle.result.current)).toBe(false);

    vi.mocked(fetchComplianceSummary).mockResolvedValue(summary('Green'));
    const read = renderHook(() => useComplianceLights(true), { wrapper: withClient(sharedClient()) });
    await waitFor(() => expect(read.result.current.isSuccess).toBe(true));
    expect(lightsCouldNotBeRead(read.result.current)).toBe(false);
    expect(lightsOf(read.result.current)).toEqual(summary('Green'));
  });

  it('useComplianceLights_ShareTheEntryOfThePageAndOfTheMenu', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summary('Yellow'));
    const client = sharedClient();
    const { result } = renderHook(() => useComplianceLights(true), { wrapper: withClient(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData([COMPLIANCE_KEY, 'summary'])).toEqual(summary('Yellow'));
  });

  it.each([
    ['Green', true],
    ['Yellow', true],
    ['Red', true],
    [undefined, false],
  ] as const)('useComplianceLightsOn_LightOf%s_Is%s', async (light, expected) => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summary(light));
    const { result } = renderHook(() => useComplianceLightsOn(true), { wrapper: withClient(sharedClient()) });

    await waitFor(() => expect(fetchComplianceSummary).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toBe(expected));
  });

  it('useComplianceLightsOn_NotEnabledOrNotRead_IsFalseAndNeverReads', async () => {
    const { result } = renderHook(() => useComplianceLightsOn(false), { wrapper: withClient(sharedClient()) });

    expect(result.current).toBe(false);
    expect(fetchComplianceSummary).not.toHaveBeenCalled();
  });
});
