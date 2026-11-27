import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { ONBOARDING_FLOW_KEYS, type BulkProgress, type OnboardingPrerequisiteKey } from '@/types/onboarding.types';
import { ActivationDialog } from '../components/activation-dialog';

vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: { bulkProgress: vi.fn(), getFlowProperties: vi.fn(), activateFlow: vi.fn() },
}));

const P1 = '9d4f6a0e-2c1b-4c5d-8e7f-3a2b1c0d9e8f';

const PROGRESS: BulkProgress = {
  total: 1,
  ready: 1,
  notReady: 0,
  flows: ONBOARDING_FLOW_KEYS.map((flow) => ({ flow, active: 0, ready: flow === 'Reports' ? 1 : 0, toComplete: 0, notAvailable: flow === 'Reports' ? 0 : 1 })),
  pilot: { members: [], size: 0, recommendedMin: 5, maxSize: 10, belowRecommended: true, flows: [] },
};

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ActivationDialog open onOpenChange={() => undefined} />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  vi.mocked(onboardingApi.bulkProgress).mockReset().mockResolvedValue(PROGRESS);
  vi.mocked(onboardingApi.getFlowProperties)
    .mockReset()
    .mockResolvedValue({
      items: [{ propertyId: P1, name: 'Casa del Mare', city: 'Rimini', flow: 'Reports', state: 'toComplete', reason: 'flow_not_activated', action: 'activate', prerequisites: [] }],
      totalCount: 1,
      page: 1,
      pageSize: 100,
    });
});

afterEach(() => {
  cleanup();
});

describe('ActivationDialog, what a property still lacks (E10/F01/US04/T01 codes)', () => {
  it('ActivationDialog_UnmetPrerequisitesOfTheNewFlows_AreToldInPlainWordsAndAnUnknownOneNeverPrintsItsKey', async () => {
    // The server checked the prerequisites again and found three of the new ones lacking, one this version of the app has never heard of, and a repeat of it.
    vi.mocked(onboardingApi.activateFlow).mockResolvedValue({
      flow: 'Reports',
      outcomes: [
        {
          propertyId: P1,
          outcome: 'prerequisitesNotMet',
          unmetPrerequisites: ['messageSync', 'issuer', 'bookings', 'brandNewKey', 'anotherNewKey'] as unknown as OnboardingPrerequisiteKey[],
          reason: null,
        },
      ],
    });
    renderDialog();
    const dialog = await screen.findByTestId('activation-dialog');
    await waitFor(() => expect(within(dialog).getByTestId('activation-confirm')).toBeEnabled());

    fireEvent.click(within(dialog).getByTestId('activation-confirm'));

    const line = await within(dialog).findByTestId(`activation-not-Reports-${P1}`);
    expect(line).toHaveTextContent(i18n.t('onboardingPlan.summary.prerequisites.messageSync'));
    expect(line).toHaveTextContent(i18n.t('onboardingPlan.summary.prerequisites.issuer'));
    expect(line).toHaveTextContent(i18n.t('onboardingPlan.summary.prerequisites.bookings'));
    // The two keys of this version's future read as the same neutral phrase, said once; no key of the i18n file is ever printed.
    expect(line).toHaveTextContent(i18n.t('onboardingPlan.summary.prerequisites.unknown'));
    expect(line.textContent?.split(i18n.t('onboardingPlan.summary.prerequisites.unknown')).length).toBe(2);
    expect(dialog.textContent).not.toContain('onboardingPlan.');
    expect(dialog.textContent).not.toContain('brandNewKey');
  });
});
