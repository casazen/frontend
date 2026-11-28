/**
 * The frame sequence of the presence check (E72/F02/US01/T01, NF-192, ADR-013-R11): while the guest follows the prompts, the browser takes a frame of the camera about `targetFps` times a second, draws it on a canvas no
 * larger than `maxFrameSide` px on its long side, encodes it as a JPEG and notes its time in whole milliseconds from the first frame. The server validates the sequence and chooses the frames itself, so nothing is decided here.
 *
 * Everything in this module is pure or works on the objects it is given (a video, a canvas): no storage, no network, no log. The frames are Blobs in memory, handed to the caller by {@link SequenceRecorder.finish} and
 * let go with {@link releaseSequence}; they are never written to `localStorage`, IndexedDB or a file.
 */

export const FRAME_JPEG_QUALITY = 0.7;

/**
 * A frame is taken when at least this share of the interval of `targetFps` has gone by since the last one: the video delivers its own frames (25 or 30 a second), so a frame that comes a little early is not waited for
 * another whole frame. 0.8 keeps the rate at the target or a little above it, never far below.
 */
const MIN_GAP_SHARE = 0.8;

const ENCODE_WAIT_MS = 5_000;

export interface RecordedSequence {
  frames: Blob[];
  timestamps: number[];
}

/** Lets the frames go: the arrays are emptied in place, so that nothing that still holds them keeps a Blob alive. */
export function releaseSequence(sequence: RecordedSequence): void {
  sequence.frames.length = 0;
  sequence.timestamps.length = 0;
}

export function fitLongSide(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (Math.max(width, height) <= maxSide) return { width, height };
  if (width >= height) return { width: maxSide, height: Math.max(1, Math.round((height * maxSide) / width)) };
  return { width: Math.max(1, Math.round((width * maxSide) / height)), height: maxSide };
}

export interface SequenceRecorderOptions {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  targetFps: number;
  maxFrames: number;
  maxFrameSide: number;
  /** The clock in milliseconds; the time of the browser (`performance.now`) unless a test brings its own. */
  now?: () => number;
  onFull?: () => void;
  onResized?: () => void;
}

export interface SequenceRecorder {
  start: () => void;
  finish: () => Promise<RecordedSequence>;
  discard: () => void;
}

function shapeOf(width: number, height: number): number {
  return Math.sign(width - height);
}

export function createSequenceRecorder(options: SequenceRecorderOptions): SequenceRecorder {
  const { video, canvas, targetFps, maxFrames, maxFrameSide, onFull, onResized } = options;
  const now = options.now ?? (() => performance.now());
  const interval = 1000 / targetFps;
  const minGap = interval * MIN_GAP_SHARE;

  const taken: Array<{ stamp: number; blob: Blob | null }> = [];
  let origin: number | null = null;
  let lastAt = Number.NEGATIVE_INFINITY;
  let lastStamp = -1;
  let shape: number | null = null;
  let stopped = false;
  let released = false;
  let pending = 0;
  let onIdle: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let callbackHandle: number | null = null;
  let context: CanvasRenderingContext2D | null = null;

  const stopTaking = () => {
    stopped = true;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (callbackHandle !== null) {
      video.cancelVideoFrameCallback?.(callbackHandle);
      callbackHandle = null;
    }
  };

  const emptyCanvas = () => {
    canvas.width = 0;
    canvas.height = 0;
    context = null;
  };

  const grab = () => {
    if (stopped) return;
    const { videoWidth, videoHeight } = video;
    if (!videoWidth || !videoHeight) return;

    const currentShape = shapeOf(videoWidth, videoHeight);
    if (shape === null) {
      shape = currentShape;
    } else if (currentShape !== shape) {
      stopTaking();
      onResized?.();
      return;
    }

    const at = now();
    if (at - lastAt < minGap) return;
    const stamp = Math.round(at - (origin ?? at));
    if (stamp <= lastStamp) return;

    const size = fitLongSide(videoWidth, videoHeight, maxFrameSide);
    if (canvas.width !== size.width) canvas.width = size.width;
    if (canvas.height !== size.height) canvas.height = size.height;
    context ??= canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, size.width, size.height);

    origin ??= at;
    lastAt = at;
    lastStamp = stamp;
    const frame: { stamp: number; blob: Blob | null } = { stamp, blob: null };
    taken.push(frame);
    pending += 1;
    canvas.toBlob(
      (blob) => {
        pending -= 1;
        if (!released) frame.blob = blob;
        if (pending === 0) onIdle?.();
      },
      'image/jpeg',
      FRAME_JPEG_QUALITY,
    );

    if (taken.length >= maxFrames) {
      stopTaking();
      onFull?.();
    }
  };

  const scheduleNextFrame = () => {
    callbackHandle = video.requestVideoFrameCallback(() => {
      callbackHandle = null;
      grab();
      if (!stopped) scheduleNextFrame();
    });
  };

  const waitForEncoding = () =>
    new Promise<void>((resolve) => {
      if (pending === 0) {
        resolve();
        return;
      }
      const giveUp = setTimeout(done, ENCODE_WAIT_MS);
      function done() {
        clearTimeout(giveUp);
        onIdle = null;
        resolve();
      }
      onIdle = done;
    });

  return {
    start: () => {
      grab();
      if (stopped) return;
      if (typeof video.requestVideoFrameCallback === 'function') scheduleNextFrame();
      else timer = setInterval(grab, interval);
    },

    finish: async () => {
      stopTaking();
      await waitForEncoding();
      released = true;
      const kept = taken.filter((frame): frame is { stamp: number; blob: Blob } => frame.blob !== null);
      taken.length = 0;
      emptyCanvas();
      const first = kept[0]?.stamp ?? 0;
      return { frames: kept.map((frame) => frame.blob), timestamps: kept.map((frame) => frame.stamp - first) };
    },

    discard: () => {
      stopTaking();
      released = true;
      taken.length = 0;
      emptyCanvas();
    },
  };
}

export interface PromptPlan {
  leadInMs: number;
  stepMs: number;
  steps: readonly string[];
}

export type PromptPhase =
  | { kind: 'lead-in'; remainingMs: number }
  | { kind: 'step'; index: number; move: string; remainingMs: number }
  | { kind: 'done' };

export function totalDurationMs(plan: PromptPlan): number {
  return plan.leadInMs + plan.stepMs * plan.steps.length;
}

export function phaseAt(elapsedMs: number, plan: PromptPlan): PromptPhase {
  if (elapsedMs < plan.leadInMs) return { kind: 'lead-in', remainingMs: plan.leadInMs - elapsedMs };
  const into = elapsedMs - plan.leadInMs;
  const index = Math.floor(into / plan.stepMs);
  if (index >= plan.steps.length) return { kind: 'done' };
  return { kind: 'step', index, move: plan.steps[index], remainingMs: plan.stepMs - (into - index * plan.stepMs) };
}

export function secondsLeft(remainingMs: number): number {
  return Math.max(1, Math.ceil(remainingMs / 1000));
}
