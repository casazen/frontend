import { useCallback, useEffect, useId, useReducer, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2, RefreshCw, ScanFace, Video, WifiOff, type LucideIcon } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { PresenceChallenge, PresenceMove, PresenceSequence } from '@/types/public-checkin.types';
import {
  createSequenceRecorder,
  phaseAt,
  releaseSequence,
  secondsLeft,
  totalDurationMs,
  type PromptPhase,
  type PromptPlan,
  type SequenceRecorder,
} from '../lib/frame-sequence';
import { problemKey, type IdentityProblem } from '../lib/identity-model';
import { newIdempotencyKey } from '../lib/presence-upload';
import type { PresenceChallengeResult, PresenceSendResult } from '../use-identity-verification';

interface PresenceSequenceCaptureProps {
  /** Asks for a challenge (the hook of the step). `isCurrent` says whether this screen is still the one that wants the answer. */
  startChallenge: (isCurrent?: () => boolean) => Promise<PresenceChallengeResult>;
  /** Sends the sequence with the key of its recording (the hook of the step). It repeats a request that did not get through, with the same frames and the same key. */
  sendSequence: (sequence: PresenceSequence, idempotencyKey: string) => Promise<PresenceSendResult>;
  /** A call of the step is in flight (this one or another): the buttons stay disabled. */
  busy: boolean;
}

/** What the camera is asked for (ADR-013-R11): the front camera, small frames, no sound. */
const CAMERA_CONSTRAINTS: MediaStreamConstraints = { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false };

/** How often the prompts are looked at (ten times a second: a countdown that changes by the second, and a move that changes on time). */
const TICK_MS = 100;

/** Why the camera is not there: the browser blocked it, there is none, another app has it, this page cannot use one (no secure connection, an old browser), or anything else. */
type CameraProblem = 'denied' | 'not_found' | 'busy' | 'unsupported' | 'unknown';

const CAMERA_TEXT: Record<CameraProblem, string> = {
  denied: 'checkin.biometric.capture.cameraDenied',
  not_found: 'checkin.biometric.capture.cameraNotFound',
  busy: 'checkin.identity.presence.camera.busy',
  unsupported: 'checkin.biometric.capture.cameraUnsupported',
  unknown: 'checkin.biometric.capture.cameraUnknown',
};

/** The words and the drawing of each move of the challenge. The arrow points where the guest's face goes on the mirrored preview: the way they turn is the way it shows. */
const MOVES: Record<PresenceMove, { text: string; Icon: LucideIcon }> = {
  turn_left: { text: 'checkin.identity.presence.move.turn_left', Icon: ArrowLeft },
  turn_right: { text: 'checkin.identity.presence.move.turn_right', Icon: ArrowRight },
  look_up: { text: 'checkin.identity.presence.move.look_up', Icon: ArrowUp },
  look_down: { text: 'checkin.identity.presence.move.look_down', Icon: ArrowDown },
};

function cameraProblemOf(error: unknown): CameraProblem {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'not_found';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy';
  return 'unknown';
}

/** The browser can open a camera at all (it cannot on a page without a secure connection). */
function canOpenCamera(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

/** The screen is wider than it is high (a phone held sideways, a desktop): turning the phone, or a window that changes shape, flips it. */
function isLandscape(): boolean {
  return window.innerWidth >= window.innerHeight;
}

/** Calls `onEnd` when a track of the stream ends by itself (the camera was taken by another app, or unplugged). A track that is stopped by the page does not call it. */
function watchForTheEnd(stream: MediaStream, onEnd: () => void) {
  for (const track of stream.getTracks()) {
    if (typeof track.addEventListener === 'function') track.addEventListener('ended', onEnd);
  }
}

function subscribeToTheConnection(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Whether the browser says it is online: the upload waits for it when it is not. */
function useIsOnline(): boolean {
  return useSyncExternalStore(
    subscribeToTheConnection,
    () => navigator.onLine !== false,
    () => true,
  );
}

/**
 * Where the screen is: asking for the challenge and opening the camera, ready for the guest to start, renewing the challenge that ran out before the start, following the prompts, sending, holding the recording
 * that did not get through for one manual retry, without a camera, or a recording that was refused.
 */
type Phase = 'preparing' | 'ready' | 'starting' | 'recording' | 'uploading' | 'kept' | 'camera-problem' | 'failed';

/** The sentence of a recording that is kept: no connection, or a service that does not answer; any other reason (too many requests) has its own sentence among the problems of the step. */
const KEPT_TEXT: Partial<Record<IdentityProblem, string>> = {
  network: 'checkin.identity.presence.kept.offline',
  processing: 'checkin.identity.presence.kept.server',
};

/** A line above the camera that says what happened to the recording before. */
type Notice = 'not_prepared' | 'expired' | 'hidden' | 'rotated' | 'lost';

const NOTICE_TEXT: Record<Notice, string> = {
  not_prepared: 'checkin.identity.presence.notice.not_prepared',
  expired: 'checkin.identity.presence.notice.expired',
  hidden: 'checkin.identity.presence.notice.hidden',
  rotated: 'checkin.identity.presence.notice.rotated',
  lost: 'checkin.identity.presence.notice.lost',
};

/** What the guest is asked now: the lead-in or a move (with its place in the challenge), and the seconds left of it. */
interface PromptView {
  kind: 'lead-in' | 'step';
  index: number;
  total: number;
  move: PresenceMove | null;
  seconds: number;
}

interface CaptureState {
  phase: Phase;
  problem: CameraProblem | null;
  /** Why the recording that did not get through is kept: the network, or too many requests. */
  kept: IdentityProblem | null;
  notice: Notice | null;
  prompt: PromptView | null;
  /** The size of the pictures of the camera, to give the view their shape (a phone upright gives upright pictures). */
  frame: { width: number; height: number } | null;
}

type CaptureAction =
  | { type: 'preparing'; notice?: Notice | null }
  | { type: 'ready' }
  | { type: 'starting' }
  | { type: 'recording'; prompt: PromptView | null }
  | { type: 'prompt'; prompt: PromptView | null }
  | { type: 'uploading' }
  | { type: 'kept'; problem: IdentityProblem }
  | { type: 'camera-problem'; problem: CameraProblem }
  | { type: 'failed' }
  | { type: 'frame'; width: number; height: number };

const FIRST_STATE: CaptureState = { phase: 'preparing', problem: null, kept: null, notice: null, prompt: null, frame: null };

function reduce(state: CaptureState, action: CaptureAction): CaptureState {
  switch (action.type) {
    case 'preparing':
      return { ...state, phase: 'preparing', problem: null, kept: null, notice: action.notice ?? null, prompt: null };
    case 'ready':
      return { ...state, phase: 'ready', problem: null, kept: null, prompt: null };
    case 'starting':
      return { ...state, phase: 'starting' };
    case 'recording':
      return { ...state, phase: 'recording', problem: null, kept: null, notice: null, prompt: action.prompt };
    case 'prompt': {
      const { prompt } = state;
      const next = action.prompt;
      // The countdown is looked at ten times a second and changes once: the screen is drawn again only when what it shows is different.
      if (prompt === next || (prompt && next && prompt.kind === next.kind && prompt.index === next.index && prompt.seconds === next.seconds)) return state;
      return { ...state, prompt: next };
    }
    case 'uploading':
      return { ...state, phase: 'uploading', prompt: null };
    case 'kept':
      return { ...state, phase: 'kept', kept: action.problem, prompt: null };
    case 'camera-problem':
      return { ...state, phase: 'camera-problem', problem: action.problem, prompt: null };
    case 'failed':
      return { ...state, phase: 'failed', prompt: null };
    case 'frame':
      if (action.width <= 0 || action.height <= 0 || (state.frame?.width === action.width && state.frame.height === action.height)) return state;
      return { ...state, frame: { width: action.width, height: action.height } };
  }
}

/** The recording as it is made: the plan of the prompts, the token of the challenge it answers and its key. */
interface Recording {
  plan: PromptPlan & { steps: PresenceMove[] };
  challengeToken: string;
  key: string;
}

/** The recording that is held after it was taken: what is sent, its key, and how many times the guest may still send it by hand (once). */
interface Attempt {
  key: string;
  sequence: PresenceSequence;
  manualRetriesLeft: number;
}

/** What interrupts the screen: the phone turned (or the window changed its shape) while recording, the page went to the background, or the camera was taken away. */
type Interruption = 'rotated' | 'hidden' | 'camera';

/** What the guest sees of a place in the prompts, or `null` once they are over. */
function promptOf(phase: PromptPhase, plan: Recording['plan']): PromptView | null {
  if (phase.kind === 'lead-in') return { kind: 'lead-in', index: 0, total: plan.steps.length, move: null, seconds: secondsLeft(phase.remainingMs) };
  if (phase.kind === 'step') return { kind: 'step', index: phase.index, total: plan.steps.length, move: plan.steps[phase.index], seconds: secondsLeft(phase.remainingMs) };
  return null;
}

/** The plan of the prompts of a challenge. */
function planOf(challenge: PresenceChallenge): Recording['plan'] {
  return { leadInMs: challenge.leadInMs, stepMs: challenge.stepMs, steps: challenge.steps };
}

/** The challenge is still good when the prompts will have ended: one that runs out before the start, or in the middle of the recording, is asked for again. */
function outlivesTheRecording(challenge: PresenceChallenge): boolean {
  return Date.parse(challenge.expiresAt) > Date.now() + totalDurationMs(planOf(challenge));
}

/**
 * The presence of a self-hosted verification (E72/F02/US01/T01 and T02, NF-192, NF-198, D6, D13): it takes the place of the two selfies. The guest sees the camera, mirrored, with an oval for the face, and follows the
 * prompts of a challenge the server issued: a lead-in to look at the camera, then each move (`turn_left`, `turn_right`, `look_up`, `look_down`) for `stepMs`, with large words, an arrow and a countdown, announced to a
 * screen reader (`aria-live="assertive"`) and without any animation for a guest who asks for less motion. While the prompts run the browser takes a frame at `targetFps` (at most `maxFrames`, each at most
 * `maxFrameSide` px), times it and, at the end, sends the whole sequence once, with a key made for this recording.
 *
 * The frames are in memory only: never in a storage, an address, a log or a file. They are let go as soon as the API has answered, with the canvas, and every track of the camera is stopped when the prompts end, on a
 * failure, on an answer and when this screen goes. The guest never needs to decide anything the server decides: the answer (`ok`, `retry` with its guidance, `operator`) moves the step on by itself.
 *
 * It survives what a phone does to a guest (T02): no camera (denied, missing, busy, not supported) says why and the way to a person is the button the step keeps under it; a phone that is turned or a page that goes to the
 * background while recording throws the frames away, says why, and starts again with a new challenge; a challenge that runs out before the start is renewed without a word, and one that the server says ran out (409) starts a new
 * recording with a new key; a connection that drops is waited for and the same frames go again with the same key (the hook repeats the request), and when that is not enough the recording is kept in memory for ONE manual
 * retry with the same key and then let go; a second tap while something is on its way does nothing.
 */
export function PresenceSequenceCapture({ startChallenge, sendSequence, busy }: PresenceSequenceCaptureProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const online = useIsOnline();
  const [state, dispatch] = useReducer(reduce, FIRST_STATE);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const challengeRef = useRef<PresenceChallenge | null>(null);
  const recorderRef = useRef<SequenceRecorder | null>(null);
  const recordingRef = useRef<Recording | null>(null);
  const attemptRef = useRef<Attempt | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const landscapeAtStartRef = useRef(true);
  const startingRef = useRef(false);
  const uploadingRef = useRef(false);
  /** The page went to the background and the camera was let go: it is opened again when the page is back. */
  const hiddenRef = useRef(false);
  const phaseRef = useRef<Phase>('preparing');
  const mounted = useRef(false);
  /** Counts the starts of the screen: an answer that comes for an older start is not for this one. */
  const epoch = useRef(0);
  // What the callbacks that live across renders read of the props and of the state: the latest ones.
  const latest = useRef({ startChallenge, sendSequence });
  useEffect(() => {
    latest.current = { startChallenge, sendSequence };
    phaseRef.current = state.phase;
  });

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  /** Lets the frames of the recording go (the arrays are emptied in place), whether they were sent or not. */
  const letGoOfTheAttempt = useCallback(() => {
    const attempt = attemptRef.current;
    attemptRef.current = null;
    if (attempt) releaseSequence(attempt.sequence);
  }, []);

  /** Stops the recording that is on its way and lets its frames go. */
  const discardRecording = useCallback(() => {
    clearTimer();
    recorderRef.current?.discard();
    recorderRef.current = null;
    recordingRef.current = null;
  }, [clearTimer]);

  /**
   * What the phone does to the screen while it works: a recording is thrown away, with its frames, and the guest is told why. Resolves true when the screen must start again with a new challenge (the phone was turned
   * while recording: the camera is still there), and false when it is done (the camera was let go and a page that comes back opens it again, or the camera ended by itself and the guest is told so).
   */
  const interrupt = useCallback(
    (reason: Interruption): boolean => {
      const current = phaseRef.current;
      // The frames are on their way to the server, or kept for the guest to send again: the camera is off and there is nothing to spoil.
      if (uploadingRef.current || attemptRef.current) return false;
      const recording = recorderRef.current !== null;

      if (reason === 'rotated') {
        // Turning the phone only matters to a recording: frames of two shapes are not one sequence.
        if (!recording) return false;
        discardRecording();
        dispatch({ type: 'preparing', notice: 'rotated' });
        return true;
      }

      if (reason === 'hidden') {
        // A page in the background keeps no camera on: it is let go, and opened again when the page is back. A recording that was on its way is thrown away, and the guest is told.
        if (!recording && current !== 'preparing' && current !== 'starting' && current !== 'ready') return false;
        epoch.current += 1;
        discardRecording();
        stopCamera();
        hiddenRef.current = true;
        dispatch({ type: 'preparing', notice: recording ? 'hidden' : null });
        return false;
      }

      // The camera ended by itself.
      if (!recording && !streamRef.current) return false;
      epoch.current += 1;
      discardRecording();
      stopCamera();
      dispatch({ type: 'camera-problem', problem: 'unknown' });
      return false;
    },
    [discardRecording, stopCamera],
  );

  /** Opens the camera of the front. `isCurrent` says whether the screen is still the one that asked (it may have been left while the browser asked the guest). */
  const openCamera = useCallback(
    async (isCurrent: () => boolean): Promise<'ok' | 'stale' | CameraProblem> => {
      if (!canOpenCamera()) return 'unsupported';
      try {
        const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
        if (!isCurrent() || document.hidden) {
          // Left, or sent to the background, while the browser asked: nothing keeps the camera, and a page that comes back opens it again.
          stream.getTracks().forEach((track) => track.stop());
          if (isCurrent()) hiddenRef.current = true;
          return 'stale';
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        watchForTheEnd(stream, () => {
          if (streamRef.current === stream) interrupt('camera');
        });
        return 'ok';
      } catch (error) {
        return cameraProblemOf(error);
      }
    },
    [interrupt],
  );

  /**
   * Gets the screen ready to record: a challenge from the server (unless `reuseChallenge` and the screen already has one) and the camera (unless it is open). A challenge that cannot be issued moves the step to the
   * assisted path by itself (the hook does it); a failure to get one, or a camera that is not there, says so.
   */
  const prepare = useCallback(
    async (reuseChallenge = false) => {
      epoch.current += 1;
      const mine = epoch.current;
      const isCurrent = () => mounted.current && epoch.current === mine;

      if (!(reuseChallenge && challengeRef.current)) {
        const asked = await latest.current.startChallenge(isCurrent);
        if (!isCurrent() || asked.kind === 'stale' || asked.kind === 'moved') return;
        if (asked.kind === 'failed') {
          dispatch({ type: 'failed' });
          return;
        }
        challengeRef.current = asked.challenge;
      }

      if (!streamRef.current) {
        const opened = await openCamera(isCurrent);
        if (!isCurrent() || opened === 'stale') return;
        if (opened !== 'ok') {
          dispatch({ type: 'camera-problem', problem: opened });
          return;
        }
      }
      dispatch({ type: 'ready' });
    },
    [openCamera],
  );

  /**
   * Sends the recording that is held. `manual` is the guest sending it again by hand: that is allowed once. The hook repeats a request that did not get through (with the same frames and the same key) before it says so;
   * when it still did not, the recording is kept for that one manual retry and then let go. An answer moves the step on and this screen goes with it; a challenge that ran out, or a retry that failed, starts again
   * with a new challenge (and so a new key); a refusal leaves the guest to record again.
   */
  const upload = useCallback(
    async (manual = false) => {
      const attempt = attemptRef.current;
      if (!attempt || uploadingRef.current) return;
      uploadingRef.current = true;
      if (manual) attempt.manualRetriesLeft -= 1;
      dispatch({ type: 'uploading' });
      try {
        // The hook never rejects; a defect that did would leave the guest on a screen that waits for ever, so it is a call that failed.
        const result = await latest.current.sendSequence(attempt.sequence, attempt.key).catch((): PresenceSendResult => ({ kind: 'failed' }));
        if (!mounted.current) return;
        if (result.kind === 'answered') {
          letGoOfTheAttempt();
          return;
        }
        if (result.kind === 'busy') {
          // Another call of the step was in flight and nothing was sent: the recording is still held, and the retry that was spent is given back.
          if (manual) attempt.manualRetriesLeft += 1;
          dispatch({ type: 'kept', problem: 'network' });
          return;
        }
        if (result.kind === 'kept' && attempt.manualRetriesLeft > 0) {
          dispatch({ type: 'kept', problem: result.problem });
          return;
        }

        letGoOfTheAttempt();
        if (result.kind === 'failed') {
          dispatch({ type: 'failed' });
          return;
        }
        dispatch({ type: 'preparing', notice: result.kind === 'renew' ? 'expired' : 'lost' });
        void prepare();
      } finally {
        uploadingRef.current = false;
      }
    },
    [letGoOfTheAttempt, prepare],
  );

  /** The prompts are over (or the frames are at their limit): the sequence is taken, the camera is stopped, and the sequence is sent. */
  const finishRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    const recording = recordingRef.current;
    if (!recorder || !recording) return;
    recorderRef.current = null;
    recordingRef.current = null;
    clearTimer();
    const mine = epoch.current;

    const sequence = await recorder.finish();
    // The camera is of no use once the sequence is taken: it is off before a single frame is sent.
    stopCamera();
    if (!mounted.current || epoch.current !== mine) {
      releaseSequence(sequence);
      return;
    }
    if (sequence.frames.length === 0) {
      // The browser gave no picture, or could not encode one: there is nothing to send. A new challenge, a new recording.
      dispatch({ type: 'preparing', notice: 'not_prepared' });
      void prepare();
      return;
    }
    attemptRef.current = { key: recording.key, sequence: { ...sequence, challengeToken: recording.challengeToken }, manualRetriesLeft: 1 };
    await upload();
  }, [clearTimer, prepare, stopCamera, upload]);

  const tick = useCallback(() => {
    const recording = recordingRef.current;
    if (!recording || !recorderRef.current) return;
    const phase = phaseAt(performance.now() - startedAtRef.current, recording.plan);
    if (phase.kind === 'done') {
      void finishRecording();
      return;
    }
    dispatch({ type: 'prompt', prompt: promptOf(phase, recording.plan) });
  }, [finishRecording]);

  /** The prompts begin and the first frame is taken at once; the key of this recording is made now. */
  const beginRecording = (challenge: PresenceChallenge, video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    const recording: Recording = { plan: planOf(challenge), challengeToken: challenge.challengeToken, key: newIdempotencyKey() };
    recordingRef.current = recording;
    recorderRef.current = createSequenceRecorder({
      video,
      canvas,
      targetFps: challenge.targetFps,
      maxFrames: challenge.maxFrames,
      maxFrameSide: challenge.maxFrameSide,
      onFull: () => void finishRecording(),
      onResized: () => {
        if (interrupt('rotated')) void prepare();
      },
    });
    landscapeAtStartRef.current = isLandscape();
    startedAtRef.current = performance.now();
    dispatch({ type: 'recording', prompt: promptOf(phaseAt(0, recording.plan), recording.plan) });
    recorderRef.current.start();
    timerRef.current = window.setInterval(tick, TICK_MS);
  };

  /**
   * The guest starts. A challenge that would run out before the end of the prompts is asked for again first, without a word (the camera stays as it is). A second tap while this is under way, or while the recording
   * runs, does nothing.
   */
  const start = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (startingRef.current || recorderRef.current || uploadingRef.current || !video || !canvas || !streamRef.current) return;
    startingRef.current = true;
    try {
      let challenge = challengeRef.current;
      if (!challenge || !outlivesTheRecording(challenge)) {
        const mine = epoch.current;
        const isCurrent = () => mounted.current && epoch.current === mine;
        dispatch({ type: 'starting' });
        const asked = await latest.current.startChallenge(isCurrent);
        if (!isCurrent() || asked.kind === 'stale' || asked.kind === 'moved') return;
        if (asked.kind === 'failed') {
          dispatch({ type: 'failed' });
          return;
        }
        challenge = asked.challenge;
        challengeRef.current = challenge;
        if (!streamRef.current) return;
      }
      beginRecording(challenge, video, canvas);
    } finally {
      startingRef.current = false;
    }
  };

  useEffect(() => {
    mounted.current = true;
    const canvas = canvasRef.current;
    void prepare();
    return () => {
      // The screen goes (an answer, the way to a person, another step): every track is stopped, and the frames and the canvas are let go.
      mounted.current = false;
      epoch.current += 1;
      discardRecording();
      letGoOfTheAttempt();
      stopCamera();
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [discardRecording, letGoOfTheAttempt, prepare, stopCamera]);

  // A page in the background, a phone that is turned, a window that changes shape: what the recording needs is not there any more.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        interrupt('hidden');
      } else if (hiddenRef.current) {
        hiddenRef.current = false;
        void prepare();
      }
    };
    const onResize = () => {
      if (recorderRef.current !== null && isLandscape() !== landscapeAtStartRef.current && interrupt('rotated')) void prepare();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [interrupt, prepare]);

  /** The guest tries the camera again after allowing it (the challenge they have is still good). */
  const retryCamera = () => {
    dispatch({ type: 'preparing' });
    void prepare(true);
  };

  /** The guest starts the recording over, with a new challenge. */
  const startOver = () => {
    dispatch({ type: 'preparing' });
    void prepare();
  };

  const { phase, problem, kept, notice, prompt, frame } = state;
  const shape = frame ?? { width: 4, height: 3 };
  const move = prompt?.move ? MOVES[prompt.move] : null;
  const MoveIcon = move?.Icon ?? ScanFace;
  const announcement = (() => {
    if (phase === 'recording' && prompt) return prompt.kind === 'lead-in' ? t('checkin.identity.presence.leadIn') : move ? t(move.text) : '';
    if (phase === 'preparing') return t('checkin.identity.presence.preparing');
    if (phase === 'uploading') return online ? t('checkin.biometric.capture.sending') : t('checkin.identity.presence.waitingForConnection');
    return '';
  })();

  return (
    <section className="space-y-4" aria-labelledby={titleId} data-testid="checkin-presence" data-phase={phase}>
      <div className="space-y-1">
        <h4 id={titleId} className="text-base font-semibold">
          {t('checkin.identity.presence.title')}
        </h4>
        <p className="text-sm text-muted-foreground">{t('checkin.identity.presence.instructions')}</p>
      </div>

      {notice && (
        <Alert variant="warning" role="alert" data-testid="checkin-presence-notice" data-notice={notice}>
          {t(NOTICE_TEXT[notice])}
        </Alert>
      )}

      {/* The frames are drawn here and nowhere else; it is never shown, and it is one element for the whole life of the screen. It is emptied when the answer comes and when the screen goes. */}
      <canvas ref={canvasRef} aria-hidden="true" className="hidden" data-testid="checkin-presence-canvas" />

      {phase === 'camera-problem' && problem ? (
        <div className="space-y-3" data-testid="checkin-presence-camera-problem" data-problem={problem}>
          <Alert variant="warning" role="alert" title={t('checkin.biometric.capture.cameraTitle')}>
            <p>{t(CAMERA_TEXT[problem])}</p>
            <p className="mt-1">{t('checkin.identity.presence.camera.fallback')}</p>
          </Alert>
          {problem !== 'unsupported' && (
            <Button type="button" size="lg" variant="outline" disabled={busy} onClick={retryCamera} data-testid="checkin-presence-camera-retry">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('checkin.biometric.capture.retryCamera')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div
            className="relative mx-auto w-full overflow-hidden rounded-lg bg-black"
            style={{ aspectRatio: `${shape.width} / ${shape.height}`, maxWidth: `calc(60vh * ${shape.width / shape.height})` }}
            data-testid="checkin-presence-view"
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label={t('checkin.biometric.capture.previewLabel')}
              className="h-full w-full -scale-x-100 object-cover"
              data-testid="checkin-presence-video"
              onLoadedMetadata={(event) => dispatch({ type: 'frame', width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight })}
              onResize={(event) => dispatch({ type: 'frame', width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight })}
            />
            <div
              aria-hidden="true"
              data-testid="checkin-presence-oval"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
            />
            {(phase === 'preparing' || phase === 'uploading' || phase === 'kept') && (
              <div className="absolute inset-0 grid place-items-center bg-black/60 text-white" data-testid="checkin-presence-wait">
                {phase === 'kept' || (phase === 'uploading' && !online) ? (
                  <WifiOff className="size-8" aria-hidden="true" />
                ) : (
                  <Loader2 className="size-8 motion-safe:animate-spin" aria-hidden="true" />
                )}
              </div>
            )}
          </div>

          <div className="min-h-28 space-y-2 text-center" data-testid="checkin-presence-panel">
            <p aria-live="assertive" aria-atomic="true" className="min-h-8 text-2xl font-semibold" data-testid="checkin-presence-prompt">
              {announcement}
            </p>
            {phase === 'recording' && prompt && (
              <div className="flex items-center justify-center gap-4">
                <MoveIcon className="size-12 motion-safe:animate-pulse" aria-hidden="true" data-testid="checkin-presence-arrow" data-move={prompt.move ?? 'lead-in'} />
                <span
                  role="timer"
                  aria-label={t('checkin.identity.presence.secondsLeft', { count: prompt.seconds })}
                  className="text-5xl font-bold tabular-nums"
                  data-testid="checkin-presence-countdown"
                >
                  {prompt.seconds}
                </span>
              </div>
            )}
            {phase === 'recording' && prompt && prompt.kind === 'step' && (
              <p className="text-xs font-medium text-muted-foreground" data-testid="checkin-presence-step">
                {t('checkin.identity.presence.step', { current: prompt.index + 1, total: prompt.total })}
              </p>
            )}
          </div>

          {(phase === 'ready' || phase === 'starting') && (
            <Button type="button" size="lg" disabled={busy || phase === 'starting'} onClick={() => void start()} className="w-full sm:w-auto" data-testid="checkin-presence-start">
              <Video className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('checkin.identity.presence.start')}
            </Button>
          )}

          {phase === 'kept' && kept && (
            <div className="space-y-3" data-testid="checkin-presence-kept" data-problem={kept}>
              <Alert variant="warning" role="alert">
                {t(KEPT_TEXT[kept] ?? problemKey(kept))}
              </Alert>
              <Button type="button" size="lg" disabled={busy} onClick={() => void upload(true)} className="w-full sm:w-auto" data-testid="checkin-presence-send-again">
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('checkin.identity.presence.kept.sendAgain')}
              </Button>
            </div>
          )}

          {phase === 'failed' && (
            <Button type="button" size="lg" disabled={busy} onClick={startOver} className="w-full sm:w-auto" data-testid="checkin-presence-retry">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('checkin.identity.presence.retry')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
