import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { ConnectApi } from '@/api/connect.api';
import type { ConnectStatus } from '@/types/connect.types';
import { ConnectPaymentsPage } from '../payments-page';

vi.mock('@/api/connect.api', () => ({
  ConnectApi: { getStatus: vi.fn(), createAccount: vi.fn(), createOnboardingLink: vi.fn() },
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const assign = vi.fn();

const pendingStatus: ConnectStatus = {
  connectedAccountId: 'acct_verified_host',
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: true,
  requirementsDue: [],
};

const activeStatus: ConnectStatus = {
  connectedAccountId: 'acct_verified_host',
  chargesEnabled: true,
  payoutsEnabled: true,
  detailsSubmitted: true,
  requirementsDue: [],
};

function problemError(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { status, code, detail: 'Server detail' },
  });
}

function renderPage(path = '/app/short-rent/settings/payments') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(
        QueryClientProvider,
        { client },
        createElement(MemoryRouter, { initialEntries: [path] }, createElement(ConnectPaymentsPage)),
      ),
    ),
  );
}

const retryButton = () => screen.getByRole('button', { name: i18n.t('settings.connectRetry') });

describe('ConnectPaymentsPage (BK-09)', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { ...window.location, assign });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('statusQuery_StripeUnavailable_ShowsRetryWithoutFalseDisconnectedState', async () => {
    vi.mocked(ConnectApi.getStatus)
      .mockRejectedValueOnce(problemError(503, 'stripe_connect_unavailable'))
      .mockResolvedValueOnce(activeStatus);
    renderPage();

    const alert = await screen.findByTestId('connect-status-error');
    expect(alert).toHaveTextContent(i18n.t('apiErrors.codes.stripeConnectUnavailable'));
    // The status was not read: no "Non collegato" badge, no "site not active" banner, no "Collega Stripe" button.
    expect(screen.queryByTestId('connect-status-badge')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('settings.connectStatusDisconnected'))).not.toBeInTheDocument();
    expect(screen.queryByTestId('connect-checkout-gate-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('connect-stripe-cta')).not.toBeInTheDocument();

    fireEvent.click(retryButton());

    await waitFor(() =>
      expect(screen.getByTestId('connect-status-badge')).toHaveTextContent(i18n.t('settings.connectStatusActive')),
    );
    expect(ConnectApi.getStatus).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('connect-status-error')).not.toBeInTheDocument();
  });

  it('startOnboarding_StripeUnavailable_ShowsRetryKeepsStatusAndRedirectsOnRetry', async () => {
    vi.mocked(ConnectApi.getStatus).mockResolvedValue(pendingStatus);
    vi.mocked(ConnectApi.createOnboardingLink)
      .mockRejectedValueOnce(problemError(503, 'stripe_connect_unavailable'))
      .mockResolvedValueOnce({ url: 'https://connect.stripe.com/setup/e/acct_verified_host/abc' });
    renderPage();

    fireEvent.click(await screen.findByTestId('connect-stripe-cta'));

    const alert = await screen.findByTestId('connect-onboarding-error');
    expect(alert).toHaveTextContent(i18n.t('apiErrors.codes.stripeConnectUnavailable'));
    // The linked account is still shown as it is on Stripe, never as disconnected.
    expect(screen.getByTestId('connect-status-badge')).toHaveTextContent(i18n.t('settings.connectStatusPending'));
    expect(screen.getByText('acct_verified_host')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();

    fireEvent.click(retryButton());

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/setup/e/acct_verified_host/abc'),
    );
    expect(ConnectApi.createOnboardingLink).toHaveBeenCalledTimes(2);
  });

  it('startOnboarding_Click_SendsNoReturnUrls', async () => {
    vi.mocked(ConnectApi.getStatus).mockResolvedValue({ ...pendingStatus, connectedAccountId: null });
    vi.mocked(ConnectApi.createOnboardingLink).mockResolvedValue({ url: 'https://connect.stripe.com/setup/e/x' });
    renderPage();

    fireEvent.click(await screen.findByTestId('connect-stripe-cta'));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/setup/e/x'));
    // A3-42: the return and refresh pages are built by the API.
    expect(ConnectApi.createOnboardingLink).toHaveBeenCalledWith();
    expect(ConnectApi.createAccount).not.toHaveBeenCalled();
  });

  it('startOnboarding_NotConfigured_ShowsMessageWithoutRetry', async () => {
    vi.mocked(ConnectApi.getStatus).mockResolvedValue(pendingStatus);
    vi.mocked(ConnectApi.createOnboardingLink).mockRejectedValue(problemError(503, 'stripe_connect_not_configured'));
    renderPage();

    fireEvent.click(await screen.findByTestId('connect-stripe-cta'));

    const alert = await screen.findByTestId('connect-onboarding-error');
    expect(alert).toHaveTextContent(i18n.t('apiErrors.codes.stripeConnectNotConfigured'));
    expect(screen.queryByRole('button', { name: i18n.t('settings.connectRetry') })).not.toBeInTheDocument();
    expect(screen.getByTestId('connect-status-badge')).toHaveTextContent(i18n.t('settings.connectStatusPending'));
  });

  it('startOnboarding_NotBillingAdmin_ShowsForbiddenWithoutRetry', async () => {
    vi.mocked(ConnectApi.getStatus).mockResolvedValue(pendingStatus);
    vi.mocked(ConnectApi.createOnboardingLink).mockRejectedValue(problemError(403, 'forbidden'));
    renderPage();

    fireEvent.click(await screen.findByTestId('connect-stripe-cta'));

    const alert = await screen.findByTestId('connect-onboarding-error');
    expect(alert).toHaveTextContent(i18n.t('apiErrors.forbidden'));
    expect(screen.queryByRole('button', { name: i18n.t('settings.connectRetry') })).not.toBeInTheDocument();
  });

  it('statusQuery_Loaded_WithoutChargesShowsGateBanner', async () => {
    vi.mocked(ConnectApi.getStatus).mockResolvedValue(pendingStatus);
    renderPage();

    expect(await screen.findByTestId('connect-checkout-gate-banner')).toHaveTextContent(
      i18n.t('settings.bookingSiteNotActive'),
    );
    expect(screen.queryByTestId('connect-status-error')).not.toBeInTheDocument();
  });
});
