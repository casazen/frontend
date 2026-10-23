import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import type { ActivationStep, OnboardingStatus } from '@/types/onboarding.types';
import { ActivationChecklist } from '../activation-checklist';

/**
 * The next step of the activation checklist is the shared `NextStepCard` of the calm blocks (UI-16). The card has its own test;
 * this one pins what the checklist hands it: the words, the order of the parts, the button, who does not get it, the state of
 * the link, and that the title is not a heading of the page (the checklist has its own).
 */
vi.mock('@/api/onboarding.api', () => ({ onboardingApi: { getStatus: vi.fn() } }));

const permissions = vi.hoisted(() => ({ canWrite: true, orgAdmin: true }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (_context: string, permission: string) => (permission === 'org.billing.admin' ? permissions.orgAdmin : permissions.canWrite),
  }),
}));

const STEPS: ActivationStep[] = [
  { key: 'account', state: 'done', reason: null },
  { key: 'organization', state: 'todo', reason: 'org_profile_incomplete' },
  { key: 'property', state: 'todo', reason: 'no_property' },
  { key: 'cin', state: 'blocked', reason: 'no_property' },
  { key: 'payments', state: 'todo', reason: 'connect_not_started' },
  { key: 'sitePublished', state: 'blocked', reason: 'no_property' },
  { key: 'firstBooking', state: 'blocked', reason: 'site_not_published' },
];

function status(steps: ActivationStep[]): OnboardingStatus {
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
  };
}

function Arrived() {
  return <p data-testid="arrived">{JSON.stringify(useLocation().state)}</p>;
}

function renderChecklist() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/short-rent']}>
          <Routes>
            <Route path="/app/short-rent" element={<ActivationChecklist />} />
            <Route path="*" element={<Arrived />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('ActivationChecklist, the next step (UI-16)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    permissions.canWrite = true;
    permissions.orgAdmin = true;
    vi.mocked(onboardingApi.getStatus).mockReset();
  });

  afterEach(() => cleanup());

  it('NextStep_FirstOpenStep_IsKickerTitleDetailPositionAndTheButtonInThatOrderAsParagraphs', async () => {
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(STEPS));
    renderChecklist();

    const next = await screen.findByTestId('activation-next-step');

    // The elements and the order of the markup it had before it was shared: four paragraphs and the button.
    expect(Array.from(next.children).map((child) => child.tagName)).toEqual(['P', 'P', 'P', 'P', 'A']);
    expect(Array.from(next.children).map((child) => child.textContent)).toEqual([
      i18n.t('activation.next.kicker'),
      i18n.t('activation.steps.organization.title'),
      i18n.t('activation.reasons.org_profile_incomplete'),
      i18n.t('activation.next.position', { current: 2, total: 7 }),
      i18n.t('activation.cta.organization'),
    ]);
  });

  it('NextStep_Title_IsNotAHeadingBecauseTheChecklistHasItsOwn', async () => {
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(STEPS));
    renderChecklist();

    const next = await screen.findByTestId('activation-next-step');

    expect(within(next).queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('NextStep_UserWhoCannotOpenThePage_SeesTheStepButNoButton', async () => {
    permissions.canWrite = false;
    permissions.orgAdmin = false;
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(STEPS));
    renderChecklist();

    const next = await screen.findByTestId('activation-next-step');

    expect(within(next).getByText(i18n.t('activation.steps.organization.title'))).toBeInTheDocument();
    expect(within(next).getByText(i18n.t('activation.reasons.org_profile_incomplete'))).toBeInTheDocument();
    expect(screen.queryByTestId('activation-next-step-cta')).not.toBeInTheDocument();
    expect(Array.from(next.children).map((child) => child.tagName)).toEqual(['P', 'P', 'P', 'P']);
  });

  it('NextStep_AccountStepStillOpen_OpensTheWizardWithTheFlagThatSaysTheUserCameToFinishAStep', async () => {
    const open: ActivationStep[] = STEPS.map((step) => (step.key === 'account' ? ({ key: 'account', state: 'todo', reason: 'onboarding_incomplete' } as ActivationStep) : step));
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(open));
    renderChecklist();

    const cta = await screen.findByTestId('activation-next-step-cta');
    expect(cta).toHaveAttribute('href', '/onboarding');
    fireEvent.click(cta);

    expect(screen.getByTestId('arrived')).toHaveTextContent('{"completeStep":true}');
  });

  it('NextStep_Position_CountsTheStepAmongAllOfThem', async () => {
    vi.mocked(onboardingApi.getStatus).mockResolvedValue(status(STEPS.map((step) => (step.key === 'organization' ? { ...step, state: 'done' as const, reason: null } : step))));
    renderChecklist();

    const next = await screen.findByTestId('activation-next-step');

    expect(within(next).getByText(i18n.t('activation.next.position', { current: 3, total: 7 }))).toBeInTheDocument();
    expect(within(next).getByText(i18n.t('activation.steps.property.title'))).toBeInTheDocument();
  });
});
