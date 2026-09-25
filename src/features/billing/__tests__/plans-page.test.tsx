import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { BillingApi } from '@/api/billing.api';
import { useWorkspace } from '@/hooks/use-workspace';
import { ME_QUERY_KEY } from '@/lib/onboarding-gate';
import * as userQueries from '@/queries/use-users';
import type { BillingPlan, BillingSubscription, PlanTier } from '@/types';
import { CHECKOUT_CONFIRM_POLL_MS, CHECKOUT_CONFIRM_TIMEOUT_MS } from '../billing-utils';
import { PlansPage, PlansPageContent } from '../plans-page';

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
  return { ...actual, useCurrentUser: vi.fn(), useEntitlement: vi.fn() };
});
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

type CurrentUserResult = ReturnType<typeof userQueries.useCurrentUser>;
type EntitlementResult = ReturnType<typeof userQueries.useEntitlement>;
type WorkspaceResult = ReturnType<typeof useWorkspace>;

const PLAN_PATH = '/app/short-rent/settings/plan';
const LONG_RENT_PLAN_PATH = '/app/long-rent/settings/plan';
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_123';
const PORTAL_URL = 'https://billing.stripe.com/p/session/test_123';

const plans: BillingPlan[] = [
  {
    tier: 'Starter',
    displayName: 'Starter',
    priceMonthly: 29,
    currency: 'EUR',
    unitAllowance: 3,
    features: ['Fino a 3 proprietà'],
    purchasable: true,
  },
  { tier: 'Pro', displayName: 'Pro', priceMonthly: 79, currency: 'EUR', unitAllowance: 50, features: [], purchasable: true },
  // No price in the configuration and no Stripe price id in this environment.
  { tier: 'Scale', displayName: 'Scale', priceMonthly: 0, currency: 'EUR', unitAllowance: -1, features: [], purchasable: false },
];

function subscription(overrides: Partial<BillingSubscription> = {}): BillingSubscription {
  return {
    planTier: 'Starter',
    status: 'none',
    currentPeriodEnd: null,
    seats: 1,
    billingCountry: null,
    vatId: null,
    ...overrides,
  };
}

function problemError(status: number, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: code ? { status, code, detail: 'Server detail' } : {},
  });
}

function mockUser(planTier: PlanTier = 'Starter') {
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

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderPage(search = '', path = PLAN_PATH) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`${path}${search}`]}>
          <Routes>
            <Route path={PLAN_PATH} element={<PlansPage />} />
            {/* The long-rent route renders the content only: the long-rent shell comes from the context layout. */}
            <Route path={LONG_RENT_PLAN_PATH} element={<PlansPageContent />} />
            <Route path="/app/short-rent/settings/billing" element={<p>billing page</p>} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return { invalidate };
}

function planButton(tier: PlanTier) {
  return within(screen.getByTestId(`plan-card-${tier}`)).getByRole('button');
}

async function openCheckoutFor(tier: PlanTier) {
  fireEvent.click(await screen.findByRole('button', { name: i18n.t('plan.choosePlan') }));
  const dialog = await screen.findByTestId('checkout-dialog');
  expect(dialog).toHaveTextContent(i18n.t('billing.checkout.title', { plan: tier }));
  return dialog;
}

async function submitCheckout(dialog: HTMLElement, country = 'IT', vatId = '') {
  fireEvent.change(within(dialog).getByLabelText(i18n.t('billing.profile.country')), { target: { value: country } });
  if (vatId) {
    fireEvent.change(within(dialog).getByLabelText(i18n.t('billing.profile.vatId')), { target: { value: vatId } });
  }
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('billing.checkout.submit') }));
}

describe('PlansPage', () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('location', { ...window.location, assign });
    mockContexts(['short-rent']);
    mockUser('Starter');
    vi.mocked(userQueries.useEntitlement).mockReturnValue({
      data: { orgId: 'org-1', planTier: 'Starter', limits: { maxProperties: 3 }, usage: { properties: 1 }, canAddProperty: true },
    } as unknown as EntitlementResult);
    vi.mocked(BillingApi.getPlans).mockResolvedValue(plans);
    vi.mocked(BillingApi.getSubscription).mockResolvedValue(subscription());
    vi.mocked(BillingApi.createCheckoutSession).mockResolvedValue({ checkoutUrl: CHECKOUT_URL });
    vi.mocked(BillingApi.createPortalSession).mockResolvedValue({ portalUrl: PORTAL_URL });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('PlansPage_Loading_ShowsSkeletonsNotAnEmptyList', () => {
    vi.mocked(BillingApi.getPlans).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('billing-plans-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('billing-plans-empty')).not.toBeInTheDocument();
  });

  it('PlansPage_ApiError_ShowsErrorWithRetryNotAnEmptyList', async () => {
    vi.mocked(BillingApi.getPlans).mockRejectedValueOnce(problemError(500));
    renderPage();

    const error = await screen.findByTestId('billing-plans-error');
    expect(error).toHaveTextContent(i18n.t('billing.plans.loadError'));
    expect(screen.queryByTestId('billing-plans-empty')).not.toBeInTheDocument();

    fireEvent.click(within(error).getByRole('button', { name: i18n.t('shared.errorFallback.tryAgain') }));
    expect(await screen.findByTestId('billing-plans-grid')).toBeInTheDocument();
    expect(BillingApi.getPlans).toHaveBeenCalledTimes(2);
  });

  it('PlansPage_NoPlans_ShowsEmptyState', async () => {
    vi.mocked(BillingApi.getPlans).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByTestId('billing-plans-empty')).toHaveTextContent(i18n.t('billing.plans.emptyTitle'));
  });

  it('PlansPage_Prices_ShowsApiPriceOrStripeNoteNeverAnInventedOne', async () => {
    renderPage();
    await screen.findByTestId('billing-plans-grid');

    // toHaveTextContent collapses the no-break space of the currency format into a space.
    const euro = (amount: number) =>
      new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR' }).format(amount).replace(/\s/g, ' ');
    expect(screen.getByTestId('plan-price-Pro')).toHaveTextContent(
      i18n.t('billing.plans.pricePerMonth', { price: euro(79) }),
    );
    expect(screen.getByTestId('plan-price-Scale')).toHaveTextContent(i18n.t('billing.plans.priceAtCheckout'));

    expect(planButton('Starter')).toHaveTextContent(i18n.t('plan.currentPlan'));
    expect(planButton('Starter')).toBeDisabled();
    expect(planButton('Pro')).toHaveTextContent(i18n.t('plan.choosePlan'));
    expect(planButton('Scale')).toHaveTextContent(i18n.t('billing.plans.unavailable'));
    expect(planButton('Scale')).toBeDisabled();
  });

  it('ChoosePlan_CountryAndVatId_StartsCheckoutAndRedirectsToStripe', async () => {
    renderPage();
    const dialog = await openCheckoutFor('Pro');

    await submitCheckout(dialog, 'IT', 'it 123.456.789-01');

    await waitFor(() => expect(assign).toHaveBeenCalledWith(CHECKOUT_URL));
    // Stripe comes back to this same page (PL-16); the backend builds the URL on its public domain.
    expect(BillingApi.createCheckoutSession).toHaveBeenCalledWith({
      planTier: 'Pro',
      billingCountry: 'IT',
      vatId: 'IT12345678901',
      returnPath: PLAN_PATH,
    });
  });

  it('ChoosePlan_FromTheLongRentShell_LandlordPaysAndReturnsToTheLongRentPlanPage', async () => {
    // PL-16 (A1-36): a landlord with only long-term leases is the billing administrator of its org.
    mockContexts(['long-rent']);
    renderPage('', LONG_RENT_PLAN_PATH);
    const dialog = await openCheckoutFor('Pro');

    await submitCheckout(dialog, 'IT');

    await waitFor(() => expect(assign).toHaveBeenCalledWith(CHECKOUT_URL));
    expect(screen.queryByTestId('billing-admin-required')).not.toBeInTheDocument();
    expect(BillingApi.createCheckoutSession).toHaveBeenCalledWith({
      planTier: 'Pro',
      billingCountry: 'IT',
      returnPath: LONG_RENT_PLAN_PATH,
    });
    expect(screen.getByTestId('billing-settings-link')).toHaveAttribute('href', '/app/long-rent/settings/billing');
  });

  it('ChoosePlan_NoCountry_ShowsValidationWithoutCallingTheApi', async () => {
    renderPage();
    const dialog = await openCheckoutFor('Pro');

    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('billing.checkout.submit') }));

    expect(await within(dialog).findByText(i18n.t('billing.profile.validation.countryRequired'))).toBeInTheDocument();
    expect(BillingApi.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('ChoosePlan_AlreadySubscribed409_ShowsMessageWithLinkToThePortal', async () => {
    vi.mocked(BillingApi.createCheckoutSession).mockRejectedValue(problemError(409, 'already_subscribed'));
    renderPage();
    const dialog = await openCheckoutFor('Pro');

    await submitCheckout(dialog);

    const alert = await screen.findByTestId('already-subscribed-alert');
    expect(alert).toHaveTextContent(i18n.t('apiErrors.codes.alreadySubscribed'));
    await waitFor(() => expect(screen.queryByTestId('checkout-dialog')).not.toBeInTheDocument());
    expect(assign).not.toHaveBeenCalled();

    fireEvent.click(within(alert).getByRole('button', { name: i18n.t('billing.portal.open') }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(PORTAL_URL));
    expect(BillingApi.createPortalSession).toHaveBeenCalledTimes(1);
  });

  it('ChoosePlan_PlanUnavailable422_ShowsPlanNotPurchasable', async () => {
    vi.mocked(BillingApi.createCheckoutSession).mockRejectedValue(problemError(422, 'billing_plan_unavailable'));
    renderPage();
    const dialog = await openCheckoutFor('Pro');

    await submitCheckout(dialog);

    expect(await within(dialog).findByTestId('checkout-error')).toHaveTextContent(
      i18n.t('apiErrors.codes.billingPlanUnavailable'),
    );
    expect(assign).not.toHaveBeenCalled();
    // The catalogue is read again: the card becomes "not available".
    await waitFor(() => expect(BillingApi.getPlans).toHaveBeenCalledTimes(2));
  });

  it('ChoosePlan_BillingGateClosed409_ShowsBillingNotAvailable', async () => {
    vi.mocked(BillingApi.createCheckoutSession).mockRejectedValue(problemError(409, 'billing_gate_closed'));
    renderPage();
    const dialog = await openCheckoutFor('Pro');

    await submitCheckout(dialog);

    expect(await within(dialog).findByTestId('checkout-error')).toHaveTextContent(
      i18n.t('apiErrors.codes.billingGateClosed'),
    );
    expect(screen.queryByTestId('already-subscribed-alert')).not.toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('LiveSubscription_Active_OffersThePortalInsteadOfASecondCheckout', async () => {
    mockUser('Pro');
    vi.mocked(BillingApi.getSubscription).mockResolvedValue(subscription({ planTier: 'Pro', status: 'active' }));
    renderPage();
    await screen.findByTestId('billing-plans-grid');

    expect(screen.getByTestId('live-subscription-notice')).toBeInTheDocument();
    expect(planButton('Pro')).toHaveTextContent(i18n.t('plan.currentPlan'));
    expect(planButton('Starter')).toHaveTextContent(i18n.t('billing.plans.changeInPortal'));
    expect(screen.queryByRole('button', { name: i18n.t('plan.choosePlan') })).not.toBeInTheDocument();

    fireEvent.click(planButton('Starter'));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(PORTAL_URL));
    expect(BillingApi.createCheckoutSession).not.toHaveBeenCalled();
    expect(BillingApi.createPortalSession).toHaveBeenCalledWith(PLAN_PATH);
  });

  it('CheckoutReturnSuccess_BackendReportsActive_ConfirmsAndRefreshesThePlan', async () => {
    vi.mocked(BillingApi.getSubscription).mockResolvedValue(subscription({ planTier: 'Pro', status: 'active' }));
    const { invalidate } = renderPage('?checkout=success');

    expect(await screen.findByTestId('checkout-return-confirmed')).toHaveTextContent(
      i18n.t('billing.checkout.return.confirmed', { plan: 'Pro' }),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ME_QUERY_KEY }));
    // The return parameter is consumed: a reload does not show the outcome again.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(new RegExp(`^${PLAN_PATH}$`)));
  });

  it('CheckoutReturnSuccess_WebhookNotReceivedYet_ShowsConfirmingNotSuccess', async () => {
    renderPage('?checkout=success');

    expect(await screen.findByTestId('checkout-return-confirming')).toHaveTextContent(
      i18n.t('billing.checkout.return.confirming'),
    );
    expect(screen.queryByTestId('checkout-return-confirmed')).not.toBeInTheDocument();
  });

  it('CheckoutReturnSuccess_WebhookArrivesLater_PollsTheBackendUntilActive', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(BillingApi.getSubscription)
      .mockResolvedValueOnce(subscription())
      .mockResolvedValue(subscription({ planTier: 'Pro', status: 'active' }));
    renderPage('?checkout=success');
    await screen.findByTestId('checkout-return-confirming');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECKOUT_CONFIRM_POLL_MS);
    });

    expect(await screen.findByTestId('checkout-return-confirmed')).toBeInTheDocument();
  });

  it('CheckoutReturnSuccess_NoConfirmationInTime_ShowsPendingWithRefresh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage('?checkout=success');
    await screen.findByTestId('checkout-return-confirming');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECKOUT_CONFIRM_TIMEOUT_MS);
    });

    const pending = await screen.findByTestId('checkout-return-pending');
    expect(pending).toHaveTextContent(i18n.t('billing.checkout.return.pending'));
    expect(screen.queryByTestId('checkout-return-confirmed')).not.toBeInTheDocument();
    const calls = vi.mocked(BillingApi.getSubscription).mock.calls.length;
    fireEvent.click(within(pending).getByRole('button', { name: i18n.t('billing.checkout.return.refresh') }));
    await waitFor(() => expect(vi.mocked(BillingApi.getSubscription).mock.calls.length).toBe(calls + 1));
  });

  it('CheckoutReturnSuccess_FirstPaymentIncomplete_ShowsCompletePaymentNotSuccess', async () => {
    vi.mocked(BillingApi.getSubscription).mockResolvedValue(subscription({ planTier: 'Starter', status: 'incomplete' }));
    renderPage('?checkout=success');

    const notice = await screen.findByTestId('subscription-notice-incomplete');
    expect(notice).toHaveTextContent(i18n.t('billing.notice.incomplete'));
    expect(screen.queryByTestId('checkout-return-confirmed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-return-confirming')).not.toBeInTheDocument();

    fireEvent.click(within(notice).getByRole('button', { name: i18n.t('billing.portal.completePayment') }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(PORTAL_URL));
  });

  it('CheckoutReturnCancel_ShowsNoChargeAndTheRealPlans', async () => {
    renderPage('?checkout=cancel');

    expect(await screen.findByTestId('checkout-return-canceled')).toHaveTextContent(
      i18n.t('billing.checkout.return.canceled'),
    );
    expect(await screen.findByTestId('billing-plans-grid')).toBeInTheDocument();
    expect(planButton('Starter')).toHaveTextContent(i18n.t('plan.currentPlan'));
  });

  it('PlansPage_NotBillingAdmin_AsksToContactTheAdministratorWithoutCallingTheApi', () => {
    mockContexts(['supplier']);
    renderPage();

    expect(screen.getByTestId('billing-admin-required')).toHaveTextContent(i18n.t('billing.adminRequired.description'));
    expect(BillingApi.getPlans).not.toHaveBeenCalled();
    expect(BillingApi.getSubscription).not.toHaveBeenCalled();
  });

  it('PlansPage_BillingLink_IsRelativeToTheCurrentContext', async () => {
    renderPage();

    expect(await screen.findByTestId('billing-settings-link')).toHaveAttribute('href', '/app/short-rent/settings/billing');
  });
});
