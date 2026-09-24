import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { BillingApi } from '@/api/billing.api';
import { useWorkspace } from '@/hooks/use-workspace';
import * as userQueries from '@/queries/use-users';
import type { BillingSubscription, PlanTier } from '@/types';
import { BillingSettingsPage } from '../billing-settings-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/billing.api', () => ({
  BillingApi: {
    getPlans: vi.fn(),
    getSubscription: vi.fn(),
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    updateProfile: vi.fn(),
  },
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));
vi.mock('@/queries/use-users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/use-users')>();
  return { ...actual, useCurrentUser: vi.fn() };
});
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

type CurrentUserResult = ReturnType<typeof userQueries.useCurrentUser>;
type WorkspaceResult = ReturnType<typeof useWorkspace>;

const BILLING_PATH = '/app/short-rent/settings/billing';
const PORTAL_URL = 'https://billing.stripe.com/p/session/test_123';

function subscription(overrides: Partial<BillingSubscription> = {}): BillingSubscription {
  return {
    planTier: 'Pro',
    status: 'active',
    currentPeriodEnd: '2026-10-24T08:00:00Z',
    seats: 1,
    billingCountry: 'IT',
    vatId: 'IT12345678901',
    ...overrides,
  };
}

function problemError(status: number, data: Record<string, unknown> = {}): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

function mockUser(planTier: PlanTier) {
  vi.mocked(userQueries.useCurrentUser).mockReturnValue({
    user: { orgId: 'org-1' },
    org: { id: 'org-1', name: 'Casa Test', slug: 'casa-test', planTier },
    planTier,
  } as unknown as CurrentUserResult);
}

function mockContexts(contextKeys: string[]) {
  vi.mocked(useWorkspace).mockReturnValue({
    contexts: contextKeys.map((contextKey) => ({
      contextKey,
      displayName: contextKey,
      roleKey: contextKey,
      permissions: [],
      defaultRoute: `/app/${contextKey}`,
    })),
  } as unknown as WorkspaceResult);
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[BILLING_PATH]}>
          <Routes>
            <Route path={BILLING_PATH} element={<BillingSettingsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function statusBadge() {
  return screen.getByTestId('subscription-status-badge');
}

describe('BillingSettingsPage', () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('location', { ...window.location, assign });
    mockContexts(['short-rent']);
    mockUser('Pro');
    vi.mocked(BillingApi.getSubscription).mockResolvedValue(subscription());
    vi.mocked(BillingApi.createPortalSession).mockResolvedValue({ portalUrl: PORTAL_URL });
    vi.mocked(BillingApi.updateProfile).mockResolvedValue({ billingCountry: 'IT', vatId: null, viesValidated: null });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('BillingSettingsPage_Loading_ShowsSkeletons', () => {
    vi.mocked(BillingApi.getSubscription).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('billing-loading')).toBeInTheDocument();
  });

  it('BillingSettingsPage_ApiError_ShowsErrorWithRetryNotAnEmptySubscription', async () => {
    vi.mocked(BillingApi.getSubscription).mockRejectedValueOnce(problemError(500));
    renderPage();

    const error = await screen.findByTestId('billing-error');
    expect(error).toHaveTextContent(i18n.t('billing.settings.loadError'));
    expect(screen.queryByTestId('subscription-empty')).not.toBeInTheDocument();

    fireEvent.click(within(error).getByRole('button', { name: i18n.t('shared.errorFallback.tryAgain') }));
    expect(await screen.findByTestId('subscription-card')).toBeInTheDocument();
  });

  it('BillingSettingsPage_NoSubscription_ShowsEmptyStateWithLinkToThePlans', async () => {
    mockUser('Starter');
    vi.mocked(BillingApi.getSubscription).mockResolvedValue(
      subscription({ planTier: 'Starter', status: 'none', currentPeriodEnd: null, billingCountry: null, vatId: null }),
    );
    renderPage();

    const empty = await screen.findByTestId('subscription-empty');
    expect(empty).toHaveTextContent(i18n.t('billing.settings.noneDescription', { plan: 'Starter' }));
    expect(within(empty).getByRole('link', { name: i18n.t('billing.settings.choosePlan') })).toHaveAttribute(
      'href',
      '/app/short-rent/settings/plan',
    );
    expect(screen.queryByTestId('billing-portal-button')).not.toBeInTheDocument();
  });

  it('BillingSettingsPage_Active_ShowsPlanStatusNextDueAndOpensThePortal', async () => {
    renderPage();

    await screen.findByTestId('subscription-card');
    expect(screen.getByTestId('plan-badge')).toHaveTextContent('Pro');
    expect(statusBadge()).toHaveTextContent(i18n.t('billing.status.active'));
    const expectedDate = new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Rome',
    }).format(new Date('2026-10-24T08:00:00Z'));
    expect(screen.getByTestId('subscription-next-due')).toHaveTextContent(expectedDate);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('billing.portal.managePayments') }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(PORTAL_URL));
  });

  it('BillingSettingsPage_PastDue_ShowsGraceNoticeWithPaymentAction', async () => {
    vi.mocked(BillingApi.getSubscription).mockResolvedValue(subscription({ status: 'past_due' }));
    renderPage();

    const notice = await screen.findByTestId('subscription-notice-past_due');
    expect(notice).toHaveTextContent(i18n.t('billing.notice.pastDue'));
    expect(statusBadge()).toHaveTextContent(i18n.t('billing.status.pastDue'));
  });

  it('BillingSettingsPage_Incomplete_ExplainsAndCompletesThePaymentInThePortal', async () => {
    mockUser('Starter');
    vi.mocked(BillingApi.getSubscription).mockResolvedValue(subscription({ planTier: 'Starter', status: 'incomplete' }));
    renderPage();

    const notice = await screen.findByTestId('subscription-notice-incomplete');
    expect(notice).toHaveTextContent(i18n.t('billing.notice.incomplete'));
    expect(statusBadge()).toHaveTextContent(i18n.t('billing.status.incomplete'));
    // The paid plan is not granted: the effective plan is shown.
    expect(screen.getByTestId('plan-badge')).toHaveTextContent('Starter');

    fireEvent.click(within(notice).getByRole('button', { name: i18n.t('billing.portal.completePayment') }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(PORTAL_URL));
  });

  it('BillingSettingsPage_Unpaid_ExplainsTheSuspension', async () => {
    mockUser('Starter');
    vi.mocked(BillingApi.getSubscription).mockResolvedValue(subscription({ status: 'unpaid' }));
    renderPage();

    expect(await screen.findByTestId('subscription-notice-unpaid')).toHaveTextContent(i18n.t('billing.notice.unpaid'));
    expect(statusBadge()).toHaveTextContent(i18n.t('billing.status.unpaid'));
  });

  it('BillingSettingsPage_Canceled_ShowsExpiredWithoutNextDueAndOffersThePlans', async () => {
    mockUser('Starter');
    vi.mocked(BillingApi.getSubscription).mockResolvedValue(subscription({ status: 'canceled' }));
    renderPage();

    expect(await screen.findByTestId('subscription-canceled-message')).toHaveTextContent(i18n.t('billing.notice.canceled'));
    expect(statusBadge()).toHaveTextContent(i18n.t('billing.status.canceled'));
    expect(screen.queryByTestId('subscription-next-due')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('billing.settings.choosePlan') })).toHaveAttribute(
      'href',
      '/app/short-rent/settings/plan',
    );
  });

  it('OpenPortal_NoStripeCustomer_ShowsTranslatedMessage', async () => {
    vi.mocked(BillingApi.createPortalSession).mockRejectedValue(problemError(400, { error: 'No Stripe customer' }));
    renderPage();

    fireEvent.click(await screen.findByTestId('billing-portal-button'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('billing.portal.noCustomer')));
    expect(assign).not.toHaveBeenCalled();
  });

  it('BillingProfile_SavedValues_ArePrefilledAndSavedNormalized', async () => {
    renderPage();
    const card = await screen.findByTestId('billing-profile-card');
    const country = within(card).getByLabelText(i18n.t('billing.profile.country'));
    const vatId = within(card).getByLabelText(i18n.t('billing.profile.vatId'));
    expect(country).toHaveValue('IT');
    expect(vatId).toHaveValue('IT12345678901');
    expect(card).toHaveTextContent(i18n.t('billing.profile.vatIdHint'));

    fireEvent.change(country, { target: { value: 'DE' } });
    fireEvent.change(vatId, { target: { value: 'de 123 456 789' } });
    fireEvent.click(within(card).getByRole('button', { name: i18n.t('billing.profile.save') }));

    await waitFor(() =>
      expect(BillingApi.updateProfile).toHaveBeenCalledWith({ billingCountry: 'DE', vatId: 'DE123456789' }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('billing.profile.saved')));
  });

  it('BillingProfile_EmptyVatId_IsNotSent', async () => {
    renderPage();
    const card = await screen.findByTestId('billing-profile-card');

    fireEvent.change(within(card).getByLabelText(i18n.t('billing.profile.vatId')), { target: { value: '' } });
    fireEvent.click(within(card).getByRole('button', { name: i18n.t('billing.profile.save') }));

    await waitFor(() => expect(BillingApi.updateProfile).toHaveBeenCalledWith({ billingCountry: 'IT' }));
  });

  it('BillingProfile_VatIdRefusedByTheBackend_ShowsTranslatedMessage', async () => {
    vi.mocked(BillingApi.updateProfile).mockRejectedValue(
      problemError(400, { error: 'Invalid VAT id', code: 'validation_error' }),
    );
    renderPage();
    const card = await screen.findByTestId('billing-profile-card');

    fireEvent.click(within(card).getByRole('button', { name: i18n.t('billing.profile.save') }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('billing.profile.vatRejected')));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('BillingProfile_VatIdWithSymbols_ShowsValidationWithoutCallingTheApi', async () => {
    renderPage();
    const card = await screen.findByTestId('billing-profile-card');

    fireEvent.change(within(card).getByLabelText(i18n.t('billing.profile.vatId')), { target: { value: 'IT#123' } });
    fireEvent.click(within(card).getByRole('button', { name: i18n.t('billing.profile.save') }));

    expect(await within(card).findByText(i18n.t('billing.profile.validation.vatIdInvalid'))).toBeInTheDocument();
    expect(BillingApi.updateProfile).not.toHaveBeenCalled();
  });

  it('BillingSettingsPage_NotBillingAdmin_AsksToContactTheAdministratorWithoutCallingTheApi', () => {
    mockContexts(['long-rent']);
    renderPage();

    expect(screen.getByTestId('billing-admin-required')).toHaveTextContent(i18n.t('billing.adminRequired.title'));
    expect(BillingApi.getSubscription).not.toHaveBeenCalled();
  });
});
