import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import type { AdminAssistRequest, AssistChecklistProperty } from '@/types/onboarding.types';
import { AssistChecklist } from '../assist-checklist';

vi.mock('@/api/onboarding-assist.api', () => ({ onboardingAssistApi: { revealSecret: vi.fn(), storeVaultSecret: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ORG = 'aa11bb22-cc33-4d44-8e55-ff6677889900';
const PROPERTY = '77777777-0000-4000-8000-000000000001';
const OTHER_PROPERTY = '88888888-0000-4000-8000-000000000002';

function request(overrides: Partial<AdminAssistRequest> = {}): AdminAssistRequest {
  return {
    id: '9d4f6a0e-2c1b-4c5d-8e7f-3a2b1c0d9e8f',
    orgId: ORG,
    part: 'compliance',
    propertyId: PROPERTY,
    propertyName: 'Casa del Mare',
    comune: 'Rimini',
    context: 'panelPolice',
    status: 'Requested',
    requestedAt: '2026-11-12T08:00:00Z',
    updatedAt: '2026-11-12T08:00:00Z',
    completedAt: null,
    assignedToUserId: null,
    staffNote: null,
    draftWizardType: null,
    draftEntityId: null,
    ...overrides,
  };
}

function block(overrides: Partial<AssistChecklistProperty> = {}): AssistChecklistProperty {
  return {
    propertyId: PROPERTY,
    propertyName: 'Casa del Mare',
    comune: 'Rimini',
    panelUser: { present: true, updatedAt: '2026-11-10T09:00:00Z' },
    policeCredentials: { present: true, updatedAt: '2026-11-11T09:00:00Z' },
    istatCredentials: { present: true, updatedAt: '2026-11-12T09:00:00Z', requirement: 'toVerify' },
    sender: { sender: 'ChannelManager', changedAt: '2026-11-09T09:00:00Z', activationDeclared: false },
    steps: [{ kind: 'policeConnection', channelCode: null, instructionsKey: 'panelPolice', state: 'notStarted', lastVerificationOutcome: null, completedAt: null }],
    ...overrides,
  };
}

function renderChecklist(assist: AdminAssistRequest, checklist: AssistChecklistProperty[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <AssistChecklist request={assist} checklist={checklist} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const openButton = (kind: string) => screen.queryByTestId(`assist-reveal-open-${kind}`);

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

describe('AssistChecklist, what support needs for each property of a «Fallo per me» request (E20/F03/US02/T01)', () => {
  it('shows the actual work to perform without hiding the guide in an accordion', () => {
    renderChecklist(request({ context: 'panelIstat' }), [block({ country: 'IT' })]);
    const guide = screen.getByTestId('assist-checklist-task-guide');
    expect(guide).toHaveTextContent(i18n.t('complianceJurisdiction.guideIstat'));
    expect(within(guide).getAllByRole('listitem')).toHaveLength(3);
  });

  it('does not ask for Italian credentials or a sender for a Swiss property, even with stale API fields', () => {
    renderChecklist(request(), [block({ country: 'CH', policeCredentials: { present: false, updatedAt: null } })]);
    expect(screen.getByTestId('assist-checklist-local-requirements')).toHaveTextContent(i18n.t('complianceJurisdiction.foreignDescription'));
    expect(screen.queryByTestId('assist-checklist-police')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assist-checklist-istat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assist-checklist-sender')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assist-checklist-step-policeConnection')).not.toBeInTheDocument();
    expect(openButton('Police')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('complianceJurisdiction.ticinoLink') })).toHaveAttribute('href', 'https://www4.ti.ch/di/pol-new/servizi-online/notifiche-degli-ospiti-alla-polizia-no-lear');
  });

  it('never marks a non-required ISTAT credential missing', () => {
    renderChecklist(request(), [block({ country: 'IT', istatCredentials: { present: false, updatedAt: null, requirement: 'notRequired' } })]);
    expect(within(screen.getByTestId('assist-checklist-istat')).queryByTestId('assist-checklist-missing')).not.toBeInTheDocument();
    expect(openButton('RegionalIstat')).not.toBeInTheDocument();
  });

  it('AssistChecklist_RequestAboutThePolice_OffersThePanelAndThePoliceCredentialsAndNeverTheIstatOnes', () => {
    renderChecklist(request({ context: 'panelPolice' }), [block()]);

    // The credentials a request needs, and no more: the ISTAT ones are there to read (presence and date), but not to open.
    expect(openButton('OctoratePanel')).toBeInTheDocument();
    expect(openButton('Police')).toBeInTheDocument();
    expect(openButton('RegionalIstat')).not.toBeInTheDocument();
    expect(screen.getByTestId('assist-checklist-istat')).toBeInTheDocument();
  });

  it('AssistChecklist_RequestAboutIstat_OffersThePanelAndTheIstatCredentialsAndNeverThePoliceOnes', () => {
    renderChecklist(request({ context: 'panelIstat' }), [block({ istatCredentials: { present: true, updatedAt: '2026-11-12T09:00:00Z', requirement: 'required' } })]);

    expect(openButton('OctoratePanel')).toBeInTheDocument();
    expect(openButton('RegionalIstat')).toBeInTheDocument();
    expect(openButton('Police')).not.toBeInTheDocument();
    expect(screen.getByTestId('assist-checklist-istat-requirement')).toHaveAttribute('data-requirement', 'required');
  });

  it('AssistChecklist_RequestAboutAChannel_OffersOnlyThePanelUser', () => {
    renderChecklist(request({ part: 'channels', context: 'panelChannelAccess', propertyId: PROPERTY }), [block({ steps: [] })]);

    expect(openButton('OctoratePanel')).toBeInTheDocument();
    expect(openButton('Police')).not.toBeInTheDocument();
    expect(openButton('RegionalIstat')).not.toBeInTheDocument();
  });

  it('AssistChecklist_RequestOfTheWholeOrganization_OffersOnlyThePanelUserOfTheOrganizationAndNoCredentialOfAProperty', () => {
    const wholeOrg = request({ part: 'compliance', context: 'part', propertyId: null, propertyName: null, comune: null });
    renderChecklist(wholeOrg, [
      block({ propertyId: null, propertyName: null, comune: null, policeCredentials: null, istatCredentials: null, sender: null, steps: [] }),
      block({ propertyId: PROPERTY }),
      block({ propertyId: OTHER_PROPERTY, propertyName: 'Villa Lago' }),
    ]);

    const org = screen.getByTestId('assist-checklist-block-org');
    expect(within(org).getByTestId('assist-reveal-open-OctoratePanel')).toBeInTheDocument();
    expect(screen.getAllByTestId('assist-reveal-open-OctoratePanel')).toHaveLength(1);
    expect(openButton('Police')).not.toBeInTheDocument();
    expect(openButton('RegionalIstat')).not.toBeInTheDocument();
    expect(within(screen.getByTestId(`assist-checklist-block-${PROPERTY}`)).getByTestId('assist-checklist-sender-value')).toBeInTheDocument();
    expect(within(screen.getByTestId(`assist-checklist-block-${PROPERTY}`)).queryByRole('button', { name: /apri credenziali/i })).not.toBeInTheDocument();
  });

  it.each(['Done', 'Cancelled'] as const)('AssistChecklist_RequestThatIs%s_OffersNoOpeningNoStoreAndSaysItIsClosed', (status) => {
    renderChecklist(request({ status }), [block()]);

    expect(screen.getByTestId('assist-checklist-closed')).toHaveTextContent(i18n.t('onboardingPlan.assist.checklist.closed'));
    for (const kind of ['OctoratePanel', 'Police', 'RegionalIstat']) expect(openButton(kind)).not.toBeInTheDocument();
    expect(screen.queryByTestId('assist-vault-open')).not.toBeInTheDocument();
  });

  it('AssistChecklist_ACredentialThatIsNotThere_IsShownMissingAndHasNothingToOpen', () => {
    renderChecklist(request(), [block({ policeCredentials: { present: false, updatedAt: null }, panelUser: { present: false, updatedAt: null } })]);

    const police = screen.getByTestId('assist-checklist-police');
    expect(within(police).getByTestId('assist-checklist-missing')).toHaveTextContent(i18n.t('onboardingPlan.assist.checklist.presence.missing'));
    expect(openButton('Police')).not.toBeInTheDocument();
    expect(openButton('OctoratePanel')).not.toBeInTheDocument();
    expect(screen.getByTestId('assist-vault-open')).toHaveTextContent(i18n.t('onboardingPlan.assist.vault.open'));
  });

  it('AssistChecklist_ShowsPresenceAndDatesOnly_NeverAValueNorAFieldBeforeACredentialIsOpened', () => {
    const { container } = renderChecklist(request(), [block()]);

    expect(within(screen.getByTestId('assist-checklist-police')).getByTestId('assist-checklist-present')).toHaveTextContent('11 novembre 2026');
    expect(container.querySelectorAll('input, textarea')).toHaveLength(0);
    expect(container.textContent ?? '').not.toMatch(/password:|segreto|token/i);
    expect(container.textContent ?? '').not.toMatch(/octorate/i);
  });

  it('AssistChecklist_OpenCredentials_OpensTheDialogOfTheReasonForThatCredential', () => {
    renderChecklist(request(), [block()]);

    fireEvent.click(screen.getByTestId('assist-reveal-open-Police'));

    const dialog = screen.getByTestId('assist-reveal-dialog');
    expect(dialog).toHaveTextContent(i18n.t('onboardingPlan.assist.reveal.kinds.Police'));
    expect(within(dialog).getByTestId('assist-reveal-reason')).toBeInTheDocument();
    expect(within(dialog).queryByTestId('assist-reveal-values')).not.toBeInTheDocument();
  });

  it('AssistChecklist_StepsAndSender_AreToldInWordsWithTheGuideOfThePanel', () => {
    renderChecklist(request(), [block({ steps: [{ kind: 'istatConnection', channelCode: null, instructionsKey: 'panelIstat', state: 'assistRequested', lastVerificationOutcome: 'unverifiable', completedAt: null }] })]);

    const step = screen.getByTestId('assist-checklist-step-istatConnection');
    expect(step).toHaveAttribute('data-state', 'assistRequested');
    expect(within(step).getByTestId('assist-checklist-step-state')).toHaveTextContent(i18n.t('onboardingPlan.assist.checklist.steps.state.assistRequested'));
    expect(within(step).getByTestId('assist-checklist-step-check')).toHaveTextContent(i18n.t('onboardingPlan.assist.checklist.steps.lastCheck.unverifiable'));
    expect(within(step).getByTestId('assist-checklist-guide')).toBeInTheDocument();
    expect(screen.getByTestId('assist-checklist-sender-value')).toHaveTextContent(i18n.t('onboardingPlan.assist.checklist.sender.ChannelManager'));
  });

  it('AssistChecklist_AStepStateThisVersionDoesNotKnow_IsNeverReadAsDone', () => {
    renderChecklist(request(), [
      block({ steps: [{ kind: 'policeConnection', channelCode: null, instructionsKey: 'panelPolice', state: 'quantum' as never, lastVerificationOutcome: null, completedAt: null }] }),
    ]);

    const step = screen.getByTestId('assist-checklist-step-policeConnection');
    expect(within(step).getByTestId('assist-checklist-step-state')).toHaveAttribute('data-state', 'unknown');
    expect(within(step).getByTestId('assist-checklist-step-state')).toHaveTextContent(i18n.t('onboardingPlan.assist.checklist.steps.state.unknown'));
  });

  it('AssistChecklist_WithEveryBlockAndTheOpeningDialog_HasNoAccessibilityViolationAxeCanFind', async () => {
    const { container } = renderChecklist(request(), [block()]);
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByTestId('assist-reveal-open-OctoratePanel'));
    await screen.findByTestId('assist-reveal-dialog');
    await expectNoAxeViolations(document.body);
  });
});
