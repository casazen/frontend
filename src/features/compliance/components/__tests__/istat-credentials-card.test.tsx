import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { onboardingAssistApi } from '@/api/onboarding-assist.api';
import { COLLABORATOR, OWNER, problemError } from '@/features/onboarding/__tests__/onboarding-fixtures';
import type { AssistRequest, PanelStep } from '@/types/onboarding.types';
import { IstatCredentialsCard } from '../istat-credentials-card';

vi.mock('@/api/onboarding-assist.api', () => ({
  onboardingAssistApi: { getIstatCredentialsStatus: vi.fn(), setIstatCredentials: vi.fn(), removeIstatCredentials: vi.fn(), reopenRequest: vi.fn() },
}));
vi.mock('@/api/onboarding.api', () => ({ onboardingApi: { listPanelSteps: vi.fn(), listAssistRequests: vi.fn(), requestAssist: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const session = vi.hoisted(() => ({
  flags: { octorateOnboarding: true } as Record<string, boolean>,
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: session.contexts }) }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: session.flags, isLoading: false }) }));

const PROPERTY_ID = '9d4f6a0e-2c1b-4c5d-8e7f-3a2b1c0d9e8f';
const USERNAME = 'ISTAT-UTENTE-77';
const PASSWORD = 'Pa55 Word S3cret!';

let client: QueryClient;
/** What the server holds: the steps and the requests of the host. The fakes answer from it. */
let steps: PanelStep[];
let requests: AssistRequest[];

function istatStep(overrides: Partial<PanelStep> = {}): PanelStep {
  return {
    id: 'step-1',
    kind: 'istatConnection',
    status: 'assistRequested',
    handoffMode: 'managedWindow',
    propertyId: PROPERTY_ID,
    channelCode: null,
    instructionsKey: 'panelIstat',
    activityId: null,
    nextCheckAt: null,
    lastVerificationOutcome: null,
    canConfirm: false,
    resume: { wizardType: null, draftEntityId: null, stepCode: null },
    startedAt: '2026-11-12T08:00:00Z',
    completedAt: null,
    ...overrides,
  };
}

function istatRequest(overrides: Partial<AssistRequest> = {}): AssistRequest {
  return {
    id: 'req-1',
    part: 'compliance',
    propertyId: PROPERTY_ID,
    context: 'panelIstat',
    status: 'Requested',
    requestedAt: '2026-11-12T08:00:00Z',
    updatedAt: '2026-11-12T08:00:00Z',
    completedAt: null,
    staffNote: null,
    activityId: 'a1',
    ...overrides,
  };
}

function renderCard(canEdit = true) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <IstatCredentialsCard propertyId={PROPERTY_ID} canEdit={canEdit} />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

beforeEach(async () => {
  await i18n.changeLanguage('it');
  session.flags = { octorateOnboarding: true };
  session.contexts = OWNER;
  steps = [];
  requests = [];
  vi.mocked(onboardingAssistApi.getIstatCredentialsStatus).mockReset().mockResolvedValue({ configured: false, configuredAt: null });
  vi.mocked(onboardingAssistApi.setIstatCredentials).mockReset();
  vi.mocked(onboardingAssistApi.removeIstatCredentials).mockReset();
  vi.mocked(onboardingAssistApi.reopenRequest).mockReset();
  vi.mocked(onboardingApi.listPanelSteps).mockReset().mockImplementation(() => Promise.resolve(steps));
  vi.mocked(onboardingApi.listAssistRequests).mockReset().mockImplementation(() => Promise.resolve(requests));
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

afterEach(cleanup);

// E20/F03/US02/T01 (NF-15, NF-107): the regional ISTAT credentials of a property are write-only, like the police ones.
describe('IstatCredentialsCard, the write-only credentials of the regional ISTAT', () => {
  it('IstatCredentialsCard_NotConfigured_ShowsNotConfiguredAndAnEmptyFormWithNothingTheBrowserCanFill', async () => {
    renderCard();

    expect(await screen.findByText(text('istatCredentials.notConfigured'))).toBeInTheDocument();
    expect(screen.getByLabelText(text('istatCredentials.fields.username'))).toHaveValue('');
    expect(screen.getByLabelText(text('istatCredentials.fields.password'))).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(text('istatCredentials.fields.password'))).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByLabelText(text('istatCredentials.fields.structureCode'))).toHaveValue('');
    expect(screen.getByRole('button', { name: text('istatCredentials.save') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: text('istatCredentials.remove') })).not.toBeInTheDocument();
  });

  it('IstatCredentialsCard_Configured_ShowsOnlyTheDateNeverAValue', async () => {
    vi.mocked(onboardingAssistApi.getIstatCredentialsStatus).mockResolvedValue({ configured: true, configuredAt: '2026-11-10T10:30:00Z' });
    renderCard();

    expect(await screen.findByText(/^Configurate il 10\/11\/2026/)).toBeInTheDocument();
    // Write-only: the form stays empty, there is nothing to reveal.
    expect(screen.getByLabelText(text('istatCredentials.fields.username'))).toHaveValue('');
    expect(screen.getByLabelText(text('istatCredentials.fields.password'))).toHaveValue('');
    expect(screen.getByRole('button', { name: text('istatCredentials.replace') })).toBeInTheDocument();
  });

  it('IstatCredentialsCard_MissingOrTooLongValues_AreToldOnTheFieldAndSendNothing', async () => {
    renderCard();
    await screen.findByText(text('istatCredentials.notConfigured'));

    fill(text('istatCredentials.fields.username'), '   ');
    fill(text('istatCredentials.fields.structureCode'), 'x'.repeat(51));
    fireEvent.click(screen.getByRole('button', { name: text('istatCredentials.save') }));

    expect(await screen.findByText(text('istatCredentials.errors.usernameRequired'))).toBeInTheDocument();
    expect(screen.getByText(text('istatCredentials.errors.passwordRequired'))).toBeInTheDocument();
    expect(screen.getByText(text('istatCredentials.errors.structureCodeTooLong'))).toBeInTheDocument();
    expect(screen.getByLabelText(text('istatCredentials.fields.username'))).toHaveAttribute('aria-invalid', 'true');
    expect(onboardingAssistApi.setIstatCredentials).not.toHaveBeenCalled();
  });

  it('IstatCredentialsCard_ValidValues_AreSentOnceThenLeaveTheFieldsAndTheCaches', async () => {
    vi.mocked(onboardingAssistApi.setIstatCredentials).mockResolvedValue({ configured: true, configuredAt: '2026-11-15T08:15:00Z' });
    renderCard();
    await screen.findByText(text('istatCredentials.notConfigured'));

    fill(text('istatCredentials.fields.username'), USERNAME);
    fill(text('istatCredentials.fields.password'), PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: text('istatCredentials.save') }));

    // The structure code is optional: left empty it goes as empty, the password exactly as typed.
    await waitFor(() => expect(onboardingAssistApi.setIstatCredentials).toHaveBeenCalledWith(PROPERTY_ID, { username: USERNAME, password: PASSWORD, structureCode: '' }));
    expect(await screen.findByText(/^Configurate il 15\/11\/2026/)).toBeInTheDocument();
    expect(screen.getByLabelText(text('istatCredentials.fields.username'))).toHaveValue('');
    expect(screen.getByLabelText(text('istatCredentials.fields.password'))).toHaveValue('');
    expect(toast.success).toHaveBeenCalledWith(text('istatCredentials.saved'));
    // Nothing the person typed stays anywhere the app keeps things: not in the cache of the queries, not in the one of the mutations, not in the page.
    await waitFor(() => expect(JSON.stringify(client.getMutationCache().getAll().map((mutation) => mutation.state))).not.toContain(PASSWORD));
    expect(JSON.stringify(client.getQueryCache().getAll().map((query) => query.state))).not.toContain(PASSWORD);
    expect(document.body.textContent).not.toContain(PASSWORD);
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(PASSWORD);
  });

  it('IstatCredentialsCard_TheServerRefuses_KeepsTheValuesToBeCorrectedAndShowsNoSecretInTheCache', async () => {
    vi.mocked(onboardingAssistApi.setIstatCredentials).mockRejectedValue(problemError(422, { code: 'istat_credentials_invalid' }));
    renderCard();
    await screen.findByText(text('istatCredentials.notConfigured'));

    fill(text('istatCredentials.fields.username'), USERNAME);
    fill(text('istatCredentials.fields.password'), PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: text('istatCredentials.save') }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByLabelText(text('istatCredentials.fields.username'))).toHaveValue(USERNAME);
    expect(screen.getByText(text('istatCredentials.notConfigured'))).toBeInTheDocument();
    // A refusal is kept without the request that was sent.
    await waitFor(() => expect(JSON.stringify(client.getMutationCache().getAll().map((mutation) => mutation.state.error))).not.toContain(PASSWORD));
  });

  it('IstatCredentialsCard_Remove_AsksForConfirmationAndShowsNotConfigured', async () => {
    vi.mocked(onboardingAssistApi.getIstatCredentialsStatus).mockResolvedValue({ configured: true, configuredAt: '2026-11-10T10:30:00Z' });
    vi.mocked(onboardingAssistApi.removeIstatCredentials).mockResolvedValue(undefined);
    renderCard();
    await screen.findByText(/^Configurate il/);

    fireEvent.click(screen.getByRole('button', { name: text('istatCredentials.remove') }));
    expect(onboardingAssistApi.removeIstatCredentials).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: text('istatCredentials.removeConfirm') }));

    await waitFor(() => expect(onboardingAssistApi.removeIstatCredentials).toHaveBeenCalledWith(PROPERTY_ID));
    expect(await screen.findByText(text('istatCredentials.notConfigured'))).toBeInTheDocument();
  });

  it('IstatCredentialsCard_ReadFails_SaysSoNeverNotConfiguredAndOffersNoForm', async () => {
    vi.mocked(onboardingAssistApi.getIstatCredentialsStatus).mockRejectedValue(new Error('network'));
    renderCard();

    expect(await screen.findByTestId('istat-credentials-error')).toBeInTheDocument();
    expect(screen.queryByText(text('istatCredentials.notConfigured'))).not.toBeInTheDocument();
    expect(screen.queryByTestId('istat-credentials-form')).not.toBeInTheDocument();
  });

  it('IstatCredentialsCard_WithoutThePermissionToWrite_ShowsTheStatusWithoutTheForm', async () => {
    renderCard(false);

    expect(await screen.findByText(text('istatCredentials.notConfigured'))).toBeInTheDocument();
    expect(screen.queryByTestId('istat-credentials-form')).not.toBeInTheDocument();
  });
});

// The request of help for the ISTAT connection, under the credentials: «Ci pensa CasaZen», then how support closed it.
describe('IstatCredentialsCard, the request of help of the ISTAT connection', () => {
  it('IstatCredentialsCard_NotTheOrganizationAdministrator_DrawsNoRequestAndAsksNothingOfTheRequests', async () => {
    session.contexts = COLLABORATOR;
    renderCard();
    await screen.findByText(text('istatCredentials.notConfigured'));

    expect(screen.queryByTestId('istat-credentials-assist')).not.toBeInTheDocument();
    expect(onboardingApi.listAssistRequests).not.toHaveBeenCalled();
    expect(onboardingApi.listPanelSteps).not.toHaveBeenCalled();
  });

  it('IstatCredentialsCard_NoRequestYet_OffersFalloPerMeForTheIstatConnectionOfThisProperty', async () => {
    vi.mocked(onboardingApi.requestAssist).mockResolvedValue(istatRequest());
    renderCard();

    fireEvent.click(await screen.findByTestId('assist-request-button'));

    await waitFor(() => expect(onboardingApi.requestAssist).toHaveBeenCalledWith({ part: 'compliance', context: 'panelIstat', propertyId: PROPERTY_ID, channelCode: undefined }));
  });

  it('IstatCredentialsCard_RequestInProgress_SaysCasaZenIsOnIt', async () => {
    requests = [istatRequest({ status: 'InProgress' })];
    renderCard();

    expect(await screen.findByTestId('assist-request-status')).toHaveTextContent(text('onboardingPlan.panel.assist.status.InProgress'));
    expect(screen.queryByTestId('assist-outcome')).not.toBeInTheDocument();
  });

  it('IstatCredentialsCard_ClosedByTheSupportAndTheStepDone_IsToldDeclaredBecauseTheIstatIsNeverReadOnThePanel', async () => {
    steps = [istatStep({ status: 'confirmed', completedAt: '2026-11-13T09:00:00Z' })];
    requests = [istatRequest({ status: 'Done', completedAt: '2026-11-13T09:00:00Z', outcome: 'declared', staffNote: 'Fatto con le credenziali della regione.' })];
    renderCard();

    const outcome = await screen.findByTestId('assist-outcome');
    expect(outcome).toHaveAttribute('data-outcome', 'declared');
    expect(outcome).toHaveTextContent(text('onboardingPlan.panel.assist.outcome.declared.title'));
    expect(outcome).toHaveTextContent(text('onboardingPlan.panel.assist.outcome.declared.text'));
    expect(within(outcome).getByTestId('assist-outcome-staff-note')).toHaveTextContent('Fatto con le credenziali della regione.');
    // A word that nobody checked is never shown as checked.
    expect(outcome).not.toHaveTextContent(text('onboardingPlan.panel.assist.outcome.verified.title'));
    expect(within(outcome).getByRole('button', { name: text('onboardingPlan.panel.assist.notWorking.action') })).toBeInTheDocument();
  });

  it('IstatCredentialsCard_ClosedAndVerified_IsToldVerified', async () => {
    steps = [istatStep({ status: 'verified', completedAt: '2026-11-13T09:00:00Z' })];
    requests = [istatRequest({ status: 'Done', completedAt: '2026-11-13T09:00:00Z', outcome: 'verified' })];
    renderCard();

    expect(await screen.findByTestId('assist-outcome')).toHaveAttribute('data-outcome', 'verified');
    expect(screen.getByTestId('assist-outcome')).toHaveTextContent(text('onboardingPlan.panel.assist.outcome.verified.title'));
  });

  it('IstatCredentialsCard_ClosedWithNoOutcomeRecorded_IsNeverShownAsVerified', async () => {
    steps = [istatStep({ status: 'confirmed', completedAt: '2026-11-13T09:00:00Z' })];
    // A request closed before the outcome was recorded: it says nothing of a check, so it is the support's word.
    requests = [istatRequest({ status: 'Done', completedAt: '2026-11-13T09:00:00Z', outcome: null })];
    renderCard();

    expect(await screen.findByTestId('assist-outcome')).toHaveAttribute('data-outcome', 'declared');
  });

  it('IstatCredentialsCard_ClosedButTheStepIsNotDoneAnyMore_TellsNothingOfThePastAndOffersTheRequestAgain', async () => {
    steps = [istatStep({ status: 'started' })];
    requests = [istatRequest({ status: 'Done', completedAt: '2026-11-13T09:00:00Z', outcome: 'declared' })];
    renderCard();

    expect(await screen.findByTestId('assist-request-button')).toBeInTheDocument();
    expect(screen.queryByTestId('assist-outcome')).not.toBeInTheDocument();
  });

  it('IstatCredentialsCard_NonFunziona_NeedsANoteThenReopensTheRequestWithItAndShowsItOpenAgain', async () => {
    steps = [istatStep({ status: 'confirmed', completedAt: '2026-11-13T09:00:00Z' })];
    requests = [istatRequest({ id: 'req-9', status: 'Done', completedAt: '2026-11-13T09:00:00Z', outcome: 'declared' })];
    vi.mocked(onboardingAssistApi.reopenRequest).mockImplementation((id, note) => {
      const reopened = istatRequest({ id, status: 'Requested', hostNote: note, reopenedAt: '2026-11-14T09:00:00Z', completedAt: null });
      requests = [reopened];
      return Promise.resolve(reopened);
    });
    renderCard();

    fireEvent.click(await screen.findByTestId('assist-reopen'));
    const dialog = await screen.findByTestId('assist-reopen-dialog');
    // The note is required: without it nothing is sent.
    fireEvent.click(within(dialog).getByTestId('assist-reopen-confirm'));
    expect(await within(dialog).findByTestId('assist-reopen-missing')).toHaveTextContent(text('onboardingPlan.panel.assist.notWorking.required'));
    expect(onboardingAssistApi.reopenRequest).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByTestId('assist-reopen-note'), { target: { value: 'Il portale dice ancora che mancano le credenziali.' } });
    expect(within(dialog).getByTestId('assist-reopen-counter')).toHaveTextContent('50/500');
    expect(within(dialog).getByTestId('assist-reopen-confirm')).toBeEnabled();
    fireEvent.click(within(dialog).getByTestId('assist-reopen-confirm'));

    await waitFor(() => expect(onboardingAssistApi.reopenRequest).toHaveBeenCalledWith('req-9', 'Il portale dice ancora che mancano le credenziali.'));
    await waitFor(() => expect(screen.queryByTestId('assist-reopen-dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith(text('onboardingPlan.panel.assist.notWorking.reopened'));
    // The request is open again, with what the host wrote, and the outcome is gone.
    const status = await screen.findByTestId('assist-request-status');
    expect(status).toHaveAttribute('data-status', 'Requested');
    expect(screen.getByTestId('assist-request-host-note')).toHaveTextContent('Il portale dice ancora che mancano le credenziali.');
    expect(screen.queryByTestId('assist-outcome')).not.toBeInTheDocument();
    // The note was free text of the person: it is not kept by the mutation once the dialog is done.
    await waitFor(() => expect(JSON.stringify(client.getMutationCache().getAll().map((mutation) => mutation.state.variables))).not.toContain('credenziali'));
  });

  it('IstatCredentialsCard_ReopenRefused_SaysWhyUnderTheNoteAndKeepsTheDialogOpen', async () => {
    steps = [istatStep({ status: 'confirmed', completedAt: '2026-11-13T09:00:00Z' })];
    requests = [istatRequest({ id: 'req-9', status: 'Done', completedAt: '2026-11-13T09:00:00Z', outcome: 'declared' })];
    vi.mocked(onboardingAssistApi.reopenRequest).mockRejectedValue(problemError(422, { code: 'assist_reopen_note_required' }));
    renderCard();

    fireEvent.click(await screen.findByTestId('assist-reopen'));
    const dialog = await screen.findByTestId('assist-reopen-dialog');
    fireEvent.change(within(dialog).getByTestId('assist-reopen-note'), { target: { value: 'scrivimi a mario@example.com' } });
    fireEvent.click(within(dialog).getByTestId('assist-reopen-confirm'));

    expect(await within(dialog).findByTestId('assist-reopen-error')).toHaveTextContent(text('apiErrors.codes.assistReopenNoteRequired'));
    expect(within(dialog).getByTestId('assist-reopen-note')).toHaveValue('scrivimi a mario@example.com');
    expect(within(dialog).getByTestId('assist-reopen-confirm')).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
