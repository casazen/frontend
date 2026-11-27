import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, configure, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { publicCheckinApi } from '@/api/checkin.api';
import { expectNoAxeViolations } from '@/test/axe';
import type { CheckInLegalTextsResponse, IdentityOperatorResponse, IdentityVerificationState } from '@/types/public-checkin.types';
import { IdentityStep } from '../identity-step';
import { closedStateOf, identityStateOf, isNoticeVersionUnknown, progressFromState } from '../lib/identity-model';
import { useIdentityVerification } from '../use-identity-verification';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: {
    getLegalTexts: vi.fn(),
    openIdentity: vi.fn(),
    postBiometricConsent: vi.fn(),
    postDocument: vi.fn(),
    postSelfie: vi.fn(),
    startSelfieChallenge: vi.fn(),
    requestOperator: vi.fn(),
  },
}));

configure({ asyncUtilTimeout: 5_000 });

const TOKEN = 'tok-opening';

/** The version of the text of the consent the registry serves: what the opening names and what the consent posts back. */
const CONSENT_VERSION = 'checkin-biometric-2026-11';

const servedTexts = (version: string = CONSENT_VERSION): CheckInLegalTextsResponse => ({
  language: 'it',
  texts: [{ kind: 'biometric-consent', version, language: 'it', isDraft: false, contentHtml: '<h3>Verifica la tua identità con il viso</h3><p>Il tuo selfie non viene mai salvato.</p>' }],
});

/** A state of the legacy path: none of the members of the self-hosted flow (an older API sends none either). */
const state = (overrides: Partial<IdentityVerificationState> = {}): IdentityVerificationState => ({
  step: 'consent',
  result: null,
  biometricOffered: true,
  consentRecorded: false,
  consentRefused: false,
  documentChecked: false,
  attemptsRemaining: 3,
  operatorRequested: false,
  operatorPathOpen: true,
  documentNotArchived: false,
  verifyingGuestPosition: 0,
  ...overrides,
});

/** A state of the self-hosted flow, as the API sends it before the guest has chosen. */
const selfHosted = (overrides: Partial<IdentityVerificationState> = {}): IdentityVerificationState =>
  state({ selfHosted: true, opened: false, noticeVersion: null, choice: null, formatId: null, guidedRetryAvailable: false, closed: false, outcome: null, ...overrides });

/** A verification that ended with a person: every member the API sends for it. */
const closedWithAPerson = (overrides: Partial<IdentityVerificationState> = {}): IdentityVerificationState =>
  selfHosted({ step: 'operator', result: 'operator', operatorRequested: true, biometricOffered: false, opened: true, noticeVersion: CONSENT_VERSION, choice: 'assisted', closed: true, outcome: 'operator', ...overrides });

function httpError(status?: number, data?: unknown, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response = status === undefined ? undefined : { status, data, statusText: '', headers: {}, config };
  return new AxiosError('Request failed', code ?? AxiosError.ERR_BAD_REQUEST, config, {}, response);
}

/** The step as the page holds it: the state of the check lives in the hook, and the step can be left and come back to (what the buttons of the page do). */
function Harness({ initial }: { initial: IdentityVerificationState }) {
  const identity = useIdentityVerification(TOKEN, initial);
  const [onTheStep, setOnTheStep] = useState(true);
  return (
    <>
      {onTheStep && <IdentityStep identity={identity} token={TOKEN} />}
      <button type="button" data-testid="harness-toggle" onClick={() => setOnTheStep((current) => !current)}>
        toggle
      </button>
      <span data-testid="harness-concluded">{String(identity.concluded)}</span>
    </>
  );
}

/** One query client for the life of the test, so that a render again is a render again and not a new page. */
function renderStep(initial: IdentityVerificationState = selfHosted()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const tree = (current: IdentityVerificationState) => (
    <QueryClientProvider client={client}>
      <Harness initial={current} />
    </QueryClientProvider>
  );
  const view = render(tree(initial));
  return { ...view, client, renderAgain: (current: IdentityVerificationState = initial) => view.rerender(tree(current)) };
}

const stage = () => screen.getByTestId('checkin-identity-step').getAttribute('data-stage');
const waitForTheConsentText = () => waitFor(() => expect(screen.getByTestId('checkin-biometric-accept')).toBeEnabled());
const photoFile = () => new File(['document'], 'document.jpg', { type: 'image/jpeg' });
const pickDocument = () => fireEvent.change(screen.getByTestId('checkin-identity-document-file'), { target: { files: [photoFile()] } });

/** A camera that works: a stream with one track, and a video that has a picture. */
function stubCamera() {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  return { stop };
}

const documentPassed = { success: true, acceptable: true, guidanceCodes: [], documentStored: true, documentNotArchived: false };

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(publicCheckinApi.getLegalTexts).mockResolvedValue(servedTexts());
  vi.mocked(publicCheckinApi.openIdentity).mockResolvedValue({ state: selfHosted({ opened: true, noticeVersion: CONSENT_VERSION }) });
  vi.mocked(publicCheckinApi.startSelfieChallenge).mockResolvedValue({
    challengeToken: 'test-challenge',
    noseToRight: true,
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
  });
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  localStorage.clear();
  sessionStorage.clear();
});

describe('identity-opening: the step is opened with the text the guest reads (E70/F03/US01/T01, AC2)', () => {
  it('openIdentity_TheTextOfTheConsentIsOnTheScreen_IsCalledOnceWithTheVersionShown', async () => {
    renderStep();
    await waitForTheConsentText();

    await waitFor(() => expect(publicCheckinApi.openIdentity).toHaveBeenCalledTimes(1));
    expect(publicCheckinApi.openIdentity).toHaveBeenCalledWith(TOKEN, CONSENT_VERSION);
    // The text on the screen is the one that was named: the page has no version of its own.
    expect(screen.getByTestId('checkin-consent-text')).toHaveAttribute('data-version', CONSENT_VERSION);
    // The guest is never kept waiting for it, and nothing of the guest is kept by the page.
    expect(screen.getByTestId('checkin-biometric-decline')).toBeEnabled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('openIdentity_NothingIsOnTheScreenYet_IsNotCalled', async () => {
    vi.mocked(publicCheckinApi.getLegalTexts).mockReturnValue(new Promise<CheckInLegalTextsResponse>(() => undefined));
    renderStep();

    expect(await screen.findByTestId('checkin-consent-loading')).toBeInTheDocument();
    expect(publicCheckinApi.openIdentity).not.toHaveBeenCalled();
  });

  it('openIdentity_TheTextsCannotBeRead_IsNotCalledWithAnOlderAnswer', async () => {
    vi.mocked(publicCheckinApi.getLegalTexts).mockRejectedValue(httpError(500));
    renderStep();

    expect(await screen.findByTestId('checkin-consent-error')).toBeInTheDocument();
    expect(publicCheckinApi.openIdentity).not.toHaveBeenCalled();
  });

  it('openIdentity_RendersALanguageChangeAndALeaveAndReturn_NeverCallItAgain', async () => {
    const { renderAgain } = renderStep();
    await waitFor(() => expect(publicCheckinApi.openIdentity).toHaveBeenCalledTimes(1));

    // The same page rendered again, a new language (the texts are asked again), and the step left and come back to: still the one call of this page load.
    renderAgain();
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    await waitFor(() => expect(publicCheckinApi.getLegalTexts).toHaveBeenCalledTimes(2));
    await waitForTheConsentText();
    fireEvent.click(screen.getByTestId('harness-toggle'));
    fireEvent.click(screen.getByTestId('harness-toggle'));
    await waitFor(() => expect(publicCheckinApi.getLegalTexts).toHaveBeenCalledTimes(3));
    await waitForTheConsentText();

    expect(publicCheckinApi.openIdentity).toHaveBeenCalledTimes(1);
  });

  it('openIdentity_TheStateIsOfTheLegacyPath_IsNeverCalledAndTheStepIsTheOneItAlwaysWas', async () => {
    renderStep(state());
    await waitForTheConsentText();

    expect(publicCheckinApi.openIdentity).not.toHaveBeenCalled();
    // The legacy answers: the button that agrees, in the primary look, and the one that refuses beside it. No pair of choices, no way to a person under the steps.
    expect(screen.queryByTestId('checkin-identity-choices')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-biometric-accept')).toHaveTextContent(i18n.t('checkin.biometric.consent.accept'));
    expect(screen.getByTestId('checkin-biometric-accept').className).toContain('bg-primary');
    expect(screen.getByTestId('checkin-biometric-decline')).toHaveTextContent(i18n.t('checkin.biometric.consent.decline'));
    expect(screen.getByTestId('checkin-biometric-decline').className).not.toContain('bg-primary');
  });

  it('openIdentity_TheCallFailsOnTheNetwork_ChangesNothingForTheGuest', async () => {
    vi.mocked(publicCheckinApi.openIdentity).mockRejectedValue(httpError(undefined, undefined, AxiosError.ERR_NETWORK));
    renderStep();

    await waitFor(() => expect(publicCheckinApi.openIdentity).toHaveBeenCalledTimes(1));
    await waitForTheConsentText();
    // The answer to the consent opens the step too: no sentence of failure for a call the guest did not make, and both ways stay open.
    expect(screen.queryByTestId('checkin-identity-problem')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-biometric-accept')).toBeEnabled();
    expect(screen.getByTestId('checkin-biometric-decline')).toBeEnabled();
  });

  it('openIdentity_TheServerNamesTheVersionUnknown_ReadsTheTextsAgainOnceAndOpensWithWhatItServesNow', async () => {
    vi.mocked(publicCheckinApi.getLegalTexts).mockResolvedValueOnce(servedTexts('checkin-biometric-2026-10')).mockResolvedValue(servedTexts('checkin-biometric-2026-11'));
    vi.mocked(publicCheckinApi.openIdentity)
      .mockRejectedValueOnce(httpError(422, { code: 'notice_version_unknown' }))
      .mockResolvedValueOnce({ state: selfHosted({ opened: true, noticeVersion: 'checkin-biometric-2026-11' }) });
    vi.mocked(publicCheckinApi.postBiometricConsent).mockResolvedValue({
      consentRecorded: true,
      result: 'consent_recorded',
      biometricOffered: true,
      operatorPathOpen: true,
      state: selfHosted({ step: 'document', consentRecorded: true, opened: true, choice: 'automatic' }),
    });
    renderStep();

    await waitFor(() => expect(publicCheckinApi.openIdentity).toHaveBeenCalledTimes(2));
    expect(vi.mocked(publicCheckinApi.openIdentity).mock.calls.map(([, version]) => version)).toEqual(['checkin-biometric-2026-10', 'checkin-biometric-2026-11']);
    expect(publicCheckinApi.getLegalTexts).toHaveBeenCalledTimes(2);
    // The guest reads and agrees to the text in force.
    await waitFor(() => expect(screen.getByTestId('checkin-consent-text')).toHaveAttribute('data-version', 'checkin-biometric-2026-11'));
    await waitForTheConsentText();
    fireEvent.click(screen.getByTestId('checkin-biometric-accept'));
    await waitFor(() => expect(stage()).toBe('document'));
    expect(publicCheckinApi.postBiometricConsent).toHaveBeenCalledWith(TOKEN, { consentGiven: true, consentVersion: 'checkin-biometric-2026-11' });
  });

  it('openIdentity_TheVersionIsStillUnknownAfterTheTextsWereReadAgain_FallsBackToTheAssistedPath', async () => {
    vi.mocked(publicCheckinApi.openIdentity).mockRejectedValue(httpError(422, { code: 'notice_version_unknown' }));
    vi.mocked(publicCheckinApi.postBiometricConsent).mockResolvedValue({
      consentRecorded: false,
      result: 'operator',
      biometricOffered: false,
      operatorPathOpen: true,
      state: closedWithAPerson({ step: 'operator', consentRefused: true }),
    });
    renderStep();

    // Once more, and no more: the texts are read again once, the opening is tried again once.
    await waitFor(() => expect(publicCheckinApi.openIdentity).toHaveBeenCalledTimes(2));
    expect(publicCheckinApi.getLegalTexts).toHaveBeenCalledTimes(2);
    expect(await screen.findByTestId('checkin-consent-unavailable')).toBeInTheDocument();
    // The text that nobody can say is in force is not offered to agree to; the way to a person is.
    expect(screen.queryByTestId('checkin-consent-text')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-biometric-accept')).toBeDisabled();
    expect(screen.getByTestId('checkin-biometric-decline')).toBeEnabled();

    await act(async () => {
      await i18n.changeLanguage('en');
    });
    await waitFor(() => expect(publicCheckinApi.getLegalTexts).toHaveBeenCalledTimes(3));
    expect(publicCheckinApi.openIdentity).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('checkin-biometric-decline'));
    await waitFor(() => expect(stage()).toBe('operator'));
    expect(publicCheckinApi.postBiometricConsent).toHaveBeenCalledWith(TOKEN, { consentGiven: false });
  });

  it('openIdentity_TheTextsCannotBeReadAgainAfterThe422_IsNotOpenedAgainWithTheVersionJustRefusedAndIsTriedAgainWithTheNextTextThatSettles', async () => {
    vi.mocked(publicCheckinApi.getLegalTexts).mockResolvedValueOnce(servedTexts('checkin-biometric-2026-10')).mockRejectedValue(httpError(404));
    vi.mocked(publicCheckinApi.openIdentity).mockRejectedValueOnce(httpError(422, { code: 'notice_version_unknown' }));
    renderStep();

    // The second read of the texts fails: an error leaves the older answer in memory, and that is the version the server has just refused. The page says the texts cannot be read (with a way to try again), it does not
    // say they are not available, and it does not open again with the older answer.
    expect(await screen.findByTestId('checkin-consent-error')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-consent-unavailable')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-biometric-accept')).toBeDisabled();
    expect(screen.getByTestId('checkin-biometric-decline')).toBeEnabled();

    // The guest tries again and the text in force settles: the opening is made with it, and the face check is offered (no «text not available» after a «Riprova» that worked).
    vi.mocked(publicCheckinApi.getLegalTexts).mockResolvedValue(servedTexts('checkin-biometric-2026-11'));
    fireEvent.click(screen.getByTestId('checkin-consent-retry'));

    await waitFor(() => expect(publicCheckinApi.openIdentity).toHaveBeenCalledTimes(2));
    expect(vi.mocked(publicCheckinApi.openIdentity).mock.calls.map(([, version]) => version)).toEqual(['checkin-biometric-2026-10', 'checkin-biometric-2026-11']);
    await waitForTheConsentText();
    expect(screen.getByTestId('checkin-consent-text')).toHaveAttribute('data-version', 'checkin-biometric-2026-11');
    expect(screen.queryByTestId('checkin-consent-unavailable')).not.toBeInTheDocument();
  });

  it('openIdentity_RefusedForGoodAndAnotherTextSettlesLater_IsOpenedAgainWithItAndTheFaceCheckIsOfferedAgain', async () => {
    vi.mocked(publicCheckinApi.openIdentity)
      .mockRejectedValueOnce(httpError(422, { code: 'notice_version_unknown' }))
      .mockRejectedValueOnce(httpError(422, { code: 'notice_version_unknown' }));
    const { client } = renderStep();

    // Refused twice, with the texts read again in between: the face check is not offered and the text of the consent is not shown.
    expect(await screen.findByTestId('checkin-consent-unavailable')).toBeInTheDocument();
    expect(publicCheckinApi.openIdentity).toHaveBeenCalledTimes(2);

    // The registry serves another text and the page reads it (the window comes back to the front): it is a text the server has not refused, so it gets an opening of its own, and it is what turns the refusal off.
    vi.mocked(publicCheckinApi.getLegalTexts).mockResolvedValue(servedTexts('checkin-biometric-2026-12'));
    await act(async () => {
      await client.refetchQueries({ queryKey: ['checkin', TOKEN, 'legal-texts'] });
    });

    await waitFor(() => expect(publicCheckinApi.openIdentity).toHaveBeenCalledTimes(3));
    expect(vi.mocked(publicCheckinApi.openIdentity).mock.calls[2]?.[1]).toBe('checkin-biometric-2026-12');
    await waitFor(() => expect(screen.getByTestId('checkin-consent-text')).toHaveAttribute('data-version', 'checkin-biometric-2026-12'));
    expect(screen.queryByTestId('checkin-consent-unavailable')).not.toBeInTheDocument();
    await waitForTheConsentText();
  });
});

describe('identity-opening: two ways to be verified, of equal weight (E70/F03/US01/T01, AC3)', () => {
  it('IdentityStep_SelfHostedConsent_OffersTheAutomaticCheckAndAPersonSideBySideWithTheSameLook', async () => {
    renderStep();
    await waitForTheConsentText();

    const automatic = screen.getByTestId('checkin-biometric-accept');
    const assisted = screen.getByTestId('checkin-biometric-decline');
    expect(automatic).toHaveTextContent('Verifica automatica');
    expect(assisted).toHaveTextContent('Verifica con una persona');
    expect(screen.getByTestId('checkin-identity-choices')).toContainElement(automatic);
    expect(screen.getByTestId('checkin-identity-choices')).toContainElement(assisted);
    // Equal weight: the same size, the same look, the same width, neither of them the primary one. Each says in a line what it means, and the line is tied to the button.
    expect(automatic.className).toBe(assisted.className);
    expect(automatic.className).not.toContain('bg-primary');
    expect(automatic).toHaveAccessibleDescription(i18n.t('checkin.identity.choice.automatic.hint'));
    expect(assisted).toHaveAccessibleDescription(i18n.t('checkin.identity.choice.assisted.hint'));
    // Both are live as soon as the text is: agreeing is possible only with a text on the screen, a person always.
    expect(automatic).toBeEnabled();
    expect(assisted).toBeEnabled();
  });

  it('IdentityStep_TheTextIsNotThereYet_AgreeingIsNotPossibleButAPersonIs', async () => {
    vi.mocked(publicCheckinApi.getLegalTexts).mockReturnValue(new Promise<CheckInLegalTextsResponse>(() => undefined));
    renderStep();

    expect(await screen.findByTestId('checkin-consent-loading')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-biometric-accept')).toBeDisabled();
    expect(screen.getByTestId('checkin-biometric-decline')).toBeEnabled();
  });

  it('IdentityStep_TheGuestChoosesTheAutomaticCheck_AgreesToTheTextShownAndGoesToTheDocument', async () => {
    vi.mocked(publicCheckinApi.postBiometricConsent).mockResolvedValue({
      consentRecorded: true,
      result: 'consent_recorded',
      biometricOffered: true,
      operatorPathOpen: true,
      state: selfHosted({ step: 'document', consentRecorded: true, opened: true, choice: 'automatic' }),
    });
    renderStep();
    await waitForTheConsentText();

    fireEvent.click(screen.getByTestId('checkin-biometric-accept'));

    await waitFor(() => expect(stage()).toBe('document'));
    expect(publicCheckinApi.postBiometricConsent).toHaveBeenCalledWith(TOKEN, { consentGiven: true, consentVersion: CONSENT_VERSION });
    expect(screen.getByTestId('checkin-identity-document')).toBeInTheDocument();
  });

  it('IdentityStep_TheGuestChoosesAPerson_RefusesTheConsentAndTheStepIsOverForTheGuest', async () => {
    vi.mocked(publicCheckinApi.postBiometricConsent).mockResolvedValue({
      consentRecorded: false,
      result: 'operator',
      biometricOffered: false,
      operatorPathOpen: true,
      state: closedWithAPerson({ consentRefused: true }),
    });
    renderStep();
    await waitForTheConsentText();

    fireEvent.click(screen.getByTestId('checkin-biometric-decline'));

    await waitFor(() => expect(stage()).toBe('operator'));
    expect(publicCheckinApi.postBiometricConsent).toHaveBeenCalledWith(TOKEN, { consentGiven: false });
    expect(screen.getByTestId('identity-operator-text')).toHaveTextContent(i18n.t('checkin.identity.result.operator.text'));
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('true');
    expect(screen.queryByTestId('checkin-identity-choices')).not.toBeInTheDocument();
  });

  it('IdentityStep_BothChoices_HaveNoAccessibilityViolations', async () => {
    const { container } = renderStep();
    await waitForTheConsentText();

    await expectNoAxeViolations(container);
  });
});

describe('identity-opening: the way to a person on every step (E70/F03/US01/T01, AC3)', () => {
  it('assisted path visible after consent', async () => {
    // The proof of GDPR art. 22 in the self-hosted flow: after the guest has agreed, at the document and at the selfie, a person can be asked for with one tap.
    stubCamera();
    vi.mocked(publicCheckinApi.postBiometricConsent).mockResolvedValue({
      consentRecorded: true,
      result: 'consent_recorded',
      biometricOffered: true,
      operatorPathOpen: true,
      state: selfHosted({ step: 'document', consentRecorded: true, opened: true, choice: 'automatic' }),
    });
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue(documentPassed);
    vi.mocked(publicCheckinApi.requestOperator).mockResolvedValue({
      result: 'operator',
      operatorPathOpen: true,
      state: closedWithAPerson({ choice: 'assisted' }),
    });
    renderStep();
    await waitForTheConsentText();

    fireEvent.click(screen.getByTestId('checkin-biometric-accept'));
    await waitFor(() => expect(stage()).toBe('document'));
    expect(screen.getByTestId('checkin-identity-assisted-path')).toBeVisible();
    expect(screen.getByTestId('checkin-identity-assisted-path')).toBeEnabled();
    expect(screen.getByTestId('checkin-identity-assisted-path')).toHaveTextContent(i18n.t('checkin.identity.choice.assisted.switch'));

    pickDocument();
    await waitFor(() => expect(stage()).toBe('selfie'));
    expect(screen.getByTestId('checkin-identity-assisted-path')).toBeVisible();

    fireEvent.click(screen.getByTestId('checkin-identity-assisted-path'));
    await waitFor(() => expect(stage()).toBe('operator'));
    expect(publicCheckinApi.requestOperator).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('identity-operator-text')).toHaveTextContent(i18n.t('checkin.identity.result.operator.text'));
    expect(screen.queryByTestId('checkin-identity-assisted-path')).not.toBeInTheDocument();
  });

  it('IdentityStep_AtTheDocumentOfALegacyState_HasNoSecondaryButtonForAPerson', () => {
    renderStep(state({ step: 'document', consentRecorded: true }));

    expect(stage()).toBe('document');
    expect(screen.queryByTestId('checkin-identity-assisted-path')).not.toBeInTheDocument();
  });

  it('IdentityStep_ADocumentThatWasRefused_KeepsTheOneButtonForAPersonItAlreadyHas', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue({ ...documentPassed, acceptable: false, guidanceCodes: ['avoid_glare'] });
    renderStep(selfHosted({ step: 'document', consentRecorded: true, opened: true, choice: 'automatic' }));
    expect(screen.getByTestId('checkin-identity-assisted-path')).toBeInTheDocument();

    pickDocument();

    expect(await screen.findByTestId('checkin-identity-document-guidance')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-identity-document-operator')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-identity-assisted-path')).not.toBeInTheDocument();
  });

  it('IdentityStep_TheButtonsOfTheStep_StayDisabledWhileACallIsInFlight', async () => {
    let answer: (value: IdentityOperatorResponse) => void = () => undefined;
    vi.mocked(publicCheckinApi.requestOperator).mockReturnValue(
      new Promise<IdentityOperatorResponse>((resolve) => {
        answer = resolve;
      }),
    );
    renderStep(selfHosted({ step: 'document', consentRecorded: true, opened: true, choice: 'automatic' }));

    fireEvent.click(screen.getByTestId('checkin-identity-assisted-path'));
    await waitFor(() => expect(screen.getByTestId('checkin-identity-assisted-path')).toBeDisabled());
    expect(screen.getByTestId('checkin-identity-document-pick')).toBeDisabled();
    // A second tap does not start a second request.
    fireEvent.click(screen.getByTestId('checkin-identity-assisted-path'));
    expect(publicCheckinApi.requestOperator).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer({ result: 'operator', operatorPathOpen: true, state: closedWithAPerson() });
    });
    await waitFor(() => expect(stage()).toBe('operator'));
  });
});

describe('identity-opening: a closed verification shows where it ended and offers no capture (E70/F03/US01/T01, AC4)', () => {
  it.each([
    ['document', { step: 'document' as const, consentRecorded: true }],
    ['selfie', { step: 'selfie' as const, consentRecorded: true, documentChecked: true }],
    ['presence', { step: 'presence' as const, consentRecorded: true, documentChecked: true }],
  ])('IdentityStep_ClosedWithAPersonWhileTheStepSays_%s_ShowsThatAPersonWillVerifyAndNoCapture', (_step, overrides) => {
    renderStep(selfHosted({ ...overrides, opened: true, closed: true, outcome: 'operator', operatorRequested: true }));

    expect(stage()).toBe('operator');
    expect(screen.getByTestId('identity-operator-text')).toHaveTextContent(i18n.t('checkin.identity.result.operator.text'));
    expect(screen.getByTestId('identity-operator-requested')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-identity-document')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-selfie-capture')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-identity-unsupported')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-identity-assisted-path')).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('true');
  });

  it('IdentityStep_ClosedWithAnApproval_ShowsTheSuccessAndNoCapture', () => {
    renderStep(selfHosted({ step: 'done', result: 'ok', consentRecorded: true, documentChecked: true, opened: true, closed: true, outcome: 'ok' }));

    expect(stage()).toBe('done');
    expect(screen.getByTestId('identity-result-ok')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-selfie-capture')).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('true');
  });

  it('IdentityStep_ClosedWithAnOutcomeThatIsNotAnApproval_NeverShowsASuccess', () => {
    renderStep(selfHosted({ step: 'done', result: 'ok', opened: true, closed: true, outcome: null, operatorRequested: true }));

    expect(stage()).toBe('operator');
    expect(screen.queryByTestId('identity-result-ok')).not.toBeInTheDocument();
  });

  it('IdentityStep_TheOpeningFindsTheVerificationClosed_ShowsWhereItEnded', async () => {
    vi.mocked(publicCheckinApi.openIdentity).mockResolvedValue({ state: closedWithAPerson({ step: 'consent' }) });
    renderStep();

    await waitFor(() => expect(stage()).toBe('operator'));
    expect(screen.getByTestId('identity-operator-text')).toHaveTextContent(i18n.t('checkin.identity.result.operator.text'));
    expect(screen.queryByTestId('checkin-biometric-consent')).not.toBeInTheDocument();
  });

  it('IdentityStep_TheServerAnswers409AlreadyClosedToAPicture_ShowsTheStateItEndedInWithoutASentenceOfFailure', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockRejectedValue(httpError(409, { code: 'identity_already_closed', status: 409, state: closedWithAPerson({ step: 'operator' }) }));
    renderStep(selfHosted({ step: 'document', consentRecorded: true, opened: true, choice: 'automatic' }));

    pickDocument();

    await waitFor(() => expect(stage()).toBe('operator'));
    expect(screen.getByTestId('identity-operator-text')).toHaveTextContent(i18n.t('checkin.identity.result.operator.text'));
    // The step is over, not failed: no sentence of error and nothing to take again.
    expect(screen.queryByTestId('checkin-identity-problem')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-identity-document')).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('true');
  });

  it('IdentityStep_TheServerAnswers409AlreadyClosedToASelfieWithAnApproval_IsTheEndOfTheStepAndNotAFailure', async () => {
    vi.mocked(publicCheckinApi.postSelfie).mockRejectedValue(
      httpError(409, { code: 'identity_already_closed', state: selfHosted({ step: 'done', result: 'ok', opened: true, closed: true, outcome: 'ok' }) }),
    );
    const { result } = renderHook(() => useIdentityVerification(TOKEN, selfHosted({ step: 'selfie', consentRecorded: true, documentChecked: true, opened: true, choice: 'automatic' })));
    expect(result.current.progress?.stage).toBe('selfie');

    let answered = false;
    await act(async () => {
      answered = await result.current.sendSelfie(new Blob(['selfie'], { type: 'image/jpeg' }));
    });

    // The call is answered (the capture lets its picture go), the step shows the pass and no problem, and the page may go on.
    expect(answered).toBe(true);
    expect(result.current.progress?.stage).toBe('done');
    expect(result.current.problem).toBeNull();
    expect(result.current.concluded).toBe(true);
  });

  it('IdentityStep_TheServerAnswers409AlreadyClosedWithoutAStateThePageCanRead_ShowsThatAPersonWillVerifyNeverASuccess', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockRejectedValue(httpError(409, { code: 'identity_already_closed', state: { unexpected: true } }));
    renderStep(selfHosted({ step: 'document', consentRecorded: true, opened: true, choice: 'automatic' }));

    pickDocument();

    await waitFor(() => expect(stage()).toBe('operator'));
    expect(screen.queryByTestId('identity-result-ok')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-identity-problem')).not.toBeInTheDocument();
  });

  it('IdentityStep_ADifferent409_IsStillAFailureTheGuestCanTryAgainFrom', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockRejectedValue(httpError(409, { code: 'identity_already_verified' }));
    renderStep(selfHosted({ step: 'document', consentRecorded: true, opened: true, choice: 'automatic' }));

    pickDocument();

    expect(await screen.findByTestId('checkin-identity-problem')).toBeInTheDocument();
    expect(stage()).toBe('document');
  });
});

describe('identity-opening: a step this page has no screen for shows the way to a person (E70/F03/US01/T01, AC5)', () => {
  it('IdentityStep_TheStepIsPresence_ShowsTheAssistedPathMessageInsteadOfABlankScreen', async () => {
    vi.mocked(publicCheckinApi.requestOperator).mockResolvedValue({ result: 'operator', operatorPathOpen: true, state: closedWithAPerson() });
    renderStep(selfHosted({ step: 'presence', consentRecorded: true, documentChecked: true, opened: true, choice: 'automatic' }));

    expect(stage()).toBe('unsupported');
    expect(screen.getByTestId('checkin-identity-unsupported')).toHaveTextContent(i18n.t('checkin.identity.unsupported.title'));
    expect(screen.getByTestId('checkin-identity-unsupported')).toHaveTextContent(i18n.t('checkin.identity.unsupported.text'));
    expect(screen.queryByTestId('checkin-selfie-capture')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-identity-document')).not.toBeInTheDocument();
    // The step cannot be left any other way: the page does not go on, and the one button asks for a person.
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('false');

    fireEvent.click(screen.getByTestId('checkin-identity-unsupported-ask'));

    await waitFor(() => expect(stage()).toBe('operator'));
    expect(publicCheckinApi.requestOperator).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('true');
  });

  it('IdentityStep_AStepOfTheFuture_ShowsTheSameWayToAPerson', () => {
    renderStep(state({ step: 'a_step_of_the_future' as IdentityVerificationState['step'] }));

    expect(stage()).toBe('unsupported');
    expect(screen.getByTestId('checkin-identity-unsupported-ask')).toBeEnabled();
    // Nothing is asked of the server by the screen itself: a person is asked for only when the guest says so.
    expect(publicCheckinApi.requestOperator).not.toHaveBeenCalled();
  });

  it('IdentityStep_TheUnsupportedStep_HasNoAccessibilityViolations', async () => {
    const { container } = renderStep(selfHosted({ step: 'presence', consentRecorded: true, documentChecked: true, opened: true }));

    await expectNoAxeViolations(container);
  });
});

describe('the model of the opening (E70/F03/US01/T01)', () => {
  it.each([
    [{ step: 'consent' }, 'consent'],
    [{ step: 'document' }, 'document'],
    [{ step: 'selfie' }, 'selfie'],
    [{ step: 'presence' }, 'unsupported'],
    [{ step: 'done' }, 'done'],
    [{ step: 'operator' }, 'operator'],
    [{ step: 'selfie', closed: true, outcome: 'ok' }, 'done'],
    [{ step: 'selfie', closed: true, outcome: 'operator' }, 'operator'],
    [{ step: 'selfie', closed: true, outcome: 'retry' }, 'operator'],
    [{ step: 'selfie', closed: true, outcome: null }, 'operator'],
    [{ step: 'operator', closed: false, outcome: 'ok' }, 'operator'],
  ] as const)('progressFromState_%j_StartsAt_%s', (overrides, expected) => {
    expect(progressFromState(state({ ...overrides } as Partial<IdentityVerificationState>)).stage).toBe(expected);
  });

  it('progressFromState_TheStateSaysSelfHosted_IsMirroredAndOtherwiseOff', () => {
    expect(progressFromState(selfHosted()).selfHosted).toBe(true);
    expect(progressFromState(state()).selfHosted).toBe(false);
    expect(progressFromState(state({ selfHosted: false })).selfHosted).toBe(false);
  });

  it('identityStateOf_ABodyThatIsNotAState_IsNull', () => {
    expect(identityStateOf(null)).toBeNull();
    expect(identityStateOf('<html></html>')).toBeNull();
    expect(identityStateOf([])).toBeNull();
    expect(identityStateOf({})).toBeNull();
    expect(identityStateOf({ step: 3 })).toBeNull();
  });

  it('identityStateOf_AnythingMissingOrOfAnotherType_IsThePrudentValue', () => {
    const read = identityStateOf({ step: 'presence', closed: 'yes', outcome: 'approved', choice: 'sometimes', selfHosted: true, attemptsRemaining: '3', documentSides: ['front', 4] });

    expect(read).toMatchObject({
      step: 'presence',
      closed: false,
      outcome: null,
      choice: null,
      selfHosted: true,
      attemptsRemaining: 0,
      documentSides: ['front'],
      operatorRequested: false,
      biometricOffered: false,
      operatorPathOpen: true,
    });
  });

  it('closedStateOf_Only409AlreadyClosed_IsAClosedState', () => {
    const body = { code: 'identity_already_closed', state: closedWithAPerson() };

    expect(closedStateOf(httpError(409, body))).toMatchObject({ closed: true, outcome: 'operator' });
    expect(closedStateOf(httpError(409, { code: 'identity_already_verified' }))).toBeNull();
    expect(closedStateOf(httpError(422, body))).toBeNull();
    expect(closedStateOf(httpError(500, body))).toBeNull();
    expect(closedStateOf(new Error('closed'))).toBeNull();
    expect(closedStateOf(null)).toBeNull();
  });

  it('closedStateOf_NoStateOrAStateThatIsNotClosed_IsAVerificationThatEndedWithAPerson', () => {
    const open = selfHosted({ step: 'selfie' });

    for (const body of [{ code: 'identity_already_closed' }, { code: 'identity_already_closed', state: open }, { code: 'identity_already_closed', state: 'x' }]) {
      expect(closedStateOf(httpError(409, body))).toMatchObject({ closed: true, outcome: 'operator', operatorRequested: true });
    }
  });

  it('isNoticeVersionUnknown_Only422WithItsCode_IsTheVersionBeingUnknown', () => {
    expect(isNoticeVersionUnknown(httpError(422, { code: 'notice_version_unknown' }))).toBe(true);
    expect(isNoticeVersionUnknown(httpError(422, { code: 'biometric_consent_version_unknown' }))).toBe(false);
    expect(isNoticeVersionUnknown(httpError(404, { code: 'notice_version_unknown' }))).toBe(false);
    expect(isNoticeVersionUnknown(new Error('x'))).toBe(false);
  });
});
