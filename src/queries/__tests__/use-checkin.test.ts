import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { useResendCheckInLink, useSubmitGuestCheckIn } from '../use-checkin';
import { bookingsApi } from '@/api/bookings.api';
import { publicCheckinApi } from '@/api/checkin.api';

vi.mock('@/api/bookings.api');
vi.mock('@/api/checkin.api', () => ({ publicCheckinApi: { getContext: vi.fn(), submit: vi.fn(), setLanguage: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

async function resendAndFail(error: unknown) {
  vi.mocked(bookingsApi.resendCheckInLink).mockRejectedValueOnce(error);
  const { result } = renderHook(() => useResendCheckInLink('b1'), { wrapper });
  await act(async () => {
    result.current.mutate();
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useResendCheckInLink onError (A9-09 FE)', () => {
  it('onError_problemDetailsDetail_showsServerMessage', async () => {
    await resendAndFail(httpError(409, { detail: "Il link di check-in è già stato completato dall'ospite." }));

    expect(toast.error).toHaveBeenCalledWith("Il link di check-in è già stato completato dall'ospite.");
  });

  it('onError_noUsefulBody_keepsGenericTranslatedMessage', async () => {
    await resendAndFail(httpError(500, { detail: 'System.NullReferenceException at ...' }));

    expect(toast.error).toHaveBeenCalledWith(i18n.t('checkin.resendError'));
  });
});

describe('useSubmitGuestCheckIn onError (FIS-01)', () => {
  async function submitAndFail(error: unknown) {
    vi.mocked(publicCheckinApi.submit).mockRejectedValueOnce(error);
    const { result } = renderHook(() => useSubmitGuestCheckIn('tok-1'), { wrapper });
    await act(async () => {
      result.current.mutate({ guests: [], marketingConsentEmail: false, marketingConsentWhatsApp: false });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  }

  it('onError_invoiceBlockRefused_ShowsNoToastBecauseThePageShowsItOnTheFieldsInItsLanguage', async () => {
    await submitAndFail(
      httpError(422, {
        code: 'invoice_data_pec_invalid',
        field: 'pec',
        errors: [{ field: 'pec', code: 'invoice_data_pec_invalid' }],
      }),
    );

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('onError_AnyOther422_IsStillShownToTheGuest', async () => {
    await submitAndFail(httpError(422, { code: 'checkin_rule', detail: 'Questo soggiorno non accetta il check-in online.' }));

    expect(toast.error).toHaveBeenCalledWith('Questo soggiorno non accetta il check-in online.');
  });
});

describe('useResendCheckInLink onSuccess (CO-09, A5-26)', () => {
  async function resend(emailStatus: 'Queued' | 'Failed', emailError: string | null = null) {
    vi.mocked(bookingsApi.resendCheckInLink).mockResolvedValueOnce({
      checkInLink: 'https://casazen.test/checkin/abc',
      expiresAt: '2026-10-08T08:00:00Z',
      emailStatus,
      emailError,
    });
    const { result } = renderHook(() => useResendCheckInLink('b1'), { wrapper });
    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  }

  it('onSuccess_emailFailed_showsTheReasonAndNeverSaysResent', async () => {
    await resend('Failed', 'provider_not_configured');

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      i18n.t('checkin.link.toast.emailFailed', { reason: i18n.t('checkin.link.emailError.providerNotConfigured') }),
    );
  });

  it('onSuccess_unknownEmailError_usesTheGenericReason', async () => {
    await resend('Failed', 'something_new');

    expect(toast.error).toHaveBeenCalledWith(
      i18n.t('checkin.link.toast.emailFailed', { reason: i18n.t('checkin.link.emailError.unknown') }),
    );
  });

  it('onSuccess_emailQueued_saysQueued', async () => {
    await resend('Queued');

    expect(toast.success).toHaveBeenCalledWith(i18n.t('checkin.link.toast.emailQueued'));
  });
});
