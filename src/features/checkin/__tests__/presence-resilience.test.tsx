import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { publicCheckinApi } from '@/api/checkin.api';
import { expectNoAxeViolations } from '@/test/axe';
import type { IdentityPresenceResponse, IdentityVerificationState, PresenceChallenge } from '@/types/public-checkin.types';
import { PresenceSequenceCapture } from '../components/presence-sequence-capture';
import { IdentityStep } from '../identity-step';
import { useIdentityVerification } from '../use-identity-verification';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: {
    getLegalTexts: vi.fn(),
    openIdentity: vi.fn(),
    postBiometricConsent: vi.fn(),
    postDocument: vi.fn(),
    postSelfie: vi.fn(),
    startSelfieChallenge: vi.fn(),
    startPresenceChallenge: vi.fn(),
    postPresence: vi.fn(),
    requestOperator: vi.fn(),
  },
}));

const TOKEN = 'tok-resilience';
const KEY_1 = '11111111-1111-4111-8111-111111111111';
const KEY_2 = '22222222-2222-4222-8222-222222222222';

const challengeBody = (overrides: Partial<PresenceChallenge> = {}): PresenceChallenge => ({
  challengeToken: 'challenge-1',
  steps: ['turn_left', 'look_up'],
  stepMs: 1_000,
  leadInMs: 500,
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
  targetFps: 10,
  maxFrames: 100,
  maxFrameSide: 320,
  ...overrides,
});

const state = (overrides: Partial<IdentityVerificationState> = {}): IdentityVerificationState => ({
  step: 'presence',
  result: null,
  biometricOffered: true,
  consentRecorded: true,
  consentRefused: false,
  documentChecked: true,
  attemptsRemaining: 3,
  operatorRequested: false,
  operatorPathOpen: true,
  documentNotArchived: false,
  verifyingGuestPosition: 0,
  selfHosted: true,
  opened: true,
  noticeVersion: 'checkin-biometric-2026-11',
  choice: 'automatic',
  formatId: 'cie',
  guidedRetryAvailable: true,
  closed: false,
  outcome: null,
  ...overrides,
});

const approved = (overrides: Partial<IdentityPresenceResponse> = {}): IdentityPresenceResponse => ({
  result: 'ok',
  guidance: [],
  guidedRetryAvailable: false,
  state: state({ step: 'done', result: 'ok', closed: true, outcome: 'ok' }),
  ...overrides,
});

const withAPerson = state({ step: 'operator', result: 'operator', operatorRequested: true, biometricOffered: false, closed: true, outcome: 'operator' });

function httpError(status?: number, data?: unknown, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response = status === undefined ? undefined : { status, data, statusText: '', headers: {}, config };
  return new AxiosError('Request failed', code ?? AxiosError.ERR_BAD_REQUEST, config, {}, response);
}

const networkError = () => httpError(undefined, undefined, AxiosError.ERR_NETWORK);

/** The camera: what the picture of the video is (a test turns the phone by changing it), and the tracks. */
const camera = { size: { width: 640, height: 480 } };
let encoded = 0;
const originalWidth = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoWidth');
const originalHeight = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoHeight');
const originalHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');

/** A camera that works: a stream with one track that can be stopped and can end by itself. */
function stubCamera(rejectWith?: { name: string }) {
  const stop = vi.fn();
  const endedListeners: Array<() => void> = [];
  const track = {
    stop,
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'ended') endedListeners.push(listener);
    },
  };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = rejectWith ? vi.fn().mockRejectedValue(rejectWith) : vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  return { stop, getUserMedia, endTheTrack: () => endedListeners.forEach((listener) => listener()) };
}

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

const setScreen = (width: number, height: number, event: 'resize' | 'orientationchange' = 'resize') => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  act(() => {
    window.dispatchEvent(new Event(event));
  });
};

const setOnline = (online: boolean) => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
};

/** Lets what is waiting settle, with the clock where it is. */
const settle = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/** Moves the clock in small steps until the condition holds (the screen is awaited, never a window of time guessed in advance). */
async function advanceUntil(done: () => boolean, step = 100, limit = 300) {
  for (let spent = 0; spent < limit && !done(); spent += 1) await advance(step);
  expect(done()).toBe(true);
}

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const phase = () => screen.getByTestId('checkin-presence').getAttribute('data-phase');
const startButton = () => screen.getByTestId('checkin-presence-start') as HTMLButtonElement;
const canvas = () => screen.getByTestId('checkin-presence-canvas') as HTMLCanvasElement;
const posts = () => vi.mocked(publicCheckinApi.postPresence).mock.calls;

function Harness({ initial }: { initial: IdentityVerificationState }) {
  const identity = useIdentityVerification(TOKEN, initial);
  return <IdentityStep identity={identity} token={TOKEN} />;
}

function renderStep(initial: IdentityVerificationState = state()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness initial={initial} />
    </QueryClientProvider>,
  );
}

async function waitForTheStart() {
  await settle();
  await advanceUntil(() => screen.queryByTestId('checkin-presence-start') !== null && !startButton().disabled);
}

/** The guest starts and the prompts run to their end: the sequence is taken. */
async function startRecording() {
  await waitForTheStart();
  fireEvent.click(startButton());
  await settle();
}

/** What every post was given, as it was at that moment: the screen lets the frames go once the answer is in. */
let seen: Array<{ key: string; frames: Blob[]; timestamps: number[]; challengeToken: string }> = [];

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  seen = [];
  encoded = 0;
  camera.size = { width: 640, height: 480 };
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => camera.size.width });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => camera.size.height });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type) {
    encoded += 1;
    callback(new Blob([`frame-${encoded}`], { type }));
  });
  vi.mocked(publicCheckinApi.startPresenceChallenge).mockImplementation(async () => challengeBody());
  vi.mocked(publicCheckinApi.postPresence).mockImplementation(async (_token, sequence, key) => {
    seen.push({ key, frames: [...sequence.frames], timestamps: [...sequence.timestamps], challengeToken: sequence.challengeToken });
    return approved();
  });
  vi.mocked(publicCheckinApi.requestOperator).mockResolvedValue({ result: 'operator', operatorPathOpen: true, state: withAPerson });
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  Reflect.deleteProperty(navigator, 'onLine');
  Reflect.deleteProperty(window, 'innerWidth');
  Reflect.deleteProperty(window, 'innerHeight');
  if (originalWidth) Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', originalWidth);
  if (originalHeight) Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', originalHeight);
  if (originalHidden) Object.defineProperty(Document.prototype, 'hidden', originalHidden);
  Reflect.deleteProperty(document, 'hidden');
  localStorage.clear();
  sessionStorage.clear();
});

describe('presence-resilience: a camera that is not there offers the assisted path at once (E72/F02/US01/T02, AC1)', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not_found'],
    ['OverconstrainedError', 'not_found'],
    ['NotReadableError', 'busy'],
    ['SomethingNew', 'unknown'],
  ])('IdentityStep_The%sOfTheBrowser_SaysWhyAndTheWayToAPersonIsThere', async (name, problem) => {
    stubCamera({ name });
    renderStep();
    await settle();

    const block = screen.getByTestId('checkin-presence-camera-problem');
    expect(block).toHaveAttribute('data-problem', problem);
    expect(block).toHaveTextContent(text('checkin.identity.presence.camera.fallback'));
    expect(screen.queryByTestId('checkin-presence-start')).not.toBeInTheDocument();
    // «Riprova» for what the guest can still grant, and the person under it, enabled, with no wait.
    expect(screen.getByTestId('checkin-presence-camera-retry')).toBeEnabled();
    expect(screen.getByTestId('checkin-identity-assisted-path')).toBeEnabled();
    expect(publicCheckinApi.postPresence).not.toHaveBeenCalled();
    expect(publicCheckinApi.postSelfie).not.toHaveBeenCalled();
  });

  it('IdentityStep_TheCameraIsBlocked_ThePersonCanBeAskedForAndTheStepEndsWithHer', async () => {
    stubCamera({ name: 'NotAllowedError' });
    renderStep();
    await settle();

    fireEvent.click(screen.getByTestId('checkin-identity-assisted-path'));
    await settle();

    expect(publicCheckinApi.requestOperator).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'operator');
    expect(screen.queryByTestId('checkin-presence')).not.toBeInTheDocument();
  });

  it('PresenceSequenceCapture_TheBrowserBlockedTheCamera_TheGuestAllowsItAndTriesAgainWithTheChallengeSheAlreadyHas', async () => {
    const rig = stubCamera({ name: 'NotAllowedError' });
    renderStep();
    await settle();
    rig.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: rig.stop }] } as unknown as MediaStream);

    fireEvent.click(screen.getByTestId('checkin-presence-camera-retry'));
    await waitForTheStart();

    expect(rig.getUserMedia).toHaveBeenCalledTimes(2);
    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(1);
    expect(phase()).toBe('ready');
    expect(screen.queryByTestId('checkin-presence-camera-problem')).not.toBeInTheDocument();
  });

  it('PresenceSequenceCapture_ThePageCannotUseACamera_SaysSoWithNoButtonToTryAgainAndThePersonIsThere', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    renderStep();
    await settle();

    expect(screen.getByTestId('checkin-presence-camera-problem')).toHaveAttribute('data-problem', 'unsupported');
    expect(screen.getByTestId('checkin-presence-camera-problem')).toHaveTextContent(text('checkin.biometric.capture.cameraUnsupported'));
    expect(screen.queryByTestId('checkin-presence-camera-retry')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-identity-assisted-path')).toBeEnabled();
  });

  it('PresenceSequenceCapture_TheCameraEndsByItselfWhileRecording_ThrowsTheFramesAwayAndSaysItIsTheCamera', async () => {
    const rig = stubCamera();
    renderStep();
    await startRecording();
    await advance(700);

    act(() => rig.endTheTrack());
    await advance(5_000);

    expect(screen.getByTestId('checkin-presence-camera-problem')).toHaveAttribute('data-problem', 'unknown');
    expect(rig.stop).toHaveBeenCalled();
    expect(publicCheckinApi.postPresence).not.toHaveBeenCalled();
    expect(canvas().width).toBe(0);
  });
});

describe('presence-resilience: a phone that is turned or a page that goes away restarts with a new challenge (AC2)', () => {
  it('IdentityStep_ThePhoneIsTurnedWhileRecording_ThrowsTheFramesAwaySaysWhyAndStartsAgainWithANewChallenge', async () => {
    const rig = stubCamera();
    renderStep();
    await startRecording();
    await advance(700);
    expect(phase()).toBe('recording');

    // From wider than high to higher than wide.
    setScreen(480, 900);
    await settle();

    expect(phase()).not.toBe('recording');
    expect(screen.getByTestId('checkin-presence-notice')).toHaveAttribute('data-notice', 'rotated');
    expect(screen.getByTestId('checkin-presence-notice')).toHaveTextContent(text('checkin.identity.presence.notice.rotated'));
    await waitForTheStart();
    // A new challenge, and the camera that was open is the one that is used: no new permission is asked.
    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(2);
    expect(rig.getUserMedia).toHaveBeenCalledTimes(1);
    expect(canvas().width).toBe(0);
    // Whatever was taken before the turn is never sent.
    await advance(5_000);
    expect(publicCheckinApi.postPresence).not.toHaveBeenCalled();
  });

  it('IdentityStep_TheOrientationChangeEvent_DoesTheSameAsAResize', async () => {
    stubCamera();
    renderStep();
    await startRecording();
    await advance(500);

    setScreen(480, 900, 'orientationchange');
    await waitForTheStart();

    expect(screen.getByTestId('checkin-presence-notice')).toHaveAttribute('data-notice', 'rotated');
    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(2);
  });

  it('IdentityStep_AResizeThatKeepsTheShape_DoesNotTouchTheRecording', async () => {
    stubCamera();
    const view = renderStep();
    await startRecording();
    await advance(500);

    setScreen(1200, 800);
    await advance(500);

    expect(phase()).toBe('recording');
    expect(screen.queryByTestId('checkin-presence-notice')).not.toBeInTheDocument();
    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('IdentityStep_TheTurnComesWhileTheGuestIsNotRecording_NothingIsRestarted', async () => {
    stubCamera();
    renderStep();
    await waitForTheStart();

    setScreen(480, 900);
    await settle();

    expect(phase()).toBe('ready');
    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(1);
  });

  it('IdentityStep_ThePictureOfTheCameraChangesShapeWhileRecording_IsTheSameAsTurningThePhone', async () => {
    stubCamera();
    renderStep();
    await startRecording();
    await advance(500);

    camera.size = { width: 480, height: 640 };
    await advance(300);

    expect(screen.getByTestId('checkin-presence-notice')).toHaveAttribute('data-notice', 'rotated');
    await waitForTheStart();
    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(2);
    expect(publicCheckinApi.postPresence).not.toHaveBeenCalled();
  });

  it('IdentityStep_AfterATurnTheGuestRecordsAgain_TheSequenceThatIsSentIsTheNewOneWithANewKey', async () => {
    stubCamera();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(KEY_1).mockReturnValueOnce(KEY_2);
    vi.mocked(publicCheckinApi.startPresenceChallenge)
      .mockResolvedValueOnce(challengeBody({ challengeToken: 'challenge-1' }))
      .mockResolvedValueOnce(challengeBody({ challengeToken: 'challenge-2' }));
    renderStep();
    await startRecording();
    await advance(700);
    setScreen(480, 900);
    await settle();
    setScreen(1024, 768);
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();
    await advanceUntil(() => posts().length > 0);

    expect(posts()).toHaveLength(1);
    expect(seen[0].key).toBe(KEY_2);
    expect(seen[0].challengeToken).toBe('challenge-2');
    // The sequence starts at 0 again: it is a new recording, not the old one continued.
    expect(seen[0].timestamps[0]).toBe(0);
  });

  it('IdentityStep_ThePageGoesToTheBackgroundWhileRecording_ThrowsTheFramesAwayStopsTheCameraAndRestartsWhenItIsBack', async () => {
    const rig = stubCamera();
    renderStep();
    await startRecording();
    await advance(700);

    setHidden(true);
    await advance(5_000);

    expect(rig.stop).toHaveBeenCalledTimes(1);
    expect(publicCheckinApi.postPresence).not.toHaveBeenCalled();
    expect(canvas().width).toBe(0);
    // Nothing is asked of the server while the page is not seen.
    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(1);

    setHidden(false);
    await waitForTheStart();

    expect(rig.getUserMedia).toHaveBeenCalledTimes(2);
    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('checkin-presence-notice')).toHaveAttribute('data-notice', 'hidden');
    expect(screen.getByTestId('checkin-presence-notice')).toHaveTextContent(text('checkin.identity.presence.notice.hidden'));
  });

  it('IdentityStep_ThePageGoesToTheBackgroundBeforeTheGuestStarts_TheCameraIsLetGoAndOpenedAgainWithNoWordOfBlame', async () => {
    const rig = stubCamera();
    renderStep();
    await waitForTheStart();

    setHidden(true);
    expect(rig.stop).toHaveBeenCalledTimes(1);
    setHidden(false);
    await waitForTheStart();

    expect(rig.getUserMedia).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('checkin-presence-notice')).not.toBeInTheDocument();
  });

  it('IdentityStep_TheBrowserAnswersWhileThePageIsHidden_TheCameraIsNotKept', async () => {
    const rig = stubCamera();
    const stop = vi.fn();
    let grant: (stream: MediaStream) => void = () => undefined;
    rig.getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => (grant = resolve)));
    renderStep();
    await settle();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });

    await act(async () => {
      grant({ getTracks: () => [{ stop, addEventListener: vi.fn() }] } as unknown as MediaStream);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(stop).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    rig.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop, addEventListener: vi.fn() }] } as unknown as MediaStream);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitForTheStart();
    expect(rig.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('IdentityStep_ThePageGoesToTheBackgroundWhileTheSequenceIsOnItsWay_NothingIsThrownAway', async () => {
    stubCamera();
    let answer: (value: IdentityPresenceResponse) => void = () => undefined;
    vi.mocked(publicCheckinApi.postPresence).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length > 0);

    setHidden(true);
    await advance(1_000);
    expect(phase()).toBe('uploading');

    await act(async () => {
      answer(approved());
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('identity-result-ok')).toBeInTheDocument();
  });
});

describe('presence-resilience: a connection that drops is resumed with the same frames and the same key (AC3)', () => {
  it('IdentityStep_ANetworkErrorThenSuccess_SendsTheSameKeyAndTheSameFramesTwiceAndOneResultIsShown', async () => {
    stubCamera();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(KEY_1);
    vi.mocked(publicCheckinApi.postPresence).mockImplementationOnce(async (_token, sequence, key) => {
      seen.push({ key, frames: [...sequence.frames], timestamps: [...sequence.timestamps], challengeToken: sequence.challengeToken });
      throw networkError();
    });
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length === 1);
    // The first try failed: the screen waits, it does not say it failed.
    expect(phase()).toBe('uploading');
    expect(screen.queryByTestId('checkin-identity-problem')).not.toBeInTheDocument();

    await advanceUntil(() => posts().length === 2, 100, 40);
    await settle();

    expect(seen.map((one) => one.key)).toEqual([KEY_1, KEY_1]);
    // The very same Blobs, not a second encoding of the frames.
    expect(seen[1].frames).toHaveLength(seen[0].frames.length);
    expect(seen[1].frames.every((blob, index) => blob === seen[0].frames[index])).toBe(true);
    expect(seen[1].timestamps).toEqual(seen[0].timestamps);
    expect(screen.getAllByTestId('identity-result-ok')).toHaveLength(1);
    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'done');
  });

  it('IdentityStep_TheRetriesWaitOneTwoAndFourSecondsBetweenThemAndAllCarryTheSameKey', async () => {
    stubCamera();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(KEY_1);
    const times: number[] = [];
    vi.mocked(publicCheckinApi.postPresence).mockImplementation(async (_token, sequence, key) => {
      times.push(Date.now());
      seen.push({ key, frames: [...sequence.frames], timestamps: [...sequence.timestamps], challengeToken: sequence.challengeToken });
      throw httpError(503);
    });
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length === 4, 100, 100);

    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1_000);
    expect(times[1] - times[0]).toBeLessThan(1_200);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(2_000);
    expect(times[2] - times[1]).toBeLessThan(2_200);
    expect(times[3] - times[2]).toBeGreaterThanOrEqual(4_000);
    expect(times[3] - times[2]).toBeLessThan(4_200);
    expect(new Set(seen.map((one) => one.key))).toEqual(new Set([KEY_1]));
  });

  it('IdentityStep_A4xxAnswer_IsNotRepeatedTheFramesAreLetGoAndTheGuestRecordsAgain', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence).mockRejectedValue(httpError(422, { code: 'presence_sequence_invalid' }));
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length > 0);
    await advance(10_000);

    expect(posts()).toHaveLength(1);
    expect(phase()).toBe('failed');
    expect(screen.getByTestId('checkin-identity-problem')).toHaveTextContent(text('checkin.identity.problem.presence_invalid'));
    expect(screen.getByTestId('checkin-presence-retry')).toBeEnabled();
    // The recording that was refused is not kept.
    expect(vi.mocked(publicCheckinApi.postPresence).mock.calls[0][1].frames).toHaveLength(0);
    expect(canvas().width).toBe(0);
  });

  it.each([
    [400, 'idempotency_key_required'],
    [413, 'presence_sequence_too_large'],
    [404, undefined],
    [409, 'presence_challenge_unavailable'],
  ])('IdentityStep_A%iAnswer_IsNeverRepeated', async (status, code) => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence).mockRejectedValue(httpError(status, code ? { code } : undefined));
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length > 0);
    await advance(10_000);

    expect(posts()).toHaveLength(1);
  });

  it('IdentityStep_TheBrowserIsOffline_NothingIsSentUntilTheOnlineEventAndThenOnce', async () => {
    stubCamera();
    renderStep();
    await startRecording();
    // The connection is gone while the guest follows the prompts.
    setOnline(false);
    await advanceUntil(() => phase() === 'uploading');
    await advance(5_000);

    expect(posts()).toHaveLength(0);
    expect(screen.getByTestId('checkin-presence-prompt')).toHaveTextContent(text('checkin.identity.presence.waitingForConnection'));

    setOnline(true);
    await advanceUntil(() => posts().length > 0);
    await settle();

    expect(posts()).toHaveLength(1);
    expect(screen.getByTestId('identity-result-ok')).toBeInTheDocument();
  });

  it('IdentityStep_TheConnectionNeverComesBack_TheRecordingIsKeptForOneManualRetryWithTheSameKey', async () => {
    stubCamera();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(KEY_1);
    renderStep();
    await startRecording();
    setOnline(false);
    await advanceUntil(() => phase() === 'kept', 500, 200);

    expect(posts()).toHaveLength(0);
    expect(screen.getByTestId('checkin-presence-kept')).toHaveTextContent(text('checkin.identity.presence.kept.offline'));
    expect(screen.getByTestId('checkin-presence-send-again')).toBeEnabled();
    // The guest is never left without the person.
    expect(screen.getByTestId('checkin-identity-assisted-path')).toBeEnabled();

    setOnline(true);
    fireEvent.click(screen.getByTestId('checkin-presence-send-again'));
    await advanceUntil(() => posts().length > 0);
    await settle();

    expect(seen.map((one) => one.key)).toEqual([KEY_1]);
    // They are the frames of the first recording, kept for this: a whole sequence, not an empty one.
    expect(seen[0].frames.length).toBeGreaterThan(20);
    expect(screen.getByTestId('identity-result-ok')).toBeInTheDocument();
  });

  it('IdentityStep_EveryTryFailsAndSoDoesTheManualRetry_TheFramesAreLetGoAndANewRecordingStartsFromANewChallenge', async () => {
    stubCamera();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(KEY_1).mockReturnValueOnce(KEY_2);
    vi.mocked(publicCheckinApi.postPresence).mockImplementation(async (_token, sequence, key) => {
      seen.push({ key, frames: [...sequence.frames], timestamps: [...sequence.timestamps], challengeToken: sequence.challengeToken });
      throw networkError();
    });
    renderStep();
    await startRecording();
    await advanceUntil(() => phase() === 'kept', 500, 100);
    // One request and three repeats, all with the same key.
    expect(posts()).toHaveLength(4);
    const held = vi.mocked(publicCheckinApi.postPresence).mock.calls[0][1];
    expect(held.frames.length).toBeGreaterThan(20);

    fireEvent.click(screen.getByTestId('checkin-presence-send-again'));
    await advanceUntil(() => posts().length === 8, 500, 100);
    await waitForTheStart();

    expect(new Set(seen.map((one) => one.key))).toEqual(new Set([KEY_1]));
    // After the retry that was allowed the recording is gone: the arrays that held it are empty, and so is the canvas.
    expect(held.frames).toHaveLength(0);
    expect(held.timestamps).toHaveLength(0);
    expect(canvas().width).toBe(0);
    expect(screen.getByTestId('checkin-presence-notice')).toHaveAttribute('data-notice', 'lost');
    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('checkin-presence-send-again')).not.toBeInTheDocument();
  });

  it('IdentityStep_TheServerFailsOnEveryTry_KeepsTheRecordingAndSaysThatTheServiceDoesNotAnswer', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence).mockRejectedValue(httpError(503));
    renderStep();
    await startRecording();
    await advanceUntil(() => phase() === 'kept', 500, 100);

    expect(posts()).toHaveLength(4);
    expect(screen.getByTestId('checkin-presence-kept')).toHaveAttribute('data-problem', 'processing');
    // It is the service that does not answer, not the connection of the guest: the sentence does not say there is no connection.
    expect(screen.getByTestId('checkin-presence-kept')).toHaveTextContent(text('checkin.identity.presence.kept.server'));
    expect(screen.getByTestId('checkin-presence-send-again')).toBeEnabled();
  });

  it('IdentityStep_TooManyRequests_KeepsTheRecordingForTheGuestToSendAgainWithTheSameKey', async () => {
    stubCamera();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(KEY_1);
    vi.mocked(publicCheckinApi.postPresence).mockImplementationOnce(async (_token, sequence, key) => {
      seen.push({ key, frames: [...sequence.frames], timestamps: [...sequence.timestamps], challengeToken: sequence.challengeToken });
      throw httpError(429, { code: 'too_many_requests' });
    });
    renderStep();
    await startRecording();
    await advanceUntil(() => phase() === 'kept');
    await advance(10_000);

    // A 429 is a 4xx: not repeated by itself.
    expect(posts()).toHaveLength(1);
    expect(screen.getByTestId('checkin-presence-kept')).toHaveTextContent(text('checkin.identity.problem.too_many_requests'));

    fireEvent.click(screen.getByTestId('checkin-presence-send-again'));
    await advanceUntil(() => posts().length === 2);
    await settle();

    expect(seen.map((one) => one.key)).toEqual([KEY_1, KEY_1]);
    expect(screen.getByTestId('identity-result-ok')).toBeInTheDocument();
  });

  it('IdentityStep_TheKeptRecording_AnswersWhateverTheServerStoredWithoutAskingTwice', async () => {
    // The first request reached the server and its answer was lost: the same key gets the stored answer back, a retry (here an operator decision).
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence)
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce({ result: 'operator', guidance: [], guidedRetryAvailable: false, state: withAPerson });
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length === 2, 100, 60);
    await settle();

    expect(screen.getByTestId('identity-result-operator')).toBeInTheDocument();
    expect(screen.queryByTestId('identity-result-ok')).not.toBeInTheDocument();
    expect(publicCheckinApi.requestOperator).not.toHaveBeenCalled();
  });
});

describe('presence-resilience: an expired challenge is renewed (AC4)', () => {
  it('PresenceSequenceCapture_TheChallengeRanOutBeforeTheStart_AnotherIsAskedForWithoutAWordAndTheNewOneIsUsed', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.startPresenceChallenge)
      .mockResolvedValueOnce(challengeBody({ challengeToken: 'challenge-old', expiresAt: new Date(Date.now() + 5_000).toISOString() }))
      .mockResolvedValueOnce(challengeBody({ challengeToken: 'challenge-new' }));
    renderStep();
    await waitForTheStart();
    // The guest read the instructions for a minute.
    await advance(60_000);
    fireEvent.click(startButton());
    await settle();

    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('checkin-presence-notice')).not.toBeInTheDocument();
    await advanceUntil(() => posts().length > 0);
    expect(seen[0].challengeToken).toBe('challenge-new');
  });

  it('PresenceSequenceCapture_TheChallengeWouldRunOutInTheMiddleOfTheRecording_IsAskedForAgainBeforeStarting', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.startPresenceChallenge)
      .mockResolvedValueOnce(challengeBody({ challengeToken: 'challenge-short', expiresAt: new Date(Date.now() + 1_000).toISOString() }))
      .mockResolvedValueOnce(challengeBody({ challengeToken: 'challenge-long' }));
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length > 0);

    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(2);
    expect(seen[0].challengeToken).toBe('challenge-long');
  });

  it('PresenceSequenceCapture_AGoodChallenge_IsNotAskedForAgain', async () => {
    stubCamera();
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length > 0);

    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(1);
  });

  it('PresenceSequenceCapture_TheRenewalFails_SaysSoAndTheGuestTriesAgain', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.startPresenceChallenge)
      .mockResolvedValueOnce(challengeBody({ expiresAt: new Date(Date.now() + 1_000).toISOString() }))
      .mockRejectedValueOnce(networkError());
    renderStep();
    await startRecording();

    expect(phase()).toBe('failed');
    expect(screen.getByTestId('checkin-identity-problem')).toHaveTextContent(text('checkin.identity.problem.network'));
    expect(screen.getByTestId('checkin-presence-retry')).toBeEnabled();
  });

  it('IdentityStep_TheServerSaysTheChallengeExpired_StartsAgainWithANewChallengeANewKeyAndANewRecording', async () => {
    stubCamera();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(KEY_1).mockReturnValueOnce(KEY_2);
    vi.mocked(publicCheckinApi.startPresenceChallenge)
      .mockResolvedValueOnce(challengeBody({ challengeToken: 'challenge-1' }))
      .mockResolvedValueOnce(challengeBody({ challengeToken: 'challenge-2' }));
    vi.mocked(publicCheckinApi.postPresence).mockImplementationOnce(async (_token, sequence, key) => {
      seen.push({ key, frames: [...sequence.frames], timestamps: [...sequence.timestamps], challengeToken: sequence.challengeToken });
      throw httpError(409, { code: 'presence_challenge_expired' });
    });
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length > 0);
    await advance(10_000);

    // One request, never repeated: a 409 is the server saying no.
    expect(posts()).toHaveLength(1);
    expect(screen.getByTestId('checkin-presence-notice')).toHaveAttribute('data-notice', 'expired');
    expect(screen.queryByTestId('checkin-identity-problem')).not.toBeInTheDocument();
    await waitForTheStart();
    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(2);

    fireEvent.click(startButton());
    await settle();
    await advanceUntil(() => posts().length === 2);

    expect(seen.map((one) => one.key)).toEqual([KEY_1, KEY_2]);
    expect(seen[1].challengeToken).toBe('challenge-2');
    expect(seen[1].timestamps[0]).toBe(0);
    expect(seen[1].frames[0]).not.toBe(seen[0].frames[0]);
  });

  it('IdentityStep_TheServerHasNoChallengeForTheAttempt_IsTheSameAsAnExpiredOne', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence).mockRejectedValueOnce(httpError(409, { code: 'presence_challenge_required' }));
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length > 0);
    await waitForTheStart();

    expect(screen.getByTestId('checkin-presence-notice')).toHaveAttribute('data-notice', 'expired');
    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(2);
  });
});

describe('presence-resilience: a second tap sends nothing twice (AC5)', () => {
  it('PresenceSequenceCapture_AnotherCallOfTheStepIsInFlight_NothingIsSentTheRecordingStaysAndTheGuestSendsItOnceItIsOver', async () => {
    stubCamera();
    type CaptureProps = ComponentProps<typeof PresenceSequenceCapture>;
    const startChallenge = vi.fn<CaptureProps['startChallenge']>().mockImplementation(async () => ({ kind: 'ready', challenge: challengeBody() }));
    const sendSequence = vi.fn<CaptureProps['sendSequence']>().mockResolvedValueOnce({ kind: 'busy' }).mockResolvedValueOnce({ kind: 'answered' });
    render(<PresenceSequenceCapture startChallenge={startChallenge} sendSequence={sendSequence} busy={false} />);
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();
    await advanceUntil(() => phase() === 'kept');

    // Nothing reached the server, and it was not the connection: the general sentence, and the recording is still there.
    expect(screen.getByTestId('checkin-presence-kept')).toHaveAttribute('data-problem', 'failed');
    expect(screen.getByTestId('checkin-presence-kept')).toHaveTextContent(text('checkin.identity.problem.failed'));
    const first = sendSequence.mock.calls[0][0];
    expect(first.frames.length).toBeGreaterThan(20);

    fireEvent.click(screen.getByTestId('checkin-presence-send-again'));
    await settle();

    expect(sendSequence).toHaveBeenCalledTimes(2);
    expect(sendSequence.mock.calls[1][1]).toBe(sendSequence.mock.calls[0][1]);
    // Answered: the frames are let go.
    expect(first.frames).toHaveLength(0);
  });

  it('PresenceSequenceCapture_TwoTapsOnSendAgain_HandTheRecordingToTheSendOnceWhateverTheHookDoes', async () => {
    stubCamera();
    // The screen on its own, with a send that is not the hook's: the guard of the screen is what is looked at.
    type CaptureProps = ComponentProps<typeof PresenceSequenceCapture>;
    const startChallenge = vi.fn<CaptureProps['startChallenge']>().mockImplementation(async () => ({ kind: 'ready', challenge: challengeBody() }));
    const sendSequence = vi
      .fn<CaptureProps['sendSequence']>()
      .mockResolvedValueOnce({ kind: 'kept', problem: 'network' })
      .mockReturnValue(new Promise(() => undefined));
    render(<PresenceSequenceCapture startChallenge={startChallenge} sendSequence={sendSequence} busy={false} />);
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();
    await advanceUntil(() => phase() === 'kept');

    const again = screen.getByTestId('checkin-presence-send-again');
    act(() => {
      fireEvent.click(again);
      fireEvent.click(again);
    });
    await settle();

    expect(sendSequence).toHaveBeenCalledTimes(2);
    expect(sendSequence.mock.calls[1][1]).toBe(sendSequence.mock.calls[0][1]);
  });

  it('PresenceSequenceCapture_TwoTapsOnSendAgain_SendTheRecordingOnce', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence)
      .mockRejectedValueOnce(httpError(429, { code: 'too_many_requests' }))
      .mockReturnValue(new Promise(() => undefined));
    renderStep();
    await startRecording();
    await advanceUntil(() => phase() === 'kept');

    const again = screen.getByTestId('checkin-presence-send-again');
    act(() => {
      fireEvent.click(again);
      fireEvent.click(again);
    });
    await settle();

    expect(posts()).toHaveLength(2);
  });

  it('PresenceSequenceCapture_TheGuestTapsStartAgainWhileTheSequenceIsOnItsWay_NothingIsSentTwice', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence).mockReturnValue(new Promise(() => undefined));
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length > 0);

    expect(phase()).toBe('uploading');
    expect(screen.queryByTestId('checkin-presence-start')).not.toBeInTheDocument();
    await advance(5_000);
    expect(posts()).toHaveLength(1);
  });

  it('IdentityStep_TheButtonsOfTheStep_StayDisabledWhileTheSequenceIsOnItsWay', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence).mockReturnValue(new Promise(() => undefined));
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length > 0);

    expect(screen.getByTestId('checkin-identity-assisted-path')).toBeDisabled();
  });
});

describe('presence-resilience: the end of the step (AC6)', () => {
  it('IdentityStep_TheVerificationIsClosedWhileTheSequenceIsSent_ShowsWhereItEndedAndSaysItWasAlreadyOver', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence).mockRejectedValue(httpError(409, { code: 'identity_already_closed', state: state({ step: 'done', result: 'ok', closed: true, outcome: 'ok' }) }));
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length > 0);
    await settle();

    expect(posts()).toHaveLength(1);
    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'done');
    expect(screen.getByTestId('identity-result-ok')).toBeInTheDocument();
    expect(screen.getByTestId('identity-closed-note')).toHaveTextContent(text('checkin.identity.result.closed'));
    // The step is over, not failed.
    expect(screen.queryByTestId('checkin-identity-problem')).not.toBeInTheDocument();
  });

  it('IdentityStep_TheVerificationWasClosedWithAPerson_SaysItAndNeverASuccess', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence).mockRejectedValue(httpError(409, { code: 'identity_already_closed', state: withAPerson }));
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length > 0);
    await settle();

    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'operator');
    expect(screen.getByTestId('identity-closed-note')).toBeInTheDocument();
    expect(screen.queryByTestId('identity-result-ok')).not.toBeInTheDocument();
  });

  it('IdentityStep_AVerificationThatIsNotClosed_HasNoNoteThatItWasOver', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence).mockResolvedValue(approved({ state: state({ step: 'done', result: 'ok' }) }));
    renderStep();
    await startRecording();
    await advanceUntil(() => posts().length > 0);
    await settle();

    expect(screen.getByTestId('identity-result-ok')).toBeInTheDocument();
    expect(screen.queryByTestId('identity-closed-note')).not.toBeInTheDocument();
  });

  it('IdentityStep_ThePersonIsAskedForWhileTheRecordingIsKept_TheStepEndsWithHerAndTheFramesAreLetGo', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence).mockRejectedValue(httpError(429, { code: 'too_many_requests' }));
    renderStep();
    await startRecording();
    await advanceUntil(() => phase() === 'kept');
    const held = posts()[0][1];
    expect(held.frames.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('checkin-identity-assisted-path'));
    await settle();

    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'operator');
    expect(held.frames).toHaveLength(0);
  });
});

describe('presence-resilience: accessibility', () => {
  // axe-core waits on timers of its own: these tests run on the real clock, and wait for the screen, not for a window of time.
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('PresenceSequenceCapture_TheCameraProblem_HasNoAccessibilityViolations', async () => {
    stubCamera({ name: 'NotAllowedError' });
    const { container } = renderStep();
    await screen.findByTestId('checkin-presence-camera-problem');

    await expectNoAxeViolations(container);
  });

  it('PresenceSequenceCapture_TheKeptRecording_HasNoAccessibilityViolations', async () => {
    stubCamera();
    // A short challenge: the whole recording takes a third of a second on the real clock.
    vi.mocked(publicCheckinApi.startPresenceChallenge).mockImplementation(async () => challengeBody({ leadInMs: 100, stepMs: 100, steps: ['turn_left'] }));
    vi.mocked(publicCheckinApi.postPresence).mockRejectedValue(httpError(429, { code: 'too_many_requests' }));
    const { container } = renderStep();
    await waitFor(() => expect(phase()).toBe('ready'));
    fireEvent.click(startButton());
    await waitFor(() => expect(phase()).toBe('kept'), { timeout: 5_000 });

    await expectNoAxeViolations(container);
  });
});
