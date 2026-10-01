import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import it from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import { onboardingApi } from '@/api/onboarding.api';
import { ACTIVATION_STEP_REASONS } from '@/types/onboarding.types';
import type { ActivationStep, OnboardingStatus } from '@/types/onboarding.types';
import { ActivationChecklist } from '../activation-checklist';
import { SitePublicationBanner } from '../site-publication-banner';

vi.mock('@/api/onboarding.api', () => ({ onboardingApi: { getStatus: vi.fn() } }));

const permissions = vi.hoisted(() => ({ canWrite: true, orgAdmin: true }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (_context: string, permission: string) =>
      permission === 'org.billing.admin' ? permissions.orgAdmin : permissions.canWrite,
  }),
}));

const done = (key: ActivationStep['key'], extra: Partial<ActivationStep> = {}): ActivationStep => ({
  key,
  state: 'done',
  reason: null,
  ...extra,
});

/** A host who just signed up: nothing but the account is done, everything else says why. */
const NEW_HOST: ActivationStep[] = [
  done('account'),
  { key: 'organization', state: 'todo', reason: 'org_profile_incomplete' },
  { key: 'property', state: 'todo', reason: 'no_property' },
  { key: 'cin', state: 'blocked', reason: 'no_property' },
  { key: 'payments', state: 'todo', reason: 'connect_not_started' },
  { key: 'sitePublished', state: 'blocked', reason: 'no_property' },
  { key: 'firstBooking', state: 'blocked', reason: 'site_not_published' },
];

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

function renderWidget(ui: React.ReactElement = <ActivationChecklist />) {
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

describe('ActivationChecklist (PL-15, PLG-AC10)', () => {
  it('ActivationChecklist_Loading_ShowsSkeletonNotSteps', () => {
    vi.mocked(onboardingApi.getStatus).mockReturnValue(new Promise(() => {}));

    renderWidget();

    expect(screen.getByTestId('activation-checklist-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('activation-checklist')).not.toBeInTheDocument();
  });

  it('ActivationChecklist_ApiFails_ShowsTheErrorWithRetryNeverAnEmptyOrCompletedList', async () => {
    vi.mocked(onboardingApi.getStatus).mockRejectedValueOnce(problemError(500)).mockResolvedValueOnce(status(NEW_HOST));

    renderWidget();

    const alert = await screen.findByTestId('activation-checklist-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('activation-checklist')).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: i18n.t('activation.retry') }));

    expect(await screen.findByTestId('activation-checklist')).toBeInTheDocument();
    expect(screen.queryByTestId('activation-checklist-error')).not.toBeInTheDocument();
  });

  it('ActivationChecklist_NewHost_ShowsEachStepWithItsStateAndItsReason', async () => {
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(NEW_HOST));

    renderWidget();

    expect(await screen.findByTestId('activation-checklist')).toBeInTheDocument();
    expect(screen.getByTestId('activation-checklist-progress')).toHaveTextContent('1 passaggio su 7 completato');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByTestId('activation-step-account')).toHaveAttribute('data-state', 'done');
    expect(screen.getByTestId('activation-step-payments')).toHaveAttribute('data-state', 'todo');
    expect(screen.getByTestId('activation-step-payments-detail')).toHaveTextContent(
      i18n.t('activation.reasons.connect_not_started'),
    );
    expect(screen.getByTestId('activation-step-sitePublished')).toHaveAttribute('data-state', 'blocked');
    expect(screen.getByTestId('activation-step-sitePublished-state')).toHaveTextContent('In attesa');
    // The state is also a label, not only an icon or a color.
    expect(screen.getByTestId('activation-step-account-state')).toHaveTextContent('Completato');
  });

  it('ActivationChecklist_StripeStartedButChargesOff_IsInProgressNotDone', async () => {
    const steps = NEW_HOST.map((s) =>
      s.key === 'payments' ? ({ key: 'payments', state: 'inProgress', reason: 'connect_pending_verification' } as ActivationStep) : s,
    );
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(steps));

    renderWidget();

    const row = await screen.findByTestId('activation-step-payments');
    expect(row).toHaveAttribute('data-state', 'inProgress');
    expect(within(row).getByTestId('activation-step-payments-state')).toHaveTextContent('In corso');
    expect(within(row).getByTestId('activation-step-payments-detail')).toHaveTextContent(
      i18n.t('activation.reasons.connect_pending_verification'),
    );
  });

  it('ActivationChecklist_PausedProperties_SayThePropertiesArePausedAndLinkToThem', async () => {
    const steps: ActivationStep[] = [
      done('account'),
      done('organization'),
      done('property', { done: 2, total: 2 }),
      done('cin', { done: 2, total: 2 }),
      done('payments'),
      { key: 'sitePublished', state: 'todo', reason: 'properties_paused', done: 0, total: 2 },
      { key: 'firstBooking', state: 'blocked', reason: 'site_not_published' },
    ];
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(steps));

    renderWidget();

    const row = await screen.findByTestId('activation-step-sitePublished');
    expect(row).toHaveAttribute('data-state', 'todo');
    expect(within(row).getByTestId('activation-step-sitePublished-detail')).toHaveTextContent(
      i18n.t('activation.reasons.properties_paused'),
    );
    expect(within(row).getByTestId('activation-step-sitePublished-cta')).toHaveAttribute('href', '/app/short-rent/properties');
  });

  it('ActivationChecklist_CinPartiallyValid_ShowsHowManyPropertiesHaveOne', async () => {
    const steps = NEW_HOST.map((s) =>
      s.key === 'cin' ? ({ key: 'cin', state: 'inProgress', reason: 'cin_missing_or_invalid', done: 1, total: 3 } as ActivationStep) : s,
    );
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(steps));

    renderWidget();

    expect(await screen.findByTestId('activation-step-cin-detail')).toHaveTextContent(
      'CIN valido su 1 immobili di 3',
    );
  });

  it('ActivationChecklist_UserWithoutThePermissionOfAPage_ShowsNoLinkToIt', async () => {
    permissions.canWrite = false;
    permissions.orgAdmin = false;
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(NEW_HOST));

    renderWidget();

    await screen.findByTestId('activation-checklist');
    expect(screen.queryByTestId('activation-step-payments-cta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activation-step-organization-cta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activation-step-property-cta')).not.toBeInTheDocument();
  });

  it('ActivationChecklist_EveryStepDone_RendersNothing', async () => {
    const steps: ActivationStep[] = (
      ['account', 'organization', 'property', 'cin', 'payments', 'sitePublished', 'firstBooking'] as const
    ).map((key) => done(key, { done: 1, total: 1 }));
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(steps, { activated: true, sitePublished: true }));

    renderWidget();

    await waitFor(() => expect(onboardingApi.getStatus).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('activation-checklist-loading')).not.toBeInTheDocument());
    expect(screen.queryByTestId('activation-checklist')).not.toBeInTheDocument();
  });

  it('ActivationChecklist_ActivatedButAStepStillOpen_KeepsShowingTheOpenStep', async () => {
    const steps = NEW_HOST.map((s) => (s.key === 'organization' ? s : done(s.key, { done: 1, total: 1 })));
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(steps, { activated: true, sitePublished: true }));

    renderWidget();

    expect(await screen.findByTestId('activation-step-organization')).toHaveAttribute('data-state', 'todo');
    expect(screen.getByTestId('activation-checklist-progress')).toHaveTextContent('6 passaggi su 7 completati');
  });

  it('ActivationChecklist_StepOfAFutureVersion_IsLeftOutAndAnUnknownReasonFallsBackToNeutralText', async () => {
    const steps = [
      ...NEW_HOST.map((s) =>
        s.key === 'payments' ? ({ key: 'payments', state: 'todo', reason: 'a_future_reason' } as unknown as ActivationStep) : s,
      ),
      { key: 'brand_new_step', state: 'todo', reason: null } as unknown as ActivationStep,
    ];
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(steps));

    renderWidget();

    expect(await screen.findByTestId('activation-step-payments-detail')).toHaveTextContent(
      i18n.t('activation.reasons.unknown'),
    );
    expect(screen.queryByTestId('activation-step-brand_new_step')).not.toBeInTheDocument();
    expect(screen.getByTestId('activation-checklist-progress')).toHaveTextContent('1 passaggio su 7 completato');
  });

  it('ActivationChecklist_English_ShowsTranslatedTexts', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(NEW_HOST));

    renderWidget();

    expect(await screen.findByText('Activate your booking site')).toBeInTheDocument();
    expect(screen.getByTestId('activation-step-payments-detail')).toHaveTextContent(
      'You have not connected a Stripe account yet',
    );
    expect(screen.getByTestId('activation-step-account-state')).toHaveTextContent('Completed');
  });
});

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
    ['it', it],
    ['en', en],
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
