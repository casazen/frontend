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
import type { ContextBootstrapDto } from '@/api/contexts';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { contextOf } from '@/test/org-contexts';
import { expectNoAxeViolations } from '@/test/axe';
import type { BiometricSettings, BiometricsStatus, IdentitySegment, IdentitySegments } from '@/types/biometric-settings.types';
import { BiometricSettingsCard } from '../components/biometric-settings-card';
import { MODEL_REASON_CODES, MODEL_STATES, modelReasonKey, modelStateKey, validateBiometricForm } from '../lib/biometric-settings-model';
import { BIOMETRIC_SETTINGS_QUERY_KEY } from '../use-biometric-settings';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/biometric-settings.api', () => ({
  biometricSettingsApi: { get: vi.fn(), update: vi.fn(), getModelsStatus: vi.fn(), getSegments: vi.fn(), createSegment: vi.fn(), updateSegment: vi.fn() },
}));

configure({ asyncUtilTimeout: 5_000 });

const segment: IdentitySegment = {
  id: 'segment-1',
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
};

const segments: IdentitySegments = {
  segments: [segment],
  formats: [{ id: 'it-cie', label: "Carta d'identità elettronica italiana" }],
  channels: ['web:ios-safari', 'web:android-chrome'],
  activePolicy: { version: '2026.11-1', provisional: false },
  autoApprovalEnabled: true,
};

const settings = (overrides: Partial<BiometricSettings> = {}): BiometricSettings => ({
  enabled: true,
  acceptThreshold: 0.85,
  escalateThreshold: 0.7,
  maxAttempts: 3,
  provisional: true,
  calibratedAt: null,
  isDefault: false,
  ...overrides,
});

const models: BiometricsStatus = {
  enabled: true,
  state: 'unavailable',
  reasonCode: 'hash_not_configured',
  models: [
    { role: 'face_detector', name: 'YuNet', version: '2023mar', license: 'MIT', state: 'ready', code: null, pinned: true },
    { role: 'face_recognition', name: 'AuraFace', version: 'v1', license: 'Apache-2.0', state: 'failed', code: 'hash_not_configured', pinned: false },
  ],
};

function httpError(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

function workspaceOf(contexts: ContextBootstrapDto[]): WorkspaceContextValue {
  return { contexts, activeContext: 'short-rent', isReady: true, setActiveContext: vi.fn(), hasPermission: () => true, getDefaultRoute: () => '/app/short-rent' };
}

function renderCard({ flag = true, selfHosted = false, contexts = [contextOf('short-rent')] }: { flag?: boolean; selfHosted?: boolean; contexts?: ContextBootstrapDto[] } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrap = (children: ReactNode) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, checkInIdentityVerification: flag, checkInIdentitySelfHosted: selfHosted }, isLoading: false }}>
          <WorkspaceContext.Provider value={workspaceOf(contexts)}>{children}</WorkspaceContext.Provider>
        </FeatureFlagsContext.Provider>
      </QueryClientProvider>
    </I18nextProvider>
  );
  return { ...render(wrap(<BiometricSettingsCard />)), client };
}

const field = (testId: string) => screen.getByTestId(testId) as HTMLInputElement;
const typeInto = (testId: string, value: string) => fireEvent.change(field(testId), { target: { value } });
const save = () => fireEvent.click(screen.getByTestId('biometric-save'));
const loaded = () => screen.findByTestId('biometric-settings-form');

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(biometricSettingsApi.get).mockResolvedValue(settings());
  vi.mocked(biometricSettingsApi.update).mockImplementation(async (request) => settings({ ...request, provisional: true }));
  vi.mocked(biometricSettingsApi.getModelsStatus).mockResolvedValue(models);
  vi.mocked(biometricSettingsApi.getSegments).mockResolvedValue(segments);
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('the card «Verifica dell\'identità» of the organization settings (E22/F02/US01/T02)', () => {
  it('BiometricSettingsCard_FlagOff_ShowsNothingAndAsksNothing', () => {
    renderCard({ flag: false });

    expect(screen.queryByTestId('biometric-settings-card')).not.toBeInTheDocument();
    expect(biometricSettingsApi.get).not.toHaveBeenCalled();
    expect(biometricSettingsApi.getModelsStatus).not.toHaveBeenCalled();
    expect(biometricSettingsApi.getSegments).not.toHaveBeenCalled();
  });

  it('BiometricSettingsCard_NotTheOrgAdministrator_ShowsNothingAndAsksNothing', () => {
    renderCard({ contexts: [contextOf('short-rent', 'property_manager')] });

    expect(screen.queryByTestId('biometric-settings-card')).not.toBeInTheDocument();
    expect(biometricSettingsApi.get).not.toHaveBeenCalled();
  });

  it('BiometricSettingsCard_Admin_ShowsTheSettingsInPlainWordsAndTheProvisionalLabel', async () => {
    renderCard();

    await loaded();
    expect(field('biometric-accept').value).toBe('0.85');
    expect(field('biometric-escalate').value).toBe('0.7');
    expect(field('biometric-attempts').value).toBe('3');
    expect(screen.getByTestId('biometric-enabled')).toBeChecked();
    expect(screen.getByText(/Sotto questa soglia decide l'operatore\./)).toBeInTheDocument();
    expect(screen.getByTestId('biometric-provisional')).toHaveTextContent('Soglie provvisorie');
    expect(screen.getByTestId('biometric-provisional-explain')).toBeInTheDocument();
    expect(screen.getByTestId('biometric-save')).toBeDisabled();
    expect(screen.queryByTestId('biometric-models')).not.toBeInTheDocument();
    expect(biometricSettingsApi.getModelsStatus).not.toHaveBeenCalled();
  });

  it('BiometricSettingsCard_ThresholdsCalibrated_SaysWhenAndHasNoProvisionalLabel', async () => {
    vi.mocked(biometricSettingsApi.get).mockResolvedValue(settings({ provisional: false, calibratedAt: '2026-11-10T09:30:00Z' }));
    renderCard();

    await loaded();
    expect(screen.queryByTestId('biometric-provisional')).not.toBeInTheDocument();
    expect(screen.getByTestId('biometric-calibrated')).toHaveTextContent('2026');
  });

  it('BiometricSettingsCard_ThresholdsWithinBounds_AreSavedWholeAndTheAnswerReplacesWhatIsShown', async () => {
    renderCard();
    await loaded();

    typeInto('biometric-accept', '0.9');
    typeInto('biometric-escalate', '0.75');
    typeInto('biometric-attempts', '4');
    fireEvent.click(screen.getByTestId('biometric-enabled'));
    save();

    await waitFor(() =>
      expect(biometricSettingsApi.update).toHaveBeenCalledWith({ enabled: false, acceptThreshold: 0.9, escalateThreshold: 0.75, maxAttempts: 4 }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('biometricSettings.saved')));
    await waitFor(() => expect(screen.getByTestId('biometric-save')).toBeDisabled());
    expect(field('biometric-accept').value).toBe('0.9');
  });

  it.each([
    ['biometric-accept', '0.97', 'thresholdsRange'],
    ['biometric-escalate', '0.4', 'thresholdsRange'],
    ['biometric-accept', '0.7', 'thresholdsOrder'],
    ['biometric-attempts', '6', 'attemptsRange'],
    ['biometric-attempts', '0', 'attemptsRange'],
    ['biometric-attempts', '2.5', 'attemptsRange'],
    ['biometric-accept', '', 'notANumber'],
  ])('BiometricSettingsCard_%s_%s_IsRefusedBeforeAnythingLeaves_%s', async (testId, value, error) => {
    renderCard();
    await loaded();

    typeInto(testId, value);
    save();

    const expected = i18n.t(`biometricSettings.errors.${error}`, { min: '0,50', max: '0,95' });
    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    expect(biometricSettingsApi.update).not.toHaveBeenCalled();
  });

  it('BiometricSettingsCard_TheServerRefusesTheValues_SaysWhyInWordsAndKeepsWhatWasTyped', async () => {
    vi.mocked(biometricSettingsApi.update).mockRejectedValue(httpError(422, { code: 'biometric_thresholds_order_invalid' }));
    renderCard();
    await loaded();
    typeInto('biometric-attempts', '5');

    save();

    expect(await screen.findByTestId('biometric-save-error')).toHaveTextContent(i18n.t('apiErrors.codes.biometricThresholdsOrderInvalid'));
    expect(field('biometric-attempts').value).toBe('5');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('BiometricSettingsCard_TheSettingsCannotBeRead_IsAnErrorWithATryAgainNeverTheDefaults', async () => {
    vi.mocked(biometricSettingsApi.get).mockRejectedValueOnce(httpError(500));
    vi.mocked(biometricSettingsApi.get).mockRejectedValueOnce(httpError(500));
    renderCard();

    expect(await screen.findByTestId('biometric-settings-error')).toBeInTheDocument();
    expect(screen.queryByTestId('biometric-settings-form')).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId('biometric-settings-error')).getByRole('button'));
    await loaded();
  });

  it('BiometricSettingsCard_AReadThatFailsAfterAGoodOne_IsAnErrorAndTheProvisionalLabelOfTheOldAnswerIsNotDrawn', async () => {
    const { client } = renderCard();
    await loaded();
    expect(screen.getByTestId('biometric-provisional')).toBeInTheDocument();

    vi.mocked(biometricSettingsApi.get).mockRejectedValue(httpError(403));
    await act(async () => {
      await client.refetchQueries({ queryKey: BIOMETRIC_SETTINGS_QUERY_KEY });
    });

    expect(client.getQueryData(BIOMETRIC_SETTINGS_QUERY_KEY)).toBeDefined();
    expect(await screen.findByTestId('biometric-settings-error')).toBeInTheDocument();
    expect(screen.queryByTestId('biometric-settings-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('biometric-provisional')).not.toBeInTheDocument();
  });

  it('BiometricSettingsCard_NoRowOfItsOwn_SaysTheDefaultsAreInForce', async () => {
    vi.mocked(biometricSettingsApi.get).mockResolvedValue(settings({ isDefault: true }));
    renderCard();

    await loaded();
    expect(screen.getByTestId('biometric-default')).toBeInTheDocument();
  });

  it('BiometricSettingsCard_PlatformAdministrator_SeesTheModelsWithTheirStateAndTheReason', async () => {
    renderCard({ contexts: [contextOf('short-rent'), contextOf('admin')] });

    await loaded();
    const status = await screen.findByTestId('biometric-models-state');
    expect(status).toHaveTextContent('Stato dei modelli: Non disponibile.');
    expect(status).toHaveTextContent(i18n.t('biometricSettings.models.reason.hash_not_configured'));
    const rows = await screen.findAllByTestId('biometric-model');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('YuNet');
    expect(rows[0]).toHaveAttribute('data-state', 'ready');
    expect(rows[1]).toHaveTextContent('AuraFace');
    expect(rows[1]).toHaveTextContent(i18n.t('biometricSettings.models.reason.hash_not_configured'));
    expect(rows[1]).toHaveTextContent(i18n.t('biometricSettings.models.notPinned'));
    expect(screen.getByTestId('biometric-models').textContent ?? '').not.toMatch(/[A-Za-z]:\\|\/models\/|sha256:/i);
  });

  it('BiometricSettingsCard_TheModelsCannotBeRead_SaysSoWithoutHidingTheSettings', async () => {
    vi.mocked(biometricSettingsApi.getModelsStatus).mockRejectedValue(httpError(403));
    renderCard({ contexts: [contextOf('short-rent'), contextOf('admin')] });

    expect(await screen.findByTestId('biometric-models-error')).toBeInTheDocument();
    expect(screen.getByTestId('biometric-settings-form')).toBeInTheDocument();
  });

  it('BiometricSettingsCard_SelfHostedFlagOff_IsTheCardItAlwaysWasAndAsksNothingOfTheSegments', async () => {
    renderCard({ selfHosted: false });

    await loaded();
    expect(screen.queryByTestId('identity-segments-section')).not.toBeInTheDocument();
    expect(biometricSettingsApi.getSegments).not.toHaveBeenCalled();
  });

  it('BiometricSettingsCard_SelfHostedFlagOn_HoldsTheSegmentsBelowTheSettings', async () => {
    renderCard({ selfHosted: true });

    await loaded();
    const section = await screen.findByTestId('identity-segments-section');
    expect(within(screen.getByTestId('biometric-settings-card')).getByTestId('identity-segments-section')).toBe(section);
    expect(await screen.findAllByTestId('identity-segment')).toHaveLength(1);
    expect(biometricSettingsApi.getSegments).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('biometric-settings-form')).toBeInTheDocument();
  });

  it('BiometricSettingsCard_SelfHostedFlagOnButNotTheOrgAdministrator_ShowsNothingAndAsksNothing', () => {
    renderCard({ selfHosted: true, contexts: [contextOf('short-rent', 'property_manager')] });

    expect(screen.queryByTestId('biometric-settings-card')).not.toBeInTheDocument();
    expect(biometricSettingsApi.getSegments).not.toHaveBeenCalled();
  });

  it('BiometricSettingsCard_ASegmentIsBeingSaved_KeepsTheControlsOfTheSettingsOffToo', async () => {
    let answer: (value: IdentitySegment) => void = () => undefined;
    vi.mocked(biometricSettingsApi.updateSegment).mockReturnValue(
      new Promise<IdentitySegment>((resolve) => {
        answer = resolve;
      }),
    );
    renderCard({ selfHosted: true });
    await loaded();
    typeInto('biometric-attempts', '4');
    expect(screen.getByTestId('biometric-save')).toBeEnabled();

    fireEvent.click(await screen.findByRole('radio', { name: 'Sospesa' }));
    fireEvent.click(await screen.findByTestId('identity-segment-apply'));
    fireEvent.change(await screen.findByTestId('identity-segment-suspend-reason'), { target: { value: 'Prova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sospendi il segmento' }));

    await waitFor(() => expect(biometricSettingsApi.updateSegment).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('biometric-save')).toBeDisabled());
    expect(field('biometric-attempts')).toBeDisabled();
    expect(screen.getByTestId('biometric-enabled')).toBeDisabled();

    await act(async () => {
      answer({ ...segment, mode: 'suspended', suspendedReason: 'Prova' });
    });
    await waitFor(() => expect(screen.getByTestId('biometric-save')).toBeEnabled());
    expect(field('biometric-attempts').value).toBe('4');
  });

  it('BiometricSettingsCard_TheCard_HasNoAccessibilityViolations', async () => {
    const { container } = renderCard({ contexts: [contextOf('short-rent'), contextOf('admin')] });
    await loaded();
    await screen.findAllByTestId('biometric-model');

    await expectNoAxeViolations(container);
  });
});

describe('the model of the settings card', () => {
  it('validateBiometricForm_TheBoundsOfTheApi_AreTheOnesOfTheServer', () => {
    const ok = { enabled: true, accept: '0.95', escalate: '0.5', attempts: '5' };

    expect(validateBiometricForm(ok)).toEqual({});
    expect(validateBiometricForm({ ...ok, accept: '0.951' }).accept).toBe('thresholdsRange');
    expect(validateBiometricForm({ ...ok, escalate: '0.49' }).escalate).toBe('thresholdsRange');
    expect(validateBiometricForm({ ...ok, accept: '0.6', escalate: '0.6' }).accept).toBe('thresholdsOrder');
    expect(validateBiometricForm({ ...ok, attempts: '1' })).toEqual({});
  });

  it.each([
    ['it', it_],
    ['en', en],
  ] as const)('everyStateAndReasonOfAModelHasItsWordsIn_%s', (_language, catalogue) => {
    const words = (key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalogue);
    const keys = [
      ...MODEL_STATES.map((state) => modelStateKey(state)),
      ...MODEL_REASON_CODES.map((code) => modelReasonKey(code)),
      modelStateKey('a_state_of_the_future'),
      modelReasonKey('a_reason_of_the_future'),
      ...['attemptsRange', 'notANumber', 'thresholdsOrder', 'thresholdsRange'].map((error) => `biometricSettings.errors.${error}`),
    ];

    expect(keys.filter((key) => typeof words(key) !== 'string')).toEqual([]);
  });
});
