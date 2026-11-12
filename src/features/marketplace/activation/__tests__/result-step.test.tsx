import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { activateActivation, getActivation, getActivationPlan } from '@/api/marketplace.api';
import { propertiesApi } from '@/api/properties.api';
import { readWizardDraft, writeWizardDraft } from '@/lib/wizard-draft';
import { MARKETPLACE_PATH } from '../../lib/marketplace-paths';
import {
  ACTIVATION_PATH,
  SCOPE,
  WAIT,
  WIZARD_DRAFT_ID,
  axiosError,
  currentLocation,
  onStep,
  plan,
  primaryButton,
  property,
  renderActivation,
  state,
} from './activation-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/marketplace.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/marketplace.api')>()),
  getActivationPlan: vi.fn(),
  getActivation: vi.fn(),
  activateActivation: vi.fn(),
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'short-rent', roleKey: 'property_owner' }] }) }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: { octorateOnboarding: true } }) }));

// A whole wizard is rendered in these tests: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const ACTIVATION_IDS: Record<string, string> = { 'prop-1': 'act-1', 'prop-2': 'act-2' };
const RETURN_TO = '/app/short-rent/somewhere-else';

/** The last step, as the host reaches it: both properties chosen and connected, their rooms mapped. `access` is what the portal asks for. */
function givenTheLastStep(requirements: string[] = ['hotelId']) {
  vi.mocked(propertiesApi.getAll).mockResolvedValue([property('prop-1', 'Casa Rosa'), property('prop-2', 'Casa Azzurra')]);
  vi.mocked(getActivationPlan).mockImplementation(async (_kind, _code, propertyId) =>
    plan({ propertyId, requirements, activationId: ACTIVATION_IDS[propertyId], activationStatus: 'Pending' }),
  );
  vi.mocked(getActivation).mockImplementation(async (id) => state({ activationId: id }));
  writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'activate', values: { propertyIds: ['prop-1', 'prop-2'], hotelIds: {} } });
}

/** «Attiva»: the last button, on the summary. */
async function activateAll(url = `${ACTIVATION_PATH}?step=activate`) {
  renderActivation(url);
  await screen.findByTestId('activation-activate-step', {}, WAIT);
  fireEvent.click(primaryButton());
  await onStep('fatto');
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('the result: each property, what happens next', () => {
  it('ResultStep_OneActiveAndOneToFix_ShowsEachPropertyWithItsReasonAndAFixOnlyForTheOneToFix', async () => {
    givenTheLastStep();
    vi.mocked(activateActivation).mockImplementation(async (id) =>
      id === 'act-1' ? state({ activationId: 'act-1', status: 'Active' }) : state({ activationId: 'act-2', propertyId: 'prop-2', status: 'ToFix', lastErrorCode: 'connection_not_enabled' }),
    );

    await activateAll();

    expect(screen.getByTestId('activation-result-prop-1')).toHaveAttribute('data-status', 'Active');
    expect(screen.getByTestId('activation-result-prop-2')).toHaveAttribute('data-status', 'ToFix');
    expect(screen.getByTestId('activation-result-prop-2-problem')).toHaveTextContent(i18n.t('apiErrors.codes.connectionNotEnabled'));
    expect(screen.queryByTestId('activation-result-prop-1-fix')).not.toBeInTheDocument();
    expect(screen.getByTestId('activation-result-prop-2-fix')).toBeInTheDocument();
    // The properties are activated in turn, each with its own activation.
    expect(vi.mocked(activateActivation).mock.calls.map(([id]) => id)).toEqual(['act-1', 'act-2']);
    // What CasaZen does by itself, and when; and the one next step.
    expect(screen.getByText(i18n.t('marketplace.activation.result.whatNext.checks'))).toBeInTheDocument();
    expect(screen.getByTestId('wizard-done-secondary')).toHaveTextContent(i18n.t('marketplace.activation.result.seeActive'));
  });

  it('ResultStep_ActivationTheServerRefuses_IsToFixWithItsReasonAndNeverActive', async () => {
    givenTheLastStep();
    vi.mocked(activateActivation).mockImplementation(async (id) => {
      if (id === 'act-1') throw axiosError(409, { code: 'marketplace_panel_access_pending' });
      return state({ activationId: 'act-2', propertyId: 'prop-2', status: 'Active' });
    });

    await activateAll();

    expect(screen.getByTestId('activation-result-prop-1')).toHaveAttribute('data-status', 'ToFix');
    expect(screen.getByTestId('activation-result-prop-1-problem')).toHaveTextContent(i18n.t('apiErrors.codes.marketplacePanelAccessPending'));
    // A refusal of one property does not stop the other.
    expect(screen.getByTestId('activation-result-prop-2')).toHaveAttribute('data-status', 'Active');
  });

  it('ResultStep_ServerSaysStillPending_IsNotShownAsActive', async () => {
    givenTheLastStep();
    vi.mocked(activateActivation).mockResolvedValue(state({ status: 'Pending' }));

    await activateAll();

    expect(screen.getByTestId('activation-result-prop-1')).toHaveAttribute('data-status', 'ToFix');
    expect(screen.getByTestId('activation-result-prop-2')).toHaveAttribute('data-status', 'ToFix');
  });

  it('ResultStep_Fix_OpensTheWizardAgainAtTheStepThatFailedWithThatPropertyChosen', async () => {
    givenTheLastStep(['hotelId']);
    vi.mocked(activateActivation).mockImplementation(async (id) =>
      id === 'act-1' ? state({ activationId: 'act-1', status: 'Active' }) : state({ activationId: 'act-2', propertyId: 'prop-2', status: 'ToFix', lastErrorCode: 'connection_not_enabled' }),
    );
    await activateAll();

    fireEvent.click(screen.getByTestId('activation-result-prop-2-fix'));

    // «The connection is not enabled» is about the access: the wizard is open again there, for the property that failed.
    await onStep('access');
    expect(currentLocation()).toContain('step=access');
    expect(currentLocation()).toContain('propertyId=prop-2');
    expect(await screen.findByTestId('activation-hotel-id-prop-2', {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('activation-hotel-id-prop-1')).not.toBeInTheDocument();
  });
});

describe('the result: the closing button and the way out', () => {
  it('ResultStep_ClosingButtonWithAReturnTo_GoesBackToThePageThePersonCameFrom', async () => {
    givenTheLastStep();
    vi.mocked(activateActivation).mockResolvedValue(state({ status: 'Active' }));
    await activateAll(`${ACTIVATION_PATH}?step=activate&returnTo=${encodeURIComponent(RETURN_TO)}`);

    fireEvent.click(screen.getByTestId('wizard-done-primary'));

    expect(await screen.findByTestId('somewhere-else-marker', {}, WAIT)).toBeInTheDocument();
  });

  it('ResultStep_ClosingButtonWithNoReturnTo_GoesToTheMarketplace', async () => {
    givenTheLastStep();
    vi.mocked(activateActivation).mockResolvedValue(state({ status: 'Active' }));
    await activateAll();

    fireEvent.click(screen.getByTestId('wizard-done-primary'));

    expect(await screen.findByTestId('marketplace-marker', {}, WAIT)).toBeInTheDocument();
  });

  it.each([['https://evil.example/app/'], ['//evil.example/app/x'], ['/login'], ['/app/../login']])(
    'ResultStep_ClosingButtonWithAReturnToThatIsNotAPageOfTheApp_%s_GoesToTheMarketplace',
    async (returnTo) => {
      givenTheLastStep();
      vi.mocked(activateActivation).mockResolvedValue(state({ status: 'Active' }));
      await activateAll(`${ACTIVATION_PATH}?step=activate&returnTo=${encodeURIComponent(returnTo)}`);

      fireEvent.click(screen.getByTestId('wizard-done-primary'));

      expect(await screen.findByTestId('marketplace-marker', {}, WAIT)).toBeInTheDocument();
      expect(currentLocation()).toBe(MARKETPLACE_PATH);
    },
  );

  it('ResultStep_AddressOfTheResultOpenedAgain_StillSaysSomethingTrueAndLeadsOn', async () => {
    givenTheLastStep();
    renderActivation(`${ACTIVATION_PATH}?step=fatto&returnTo=${encodeURIComponent(RETURN_TO)}`);

    // A reload has no result to show: it says the wizard is over and where to look, and the closing button still goes back.
    expect(await screen.findByTestId('activation-result', {}, WAIT)).toHaveTextContent(i18n.t('marketplace.activation.result.title.over'));
    expect(screen.queryByTestId('activation-result-list')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('wizard-done-primary'));
    expect(await screen.findByTestId('somewhere-else-marker', {}, WAIT)).toBeInTheDocument();
  });

  it('SaveAndExit_WithAReturnTo_GoesBackToThePageThePersonCameFromAndKeepsTheDraft', async () => {
    givenTheLastStep();
    renderActivation(`${ACTIVATION_PATH}?step=activate&returnTo=${encodeURIComponent(RETURN_TO)}`);
    await screen.findByTestId('activation-activate-step', {}, WAIT);

    fireEvent.click(screen.getByTestId('activation-save-exit'));

    expect(await screen.findByTestId('somewhere-else-marker', {}, WAIT)).toBeInTheDocument();
    // What was answered stays: the wizard opens again where it was left.
    await waitFor(() => expect(readWizardDraft(WIZARD_DRAFT_ID, SCOPE)?.values.propertyIds).toEqual(['prop-1', 'prop-2']), WAIT);
  });

  it('SaveAndExit_WithNoReturnTo_GoesToTheMarketplace', async () => {
    givenTheLastStep();
    renderActivation(`${ACTIVATION_PATH}?step=activate`);
    await screen.findByTestId('activation-activate-step', {}, WAIT);

    fireEvent.click(screen.getByTestId('activation-save-exit'));

    expect(await screen.findByTestId('marketplace-marker', {}, WAIT)).toBeInTheDocument();
  });

  it('Cancel_OnTheFirstStepWithAReturnTo_GoesBackThereAndDropsTheDraft', async () => {
    givenTheLastStep();
    renderActivation(`${ACTIVATION_PATH}?step=property&returnTo=${encodeURIComponent(RETURN_TO)}`);

    fireEvent.click(await screen.findByTestId('activation-exit', {}, WAIT));

    expect(await screen.findByTestId('somewhere-else-marker', {}, WAIT)).toBeInTheDocument();
    expect(readWizardDraft(WIZARD_DRAFT_ID, SCOPE)).toBeNull();
  });
});
