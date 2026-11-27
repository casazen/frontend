import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { getActivationPlan } from '@/api/marketplace.api';
import { propertiesApi } from '@/api/properties.api';
import { readWizardDraft } from '@/lib/wizard-draft';
import {
  ACTIVATION_PATH,
  SCOPE,
  WAIT,
  WIZARD_DRAFT_ID,
  currentLocation,
  onStep,
  plan,
  primaryButton,
  property,
  renderActivation,
} from './activation-fixtures';

/** Who the person is and whether the guided steps of the activation are on: the access step reads both. */
const host = vi.hoisted(() => ({ administrator: true, guidedSteps: true }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/marketplace.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/marketplace.api')>()),
  getActivationPlan: vi.fn(),
}));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ contexts: [{ contextKey: 'short-rent', roleKey: host.administrator ? 'property_owner' : 'property_manager' }] }),
}));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: { octorateOnboarding: host.guidedSteps } }) }));

// A whole wizard is rendered in these tests: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const ACCESS_STEP_URL = `${ACTIVATION_PATH}?propertyId=prop-1&step=access`;
const SECRET_USERNAME = 'host-login-4711';
const SECRET_PASSWORD = 'Pa$$-4711-secret';

/** The host has one property, linked to the channel manager, and the portal asks for what `requirements` says. */
function givenAPortalThatAsksFor(requirements: string[]) {
  vi.mocked(propertiesApi.getAll).mockResolvedValue([property()]);
  vi.mocked(getActivationPlan).mockImplementation(async (_kind, _code, propertyId) => plan({ propertyId, requirements }));
}

/** Everything the browser keeps for this tab and for the origin, as one text. */
function everythingTheBrowserKeeps(): string {
  const dump = (storage: Storage) => Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? '').map((key) => `${key}=${storage.getItem(key)}`);
  return [...dump(sessionStorage), ...dump(localStorage)].join('\n');
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  host.administrator = true;
  host.guidedSteps = true;
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('the access step: it asks only for what the portal asks for', () => {
  it('AccessStep_PortalThatAsksForHotelIdAndCredentials_ShowsThoseFieldsAndNoPanel', async () => {
    givenAPortalThatAsksFor(['hotelId', 'credentials']);
    renderActivation(ACCESS_STEP_URL);

    expect(await screen.findByTestId('activation-hotel-id-prop-1', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('activation-username')).toBeInTheDocument();
    expect(screen.getByTestId('activation-password')).toBeInTheDocument();
    expect(screen.queryByTestId('activation-panel-access')).not.toBeInTheDocument();
    // The channel manager is named by nobody here, and the channel is the one of the catalog.
    expect(screen.getByLabelText(i18n.t('marketplace.activation.access.hotelId.label', { property: 'Casa Rosa', name: 'Booking.com' }))).toBeInTheDocument();
  });

  it('AccessStep_PortalThatAsksOnlyForHotelId_HasNoLoginFields', async () => {
    givenAPortalThatAsksFor(['hotelId']);
    renderActivation(ACCESS_STEP_URL);

    expect(await screen.findByTestId('activation-hotel-id-prop-1', {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('activation-username')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activation-password')).not.toBeInTheDocument();
  });

  it('AccessStep_PasswordField_IsAPasswordFieldThatDoesNotOfferToBeRemembered', async () => {
    givenAPortalThatAsksFor(['credentials']);
    renderActivation(ACCESS_STEP_URL);

    const password = await screen.findByTestId('activation-password', {}, WAIT);
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'off');
  });

  it('Wizard_PortalThatAsksForNothing_HasNoAccessStep', async () => {
    givenAPortalThatAsksFor([]);
    renderActivation(ACCESS_STEP_URL);

    // The address names the access step, which this portal does not have: the wizard opens on the first step.
    await onStep('property');
    expect(screen.queryByText(i18n.t('marketplace.activation.steps.access.label'))).not.toBeInTheDocument();
  });
});

describe('the access step: what the person types is not kept', () => {
  it('AccessStep_UsernameAndPasswordTyped_AreNotInTheDraftNorInTheBrowserStorageNorInTheAddressAndAreEmptyAfterAResume', async () => {
    givenAPortalThatAsksFor(['hotelId', 'credentials']);
    renderActivation(ACCESS_STEP_URL);

    fireEvent.change(await screen.findByTestId('activation-hotel-id-prop-1', {}, WAIT), { target: { value: '5551234' } });
    fireEvent.change(screen.getByTestId('activation-username'), { target: { value: SECRET_USERNAME } });
    fireEvent.change(screen.getByTestId('activation-password'), { target: { value: SECRET_PASSWORD } });
    // What was typed is on the screen (the state of the page)...
    expect(screen.getByTestId('activation-username')).toHaveValue(SECRET_USERNAME);
    expect(screen.getByTestId('activation-password')).toHaveValue(SECRET_PASSWORD);
    // ...and in no address.
    expect(currentLocation()).not.toContain(SECRET_USERNAME);
    expect(currentLocation()).not.toContain(encodeURIComponent(SECRET_PASSWORD));

    // The person leaves: the shell writes the draft as the page goes away.
    cleanup();

    const draft = readWizardDraft(WIZARD_DRAFT_ID, SCOPE);
    // What is not a secret is the draft (the identifier of the property on the channel): the scan does cover the draft.
    expect(draft?.values.hotelIds).toEqual({ 'prop-1': '5551234' });
    expect(draft?.step).toBe('access');
    for (const kept of [JSON.stringify(draft), everythingTheBrowserKeeps()]) {
      expect(kept).not.toContain(SECRET_USERNAME);
      expect(kept).not.toContain(SECRET_PASSWORD);
    }

    // The same wizard opens again (a reload, a return from the panel): the draft is back, the login is not.
    renderActivation(ACCESS_STEP_URL);
    expect(await screen.findByTestId('activation-username', {}, WAIT)).toHaveValue('');
    expect(screen.getByTestId('activation-password')).toHaveValue('');
    expect(screen.getByTestId('activation-hotel-id-prop-1')).toHaveValue('5551234');
  });

  it('AccessStep_ContinueWithTheDataMissing_StaysOnTheStepAndSaysWhichFieldsAreEmpty', async () => {
    givenAPortalThatAsksFor(['hotelId', 'credentials']);
    renderActivation(ACCESS_STEP_URL);
    await screen.findByTestId('activation-hotel-id-prop-1', {}, WAIT);

    fireEvent.click(primaryButton());

    await waitFor(() => expect(screen.getByTestId('activation-hotel-id-prop-1')).toHaveAttribute('aria-invalid', 'true'), WAIT);
    expect(screen.getByTestId('activation-username')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('activation-password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('activation-finish-error')).toHaveTextContent(i18n.t('marketplace.activation.errors.accessIncomplete'));
    await onStep('access');
  });
});

describe('the access step: the access on the panel of the channel manager', () => {
  it('AccessStep_PanelAccessAskedAndThePersonIsNotTheAdministrator_SaysWhoDoesTheStepAndTheWizardWaits', async () => {
    host.administrator = false;
    givenAPortalThatAsksFor(['panelAccess']);
    renderActivation(ACCESS_STEP_URL);

    // The sentence of the guided steps that says who does this step, and nothing that would meet a 403.
    expect(await screen.findByTestId('activation-panel-admin-only', {}, WAIT)).toHaveTextContent(i18n.t('onboardingPlan.panel.adminOnly'));
    expect(primaryButton()).toBeDisabled();
  });

  it('AccessStep_PanelAccessAskedWhileTheGuidedStepsAreOff_SaysItIsNotAvailableYetAndTheWizardWaits', async () => {
    host.guidedSteps = false;
    givenAPortalThatAsksFor(['panelAccess']);
    renderActivation(ACCESS_STEP_URL);

    expect(await screen.findByTestId('activation-panel-unavailable', {}, WAIT)).toBeInTheDocument();
    expect(primaryButton()).toBeDisabled();
  });
});

describe('the access step: reached with no property chosen', () => {
  it('AccessStep_NoPropertyChosen_LeadsBackToTheChoiceInsideTheWizard', async () => {
    givenAPortalThatAsksFor(['hotelId']);
    renderActivation(`${ACTIVATION_PATH}?step=access`);

    fireEvent.click(await screen.findByTestId('activation-choose-first-button', {}, WAIT));

    await onStep('property');
    expect(currentLocation()).toContain('step=property');
  });
});
