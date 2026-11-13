import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { publicCheckinApi } from '@/api/checkin.api';
import { expectNoAxeViolations } from '@/test/axe';
import type { IdentityVerificationState } from '@/types/public-checkin.types';
import { IdentityStep } from '../identity-step';
import { DOCUMENT_WITH_SELFIE_AS_IS_BYTES } from '@/lib/image-capture';
import { BIOMETRIC_CONSENT_VERSION } from '../lib/identity-model';
import { useIdentityVerification } from '../use-identity-verification';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: {
    postBiometricConsent: vi.fn(),
    postDocument: vi.fn(),
    postSelfie: vi.fn(),
    requestOperator: vi.fn(),
  },
}));

configure({ asyncUtilTimeout: 5_000 });

const TOKEN = 'tok-identity';

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

function Harness({ initial }: { initial: IdentityVerificationState }) {
  const identity = useIdentityVerification(TOKEN, initial);
  return (
    <>
      <IdentityStep identity={identity} />
      <span data-testid="harness-concluded">{String(identity.concluded)}</span>
    </>
  );
}

const renderStep = (initial: IdentityVerificationState = state()) => render(<Harness initial={initial} />);

/** What the page does: it keeps the state of the check and shows the step only while the guest is on it; «Back» takes the step away and leaves the state. */
function PageHarness({ initial }: { initial: IdentityVerificationState }) {
  const identity = useIdentityVerification(TOKEN, initial);
  const [onTheStep, setOnTheStep] = useState(true);
  return (
    <>
      {onTheStep && <IdentityStep identity={identity} />}
      <button type="button" data-testid="harness-back" onClick={() => setOnTheStep(false)}>
        back
      </button>
    </>
  );
}

function httpError(status?: number, data?: unknown, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response = status === undefined ? undefined : { status, data, statusText: '', headers: {}, config };
  return new AxiosError('Request failed', code ?? AxiosError.ERR_BAD_REQUEST, config, {}, response);
}

const stage = () => screen.getByTestId('checkin-identity-step').getAttribute('data-stage');

/** A camera that works: a stream with one track, and a video that has a picture (4000 x 3000). */
function stubCamera() {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 4000 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 3000 });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type) {
    callback(new Blob(['selfie'], { type }));
  });
  return { getUserMedia, stop };
}

function stubCameraDenied() {
  const error = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
  const getUserMedia = vi.fn().mockRejectedValue(error);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  return getUserMedia;
}

const photoFile = () => new File(['document'], 'document.jpg', { type: 'image/jpeg' });

function pickDocument() {
  fireEvent.change(screen.getByTestId('checkin-identity-document-file'), { target: { files: [photoFile()] } });
}

/** The guest picks a photo of the document that weighs `size` bytes (only the size is made up). */
function pickDocumentOfSize(size: number) {
  const photo = photoFile();
  Object.defineProperty(photo, 'size', { value: size });
  fireEvent.change(screen.getByTestId('checkin-identity-document-file'), { target: { files: [photo] } });
  return photo;
}

/** A browser that can draw a photo again: the bitmap of a 4000 x 3000 photo, a canvas and a JPEG that comes out of it. */
function stubRedraw() {
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), fillRect: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type) {
    callback(new Blob(['redrawn'], { type }));
  });
}

async function takeAndSendSelfie() {
  await waitFor(() => expect(screen.getByTestId('selfie-take')).toBeEnabled());
  fireEvent.click(screen.getByTestId('selfie-take'));
  fireEvent.click(await screen.findByTestId('selfie-send'));
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});

describe('IdentityStep: the consent (E03/F04/US03/T01, AC-NF50-7, AC-NF50-3)', () => {
  it('IdentityStep_FirstScreen_IsTheSeparateConsentWithAnExplicitYesAndAnEquallyEasyNo', () => {
    renderStep();

    expect(stage()).toBe('consent');
    expect(screen.getByTestId('checkin-biometric-consent')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-biometric-accept')).toBeEnabled();
    expect(screen.getByTestId('checkin-biometric-decline')).toBeEnabled();
    // Nothing is captured before the guest answers: no camera, no file.
    expect(screen.queryByTestId('checkin-selfie-capture')).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    // Only the guest who leaves the document takes part: the text says it.
    expect(screen.getByText(i18n.t('checkin.identity.intro'))).toBeInTheDocument();
  });

  it('IdentityStep_TheGuestRefuses_AnswersNoToTheApiAndShowsTheWayToAPersonNeverADeadEnd', async () => {
    vi.mocked(publicCheckinApi.postBiometricConsent).mockResolvedValue({
      consentRecorded: false,
      result: 'operator',
      biometricOffered: false,
      operatorPathOpen: true,
      state: state({ step: 'operator', consentRefused: true, operatorRequested: true, biometricOffered: false }),
    });
    renderStep();

    fireEvent.click(screen.getByTestId('checkin-biometric-decline'));

    await waitFor(() => expect(stage()).toBe('operator'));
    expect(publicCheckinApi.postBiometricConsent).toHaveBeenCalledWith(TOKEN, { consentGiven: false });
    expect(screen.getByTestId('identity-operator-text')).toHaveTextContent(i18n.t('checkin.identity.result.operator.text'));
    expect(screen.getByTestId('identity-operator-requested')).toBeInTheDocument();
    expect(screen.queryByTestId('identity-lock-code')).not.toBeInTheDocument();
    // A person has it: the step is over and the page may go on.
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('true');
  });

  it('IdentityStep_TheGuestAgrees_SendsTheVersionOfTheTextAndGoesToTheDocument', async () => {
    vi.mocked(publicCheckinApi.postBiometricConsent).mockResolvedValue({
      consentRecorded: true,
      result: 'consent_recorded',
      biometricOffered: true,
      operatorPathOpen: true,
      state: state({ step: 'document', consentRecorded: true }),
    });
    renderStep();

    fireEvent.click(screen.getByTestId('checkin-biometric-accept'));

    await waitFor(() => expect(stage()).toBe('document'));
    expect(publicCheckinApi.postBiometricConsent).toHaveBeenCalledWith(TOKEN, { consentGiven: true, consentVersion: BIOMETRIC_CONSENT_VERSION });
    expect(BIOMETRIC_CONSENT_VERSION.length).toBeLessThanOrEqual(50);
    expect(screen.getByTestId('checkin-identity-document')).toBeInTheDocument();
  });

  it('IdentityStep_AnswerInFlight_EveryButtonStaysDisabledSoASecondTapCannotStartAnotherCall', async () => {
    let answer: (value: Awaited<ReturnType<typeof publicCheckinApi.postBiometricConsent>>) => void = () => undefined;
    vi.mocked(publicCheckinApi.postBiometricConsent).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderStep();

    fireEvent.click(screen.getByTestId('checkin-biometric-accept'));

    await waitFor(() => expect(screen.getByTestId('checkin-biometric-accept')).toBeDisabled());
    expect(screen.getByTestId('checkin-biometric-decline')).toBeDisabled();
    fireEvent.click(screen.getByTestId('checkin-biometric-accept'));
    expect(publicCheckinApi.postBiometricConsent).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer({ consentRecorded: true, result: 'consent_recorded', biometricOffered: true, operatorPathOpen: true, state: state({ step: 'document' }) });
    });
    await waitFor(() => expect(stage()).toBe('document'));
  });

  it('IdentityStep_AskingForAPersonFails_SaysSoAndTheButtonStaysAvailableForAnotherTry', async () => {
    vi.mocked(publicCheckinApi.requestOperator).mockRejectedValueOnce(httpError(undefined, undefined, AxiosError.ERR_NETWORK));
    vi.mocked(publicCheckinApi.requestOperator).mockResolvedValueOnce({
      result: 'operator',
      operatorPathOpen: true,
      state: state({ step: 'operator', operatorRequested: true, biometricOffered: false }),
    });
    renderStep(state({ step: 'operator', biometricOffered: false }));

    fireEvent.click(screen.getByTestId('identity-ask-operator'));

    expect(await screen.findByTestId('checkin-identity-problem')).toHaveTextContent(i18n.t('checkin.identity.problem.network'));
    // Nobody was told: the step is not over, and the guest tries again.
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('false');
    expect(screen.getByTestId('identity-ask-operator')).toBeEnabled();
    fireEvent.click(screen.getByTestId('identity-ask-operator'));

    await waitFor(() => expect(screen.getByTestId('harness-concluded')).toHaveTextContent('true'));
    expect(screen.queryByTestId('checkin-identity-problem')).not.toBeInTheDocument();
  });

  it('IdentityStep_NotOfferedForThisStay_SaysAPersonVerifiesAndOnlyTheGuestAskingConcludesTheStep', async () => {
    vi.mocked(publicCheckinApi.requestOperator).mockResolvedValue({
      result: 'operator',
      operatorPathOpen: true,
      state: state({ step: 'operator', operatorRequested: true, biometricOffered: false }),
    });
    renderStep(state({ step: 'operator', biometricOffered: false }));

    expect(stage()).toBe('operator');
    expect(screen.getByTestId('identity-operator-text')).toHaveTextContent(i18n.t('checkin.identity.result.operator.notOffered'));
    // Nobody was asked yet: the step is not over, the guest asks with the button.
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('false');
    fireEvent.click(screen.getByTestId('identity-ask-operator'));

    await waitFor(() => expect(screen.getByTestId('harness-concluded')).toHaveTextContent('true'));
    expect(publicCheckinApi.requestOperator).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByTestId('identity-ask-operator')).toBeDisabled();
  });
});

describe('IdentityStep: the document (AC-NF51-1, AC-NF51-2)', () => {
  const documentState = state({ step: 'document', consentRecorded: true });

  it('IdentityStep_DocumentNotGoodEnough_SaysInPlainWordsWhatToChangeAndDoesNotGoOn', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue({
      success: false,
      acceptable: false,
      guidanceCodes: ['avoid_glare', 'show_whole_document'],
      documentStored: false,
      documentNotArchived: false,
    });
    renderStep(documentState);

    pickDocument();

    const guidance = await screen.findByTestId('checkin-identity-document-guidance');
    expect(within(guidance).getByText(i18n.t('checkin.identity.guidance.avoid_glare'))).toBeInTheDocument();
    expect(within(guidance).getByText(i18n.t('checkin.identity.guidance.show_whole_document'))).toBeInTheDocument();
    expect(stage()).toBe('document');
    // The button now asks to photograph it again; the way to a person is there too.
    expect(screen.getByTestId('checkin-identity-document-pick')).toHaveTextContent(i18n.t('checkin.identity.document.pickAgain'));
    expect(screen.getByTestId('checkin-identity-document-operator')).toBeInTheDocument();
  });

  it('IdentityStep_DocumentThatCanBeCompared_GoesToTheSelfieAndTheFileIsAcceptedAsAPhotoOfTheDocumentOnly', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue({ success: true, acceptable: true, guidanceCodes: [], documentStored: true, documentNotArchived: false });
    renderStep(documentState);

    expect(screen.getByTestId('checkin-identity-document-file')).toHaveAttribute('accept', 'image/jpeg,image/png');
    pickDocument();

    await waitFor(() => expect(stage()).toBe('selfie'));
    expect(publicCheckinApi.postDocument).toHaveBeenCalledTimes(1);
    expect(vi.mocked(publicCheckinApi.postDocument).mock.calls[0][0]).toBe(TOKEN);
    // The selfie step has no file input at all.
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('IdentityStep_DocumentCallFails_ShowsTheProblemAndKeepsTheStep', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockRejectedValue(httpError(undefined, undefined, AxiosError.ERR_NETWORK));
    renderStep(documentState);

    pickDocument();

    expect(await screen.findByTestId('checkin-identity-problem')).toHaveTextContent(i18n.t('checkin.identity.problem.network'));
    expect(stage()).toBe('document');
  });

  it('IdentityStep_PhotoTheBrowserCannotSend_SaysSoWithoutCallingTheApi', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    renderStep(documentState);

    fireEvent.change(screen.getByTestId('checkin-identity-document-file'), { target: { files: [new File(['x'], 'document.heic', { type: 'image/heic' })] } });

    expect(await screen.findByTestId('checkin-identity-problem')).toHaveTextContent(i18n.t('checkin.identity.problem.unsupported'));
    expect(publicCheckinApi.postDocument).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('IdentityStep: the selfie (AC-NF50-1, ADR-013-R11, R12)', () => {
  const selfieState = state({ step: 'selfie', consentRecorded: true, documentChecked: true });

  it('IdentityStep_CameraDenied_ExplainsHowToAllowItAndOffersAPersonNeverAFilePicker', async () => {
    const getUserMedia = stubCameraDenied();
    vi.mocked(publicCheckinApi.requestOperator).mockResolvedValue({
      result: 'operator',
      operatorPathOpen: true,
      state: state({ step: 'operator', operatorRequested: true }),
    });
    renderStep(selfieState);

    const problem = await screen.findByTestId('selfie-camera-problem');
    expect(getUserMedia).toHaveBeenCalled();
    expect(problem).toHaveTextContent(i18n.t('checkin.biometric.capture.cameraDenied'));
    expect(problem).toHaveTextContent(i18n.t('checkin.biometric.capture.noFile'));
    expect(screen.getByTestId('selfie-camera-retry')).toBeInTheDocument();
    // Never a file picker, in any form.
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(document.querySelector('input')).toBeNull();

    fireEvent.click(screen.getByTestId('selfie-ask-operator'));
    await waitFor(() => expect(stage()).toBe('operator'));
    expect(publicCheckinApi.requestOperator).toHaveBeenCalledWith(TOKEN);
  });

  it('IdentityStep_BrowserWithoutACamera_SaysSoAndOffersAPersonWithoutARetry', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    renderStep(selfieState);

    expect(await screen.findByTestId('selfie-camera-problem')).toHaveTextContent(i18n.t('checkin.biometric.capture.cameraUnsupported'));
    expect(screen.queryByTestId('selfie-camera-retry')).not.toBeInTheDocument();
    expect(screen.getByTestId('selfie-ask-operator')).toBeInTheDocument();
    expect(document.querySelector('input')).toBeNull();
  });

  it('IdentityStep_Selfie_IsSentAsAJpegNoWiderThan1920AndTheCameraIsSwitchedOff', async () => {
    const { stop } = stubCamera();
    const sent: Blob[] = [];
    vi.mocked(publicCheckinApi.postSelfie).mockImplementation(async (_token, selfie) => {
      sent.push(selfie);
      return { result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true, lockCode: '4821' };
    });
    const widths: number[] = [];
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(function (this: HTMLCanvasElement, callback, type) {
      widths.push(this.width);
      callback(new Blob(['selfie'], { type }));
    });
    renderStep(selfieState);

    await takeAndSendSelfie();

    await waitFor(() => expect(stage()).toBe('done'));
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('image/jpeg');
    expect(widths.every((width) => width <= 1920)).toBe(true);
    expect(stop).toHaveBeenCalled();
  });

  it('IdentityStep_SelfieThatPassed_ShowsTheLockCodeInLargeTextAndSaysItIsAlsoSentByEmail', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie).mockResolvedValue({ result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true, lockCode: '4821' });
    renderStep(selfieState);

    await takeAndSendSelfie();

    const code = await screen.findByTestId('identity-lock-code');
    expect(code).toHaveTextContent('4821');
    expect(code.className).toContain('text-4xl');
    expect(screen.getByTestId('identity-code-email')).toHaveTextContent(i18n.t('checkin.identity.result.ok.codeEmail'));
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('true');
  });

  it('IdentityStep_PassedForAPropertyWithNoCode_SaysVerifiedAndDoesNotPretendToHaveSentACode', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie).mockResolvedValue({ result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true, lockCode: null });
    renderStep(selfieState);

    await takeAndSendSelfie();

    expect(await screen.findByTestId('identity-no-code')).toBeInTheDocument();
    expect(screen.queryByTestId('identity-lock-code')).not.toBeInTheDocument();
    expect(screen.queryByTestId('identity-code-email')).not.toBeInTheDocument();
  });

  it('IdentityStep_PassedAndTheLinkOpenedAgain_SaysVerifiedWithoutACode', () => {
    renderStep(state({ step: 'done', result: 'ok' }));

    expect(stage()).toBe('done');
    expect(screen.getByTestId('identity-result-ok')).toBeInTheDocument();
    expect(screen.queryByTestId('identity-lock-code')).not.toBeInTheDocument();
  });

  it('IdentityStep_Retry_ShowsThePlainReasonTheAttemptsLeftAndNeverACodeEvenIfTheServerSentOne', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie).mockResolvedValue({
      result: 'retry',
      guidanceCodes: ['move_closer', 'more_light'],
      attemptsRemaining: 2,
      operatorPathOpen: true,
      lockCode: '9876',
    });
    renderStep(selfieState);

    await takeAndSendSelfie();

    const reasons = await screen.findByTestId('identity-retry-reasons');
    expect(within(reasons).getByText(i18n.t('checkin.identity.guidance.move_closer'))).toBeInTheDocument();
    expect(within(reasons).getByText(i18n.t('checkin.identity.guidance.more_light'))).toBeInTheDocument();
    expect(screen.getByTestId('identity-attempts-left')).toHaveTextContent('Tentativi rimasti: 2');
    // No code for any answer but `ok`.
    expect(screen.queryByText('9876')).not.toBeInTheDocument();
    expect(screen.queryByTestId('identity-lock-code')).not.toBeInTheDocument();
    // The button to ask a person is always there after a retry, and the page does not go on yet.
    expect(screen.getByTestId('identity-ask-operator')).toBeEnabled();
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('false');
  });

  it('IdentityStep_RetryThenTheGuestTakesItAgain_GoesBackToTheSelfieWithTheAttemptsLeft', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie).mockResolvedValue({ result: 'retry', guidanceCodes: ['hold_still'], attemptsRemaining: 1, operatorPathOpen: true });
    renderStep(selfieState);

    await takeAndSendSelfie();
    fireEvent.click(await screen.findByTestId('identity-retake'));

    await waitFor(() => expect(stage()).toBe('selfie'));
    expect(await screen.findByTestId('selfie-attempts-left')).toHaveTextContent('Tentativi rimasti: 1');
  });

  it('IdentityStep_RetryAboutTheDocument_AsksToPhotographTheDocumentAgain', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie).mockResolvedValue({ result: 'retry', guidanceCodes: ['use_valid_document'], attemptsRemaining: 1, operatorPathOpen: true });
    renderStep(selfieState);

    await takeAndSendSelfie();

    const retake = await screen.findByTestId('identity-retake');
    expect(retake).toHaveTextContent(i18n.t('checkin.identity.result.retry.againDocument'));
    fireEvent.click(retake);
    await waitFor(() => expect(stage()).toBe('document'));
  });

  it('IdentityStep_AfterARetry_TheGuestCanAskForAPersonAndTheStepIsOver', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie).mockResolvedValue({ result: 'retry', guidanceCodes: ['hold_still'], attemptsRemaining: 1, operatorPathOpen: true });
    vi.mocked(publicCheckinApi.requestOperator).mockResolvedValue({ result: 'operator', operatorPathOpen: true, state: state({ step: 'operator', operatorRequested: true }) });
    renderStep(selfieState);

    await takeAndSendSelfie();
    fireEvent.click(await screen.findByTestId('identity-ask-operator'));

    await waitFor(() => expect(stage()).toBe('operator'));
    expect(screen.getByTestId('identity-operator-text')).toHaveTextContent(i18n.t('checkin.identity.result.operator.text'));
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('true');
  });

  it('IdentityStep_OperatorAnswer_SaysTheHostVerifiesAndTheCodeComesAfterTheDecisionWithNoCode', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie).mockResolvedValue({ result: 'operator', guidanceCodes: [], attemptsRemaining: 0, operatorPathOpen: true, lockCode: '1111' });
    renderStep(selfieState);

    await takeAndSendSelfie();

    expect(await screen.findByTestId('identity-operator-text')).toHaveTextContent(i18n.t('checkin.identity.result.operator.text'));
    expect(screen.queryByText('1111')).not.toBeInTheDocument();
    expect(screen.getByTestId('identity-ask-operator')).toBeInTheDocument();
  });

  it('IdentityStep_NetworkErrorOnTheSelfie_KeepsThePictureSoTheGuestSendsItAgainWithoutTakingItAgain', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie)
      .mockRejectedValueOnce(httpError(undefined, undefined, AxiosError.ERR_NETWORK))
      .mockResolvedValueOnce({ result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true, lockCode: '4821' });
    renderStep(selfieState);

    await takeAndSendSelfie();

    expect(await screen.findByTestId('checkin-identity-problem')).toHaveTextContent(i18n.t('checkin.identity.problem.network'));
    expect(stage()).toBe('selfie');
    // The picture is still on the screen: the same button sends it again.
    fireEvent.click(screen.getByTestId('selfie-send'));

    await waitFor(() => expect(stage()).toBe('done'));
    expect(publicCheckinApi.postSelfie).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('checkin-identity-problem')).not.toBeInTheDocument();
  });

  it('IdentityStep_TheApiAsksForTheConsentFirst_GoesBackToTheConsent', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie).mockRejectedValue(httpError(409, { code: 'biometric_consent_required' }));
    renderStep(selfieState);

    await takeAndSendSelfie();

    await waitFor(() => expect(stage()).toBe('consent'));
    expect(screen.getByTestId('checkin-identity-problem')).toHaveTextContent(i18n.t('checkin.identity.problem.consent_required'));
  });

  it('IdentityStep_ALinkThatIsNoLongerValid_IsAlwaysSaidToBeSo', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie).mockRejectedValue(httpError(404));
    renderStep(selfieState);

    await takeAndSendSelfie();

    expect(await screen.findByTestId('checkin-identity-problem')).toHaveTextContent(i18n.t('checkin.identity.problem.link_unavailable'));
  });
});

describe('IdentityStep: a property in Ticino (ADR-013-R6, R15)', () => {
  it('IdentityStep_Ticino_ShowsTheDocumentIsNotArchivedAndTheConsentDoesNotSayItIsKept', () => {
    renderStep(state({ documentNotArchived: true }));

    expect(screen.getByTestId('checkin-document-not-archived')).toHaveTextContent('Il documento non sarà archiviato.');
    expect(screen.getByTestId('checkin-biometric-consent')).not.toHaveTextContent(i18n.t('checkin.biometric.consent.documentKept'));
  });

  it('IdentityStep_OutsideTicino_ShowsNoNoticeAndTheConsentSaysHowLongTheDocumentIsKept', () => {
    renderStep(state({ documentNotArchived: false }));

    expect(screen.queryByTestId('checkin-document-not-archived')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-biometric-consent')).toHaveTextContent(i18n.t('checkin.biometric.consent.documentKept'));
  });

  it('IdentityStep_Ticino_SendsThePhotoOfTheDocumentAgainWithEverySelfie', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue({ success: true, acceptable: true, guidanceCodes: [], documentStored: false, documentNotArchived: true });
    vi.mocked(publicCheckinApi.postSelfie)
      .mockResolvedValueOnce({ result: 'retry', guidanceCodes: ['hold_still'], attemptsRemaining: 2, operatorPathOpen: true })
      .mockResolvedValueOnce({ result: 'ok', guidanceCodes: [], attemptsRemaining: 1, operatorPathOpen: true, lockCode: '4821' });
    renderStep(state({ step: 'document', consentRecorded: true, documentNotArchived: true }));

    pickDocument();
    await waitFor(() => expect(stage()).toBe('selfie'));
    const photo = vi.mocked(publicCheckinApi.postDocument).mock.calls[0][1];

    await takeAndSendSelfie();
    fireEvent.click(await screen.findByTestId('identity-retake'));
    await takeAndSendSelfie();

    await waitFor(() => expect(stage()).toBe('done'));
    const [first, second] = vi.mocked(publicCheckinApi.postSelfie).mock.calls;
    expect(first[2]).toBe(photo);
    expect(second[2]).toBe(photo);
  });

  it('IdentityStep_TicinoAPhotoThatWouldGoAsItIsAlone_IsRedrawnSmallerBecauseItComesAgainWithTheSelfie', async () => {
    stubRedraw();
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue({ success: true, acceptable: true, guidanceCodes: [], documentStored: false, documentNotArchived: true });
    renderStep(state({ step: 'document', consentRecorded: true, documentNotArchived: true }));

    // 6 MB is under the 9 MB of one picture and over what leaves room for a selfie in the same request (the API refuses the whole body over 10 MB).
    const photo = pickDocumentOfSize(6_000_000);

    await waitFor(() => expect(stage()).toBe('selfie'));
    const sent = vi.mocked(publicCheckinApi.postDocument).mock.calls[0][1];
    expect(sent).not.toBe(photo);
    expect(sent.type).toBe('image/jpeg');
    expect(sent.size).toBeLessThanOrEqual(DOCUMENT_WITH_SELFIE_AS_IS_BYTES);
  });

  it('IdentityStep_OutsideTicino_TheSamePhotoGoesAsItIsBecauseTheSelfieRequestCarriesNoDocument', async () => {
    stubRedraw();
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue({ success: true, acceptable: true, guidanceCodes: [], documentStored: true, documentNotArchived: false });
    renderStep(state({ step: 'document', consentRecorded: true, documentNotArchived: false }));

    const photo = pickDocumentOfSize(6_000_000);

    await waitFor(() => expect(stage()).toBe('selfie'));
    expect(vi.mocked(publicCheckinApi.postDocument).mock.calls[0][1]).toBe(photo);
  });

  it('IdentityStep_OutsideTicino_SendsTheSelfieAloneTheServerKeepsTheDocument', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie).mockResolvedValue({ result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true, lockCode: '4821' });
    renderStep(state({ step: 'selfie', consentRecorded: true, documentChecked: true }));

    await takeAndSendSelfie();

    await waitFor(() => expect(stage()).toBe('done'));
    expect(vi.mocked(publicCheckinApi.postSelfie).mock.calls[0][2]).toBeNull();
  });

  it('IdentityStep_TicinoAfterAReload_AsksForTheDocumentAgainBecauseThePageNoLongerHasItsPhoto', () => {
    renderStep(state({ step: 'selfie', consentRecorded: true, documentChecked: true, documentNotArchived: true }));

    expect(stage()).toBe('document');
    expect(screen.getByTestId('checkin-identity-document')).toBeInTheDocument();
  });
});

describe('IdentityStep: nothing of the pictures or of the code is kept', () => {
  it('IdentityStep_ThePhotosAndTheCode_AreNeverWrittenToAStorage', async () => {
    stubCamera();
    const local = vi.spyOn(Storage.prototype, 'setItem');
    vi.mocked(publicCheckinApi.postSelfie).mockResolvedValue({ result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true, lockCode: '4821' });
    renderStep(state({ step: 'selfie', consentRecorded: true, documentChecked: true }));

    await takeAndSendSelfie();
    await screen.findByTestId('identity-lock-code');

    expect(local).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain('4821');
  });
});

describe('IdentityStep: the camera and the picture are let go (ADR-013-R2, R11)', () => {
  const selfieState = state({ step: 'selfie', consentRecorded: true, documentChecked: true });

  /** The live preview is on: the camera is open (the button to take the picture is ready). */
  const waitForPreview = () => waitFor(() => expect(screen.getByTestId('selfie-take')).toBeEnabled());

  /** The guest takes the picture: it is on the canvas at the size of the camera (4000 x 3000 here). */
  async function takePicture() {
    await waitFor(() => expect(screen.getByTestId('selfie-take')).toBeEnabled());
    fireEvent.click(screen.getByTestId('selfie-take'));
    const canvas = (await screen.findByTestId('checkin-selfie-capture')).querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(4000);
    expect(canvas.height).toBe(3000);
    return canvas;
  }

  it('IdentityStep_TheGuestLeavesTheStepWithTheLivePreview_TheCameraIsSwitchedOffAtOnce', async () => {
    const { stop } = stubCamera();
    render(<PageHarness initial={selfieState} />);
    await waitForPreview();
    expect(stop).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('harness-back'));

    expect(screen.queryByTestId('checkin-selfie-capture')).not.toBeInTheDocument();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('IdentityStep_TheGuestAsksForAPersonWithTheLivePreview_TheCameraIsSwitchedOffWhenTheStepChanges', async () => {
    const { stop } = stubCamera();
    vi.mocked(publicCheckinApi.requestOperator).mockResolvedValue({ result: 'operator', operatorPathOpen: true, state: state({ step: 'operator', operatorRequested: true }) });
    renderStep(selfieState);
    await waitForPreview();
    expect(stop).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('selfie-ask-operator'));

    await waitFor(() => expect(stage()).toBe('operator'));
    expect(screen.queryByTestId('checkin-selfie-capture')).not.toBeInTheDocument();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('IdentityStep_TheCameraAnswersAfterTheGuestLeftTheStep_TheStreamIsSwitchedOffAtOnceAndNeverUsed', async () => {
    const stop = vi.fn();
    let answer: (stream: MediaStream) => void = () => undefined;
    const getUserMedia = vi.fn().mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        answer = resolve;
      }),
    );
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    const view = renderStep(selfieState);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

    // The guest leaves while the browser is still asking for the camera: there is no stream to switch off yet.
    view.unmount();
    expect(stop).not.toHaveBeenCalled();
    await act(async () => {
      answer({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    });

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('IdentityStep_TheAnswerArrives_TheCanvasOfTheSelfieIsEmptied', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie).mockResolvedValue({ result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true, lockCode: '4821' });
    renderStep(selfieState);
    const canvas = await takePicture();

    fireEvent.click(await screen.findByTestId('selfie-send'));
    await screen.findByTestId('identity-lock-code');

    // Nothing of the picture stays on a canvas a phone could keep.
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it('IdentityStep_TheCallFails_ThePictureStaysOnTheCanvasToBeSentAgain', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postSelfie).mockRejectedValue(httpError(undefined, undefined, AxiosError.ERR_NETWORK));
    renderStep(selfieState);
    const canvas = await takePicture();

    fireEvent.click(await screen.findByTestId('selfie-send'));
    await screen.findByTestId('checkin-identity-problem');

    expect(canvas.width).toBe(4000);
    expect(canvas.height).toBe(3000);
  });

  it('IdentityStep_TheGuestTakesTheSelfieAgain_TheFirstCanvasIsEmptiedAndTheCameraOpensAgain', async () => {
    const { getUserMedia, stop } = stubCamera();
    renderStep(selfieState);
    const canvas = await takePicture();
    // Taking the picture switches the camera off: the picture is all that is left.
    expect(stop).toHaveBeenCalledTimes(1);

    fireEvent.click(await screen.findByTestId('selfie-retake'));

    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });
});

describe('IdentityStep: accessibility (UX-11)', () => {
  it('IdentityStep_TheConsentTheDocumentAndTheResults_HaveNoAccessibilityViolations', async () => {
    const consent = renderStep();
    await expectNoAxeViolations(consent.container);
    consent.unmount();

    const document_ = renderStep(state({ step: 'document', consentRecorded: true }));
    await expectNoAxeViolations(document_.container);
    document_.unmount();

    const passed = renderStep(state({ step: 'done', result: 'ok' }));
    await expectNoAxeViolations(passed.container);
    passed.unmount();

    const operator = renderStep(state({ step: 'operator', operatorRequested: true }));
    await expectNoAxeViolations(operator.container);
  });

  it('IdentityStep_ADocumentThatWasNotGoodEnough_HasNoAccessibilityViolations', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue({
      success: false,
      acceptable: false,
      guidanceCodes: ['avoid_glare', 'show_whole_document'],
      documentStored: false,
      documentNotArchived: false,
    });
    const { container } = renderStep(state({ step: 'document', consentRecorded: true }));
    pickDocument();
    await screen.findByTestId('checkin-identity-document-guidance');

    await expectNoAxeViolations(container);
  });

  it('IdentityStep_TheSelfieWithACamera_HasNoAccessibilityViolations', async () => {
    stubCamera();
    const { container } = renderStep(state({ step: 'selfie', consentRecorded: true, documentChecked: true }));
    await waitFor(() => expect(screen.getByTestId('selfie-take')).toBeEnabled());

    await expectNoAxeViolations(container);
  });

  it('IdentityStep_TheCameraDenied_HasNoAccessibilityViolations', async () => {
    stubCameraDenied();
    const { container } = renderStep(state({ step: 'selfie', consentRecorded: true, documentChecked: true }));
    await screen.findByTestId('selfie-camera-problem');

    await expectNoAxeViolations(container);
  });

  it('IdentityStep_TheButtons_AreNativeButtonsThatNeverSubmitAForm', () => {
    renderStep();

    for (const button of screen.getAllByRole('button')) expect(button).toHaveAttribute('type', 'button');
  });
});

describe('IdentityStep in the other languages', () => {
  it('IdentityStep_English_ShowsTheEnglishConsent', async () => {
    await i18n.changeLanguage('en');
    renderStep();

    expect(screen.getByText(i18n.t('checkin.biometric.consent.title'))).toBeInTheDocument();
    expect(screen.getByTestId('checkin-biometric-accept')).toHaveTextContent('I agree to the face check');
    await i18n.changeLanguage('it');
  });
});
