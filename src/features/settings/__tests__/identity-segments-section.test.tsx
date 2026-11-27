import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import en from '@/i18n/locales/en.json';
import it_ from '@/i18n/locales/it.json';
import { biometricSettingsApi } from '@/api/biometric-settings.api';
import { propertiesApi } from '@/api/properties.api';
import type { ContextBootstrapDto } from '@/api/contexts';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { contextOf } from '@/test/org-contexts';
import { expectNoAxeViolations } from '@/test/axe';
import type { Property } from '@/types';
import type { IdentitySegment, IdentitySegments } from '@/types/biometric-settings.types';
import { IdentitySegmentsSection } from '../components/identity-segments-section';
import {
  SEGMENT_CHANNEL_KEYS,
  SEGMENT_REASON_CODES,
  segmentModeKey,
  segmentModeOf,
  segmentReasonKey,
  suspensionReasonOf,
  withSegment,
} from '../lib/biometric-settings-model';
import { IDENTITY_SEGMENTS_QUERY_KEY } from '../use-biometric-settings';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/biometric-settings.api', () => ({
  biometricSettingsApi: { get: vi.fn(), update: vi.fn(), getModelsStatus: vi.fn(), getSegments: vi.fn(), createSegment: vi.fn(), updateSegment: vi.fn() },
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));

configure({ asyncUtilTimeout: 5_000 });

const CIE = "Carta d'identità elettronica italiana";

const segment = (overrides: Partial<IdentitySegment> = {}): IdentitySegment => ({
  id: 'segment-all-ios',
  propertyId: null,
  propertyName: null,
  formatId: 'it-cie',
  channel: 'web:ios-safari',
  mode: 'observation',
  qualified: false,
  qualificationReason: 'segment_not_qualified',
  qualifiedPolicyVersion: null,
  qualifiedAt: null,
  autoApprovalAllowed: false,
  autoApprovalReason: 'segment_observation',
  requiredAssurance: 'consistency',
  suspendedReason: null,
  ...overrides,
});

/** Three segments, one of each mode: observation for every property, automatic and qualified for «Casa Mare», suspended for «Casa Monti». */
const threeSegments = (): IdentitySegment[] => [
  segment(),
  segment({
    id: 'segment-mare-android',
    propertyId: 'property-mare',
    propertyName: 'Casa Mare',
    channel: 'web:android-chrome',
    mode: 'automatic',
    qualified: true,
    qualificationReason: null,
    qualifiedPolicyVersion: '2026.11-1',
    qualifiedAt: '2026-11-20T09:00:00Z',
    autoApprovalAllowed: true,
    autoApprovalReason: null,
  }),
  segment({
    id: 'segment-monti-desktop',
    propertyId: 'property-monti',
    propertyName: 'Casa Monti',
    channel: 'web:desktop-chromium',
    mode: 'suspended',
    qualificationReason: 'qualification_mismatch',
    autoApprovalReason: 'segment_suspended',
    suspendedReason: 'Troppi rifiuti su Android',
  }),
];

const overview = (overrides: Partial<IdentitySegments> = {}): IdentitySegments => ({
  segments: threeSegments(),
  formats: [{ id: 'it-cie', label: CIE }],
  channels: ['web:ios-safari', 'web:android-chrome', 'web:desktop-chromium', 'web:desktop-safari', 'web:desktop-firefox', 'web:other'],
  activePolicy: { version: '2026.11-1', provisional: false },
  autoApprovalEnabled: true,
  ...overrides,
});

const properties = [
  { id: 'property-mare', name: 'Casa Mare' },
  { id: 'property-monti', name: 'Casa Monti' },
] as Property[];

function httpError(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

function workspaceOf(contexts: ContextBootstrapDto[]): WorkspaceContextValue {
  return { contexts, activeContext: 'short-rent', isReady: true, setActiveContext: vi.fn(), hasPermission: () => true, getDefaultRoute: () => '/app/short-rent' };
}

interface RenderOptions {
  flags?: Partial<FeatureFlags>;
  contexts?: ContextBootstrapDto[];
  /** What surrounds the section: a page that has a form of its own. */
  wrap?: (section: ReactNode) => ReactNode;
}

function renderSection({ flags = {}, contexts = [contextOf('short-rent')], wrap = (section) => section }: RenderOptions = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, checkInIdentityVerification: true, checkInIdentitySelfHosted: true, ...flags }, isLoading: false }}>
          <WorkspaceContext.Provider value={workspaceOf(contexts)}>{wrap(<IdentitySegmentsSection />)}</WorkspaceContext.Provider>
        </FeatureFlagsContext.Provider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return { ...view, client };
}

const rows = () => screen.findAllByTestId('identity-segment');
const rowOf = async (id: string) => (await rows()).find((row) => row.getAttribute('data-segment-id') === id) as HTMLElement;
const radio = (row: HTMLElement, name: string) => within(row).getByRole('radio', { name }) as HTMLInputElement;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(biometricSettingsApi.getSegments).mockResolvedValue(overview());
  vi.mocked(propertiesApi.getAll).mockResolvedValue(properties);
  vi.mocked(biometricSettingsApi.updateSegment).mockImplementation(async (id, request) => ({
    ...threeSegments().find((entry) => entry.id === id)!,
    mode: request.mode,
    suspendedReason: request.mode === 'suspended' ? (request.reason ?? null) : null,
  }));
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('identity-segments-section: who sees it and what it asks (E70/F03/US01/T02, AC1)', () => {
  it('hidden for non admins', () => {
    // The API answers 403 to a member of the org who is not its administrator: the section is not drawn for them and asks nothing, whatever the flags say.
    renderSection({ contexts: [contextOf('short-rent', 'property_manager')] });

    expect(screen.queryByTestId('identity-segments-section')).not.toBeInTheDocument();
    expect(biometricSettingsApi.getSegments).not.toHaveBeenCalled();
    expect(propertiesApi.getAll).not.toHaveBeenCalled();
  });

  it('IdentitySegmentsSection_SelfHostedFlagOff_ShowsNothingAndAsksNothing', () => {
    renderSection({ flags: { checkInIdentitySelfHosted: false } });

    expect(screen.queryByTestId('identity-segments-section')).not.toBeInTheDocument();
    expect(biometricSettingsApi.getSegments).not.toHaveBeenCalled();
  });

  it('IdentitySegmentsSection_IdentityVerificationFlagOff_ShowsNothingAndAsksNothingEvenWithTheSelfHostedOne', () => {
    renderSection({ flags: { checkInIdentityVerification: false } });

    expect(screen.queryByTestId('identity-segments-section')).not.toBeInTheDocument();
    expect(biometricSettingsApi.getSegments).not.toHaveBeenCalled();
  });

  it('IdentitySegmentsSection_TheOrgAdministrator_ReadsTheSegmentsOnce', async () => {
    renderSection();

    expect(await screen.findByTestId('identity-segments-section')).toBeInTheDocument();
    expect(await rows()).toHaveLength(3);
    expect(biometricSettingsApi.getSegments).toHaveBeenCalledTimes(1);
    // Nothing of the properties is asked until a segment is added.
    expect(propertiesApi.getAll).not.toHaveBeenCalled();
  });
});

describe('identity-segments-section: the list (E70/F03/US01/T02, AC2)', () => {
  it('IdentitySegmentsSection_EachMode_ShowsWhereItAppliesTheDocumentTheBrowserTheModeAndWhyOrWhetherQualified', async () => {
    renderSection();
    const list = await rows();

    const [all, mare, monti] = list;
    // Observation, every property, not qualified: the reason in plain words.
    expect(within(all).getByTestId('identity-segment-property')).toHaveTextContent('Tutte le strutture');
    expect(within(all).getByTestId('identity-segment-kind')).toHaveTextContent(`${CIE} · Safari su iPhone e iPad`);
    expect(within(all).getByTestId('identity-segment-mode')).toHaveTextContent('Osservazione');
    expect(all).toHaveAttribute('data-mode', 'observation');
    expect(within(all).getByTestId('identity-segment-qualification')).toHaveTextContent(i18n.t('biometricSettings.segments.reason.segment_not_qualified'));
    // Automatic and qualified for the policy in force: «qualificato», with the version, and it approves.
    expect(within(mare).getByTestId('identity-segment-property')).toHaveTextContent('Casa Mare');
    expect(within(mare).getByTestId('identity-segment-kind')).toHaveTextContent('Chrome su Android');
    expect(within(mare).getByTestId('identity-segment-mode')).toHaveTextContent('Automatica');
    expect(within(mare).getByTestId('identity-segment-qualification')).toHaveTextContent('Qualificato per la politica 2026.11-1.');
    expect(within(mare).queryByTestId('identity-segment-not-approving')).not.toBeInTheDocument();
    // Suspended: the reason of the suspension, and why it is not qualified.
    expect(within(monti).getByTestId('identity-segment-property')).toHaveTextContent('Casa Monti');
    expect(within(monti).getByTestId('identity-segment-mode')).toHaveTextContent('Sospesa');
    expect(within(monti).getByTestId('identity-segment-suspended-reason')).toHaveTextContent('Troppi rifiuti su Android');
    expect(within(monti).getByTestId('identity-segment-qualification')).toHaveTextContent(i18n.t('biometricSettings.segments.reason.qualification_mismatch'));
  });

  it('IdentitySegmentsSection_TheActivePolicy_IsNamedWithItsVersionAndWhetherItIsProvisional', async () => {
    vi.mocked(biometricSettingsApi.getSegments).mockResolvedValue(overview({ activePolicy: { version: '2026.11-1', provisional: true } }));
    renderSection();

    const policy = await screen.findByTestId('identity-segments-policy');
    expect(policy).toHaveTextContent('Politica di decisione in uso: 2026.11-1.');
    expect(policy).toHaveTextContent('Provvisoria');
  });

  it('IdentitySegmentsSection_NoUsablePolicy_SaysSo', async () => {
    vi.mocked(biometricSettingsApi.getSegments).mockResolvedValue(overview({ activePolicy: { version: null, provisional: true } }));
    renderSection();

    expect(await screen.findByTestId('identity-segments-policy')).toHaveTextContent(i18n.t('biometricSettings.segments.policy.none'));
  });

  it('IdentitySegmentsSection_AnAutomaticSegmentThatDoesNotApprove_SaysItDoesNotAndWhy', async () => {
    vi.mocked(biometricSettingsApi.getSegments).mockResolvedValue(
      overview({ segments: [segment({ ...threeSegments()[1], autoApprovalAllowed: false, autoApprovalReason: 'auto_approval_disabled' })], autoApprovalEnabled: false }),
    );
    renderSection();

    const notApproving = await screen.findByTestId('identity-segment-not-approving');
    expect(notApproving).toHaveTextContent(i18n.t('biometricSettings.segments.notApproving'));
    expect(notApproving).toHaveTextContent(i18n.t('biometricSettings.segments.reason.auto_approval_disabled'));
  });

  it('IdentitySegmentsSection_NoSegmentYet_SaysEveryVerificationStaysInObservation', async () => {
    vi.mocked(biometricSettingsApi.getSegments).mockResolvedValue(overview({ segments: [] }));
    renderSection();

    expect(await screen.findByTestId('identity-segments-empty')).toHaveTextContent(i18n.t('biometricSettings.segments.empty'));
    expect(screen.queryByTestId('identity-segment')).not.toBeInTheDocument();
  });

  it('IdentitySegmentsSection_AChannelOrReasonThePageDoesNotKnow_IsShownWithoutBreakingTheList', async () => {
    vi.mocked(biometricSettingsApi.getSegments).mockResolvedValue(
      overview({ segments: [segment({ channel: 'web:desktop-edge-of-the-future', qualificationReason: 'a_reason_of_the_future', mode: 'a_mode_of_the_future' as IdentitySegment['mode'] })] }),
    );
    renderSection();

    const [row] = await rows();
    expect(within(row).getByTestId('identity-segment-kind')).toHaveTextContent('web:desktop-edge-of-the-future');
    expect(within(row).getByTestId('identity-segment-qualification')).toHaveTextContent(i18n.t('biometricSettings.segments.reason.other'));
    // A mode it does not know is observation, the prudent one.
    expect(row).toHaveAttribute('data-mode', 'observation');
    expect(radio(row, 'Osservazione')).toBeChecked();
  });

  it('IdentitySegmentsSection_TheBanner_SaysThatAPersonAlwaysDecidesInObservationAndThatQualificationIsNotDoneHere', async () => {
    renderSection();

    expect(await screen.findByTestId('identity-segments-observation')).toHaveTextContent('il sistema calcola una decisione automatica ma decide sempre una persona');
    expect(screen.queryByTestId('identity-segments-auto-disabled')).not.toBeInTheDocument();
    expect(screen.getByTestId('identity-segments-qualification-hint')).toHaveTextContent('la fanno gli amministratori della piattaforma');
  });

  it('IdentitySegmentsSection_AutomaticApprovalIsOffOnThePlatform_SaysSo', async () => {
    vi.mocked(biometricSettingsApi.getSegments).mockResolvedValue(overview({ autoApprovalEnabled: false }));
    renderSection();

    expect(await screen.findByTestId('identity-segments-auto-disabled')).toHaveTextContent('disattivata su tutta la piattaforma');
  });

  it('IdentitySegmentsSection_TheSegmentsCannotBeRead_IsAnErrorWithATryAgainNeverTheList', async () => {
    vi.mocked(biometricSettingsApi.getSegments).mockRejectedValueOnce(httpError(403));
    renderSection();

    const error = await screen.findByTestId('identity-segments-error');
    expect(screen.queryByTestId('identity-segment')).not.toBeInTheDocument();

    fireEvent.click(within(error).getByRole('button'));
    expect(await rows()).toHaveLength(3);
  });

  it('IdentitySegmentsSection_AReadThatFailsAfterAGoodOne_IsAnErrorAndTheOldListIsNotShown', async () => {
    const { client } = renderSection();
    await rows();

    vi.mocked(biometricSettingsApi.getSegments).mockRejectedValue(httpError(404));
    await act(async () => {
      await client.refetchQueries({ queryKey: IDENTITY_SEGMENTS_QUERY_KEY });
    });

    // The query keeps the older answer in memory, but the section says it cannot be read: a 404 is never the list of before.
    expect(client.getQueryData(IDENTITY_SEGMENTS_QUERY_KEY)).toBeDefined();
    expect(await screen.findByTestId('identity-segments-error')).toBeInTheDocument();
    expect(screen.queryByTestId('identity-segment')).not.toBeInTheDocument();
  });
});

describe('identity-segments-section: the mode of a segment (E70/F03/US01/T02, AC2 and AC3)', () => {
  it('IdentitySegmentsSection_ASegmentThatIsNotQualified_CannotBeMadeAutomaticAndSaysWhy', async () => {
    renderSection();
    const row = await rowOf('segment-all-ios');

    expect(radio(row, 'Automatica')).toBeDisabled();
    expect(radio(row, 'Osservazione')).toBeEnabled();
    expect(radio(row, 'Sospesa')).toBeEnabled();
    expect(radio(row, 'Osservazione')).toBeChecked();
    // The sentence is tied to the radio, so a screen reader says why it is off.
    expect(radio(row, 'Automatica')).toHaveAccessibleDescription(i18n.t('biometricSettings.segments.automaticNeedsQualification'));

    fireEvent.click(radio(row, 'Automatica'));
    expect(biometricSettingsApi.updateSegment).not.toHaveBeenCalled();
  });

  it('IdentitySegmentsSection_AQualifiedSegment_CanBeMadeAutomaticAndTheModeIsSent', async () => {
    vi.mocked(biometricSettingsApi.getSegments).mockResolvedValue(
      overview({ segments: [segment({ id: 'segment-q', qualified: true, qualificationReason: null, qualifiedPolicyVersion: '2026.11-1', autoApprovalReason: 'segment_observation' })] }),
    );
    vi.mocked(biometricSettingsApi.updateSegment).mockResolvedValue(
      segment({ id: 'segment-q', mode: 'automatic', qualified: true, qualificationReason: null, qualifiedPolicyVersion: '2026.11-1', autoApprovalAllowed: true, autoApprovalReason: null }),
    );
    renderSection();
    const row = await rowOf('segment-q');
    expect(radio(row, 'Automatica')).toBeEnabled();

    fireEvent.click(radio(row, 'Automatica'));

    await waitFor(() => expect(biometricSettingsApi.updateSegment).toHaveBeenCalledWith('segment-q', { mode: 'automatic' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('biometricSettings.segments.saved')));
    // What the server answered is what is shown.
    await waitFor(() => expect(radio(row, 'Automatica')).toBeChecked());
    expect(within(row).getByTestId('identity-segment-mode')).toHaveTextContent('Automatica');
  });

  it('IdentitySegmentsSection_BackToObservation_IsSentAtOnceWithoutAReason', async () => {
    renderSection();
    const row = await rowOf('segment-mare-android');

    fireEvent.click(radio(row, 'Osservazione'));

    await waitFor(() => expect(biometricSettingsApi.updateSegment).toHaveBeenCalledWith('segment-mare-android', { mode: 'observation' }));
    await waitFor(() => expect(row).toHaveAttribute('data-mode', 'observation'));
  });

  it('IdentitySegmentsSection_Suspending_AsksForAReasonAndSendsNothingWithoutOne', async () => {
    renderSection();
    const row = await rowOf('segment-mare-android');

    fireEvent.click(radio(row, 'Sospesa'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(i18n.t('biometricSettings.segments.suspend.title'))).toBeInTheDocument();
    // The segment is still what it was, and nothing was sent (the page behind a modal dialog is hidden from the accessibility tree: the radio is found as it is).
    expect(within(row).getByRole('radio', { name: 'Automatica', hidden: true })).toBeChecked();
    const confirm = within(dialog).getByRole('button', { name: i18n.t('biometricSettings.segments.suspend.confirm') });
    expect(confirm).toBeDisabled();

    // Spaces are no reason.
    fireEvent.change(within(dialog).getByTestId('identity-segment-suspend-reason'), { target: { value: '    ' } });
    expect(confirm).toBeDisabled();
    expect(biometricSettingsApi.updateSegment).not.toHaveBeenCalled();
  });

  it('IdentitySegmentsSection_SuspendingWithAReason_CallsPutWithModeSuspendedAndTheReasonAndTheSegmentShowsIt', async () => {
    renderSection();
    const row = await rowOf('segment-mare-android');
    fireEvent.click(radio(row, 'Sospesa'));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByTestId('identity-segment-suspend-reason'), { target: { value: '  Esiti anomali su Android  ' } });
    const confirm = within(dialog).getByRole('button', { name: i18n.t('biometricSettings.segments.suspend.confirm') });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(biometricSettingsApi.updateSegment).toHaveBeenCalledWith('segment-mare-android', { mode: 'suspended', reason: 'Esiti anomali su Android' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(row).toHaveAttribute('data-mode', 'suspended');
    expect(within(row).getByTestId('identity-segment-suspended-reason')).toHaveTextContent('Esiti anomali su Android');
    expect(toast.success).toHaveBeenCalledWith(i18n.t('biometricSettings.segments.saved'));
  });

  it('IdentitySegmentsSection_TheReasonOfASuspension_IsLimitedToWhatTheServerTakes', async () => {
    renderSection();
    const row = await rowOf('segment-mare-android');
    fireEvent.click(radio(row, 'Sospesa'));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByTestId('identity-segment-suspend-reason')).toHaveAttribute('maxlength', '200');
    expect(suspensionReasonOf('x'.repeat(200))).toBe('x'.repeat(200));
    expect(suspensionReasonOf('x'.repeat(201))).toBeNull();
    expect(suspensionReasonOf('')).toBeNull();
  });

  it('IdentitySegmentsSection_CancellingTheSuspension_SendsNothingAndForgetsWhatWasTyped', async () => {
    renderSection();
    const row = await rowOf('segment-mare-android');
    fireEvent.click(radio(row, 'Sospesa'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByTestId('identity-segment-suspend-reason'), { target: { value: 'Una prova' } });

    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('shared.cancel') }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(biometricSettingsApi.updateSegment).not.toHaveBeenCalled();
    expect(radio(row, 'Automatica')).toBeChecked();
    // The next time it opens it is empty.
    fireEvent.click(radio(row, 'Sospesa'));
    expect(await within(await screen.findByRole('dialog')).findByTestId('identity-segment-suspend-reason')).toHaveValue('');
  });

  it('IdentitySegmentsSection_TheServerRefusesTheMode422_ShowsItsOwnWordsInAnAlertOnTheSegmentAndKeepsTheMode', async () => {
    const detail = 'Il segmento non è qualificato per la politica e per i modelli in uso.';
    vi.mocked(biometricSettingsApi.getSegments).mockResolvedValue(
      overview({ segments: [segment({ id: 'segment-q', qualified: true, qualificationReason: null, qualifiedPolicyVersion: '2026.11-1' })] }),
    );
    vi.mocked(biometricSettingsApi.updateSegment).mockRejectedValue(httpError(422, { code: 'identity_segment_not_qualified', status: 422, detail }));
    renderSection();
    const row = await rowOf('segment-q');

    fireEvent.click(radio(row, 'Automatica'));

    const alert = await within(row).findByRole('alert');
    expect(alert).toHaveTextContent(detail);
    // Nothing was saved: the segment is what it was, and the controls are live again.
    expect(radio(row, 'Osservazione')).toBeChecked();
    expect(radio(row, 'Automatica')).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('IdentitySegmentsSection_TheServerRefusesTheSuspension422_SaysWhyInsideTheDialogThatStaysOpen', async () => {
    const detail = 'Scrivi il motivo della sospensione: al massimo 200 caratteri.';
    vi.mocked(biometricSettingsApi.updateSegment).mockRejectedValue(httpError(422, { code: 'identity_segment_invalid', status: 422, detail }));
    renderSection();
    const row = await rowOf('segment-mare-android');
    fireEvent.click(radio(row, 'Sospesa'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByTestId('identity-segment-suspend-reason'), { target: { value: 'Motivo' } });

    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('biometricSettings.segments.suspend.confirm') }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(detail);
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(within(dialog).getByTestId('identity-segment-suspend-reason')).toHaveValue('Motivo');
    expect(row).toHaveAttribute('data-mode', 'automatic');
  });

  it('IdentitySegmentsSection_TheServerRefusesWithoutAMessage_SaysTheSegmentWasNotSaved', async () => {
    vi.mocked(biometricSettingsApi.updateSegment).mockRejectedValue(httpError(500));
    renderSection();
    const row = await rowOf('segment-mare-android');

    fireEvent.click(radio(row, 'Osservazione'));

    expect(await within(row).findByRole('alert')).toHaveTextContent(i18n.t('biometricSettings.segments.saveFailed'));
  });

  it('IdentitySegmentsSection_AWriteIsInFlight_EveryControlOfTheSectionStaysOffAndASecondOneIsNotSent', async () => {
    let answer: (value: IdentitySegment) => void = () => undefined;
    vi.mocked(biometricSettingsApi.updateSegment).mockReturnValue(
      new Promise<IdentitySegment>((resolve) => {
        answer = resolve;
      }),
    );
    renderSection();
    const first = await rowOf('segment-mare-android');
    const second = await rowOf('segment-all-ios');

    fireEvent.click(radio(first, 'Osservazione'));

    await waitFor(() => expect(radio(second, 'Osservazione')).toBeDisabled());
    expect(radio(second, 'Sospesa')).toBeDisabled();
    expect(radio(first, 'Automatica')).toBeDisabled();
    expect(screen.getByTestId('identity-segment-add')).toBeDisabled();
    fireEvent.click(radio(second, 'Sospesa'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(biometricSettingsApi.updateSegment).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer(segment({ id: 'segment-mare-android', propertyId: 'property-mare', propertyName: 'Casa Mare', mode: 'observation' }));
    });
    await waitFor(() => expect(radio(second, 'Osservazione')).toBeEnabled());
  });

  it('IdentitySegmentsSection_TheReasonDialog_DoesNotSubmitAFormAroundTheSection', async () => {
    // A page that holds the section inside a form of its own: confirming the dialog (drawn outside the form but inside it for React) must not submit it.
    const submitted = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    renderSection({ wrap: (section) => <form onSubmit={submitted}>{section}</form> });
    const row = await rowOf('segment-mare-android');
    fireEvent.click(radio(row, 'Sospesa'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByTestId('identity-segment-suspend-reason'), { target: { value: 'Una prova' } });

    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('biometricSettings.segments.suspend.confirm') }));

    await waitFor(() => expect(biometricSettingsApi.updateSegment).toHaveBeenCalledTimes(1));
    expect(submitted).not.toHaveBeenCalled();
  });
});

describe('identity-segments-section: a new segment (E70/F03/US01/T02)', () => {
  it('IdentitySegmentsSection_AddingASegmentForEveryProperty_SendsTheFormatAndTheChannelWithoutAProperty', async () => {
    vi.mocked(biometricSettingsApi.createSegment).mockResolvedValue(segment({ id: 'segment-new', channel: 'web:desktop-safari', formatId: 'it-cie' }));
    renderSection();
    await rows();

    fireEvent.click(screen.getByTestId('identity-segment-add'));
    const form = await screen.findByTestId('identity-segment-form');
    // «Tutte le strutture» is the first choice, and the homes of the org follow it.
    expect(within(form).getByLabelText('Struttura')).toHaveValue('');
    await waitFor(() => expect(within(form).getByRole('option', { name: 'Casa Mare' })).toBeInTheDocument());
    fireEvent.change(within(form).getByLabelText('Browser dell\'ospite'), { target: { value: 'web:desktop-safari' } });
    fireEvent.click(within(form).getByTestId('identity-segment-submit'));

    await waitFor(() => expect(biometricSettingsApi.createSegment).toHaveBeenCalledWith({ formatId: 'it-cie', channel: 'web:desktop-safari' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('biometricSettings.segments.added')));
    // It is in the list, in observation, and the form is closed.
    await waitFor(() => expect(screen.getAllByTestId('identity-segment')).toHaveLength(4));
    expect(screen.queryByTestId('identity-segment-form')).not.toBeInTheDocument();
    expect(await rowOf('segment-new')).toHaveAttribute('data-mode', 'observation');
  });

  it('IdentitySegmentsSection_AddingASegmentForAProperty_SendsItsId', async () => {
    vi.mocked(biometricSettingsApi.createSegment).mockResolvedValue(segment({ id: 'segment-new', propertyId: 'property-monti', propertyName: 'Casa Monti' }));
    renderSection();
    await rows();

    fireEvent.click(screen.getByTestId('identity-segment-add'));
    const form = await screen.findByTestId('identity-segment-form');
    await waitFor(() => expect(within(form).getByRole('option', { name: 'Casa Monti' })).toBeInTheDocument());
    fireEvent.change(within(form).getByLabelText('Struttura'), { target: { value: 'property-monti' } });
    fireEvent.click(within(form).getByTestId('identity-segment-submit'));

    await waitFor(() => expect(biometricSettingsApi.createSegment).toHaveBeenCalledWith({ propertyId: 'property-monti', formatId: 'it-cie', channel: 'web:ios-safari' }));
  });

  it('IdentitySegmentsSection_ASegmentThatExistsAlready_IsAnsweredAsItIsAndTheListDoesNotGrow', async () => {
    vi.mocked(biometricSettingsApi.createSegment).mockResolvedValue(threeSegments()[0]);
    renderSection();
    await rows();

    fireEvent.click(screen.getByTestId('identity-segment-add'));
    fireEvent.click(await screen.findByTestId('identity-segment-submit'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('biometricSettings.segments.alreadyThere')));
    expect(screen.getAllByTestId('identity-segment')).toHaveLength(3);
  });

  it('IdentitySegmentsSection_TheServerRefusesTheNewSegment422_ShowsItsWordsInTheFormAndKeepsItOpen', async () => {
    const detail = 'La struttura, il documento o il browser scelto non sono validi.';
    vi.mocked(biometricSettingsApi.createSegment).mockRejectedValue(httpError(422, { code: 'identity_segment_invalid', status: 422, detail }));
    renderSection();
    await rows();

    fireEvent.click(screen.getByTestId('identity-segment-add'));
    fireEvent.click(await screen.findByTestId('identity-segment-submit'));

    expect(await screen.findByRole('alert')).toHaveTextContent(detail);
    expect(screen.getByTestId('identity-segment-form')).toBeInTheDocument();
    expect(screen.getAllByTestId('identity-segment')).toHaveLength(3);
  });

  it('IdentitySegmentsSection_TheHomesCannotBeRead_StillOffersEveryProperty', async () => {
    vi.mocked(propertiesApi.getAll).mockRejectedValue(httpError(500));
    renderSection();
    await rows();

    fireEvent.click(screen.getByTestId('identity-segment-add'));

    expect(await screen.findByText(i18n.t('biometricSettings.segments.add.propertiesError'))).toBeInTheDocument();
    expect(within(screen.getByTestId('identity-segment-form')).getByLabelText('Struttura')).toBeEnabled();
    expect(screen.getByTestId('identity-segment-submit')).toBeEnabled();
  });

  it('IdentitySegmentsSection_NoFormatInTheRegistry_CannotAddAndSaysSo', async () => {
    vi.mocked(biometricSettingsApi.getSegments).mockResolvedValue(overview({ formats: [] }));
    renderSection();
    await rows();

    fireEvent.click(screen.getByTestId('identity-segment-add'));

    expect(await screen.findByText(i18n.t('biometricSettings.segments.add.noFormats'))).toBeInTheDocument();
    expect(screen.getByTestId('identity-segment-submit')).toBeDisabled();
  });
});

describe('identity-segments-section: accessibility and words (E70/F03/US01/T02, AC4)', () => {
  it('IdentitySegmentsSection_TheListAndTheForm_HaveNoAccessibilityViolations', async () => {
    const { container } = renderSection();
    await rows();
    fireEvent.click(screen.getByTestId('identity-segment-add'));
    await screen.findByTestId('identity-segment-form');

    await expectNoAxeViolations(container);
  });

  it('IdentitySegmentsSection_TheModes_AreRadiosWithTargetsOfAtLeast44Pixels', async () => {
    renderSection();
    const row = await rowOf('segment-all-ios');

    for (const name of ['Osservazione', 'Automatica', 'Sospesa']) {
      const label = radio(row, name).closest('label');
      expect(label?.className).toContain('min-h-11');
    }
    expect(within(row).getByRole('group')).toBeInTheDocument();
  });

  it.each([
    ['it', it_],
    ['en', en],
  ] as const)('everyModeReasonAndChannelOfASegmentHasItsWordsIn_%s', (_language, catalogue) => {
    const words = (key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalogue);
    const keys = [
      ...(['observation', 'automatic', 'suspended'] as const).map((mode) => segmentModeKey(mode)),
      ...SEGMENT_REASON_CODES.map((code) => segmentReasonKey(code)),
      segmentReasonKey('a_reason_of_the_future'),
      ...Object.values(SEGMENT_CHANNEL_KEYS),
    ];

    expect(keys.filter((key) => typeof words(key) !== 'string')).toEqual([]);
  });
});

describe('the model of the segments (E70/F03/US01/T02)', () => {
  it('segmentModeOf_AModeItDoesNotKnow_IsObservation', () => {
    expect(segmentModeOf('automatic')).toBe('automatic');
    expect(segmentModeOf('suspended')).toBe('suspended');
    expect(segmentModeOf('observation')).toBe('observation');
    expect(segmentModeOf('')).toBe('observation');
    expect(segmentModeOf('Automatic')).toBe('observation');
  });

  it('withSegment_ANewOne_IsListedWhereTheApiWouldListIt', () => {
    const list = threeSegments();
    const sameProperty = segment({ id: 'segment-mare-ios', propertyId: 'property-mare', propertyName: 'Casa Mare', channel: 'web:ios-safari' });
    const everyProperty = segment({ id: 'segment-all-android', channel: 'web:android-chrome' });

    // Every property first, then by name of the property, then format and channel (as the API lists them).
    expect(withSegment(list, sameProperty).map((entry) => entry.id)).toEqual(['segment-all-ios', 'segment-mare-android', 'segment-mare-ios', 'segment-monti-desktop']);
    expect(withSegment(list, everyProperty).map((entry) => entry.id)).toEqual(['segment-all-android', 'segment-all-ios', 'segment-mare-android', 'segment-monti-desktop']);
  });

  it('withSegment_OneThatIsThereAlready_IsReplacedAndTheListDoesNotGrow', () => {
    const list = threeSegments();

    const next = withSegment(list, { ...list[0], mode: 'suspended', suspendedReason: 'Prova' });

    expect(next).toHaveLength(3);
    expect(next.find((entry) => entry.id === list[0].id)).toMatchObject({ mode: 'suspended', suspendedReason: 'Prova' });
    expect(list[0].mode).toBe('observation');
  });
});
