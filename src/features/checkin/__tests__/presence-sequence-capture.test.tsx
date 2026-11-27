import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { APP_RESOURCES } from '@/i18n/resources';
import guestDe from '@/i18n/locales/guest-checkin.de.json';
import guestFr from '@/i18n/locales/guest-checkin.fr.json';
import guestEs from '@/i18n/locales/guest-checkin.es.json';
import { publicCheckinApi } from '@/api/checkin.api';
import { expectNoAxeViolations } from '@/test/axe';
import type { IdentityPresenceResponse, IdentityVerificationState, PresenceChallenge, PublicCheckInContextDto } from '@/types/public-checkin.types';
import { PresenceSequenceCapture } from '../components/presence-sequence-capture';
import { IdentityStep } from '../identity-step';
import {
  afterDocument,
  afterPresence,
  afterRetake,
  classifyIdentityError,
  closedAnswerOf,
  IDENTITY_PROBLEMS,
  PRESENCE_GUIDANCE_CODES,
  presenceGuidanceKey,
  problemKey,
  progressFromState,
  readPresenceAnswer,
  readPresenceChallenge,
  retakeTargetOf,
} from '../lib/identity-model';
import { useIdentityVerification } from '../use-identity-verification';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: {
    getContext: vi.fn(),
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

const TOKEN = 'tok-presence';

/** A challenge as the API sends it: a lead-in of half a second, two moves of a second, ten frames a second. */
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

const answer = (overrides: Partial<IdentityPresenceResponse> = {}): IdentityPresenceResponse => ({
  result: 'ok',
  guidance: [],
  guidedRetryAvailable: false,
  state: state({ step: 'done', result: 'ok', closed: true, outcome: 'ok' }),
  ...overrides,
});

function httpError(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

/**
 * The 409 `identity_already_closed` of `presence-challenge` as the server sends it: the bare problem (`ApiProblem`: type, title, status, detail, instance, `code` and `traceId`) and NO `state`. The document, the selfie, the
 * presence and the opening send the state with this code; the challenge does not (`IssuePresenceChallenge`, tested on the backend by `IssuePresenceChallenge_AClosedVerification_Is409IdentityAlreadyClosed_AndNothingIsIssued`).
 */
const closedChallengeBody = {
  type: 'https://tools.ietf.org/html/rfc9110#section-15.5.10',
  title: 'Conflict',
  status: 409,
  detail: 'The identity verification is already closed.',
  instance: `/api/public/checkin/${TOKEN}/presence-challenge`,
  code: 'identity_already_closed',
  traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
};

/** The context of the link as the page reads it again: only what the identity step reads of it. */
const linkSays = (identityVerification: IdentityVerificationState) => ({ identityVerification }) as unknown as PublicCheckInContextDto;

/** What the canvases were asked to encode, and what was drawn. */
let encoded: Array<{ width: number; height: number; type: string | undefined; quality: unknown }> = [];

const originalWidth = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoWidth');
const originalHeight = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoHeight');

/** A camera that works: a stream with one track that can be stopped. */
function stubCamera(rejectWith?: { name: string }) {
  const stop = vi.fn();
  const track = { stop, addEventListener: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = rejectWith ? vi.fn().mockRejectedValue(rejectWith) : vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  return { stop, getUserMedia };
}

/** Lets what is waiting (the answer of the camera, a promise of the send) settle, with the clock where it is. */
const settle = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

/** Moves the clock by `ms`, in the one hold React wants for what that sets in motion. */
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/** Moves the clock in small steps until the condition holds (the screen is awaited, never a window of time guessed in advance). */
async function advanceUntil(done: () => boolean, step = 100, limit = 200) {
  for (let spent = 0; spent < limit && !done(); spent += 1) await advance(step);
  expect(done()).toBe(true);
}

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const phase = () => screen.getByTestId('checkin-presence').getAttribute('data-phase');
const startButton = () => screen.getByTestId('checkin-presence-start') as HTMLButtonElement;
const prompt = () => screen.getByTestId('checkin-presence-prompt');
const canvas = () => screen.getByTestId('checkin-presence-canvas') as HTMLCanvasElement;

type CaptureProps = ComponentProps<typeof PresenceSequenceCapture>;

/** What was handed to the send, as it was at that moment: the screen lets the frames go once the answer is in, so a test reads them here and not from the arguments of the call. */
interface Sent {
  frames: Blob[];
  timestamps: number[];
  challengeToken: string;
  key: string;
}

/** A send that answers with each of the given results in turn (the last one for ever), and notes what it was given. */
function recordingSender(...results: Array<Awaited<ReturnType<CaptureProps['sendSequence']>>>) {
  const sent: Sent[] = [];
  const sendSequence = vi.fn<CaptureProps['sendSequence']>(async (sequence, key) => {
    sent.push({ frames: [...sequence.frames], timestamps: [...sequence.timestamps], challengeToken: sequence.challengeToken, key });
    return results[Math.min(sent.length - 1, results.length - 1)] ?? { kind: 'answered' };
  });
  return { sendSequence, sent };
}

function renderCapture(overrides: Partial<CaptureProps> = {}) {
  const startChallenge = vi.fn<CaptureProps['startChallenge']>().mockImplementation(async () => ({ kind: 'ready', challenge: challengeBody() }));
  const { sendSequence, sent } = recordingSender({ kind: 'answered' });
  const props: CaptureProps = { startChallenge, sendSequence, busy: false, ...overrides };
  const view = render(<PresenceSequenceCapture {...props} />);
  return { ...view, startChallenge, sendSequence, sent, update: (next: Partial<CaptureProps>) => view.rerender(<PresenceSequenceCapture {...props} {...next} />) };
}

/** The camera is open and the guest can start: the button of the start is there and awake. */
async function waitForTheStart() {
  await settle();
  await advanceUntil(() => screen.queryByTestId('checkin-presence-start') !== null && !startButton().disabled);
}

/** The guest starts and the prompts run to their end (the sequence is taken and handed to the send). */
async function recordTheWholeSequence(send: { mock: { calls: unknown[] } }) {
  await waitForTheStart();
  fireEvent.click(startButton());
  await settle();
  await advanceUntil(() => send.mock.calls.length > 0);
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  encoded = [];
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type, quality) {
    encoded.push({ width: this.width, height: this.height, type, quality });
    callback(new Blob([`frame-${encoded.length}`], { type }));
  });
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  if (originalWidth) Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', originalWidth);
  if (originalHeight) Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', originalHeight);
  localStorage.clear();
  sessionStorage.clear();
});

describe('presence-sequence-capture: the challenge, the camera and the preview (E72/F02/US01/T01, AC1)', () => {
  it('PresenceSequenceCapture_Opens_AsksForOneChallengeThenOpensTheFrontCameraWithTheSmallFramesOfTheBrief', async () => {
    const rig = stubCamera();
    const view = renderCapture();
    await waitForTheStart();

    expect(view.startChallenge).toHaveBeenCalledTimes(1);
    expect(rig.getUserMedia).toHaveBeenCalledTimes(1);
    expect(rig.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    expect(phase()).toBe('ready');
    expect(startButton()).toHaveTextContent(text('checkin.identity.presence.start'));
  });

  it('PresenceSequenceCapture_Preview_IsMirroredHasTheOvalForTheFaceAndNeverShowsTheHiddenCanvas', async () => {
    stubCamera();
    renderCapture();
    await waitForTheStart();

    expect(screen.getByTestId('checkin-presence-video').className).toContain('-scale-x-100');
    expect(screen.getByTestId('checkin-presence-oval')).toHaveAttribute('aria-hidden', 'true');
    expect(canvas().className).toContain('hidden');
    expect(canvas()).toHaveAttribute('aria-hidden', 'true');
  });

  it('PresenceSequenceCapture_StartButton_IsAtLeast44PixelsAndStaysDisabledWhileACallOfTheStepIsInFlight', async () => {
    stubCamera();
    const view = renderCapture();
    await waitForTheStart();
    expect(startButton().className).toContain('h-11');

    view.update({ busy: true });

    expect(startButton()).toBeDisabled();
  });

  it('PresenceSequenceCapture_TheChallengeIsNotYetThere_ShowsThatTheCheckIsBeingPreparedAndNoStart', async () => {
    stubCamera();
    let answerChallenge: (value: Awaited<ReturnType<CaptureProps['startChallenge']>>) => void = () => undefined;
    const startChallenge = vi.fn<CaptureProps['startChallenge']>().mockReturnValue(new Promise((resolve) => (answerChallenge = resolve)));
    renderCapture({ startChallenge });
    await settle();

    expect(phase()).toBe('preparing');
    expect(prompt()).toHaveTextContent(text('checkin.identity.presence.preparing'));
    expect(screen.queryByTestId('checkin-presence-start')).not.toBeInTheDocument();

    await act(async () => {
      answerChallenge({ kind: 'ready', challenge: challengeBody() });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(phase()).toBe('ready');
  });

  it('PresenceSequenceCapture_TheChallengeFails_SaysSoAndOffersToTryAgainWithAnotherChallenge', async () => {
    const rig = stubCamera();
    const startChallenge = vi.fn<CaptureProps['startChallenge']>().mockResolvedValueOnce({ kind: 'failed' }).mockResolvedValue({ kind: 'ready', challenge: challengeBody() });
    renderCapture({ startChallenge });
    await settle();

    expect(phase()).toBe('failed');
    // No camera was asked for before there was a challenge to follow.
    expect(rig.getUserMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('checkin-presence-retry'));
    await waitForTheStart();

    expect(startChallenge).toHaveBeenCalledTimes(2);
    expect(phase()).toBe('ready');
  });
});

describe('presence-sequence-capture: the prompts (AC2)', () => {
  it('PresenceSequenceCapture_Recording_FollowsTheOrderOfTheChallengeWithTheLeadInFirst', async () => {
    stubCamera();
    const view = renderCapture();
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();

    const announced: string[] = [];
    const arrows: string[] = [];
    for (let spent = 0; spent < 60 && phase() === 'recording'; spent += 1) {
      const said = prompt().textContent ?? '';
      if (said !== announced[announced.length - 1]) {
        announced.push(said);
        arrows.push(screen.getByTestId('checkin-presence-arrow').getAttribute('data-move') ?? '');
      }
      await advance(100);
    }

    // The moves of the challenge are the server's (`turn_left`, then `look_up`); the words are the ones the guest hears for them (see the mapping below).
    expect(announced).toEqual([text('checkin.identity.presence.leadIn'), text('checkin.identity.presence.move.turnToTheRight'), text('checkin.identity.presence.move.lookUp')]);
    expect(arrows).toEqual(['lead-in', 'turn_left', 'look_up']);
    await advanceUntil(() => view.sendSequence.mock.calls.length > 0);
  });

  it('PresenceSequenceCapture_Recording_ShowsACountdownOfWholeSecondsAndTheStepOfTheMove', async () => {
    stubCamera();
    renderCapture();
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();

    // The lead-in is half a second: one second shown, then the first move starts with its two seconds... of one second each.
    const countdown = () => screen.getByTestId('checkin-presence-countdown');
    expect(countdown()).toHaveTextContent('1');
    expect(countdown()).toHaveAttribute('role', 'timer');
    expect(countdown()).toHaveAttribute('aria-label', text('checkin.identity.presence.secondsLeft', { count: 1 }));
    expect(screen.queryByTestId('checkin-presence-step')).not.toBeInTheDocument();

    await advanceUntil(() => screen.queryByTestId('checkin-presence-step') !== null);
    expect(screen.getByTestId('checkin-presence-step')).toHaveTextContent(text('checkin.identity.presence.step', { current: 1, total: 2 }));
    await advanceUntil(() => screen.getByTestId('checkin-presence-step').textContent === text('checkin.identity.presence.step', { current: 2, total: 2 }));
  });

  it('PresenceSequenceCapture_ThePromptRegion_IsAnAssertiveLiveRegionThatIsThereBeforeItSaysAnything', async () => {
    stubCamera();
    renderCapture();

    // It exists from the first render, empty or with the state of the screen: a live region that appears with its text is not announced.
    expect(prompt()).toHaveAttribute('aria-live', 'assertive');
    expect(prompt()).toHaveAttribute('aria-atomic', 'true');
    await waitForTheStart();
    expect(prompt()).toHaveAttribute('aria-live', 'assertive');
    fireEvent.click(startButton());
    await settle();
    expect(prompt()).toHaveAttribute('aria-live', 'assertive');
    expect(prompt()).toHaveTextContent(text('checkin.identity.presence.leadIn'));
    // The countdown is not inside it: a number every second would be read out every second.
    expect(prompt()).not.toContainElement(screen.getByTestId('checkin-presence-countdown'));
  });

  it('PresenceSequenceCapture_Arrows_DoNotAnimateForAGuestWhoAsksForLessMotion', async () => {
    stubCamera();
    renderCapture();
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();

    const classes = screen.getByTestId('checkin-presence-arrow').getAttribute('class') ?? '';
    expect(classes).toContain('motion-safe:animate-pulse');
    expect(classes).not.toMatch(/(^|\s)animate-/);
    const wait = screen.queryByTestId('checkin-presence-wait');
    if (wait) expect(wait.innerHTML).not.toMatch(/(^|\s)animate-/);
  });
});

describe('presence-sequence-capture: the moves are asked the way the guest turns in a mirror (AC2)', () => {
  // The server names a move by the picture it receives, as the camera gives it (`turn_right`: the nose goes to the RIGHT of the frame); the frames are sent as the camera gives them, and the guest looks at a mirror:
  // what goes to the right of the frame is the guest's LEFT, and the left of the screen they look at. So the move the server calls `turn_right` is asked as «turn your head to the left», with an arrow that points left.
  it.each([
    ['turn_left', 'turnToTheRight', 'arrow-right'],
    ['turn_right', 'turnToTheLeft', 'arrow-left'],
    ['look_up', 'lookUp', 'arrow-up'],
    ['look_down', 'lookDown', 'arrow-down'],
  ] as const)('PresenceSequenceCapture_TheMoveOfTheServer_%s_IsAskedAs_%s_WithAnArrowThatPoints_%s', async (move, words, arrow) => {
    stubCamera();
    const startChallenge = vi.fn<CaptureProps['startChallenge']>().mockResolvedValue({ kind: 'ready', challenge: challengeBody({ steps: [move], leadInMs: 0 }) });
    renderCapture({ startChallenge });
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();

    expect(prompt()).toHaveTextContent(text(`checkin.identity.presence.move.${words}`));
    expect(screen.getByTestId('checkin-presence-arrow')).toHaveAttribute('data-move', move);
    expect(screen.getByTestId('checkin-presence-arrow').getAttribute('class')).toContain(`lucide-${arrow}`);
  });

  it('PresenceSequenceCapture_TheFramesThatAreSent_AreTheOnesOfTheCameraAndNeverFlippedLikeThePreview', async () => {
    stubCamera();
    const transforms: string[] = [];
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(
      () =>
        ({
          drawImage: vi.fn(),
          setTransform: () => transforms.push('setTransform'),
          transform: () => transforms.push('transform'),
          scale: () => transforms.push('scale'),
          translate: () => transforms.push('translate'),
          rotate: () => transforms.push('rotate'),
        }) as unknown as CanvasRenderingContext2D,
    );
    const view = renderCapture();
    await recordTheWholeSequence(view.sendSequence);

    // The preview is a mirror for the guest; the picture the server gets is the one of the camera.
    expect(screen.getByTestId('checkin-presence-video').className).toContain('-scale-x-100');
    expect(view.sent[0].frames.length).toBeGreaterThan(20);
    expect(transforms).toEqual([]);
  });
});

describe('presence-sequence-capture: the frames (AC3)', () => {
  it('PresenceSequenceCapture_TheWholeSequence_IsSentOnceWithJpegFramesTheTokenAndTimestampsThatStartAtZeroAndGrow', async () => {
    stubCamera();
    const view = renderCapture();
    await recordTheWholeSequence(view.sendSequence);

    expect(view.sendSequence).toHaveBeenCalledTimes(1);
    const sequence = view.sent[0];
    const { key } = sequence;
    expect(sequence.challengeToken).toBe('challenge-1');
    // 2.5 s at ten frames a second.
    expect(sequence.frames.length).toBeGreaterThanOrEqual(24);
    expect(sequence.frames.length).toBeLessThanOrEqual(27);
    expect(sequence.timestamps).toHaveLength(sequence.frames.length);
    expect(sequence.timestamps[0]).toBe(0);
    for (const stamp of sequence.timestamps) expect(Number.isInteger(stamp)).toBe(true);
    for (let index = 1; index < sequence.timestamps.length; index += 1) expect(sequence.timestamps[index]).toBeGreaterThan(sequence.timestamps[index - 1]);
    for (const frame of sequence.frames) expect(frame.type).toBe('image/jpeg');
    expect(key).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it('PresenceSequenceCapture_EachFrame_IsAJpegAt70PercentWithItsLongSideAtTheLimitOfTheChallenge', async () => {
    stubCamera();
    const view = renderCapture();
    await recordTheWholeSequence(view.sendSequence);

    expect(encoded.length).toBeGreaterThan(20);
    for (const call of encoded) expect(call).toEqual({ width: 320, height: 240, type: 'image/jpeg', quality: 0.7 });
  });

  it('PresenceSequenceCapture_TheChallengeHasAFrameCap_TheSequenceStopsAtTheCapAndIsSentAtOnce', async () => {
    stubCamera();
    const startChallenge = vi.fn<CaptureProps['startChallenge']>().mockResolvedValue({ kind: 'ready', challenge: challengeBody({ maxFrames: 5 }) });
    const view = renderCapture({ startChallenge });
    await waitForTheStart();
    const startedAt = Date.now();
    fireEvent.click(startButton());
    await settle();
    await advanceUntil(() => view.sendSequence.mock.calls.length > 0);

    const sequence = view.sent[0];
    expect(sequence.frames).toHaveLength(5);
    expect(sequence.timestamps).toEqual([0, 100, 200, 300, 400]);
    // Not at the end of the prompts (2.5 s): when the frames ran out.
    expect(Date.now() - startedAt).toBeLessThan(1_500);
  });

  it('PresenceSequenceCapture_TheCameraIsStoppedWhenThePromptsEnd_BeforeTheSequenceIsAnswered', async () => {
    const rig = stubCamera();
    const send = vi.fn<CaptureProps['sendSequence']>().mockReturnValue(new Promise(() => undefined));
    renderCapture({ sendSequence: send });
    await recordTheWholeSequence(send);

    expect(phase()).toBe('uploading');
    expect(rig.stop).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('checkin-presence-start')).not.toBeInTheDocument();
    expect(prompt()).toHaveTextContent(text('checkin.biometric.capture.sending'));
  });
});

describe('presence-sequence-capture: one key for each recording (AC4, AC5)', () => {
  it('PresenceSequenceCapture_ARecording_MakesItsKeyOnceAndSendsThatKey', async () => {
    stubCamera();
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce('11111111-1111-4111-8111-111111111111');
    const view = renderCapture();
    await recordTheWholeSequence(view.sendSequence);

    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(view.sendSequence.mock.calls[0][1]).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('PresenceSequenceCapture_ANewRecordingAfterAFailure_AsksForANewChallengeAndUsesANewKeyWithFreshFrames', async () => {
    stubCamera();
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    const { sendSequence, sent } = recordingSender({ kind: 'failed' }, { kind: 'answered' });
    const startChallenge = vi
      .fn<CaptureProps['startChallenge']>()
      .mockResolvedValueOnce({ kind: 'ready', challenge: challengeBody({ challengeToken: 'challenge-1' }) })
      .mockResolvedValueOnce({ kind: 'ready', challenge: challengeBody({ challengeToken: 'challenge-2' }) });
    renderCapture({ startChallenge, sendSequence });
    await recordTheWholeSequence(sendSequence);
    await settle();
    expect(phase()).toBe('failed');

    fireEvent.click(screen.getByTestId('checkin-presence-retry'));
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();
    await advanceUntil(() => sendSequence.mock.calls.length > 1);

    expect(startChallenge).toHaveBeenCalledTimes(2);
    expect(sent[0].key).toBe('11111111-1111-4111-8111-111111111111');
    expect(sent[1].key).toBe('22222222-2222-4222-8222-222222222222');
    expect(sent[1].challengeToken).toBe('challenge-2');
    // The frames of the first recording are gone and the second has its own.
    expect(sent[0].frames[0]).not.toBe(sent[1].frames[0]);
    expect(sent[1].frames.length).toBeGreaterThan(20);
  });

  it('PresenceSequenceCapture_TwoTapsOnTheStart_StartOneRecordingAndMakeOneKey', async () => {
    stubCamera();
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID');
    const view = renderCapture();
    await waitForTheStart();

    const start = startButton();
    act(() => {
      fireEvent.click(start);
      fireEvent.click(start);
    });
    await settle();
    await advanceUntil(() => view.sendSequence.mock.calls.length > 0);
    await advance(3_000);

    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(view.sendSequence).toHaveBeenCalledTimes(1);
  });
});

describe('presence-sequence-capture: frames only in memory and dropped after upload (privacy)', () => {
  it('PresenceSequenceCapture_AnAnsweredRecording_DropsEveryBlobEmptiesTheCanvasAndStopsTheTracks', async () => {
    const rig = stubCamera();
    const view = renderCapture();
    await recordTheWholeSequence(view.sendSequence);
    await settle();

    const [sequence] = view.sendSequence.mock.calls[0];
    // What was sent is let go: the arrays that held the frames are empty, and so is the canvas they were drawn on.
    expect(sequence.frames).toHaveLength(0);
    expect(sequence.timestamps).toHaveLength(0);
    expect(canvas().width).toBe(0);
    expect(canvas().height).toBe(0);
    expect(rig.stop).toHaveBeenCalled();
  });

  it('PresenceSequenceCapture_AFullRecording_WritesNothingToAnyStorageMakesNoAddressAndLogsNothing', async () => {
    stubCamera();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const createObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const consoleCalls = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'debug'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    const view = renderCapture();
    await recordTheWholeSequence(view.sendSequence);
    await settle();
    view.unmount();

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(anchorClick).not.toHaveBeenCalled();
    for (const call of consoleCalls) expect(call).not.toHaveBeenCalled();
    expect(window.location.href).not.toMatch(/base64|data:|blob:/);
    Reflect.deleteProperty(URL, 'createObjectURL');
  });

  it('PresenceSequenceCapture_TheScreenIsLeftWhileRecording_StopsTheTracksAndSendsNothing', async () => {
    const rig = stubCamera();
    const view = renderCapture();
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();
    await advance(700);
    const drawingCanvas = canvas();

    view.unmount();
    await advance(5_000);

    expect(rig.stop).toHaveBeenCalledTimes(1);
    expect(view.sendSequence).not.toHaveBeenCalled();
    expect(drawingCanvas.width).toBe(0);
  });

  it('PresenceSequenceCapture_TheScreenIsLeftWhileTheBrowserAsksForTheCamera_TheCameraThatComesLaterIsStoppedAtOnce', async () => {
    const rig = stubCamera();
    const stop = vi.fn();
    let grant: (stream: MediaStream) => void = () => undefined;
    rig.getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => (grant = resolve)));
    const view = renderCapture();
    await settle();
    view.unmount();

    await act(async () => {
      grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('presence-sequence-capture: the legacy selfie stays for the legacy path (AC1)', () => {
  const Harness = ({ initial }: { initial: IdentityVerificationState }) => {
    const identity = useIdentityVerification(TOKEN, initial);
    return <IdentityStep identity={identity} token={TOKEN} />;
  };

  function renderStep(initial: IdentityVerificationState) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <Harness initial={initial} />
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    vi.mocked(publicCheckinApi.startPresenceChallenge).mockImplementation(async () => challengeBody());
    vi.mocked(publicCheckinApi.postPresence).mockResolvedValue(answer());
    vi.mocked(publicCheckinApi.requestOperator).mockResolvedValue({
      result: 'operator',
      operatorPathOpen: true,
      state: state({ step: 'operator', result: 'operator', operatorRequested: true, closed: true, outcome: 'operator' }),
    });
  });

  it('IdentityStep_ThePresenceOfASelfHostedVerification_RendersTheNewCaptureNotTheSelfie', async () => {
    stubCamera();
    renderStep(state());
    await waitForTheStart();

    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'presence');
    expect(screen.getByTestId('checkin-presence')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-selfie-capture')).not.toBeInTheDocument();
    expect(screen.queryByTestId('selfie-take')).not.toBeInTheDocument();
    // The way to a person stays under the recording.
    expect(screen.getByTestId('checkin-identity-assisted-path')).toBeEnabled();
    expect(publicCheckinApi.startSelfieChallenge).not.toHaveBeenCalled();
  });

  it('IdentityStep_TheSelfieOfTheLegacyPath_IsTheScreenItAlwaysWasAndNoPresenceIsAsked', async () => {
    stubCamera();
    renderStep(state({ step: 'selfie', selfHosted: false, opened: false, noticeVersion: null, choice: null, formatId: null, guidedRetryAvailable: false }));
    await settle();

    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'selfie');
    expect(screen.getByTestId('checkin-selfie-capture')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-presence')).not.toBeInTheDocument();
    expect(publicCheckinApi.startPresenceChallenge).not.toHaveBeenCalled();
  });

  it('IdentityStep_AnOk_ShowsTheSuccessAndTheSequenceWentWithItsKeyAndNoSelfieRouteWasCalled', async () => {
    const rig = stubCamera();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce('33333333-3333-4333-8333-333333333333');
    renderStep(state());
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();
    await advanceUntil(() => vi.mocked(publicCheckinApi.postPresence).mock.calls.length > 0);
    await settle();

    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledWith(TOKEN);
    const [token, sequence, key] = vi.mocked(publicCheckinApi.postPresence).mock.calls[0];
    expect(token).toBe(TOKEN);
    expect(key).toBe('33333333-3333-4333-8333-333333333333');
    expect(sequence.challengeToken).toBe('challenge-1');
    expect(sequence.documentPhoto).toBeNull();
    expect(sequence.documentPhotoBack).toBeNull();
    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'done');
    expect(screen.getByTestId('identity-result-ok')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-presence')).not.toBeInTheDocument();
    expect(publicCheckinApi.postSelfie).not.toHaveBeenCalled();
    expect(publicCheckinApi.startSelfieChallenge).not.toHaveBeenCalled();
    expect(rig.stop).toHaveBeenCalled();
  });

  it('IdentityStep_ARetry_ShowsTheTranslatedGuidanceAndTryAgainStartsANewChallengeWithANewKey', async () => {
    stubCamera();
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    vi.mocked(publicCheckinApi.postPresence)
      .mockResolvedValueOnce(answer({ result: 'retry', guidance: [...PRESENCE_GUIDANCE_CODES], guidedRetryAvailable: true, state: state() }))
      .mockResolvedValue(answer());
    renderStep(state());
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();
    await advanceUntil(() => screen.queryByTestId('identity-result-retry') !== null);

    const reasons = screen.getByTestId('identity-retry-reasons');
    for (const code of PRESENCE_GUIDANCE_CODES) expect(reasons).toHaveTextContent(text(`checkin.identity.guidance.${code}`));
    // One guided retry decided by the server: the page counts no attempts.
    expect(screen.queryByTestId('identity-attempts-left')).not.toBeInTheDocument();
    expect(screen.getByTestId('identity-retake')).toHaveTextContent(text('checkin.identity.result.retry.againPresence'));
    expect(screen.queryByTestId('checkin-presence')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('identity-retake'));
    await waitForTheStart();
    expect(publicCheckinApi.startPresenceChallenge).toHaveBeenCalledTimes(2);
    fireEvent.click(startButton());
    await settle();
    await advanceUntil(() => vi.mocked(publicCheckinApi.postPresence).mock.calls.length > 1);

    expect(vi.mocked(publicCheckinApi.postPresence).mock.calls[0][2]).toBe('11111111-1111-4111-8111-111111111111');
    expect(vi.mocked(publicCheckinApi.postPresence).mock.calls[1][2]).toBe('22222222-2222-4222-8222-222222222222');
    expect(publicCheckinApi.postSelfie).not.toHaveBeenCalled();
  });

  it('IdentityStep_AnUnknownCodeInARetry_IsTheGenericSentenceOfThePresenceNotThePhotoOne', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence).mockResolvedValueOnce(answer({ result: 'retry', guidance: ['a_code_of_the_future'], state: state() }));
    renderStep(state());
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();
    await advanceUntil(() => screen.queryByTestId('identity-result-retry') !== null);

    expect(screen.getByTestId('identity-retry-reasons')).toHaveTextContent(text('checkin.identity.guidance.presence_again'));
    expect(screen.getByTestId('identity-retry-reasons')).not.toHaveTextContent(text('checkin.identity.guidance.other'));
  });

  it('IdentityStep_AnOperatorAnswer_ShowsTheAssistedMessageAndNeverASuccess', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postPresence).mockResolvedValueOnce(answer({ result: 'operator', state: state({ step: 'operator', operatorRequested: true }) }));
    renderStep(state());
    await waitForTheStart();
    fireEvent.click(startButton());
    await settle();
    await advanceUntil(() => screen.queryByTestId('identity-result-operator') !== null);

    expect(screen.getByTestId('identity-operator-text')).toHaveTextContent(text('checkin.identity.result.operator.text'));
    expect(screen.queryByTestId('identity-result-ok')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-presence')).not.toBeInTheDocument();
  });

  it('IdentityStep_TheChallengeCannotBeIssued_ShowsTheMessageOfTheAssistedPathAndNoCamera', async () => {
    const rig = stubCamera();
    vi.mocked(publicCheckinApi.startPresenceChallenge).mockRejectedValue(httpError(409, { code: 'presence_challenge_unavailable', state: state({ step: 'operator', operatorRequested: true }) }));
    renderStep(state());
    await settle();

    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'operator');
    expect(screen.getByTestId('identity-operator-text')).toHaveTextContent(text('checkin.identity.result.operator.text'));
    expect(screen.queryByTestId('checkin-presence')).not.toBeInTheDocument();
    expect(rig.getUserMedia).not.toHaveBeenCalled();
    expect(publicCheckinApi.postSelfie).not.toHaveBeenCalled();
  });

  // The 409 of the challenge is the real one: the bare problem, with no `state`. The page reads the state of the link and shows what it says, and deduces nothing from the 409.
  it('IdentityStep_TheVerificationPassedInAnotherTabWhileAskingForTheChallenge_TheLinkSaysSoAndItIsShownDone', async () => {
    const rig = stubCamera();
    vi.mocked(publicCheckinApi.startPresenceChallenge).mockRejectedValue(httpError(409, closedChallengeBody));
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(linkSays(state({ step: 'done', result: 'ok', closed: true, outcome: 'ok' })));
    renderStep(state());
    await settle();

    expect(publicCheckinApi.getContext).toHaveBeenCalledTimes(1);
    expect(publicCheckinApi.getContext).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'done');
    expect(screen.getByTestId('identity-result-ok')).toBeInTheDocument();
    expect(screen.getByTestId('identity-closed-note')).toHaveTextContent(text('checkin.identity.result.closed'));
    expect(screen.queryByTestId('identity-result-operator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-identity-problem')).not.toBeInTheDocument();
    expect(rig.getUserMedia).not.toHaveBeenCalled();
    // Nobody is asked for a person on a guess.
    expect(publicCheckinApi.requestOperator).not.toHaveBeenCalled();
  });

  it('IdentityStep_TheVerificationEndedWithAPersonInAnotherTabWhileAskingForTheChallenge_TheLinkSaysSoAndItIsShownWithAPerson', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.startPresenceChallenge).mockRejectedValue(httpError(409, closedChallengeBody));
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(linkSays(state({ step: 'operator', result: 'operator', operatorRequested: true, closed: true, outcome: 'operator' })));
    renderStep(state());
    await settle();

    expect(publicCheckinApi.getContext).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'operator');
    expect(screen.getByTestId('identity-result-operator')).toBeInTheDocument();
    expect(screen.getByTestId('identity-closed-note')).toBeInTheDocument();
    expect(screen.queryByTestId('identity-result-ok')).not.toBeInTheDocument();
    expect(publicCheckinApi.requestOperator).not.toHaveBeenCalled();
  });

  it.each([
    ['the link cannot be read', () => vi.mocked(publicCheckinApi.getContext).mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK', isAxiosError: true })), 'network'],
    ['the link does not say it is closed', () => vi.mocked(publicCheckinApi.getContext).mockResolvedValue(linkSays(state())), 'failed'],
    ['the link carries no state', () => vi.mocked(publicCheckinApi.getContext).mockResolvedValue({} as unknown as PublicCheckInContextDto), 'failed'],
  ])('IdentityStep_TheChallengeIsRefusedAsClosedAnd_%s_ShowsNoOutcomeAndTheGuestTriesAgain', async (_name, arrange, problem) => {
    stubCamera();
    vi.mocked(publicCheckinApi.startPresenceChallenge).mockRejectedValue(httpError(409, closedChallengeBody));
    arrange();
    renderStep(state());
    await settle();

    // Neither a pass nor a person is deduced: the guest is told that it did not work and can try again, or ask for a person.
    expect(phase()).toBe('failed');
    expect(screen.getByTestId('checkin-identity-problem')).toHaveTextContent(text(`checkin.identity.problem.${problem}`));
    expect(screen.queryByTestId('identity-result-ok')).not.toBeInTheDocument();
    expect(screen.queryByTestId('identity-result-operator')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-presence-retry')).toBeEnabled();
    expect(screen.getByTestId('checkin-identity-assisted-path')).toBeEnabled();
    expect(publicCheckinApi.requestOperator).not.toHaveBeenCalled();
  });

  it('IdentityStep_TheChallengeFailsOnTheNetwork_SaysSoUnderTheStepAndKeepsTheWayToAPerson', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.startPresenceChallenge).mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK', isAxiosError: true }));
    renderStep(state());
    await settle();

    expect(screen.getByTestId('checkin-identity-problem')).toHaveTextContent(text('checkin.identity.problem.network'));
    expect(phase()).toBe('failed');
    expect(screen.getByTestId('checkin-identity-assisted-path')).toBeEnabled();
  });

  it('IdentityStep_ABodyThatIsNotAChallenge_IsAFailureAndNeverOpensTheCamera', async () => {
    const rig = stubCamera();
    vi.mocked(publicCheckinApi.startPresenceChallenge).mockResolvedValue({ challengeToken: '', steps: ['turn_left'] } as unknown as PresenceChallenge);
    renderStep(state());
    await settle();

    expect(phase()).toBe('failed');
    expect(rig.getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByTestId('checkin-identity-problem')).toHaveTextContent(text('checkin.identity.problem.failed'));
  });

  it('useIdentityVerification_TicinoKeepsNoDocument_ThePicturesComeAgainWithTheSequenceAndAreLetGoWhenItEnds', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue({ success: true, acceptable: true, guidanceCodes: [], documentStored: false, documentNotArchived: true, side: 'single', sides: ['single'] });
    const { result } = renderHook(() => useIdentityVerification(TOKEN, state({ step: 'document', documentNotArchived: true })), { wrapper });
    const photo = new File(['document'], 'document.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.sendDocument(photo);
    });
    // A self-hosted verification goes from the document to the presence.
    expect(result.current.progress?.stage).toBe('presence');

    const sequence = { frames: [new Blob(['frame'], { type: 'image/jpeg' })], timestamps: [0], challengeToken: 'challenge-1' };
    await act(async () => {
      await result.current.sendPresence(sequence, 'key-ticino-1');
    });

    const [, sent, key] = vi.mocked(publicCheckinApi.postPresence).mock.calls[0];
    expect(key).toBe('key-ticino-1');
    expect(sent.documentPhoto).toBeInstanceOf(Blob);
    expect(sent.documentPhotoBack).toBeNull();
    expect(result.current.progress?.stage).toBe('done');
  });
});

describe('the presence in the model of the identity step (E72/F02/US01/T01)', () => {
  it('readPresenceChallenge_ABodyOfTheContract_IsReadAsItIs', () => {
    const body = challengeBody();

    expect(readPresenceChallenge(body)).toEqual(body);
  });

  it.each([
    ['not an object', 'text'],
    ['no token', { ...challengeBody(), challengeToken: '' }],
    ['no moves', { ...challengeBody(), steps: [] }],
    ['a move the page has no words for', { ...challengeBody(), steps: ['turn_left', 'blink'] }],
    ['a step of no time', { ...challengeBody(), stepMs: 0 }],
    ['a lead-in below zero', { ...challengeBody(), leadInMs: -1 }],
    ['a rate that is not a number', { ...challengeBody(), targetFps: '10' }],
    ['no frames allowed', { ...challengeBody(), maxFrames: 0 }],
    ['a size that is not whole', { ...challengeBody(), maxFrameSide: 320.5 }],
    ['an expiry that is not a date', { ...challengeBody(), expiresAt: 'tomorrow' }],
  ])('readPresenceChallenge_%s_IsNotAChallengeThePageCanFollow', (_name, body) => {
    expect(readPresenceChallenge(body)).toBeNull();
  });

  it('readPresenceChallenge_ALeadInOfZero_IsAChallengeThatStartsOnTheFirstMove', () => {
    expect(readPresenceChallenge({ ...challengeBody(), leadInMs: 0 })).not.toBeNull();
  });

  it('readPresenceAnswer_TheContract_IsReadAndAnythingElseIsNotAnAnswer', () => {
    expect(readPresenceAnswer(answer({ result: 'retry', guidance: ['presence_timing'], guidedRetryAvailable: true }))).toMatchObject({
      result: 'retry',
      guidance: ['presence_timing'],
      guidedRetryAvailable: true,
      lockCode: null,
    });
    expect(readPresenceAnswer({ result: 'approved' })).toBeNull();
    expect(readPresenceAnswer('<html></html>')).toBeNull();
    expect(readPresenceAnswer(null)).toBeNull();
    // The older name of the codes is read too, and only texts are codes.
    expect(readPresenceAnswer({ result: 'retry', guidanceCodes: ['presence_quality', 4, ''] })?.guidance).toEqual(['presence_quality']);
  });

  it('afterPresence_Ok_IsAPassWithTheLockCodeOnlyWhenTheServerSendsOne', () => {
    const progress = progressFromState(state());
    const passed = afterPresence(progress, readPresenceAnswer({ result: 'ok', lockCode: ' 4821 ' })!);

    expect(passed).toMatchObject({ stage: 'done', lockCode: '4821', lockCodeHeld: null });
    expect(afterPresence(progress, readPresenceAnswer({ result: 'ok' })!)).toMatchObject({ stage: 'done', lockCode: null });
    expect(afterPresence(progress, readPresenceAnswer({ result: 'ok', lockCodeHeld: 'tourist_tax_due' })!)).toMatchObject({ lockCode: null, lockCodeHeld: 'tourist_tax_due' });
  });

  it('afterPresence_RetryAndOperator_AreWhatTheServerSaidAndNeverAPass', () => {
    const progress = progressFromState(state());

    expect(afterPresence(progress, readPresenceAnswer({ result: 'retry', guidance: ['presence_too_short'] })!)).toMatchObject({
      stage: 'retry',
      guidanceCodes: ['presence_too_short'],
      lockCode: null,
    });
    expect(afterPresence(progress, readPresenceAnswer({ result: 'operator' })!)).toMatchObject({ stage: 'operator', operatorRequested: true, lockCode: null });
  });

  it('afterDocument_ASelfHostedVerification_GoesToThePresenceAndTheLegacyPathToTheSelfie', () => {
    const accepted = { success: true, acceptable: true, guidanceCodes: [], documentStored: true, documentNotArchived: false };

    expect(afterDocument(progressFromState(state({ step: 'document' })), accepted).stage).toBe('presence');
    expect(afterDocument(progressFromState(state({ step: 'document', selfHosted: false })), accepted).stage).toBe('selfie');
  });

  it('retakeTargetOf_ASelfHostedRetry_IsTheRecordingAndADocumentCodeStillSendsTheGuestBackToTheDocument', () => {
    expect(retakeTargetOf([], true)).toBe('presence');
    expect(retakeTargetOf(['presence_quality'])).toBe('presence');
    expect(retakeTargetOf(['document_portrait_missing'], true)).toBe('document');
    expect(retakeTargetOf(['more_light'])).toBe('selfie');
    expect(afterRetake({ ...progressFromState(state()), stage: 'retry', guidanceCodes: ['presence_timing'] }).stage).toBe('presence');
  });

  it('closedAnswerOf_TheBareProblemOfTheChallenge_IsAClosedVerificationWithNoStateAndNeverAPerson', () => {
    expect(closedAnswerOf(httpError(409, closedChallengeBody))).toEqual({ state: null });
    expect(closedAnswerOf(httpError(409, { ...closedChallengeBody, state: state({ step: 'done', result: 'ok', closed: true, outcome: 'ok' }) }))).toMatchObject({ state: { closed: true, outcome: 'ok' } });
    // A state that does not say the verification is closed is no state of a closed one: the caller reads the link.
    expect(closedAnswerOf(httpError(409, { ...closedChallengeBody, state: state() }))).toEqual({ state: null });
    expect(closedAnswerOf(httpError(409, { code: 'presence_challenge_unavailable' }))).toBeNull();
    expect(closedAnswerOf(httpError(422, closedChallengeBody))).toBeNull();
    expect(closedAnswerOf(new Error('closed'))).toBeNull();
  });

  it.each([
    [409, 'presence_challenge_unavailable', 'presence_unavailable'],
    [409, 'presence_challenge_expired', 'presence_expired'],
    [409, 'presence_challenge_required', 'presence_expired'],
    [422, 'presence_sequence_invalid', 'presence_invalid'],
    [413, 'presence_sequence_too_large', 'presence_too_large'],
    [409, 'presence_sequence_required', 'presence_required'],
    [413, undefined, 'too_large'],
  ] as const)('classifyIdentityError_%i_%s_Is_%s', (status, code, expected) => {
    expect(classifyIdentityError(httpError(status, code ? { code } : undefined))).toBe(expected);
  });
});

describe('the words of the presence in the five languages of the page', () => {
  const catalogues = [
    ['it', APP_RESOURCES.it.translation],
    ['en', APP_RESOURCES.en.translation],
    ['de', guestDe],
    ['fr', guestFr],
    ['es', guestEs],
  ] as const;

  function lookup(tree: unknown, key: string): unknown {
    return key.split('.').reduce<unknown>((node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tree);
  }

  /** The keys of the page that the presence screens write out in their sources: every one is a text in every language, and none is a `defaultValue`. */
  const sources = import.meta.glob<string>(['../components/presence-sequence-capture.tsx', '../identity-result.tsx', '../lib/identity-model.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  const writtenOut = [
    ...new Set(
      Object.values(sources)
        .flatMap((source) => [...source.matchAll(/'(checkin\.[A-Za-z0-9_.]+)'/g)].map((match) => match[1]))
        .filter((key) => /presence|biometric\.capture|result\.retry/.test(key)),
    ),
  ];

  it('theKeysTheScreensWriteOut_AreFoundInTheSources', () => {
    expect(writtenOut.length).toBeGreaterThan(12);
    expect(writtenOut).toContain('checkin.identity.presence.title');
    expect(writtenOut).toContain('checkin.identity.presence.move.turnToTheLeft');
    expect(writtenOut).toContain('checkin.identity.result.retry.againPresence');
  });

  it.each(catalogues)('everyKeyOfThePresenceScreens_IsATextInTheCatalogueOf_%s', (_language, catalogue) => {
    const keys = [
      ...writtenOut,
      ...PRESENCE_GUIDANCE_CODES.map((code) => presenceGuidanceKey(code)),
      presenceGuidanceKey('a_code_of_the_future'),
      ...IDENTITY_PROBLEMS.filter((problem) => problem.startsWith('presence_')).map((problem) => problemKey(problem)),
    ];

    expect(keys.filter((key) => typeof lookup(catalogue, key) !== 'string' || String(lookup(catalogue, key)).trim() === '')).toEqual([]);
  });

  it.each(catalogues.slice(2))('thePresenceTexts_OfTheGuestLanguage_%s_KeepThePlaceholdersOfEnglish', (_language, catalogue) => {
    const placeholders = (value: unknown) => [...String(value).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort().join();
    const keys = ['checkin.identity.presence.secondsLeft', 'checkin.identity.presence.step'];

    for (const key of keys) expect(placeholders(lookup(catalogue, key))).toBe(placeholders(lookup(APP_RESOURCES.en.translation, key)));
  });
});

describe('presence-sequence-capture: accessibility', () => {
  // axe-core waits on timers of its own: these tests run on the real clock, and wait for the screen, not for a window of time.
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('PresenceSequenceCapture_ReadyToStart_HasNoAccessibilityViolations', async () => {
    stubCamera();
    const { container } = renderCapture();
    await waitFor(() => expect(phase()).toBe('ready'));

    await expectNoAxeViolations(container);
  });

  it('PresenceSequenceCapture_WhileRecording_HasNoAccessibilityViolations', async () => {
    stubCamera();
    const { container } = renderCapture();
    await waitFor(() => expect(phase()).toBe('ready'));
    fireEvent.click(startButton());
    await waitFor(() => expect(phase()).toBe('recording'));

    await expectNoAxeViolations(container);
  });
});
