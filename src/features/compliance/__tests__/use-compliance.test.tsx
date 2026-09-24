import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { completeComplianceActivation } from '@/api/compliance.api';
import { useCompleteComplianceActivation } from '../use-compliance';

vi.mock('@/api/compliance.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/compliance.api')>()),
  completeComplianceActivation: vi.fn(),
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
