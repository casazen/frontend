import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import itLocale from '@/i18n/locales/it.json';
import enLocale from '@/i18n/locales/en.json';
import { onboardingApi } from '@/api/onboarding.api';
import { ACTIVATION_STEP_REASONS } from '@/types/onboarding.types';
import type { ActivationStep, OnboardingStatus } from '@/types/onboarding.types';
import { SitePublicationBanner } from '../site-publication-banner';

vi.mock('@/api/onboarding.api', () => ({ onboardingApi: { getStatus: vi.fn() } }));

const permissions = vi.hoisted(() => ({ canWrite: true, orgAdmin: true }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (_context: string, permission: string) =>
      permission === 'org.billing.admin' ? permissions.orgAdmin : permissions.canWrite,
  }),
}));

function status(steps: ActivationStep[], overrides: Partial<OnboardingStatus> = {}): OnboardingStatus {
  return {
    roleChosen: true,
    orgProvisioned: true,
    consentsAccepted: true,
    propertyCreated: false,
    sitePublished: false,
    firstBookingTaken: false,
    activated: false,
    publicBookingUrl: null,
    steps,
    ...overrides,
  };
}

function problemError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { status, code: 'internal_error' },
  });
}

function renderWidget(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  permissions.canWrite = true;
  permissions.orgAdmin = true;
  vi.mocked(onboardingApi.getStatus).mockReset();
});

afterEach(() => cleanup());

describe('SitePublicationBanner (A3-26)', () => {
  it('SitePublicationBanner_PublishedPropertyButStripeChargesOff_WarnsAndLinksToPayments', async () => {
    const steps: ActivationStep[] = [
      { key: 'sitePublished', state: 'inProgress', reason: 'payments_not_ready', done: 1, total: 1 },
    ];
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(steps));

    renderWidget(<SitePublicationBanner />);

    const banner = await screen.findByTestId('site-publication-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(within(banner).getByTestId('site-publication-banner-detail')).toHaveTextContent(
      i18n.t('activation.reasons.payments_not_ready'),
    );
    expect(within(banner).getByTestId('site-publication-banner-cta')).toHaveAttribute(
      'href',
      '/app/short-rent/settings/payments',
    );
  });

  it('SitePublicationBanner_SiteReallyPublished_ShowsNothing', async () => {
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(
      status([{ key: 'sitePublished', state: 'done', reason: null, done: 1, total: 1 }]),
    );

    renderWidget(<SitePublicationBanner />);

    await waitFor(() => expect(onboardingApi.getStatus).toHaveBeenCalled());
    expect(screen.queryByTestId('site-publication-banner')).not.toBeInTheDocument();
  });

  it('SitePublicationBanner_StatusCannotBeRead_ShowsNothingInsteadOfAWrongWarning', async () => {
    vi.mocked(onboardingApi.getStatus).mockRejectedValue(problemError(500));

    renderWidget(<SitePublicationBanner />);

    await waitFor(() => expect(onboardingApi.getStatus).toHaveBeenCalled());
    expect(screen.queryByTestId('site-publication-banner')).not.toBeInTheDocument();
  });
});

describe('activation translations (PL-15)', () => {
  type Tree = { [key: string]: string | Tree };
  const lookup = (tree: Tree, path: string): unknown => path.split('.').reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);

  it.each([
    ['it', itLocale],
    ['en', enLocale],
  ])('activationTranslations_%s_CoverEveryReasonStateAndStep', (_lang, locale) => {
    const activation = (locale as unknown as { activation: Tree }).activation;
    for (const reason of ACTIVATION_STEP_REASONS) {
      expect(lookup(activation, `reasons.${reason}`), `reasons.${reason}`).toEqual(expect.any(String));
    }
    for (const state of ['done', 'todo', 'inProgress', 'blocked']) {
      expect(lookup(activation, `state.${state}`), `state.${state}`).toEqual(expect.any(String));
    }
    for (const key of ['account', 'organization', 'property', 'cin', 'payments', 'sitePublished', 'firstBooking']) {
      expect(lookup(activation, `steps.${key}.title`), `steps.${key}.title`).toEqual(expect.any(String));
      const hasDone = lookup(activation, `steps.${key}.done`) ?? lookup(activation, `steps.${key}.done_other`);
      expect(hasDone, `steps.${key}.done`).toEqual(expect.any(String));
    }
  });
});
