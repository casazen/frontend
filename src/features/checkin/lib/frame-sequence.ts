/**
 * The frame sequence of the presence check (E72/F02/US01/T01, NF-192, ADR-013-R11): while the guest follows the prompts, the browser takes a frame of the camera about `targetFps` times a second, draws it on a canvas no
 * larger than `maxFrameSide` px on its long side, encodes it as a JPEG and notes its time in whole milliseconds from the first frame. The server validates the sequence and chooses the frames itself, so nothing is decided here.
 *
 * Everything in this module is pure or works on the objects it is given (a video, a canvas): no storage, no network, no log. The frames are Blobs in memory, handed to the caller by {@link SequenceRecorder.finish} and
 * let go with {@link releaseSequence}; they are never written to `localStorage`, IndexedDB or a file.
 */

/** The quality of the JPEG of a frame, 0 to 1: the sequence is dense, so each frame is small. */
export const FRAME_JPEG_QUALITY = 0.7;

/**
 * A frame is taken when at least this share of the interval of `targetFps` has gone by since the last one: the video delivers its own frames (25 or 30 a second), so a frame that comes a little early is not waited for
 * another whole frame. 0.8 keeps the rate at the target or a little above it, never far below.
 */
const MIN_GAP_SHARE = 0.8;

/** How long `finish` waits for the frames that are still being encoded: a browser that never calls back does not keep the guest waiting. */
const ENCODE_WAIT_MS = 5_000;

/** What a recording hands over: the JPEG frames in the order they were taken, and the time of each in whole milliseconds from the first (the first is 0, each one is larger than the one before). */
export interface RecordedSequence {
  frames: Blob[];
  timestamps: number[];
}

/** Lets the frames go: the arrays are emptied in place, so that nothing that still holds them keeps a Blob alive. */
export function releaseSequence(sequence: RecordedSequence): void {
  sequence.frames.length = 0;
  sequence.timestamps.length = 0;
}

/** The size of a frame whose long side is at most `maxSide`, with the proportions of the picture (never larger than the picture is). */
export function fitLongSide(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (Math.max(width, height) <= maxSide) return { width, height };
  if (width >= height) return { width: maxSide, height: Math.max(1, Math.round((height * maxSide) / width)) };
  return { width: Math.max(1, Math.round((width * maxSide) / height)), height: maxSide };
}

export interface SequenceRecorderOptions {
  /** The video the camera plays into. Its frames are drawn as they are, the way the camera gives them (the mirror of the preview is only a style of the screen). */
  video: HTMLVideoElement;
  /** The canvas the frames are drawn on, one at a time. The caller owns it; the recorder empties it when it lets go. */
  canvas: HTMLCanvasElement;
  /** Frames a second to aim at (positive, from the challenge). */
  targetFps: number;
  /** The most frames a sequence may have: the recorder stops there and calls `onFull`. */
  maxFrames: number;
  /** The longest side of a frame, in px. */
  maxFrameSide: number;
  /** The clock in milliseconds; the time of the browser (`performance.now`) unless a test brings its own. */
  now?: () => number;
  /** The sequence has `maxFrames` frames: nothing more is taken. */
  onFull?: () => void;
  /** The picture of the camera changed its aspect (a phone turned from upright to sideways, or the other way): frames of the two shapes are not one sequence, so the recorder stops taking them. */
  onResized?: () => void;
}

export interface SequenceRecorder {
  /** Takes the first frame at once (the sequence starts now) and then the following ones until `finish`, `discard`, `maxFrames` or a change of aspect. */
  start: () => void;
  /** Stops taking frames, waits for the ones being encoded and gives the sequence back, with the first timestamp at 0. The canvas is emptied. */
  finish: () => Promise<RecordedSequence>;
  /** Stops and lets go of everything: the frames that were taken, the ones still being encoded, the canvas. */
  discard: () => void;
}

/** The shape of a picture: wider than high, higher than wide, or square. */
function shapeOf(width: number, height: number): number {
  return Math.sign(width - height);
}

/**
 * The recorder of the frame sequence. Frames come from `requestVideoFrameCallback` when the browser has it (one look at each frame the camera delivers, spaced by `targetFps`), else from a timer at the interval of
 * `targetFps`. Each frame is drawn at the size that fits `maxFrameSide`, encoded with `canvas.toBlob('image/jpeg', 0.7)` and timed with `Math.round(now() - t0)`, where `t0` is the time of the first frame: so the first
 * timestamp is 0 and a frame that would fall on the same millisecond as the one before (or before it) is not kept. At most `maxFrames` frames are taken. A frame the browser fails to encode is a frame the sequence does not have.
 */
export function createSequenceRecorder(options: SequenceRecorderOptions): SequenceRecorder {
  const { video, canvas, targetFps, maxFrames, maxFrameSide, onFull, onResized } = options;
  const now = options.now ?? (() => performance.now());
  const interval = 1000 / targetFps;
  const minGap = interval * MIN_GAP_SHARE;

  /** One frame of the sequence: its time, and its JPEG once the browser has encoded it (`null` until then, and for good when it could not). */
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
    // A camera that has not given a picture yet has nothing to take.
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
    // Never two frames on the same millisecond and never one before another: a stamp that does not grow is a frame that is not taken.
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
        // A recording that was let go while this frame was being encoded does not get it back.
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

  /** Resolves when no frame is being encoded any more, or after `ENCODE_WAIT_MS`. */
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
      // The first frame that was kept is the start of the sequence, whatever happened to the ones before it.
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

/** The prompts of a challenge: a lead-in to look at the camera, then each move for the same time, in order. */
export interface PromptPlan {
  leadInMs: number;
  stepMs: number;
  steps: readonly string[];
}

/** Where the guest is in the prompts: looking at the camera, on one of the moves, or past the last one. */
export type PromptPhase =
  | { kind: 'lead-in'; remainingMs: number }
  | { kind: 'step'; index: number; move: string; remainingMs: number }
  | { kind: 'done' };

/** How long the prompts last, from the first instant of the lead-in to the end of the last move. */
export function totalDurationMs(plan: PromptPlan): number {
  return plan.leadInMs + plan.stepMs * plan.steps.length;
}

/** What the guest is asked at `elapsedMs` from the start of the recording, and how much of it is left. */
export function phaseAt(elapsedMs: number, plan: PromptPlan): PromptPhase {
  if (elapsedMs < plan.leadInMs) return { kind: 'lead-in', remainingMs: plan.leadInMs - elapsedMs };
  const into = elapsedMs - plan.leadInMs;
  const index = Math.floor(into / plan.stepMs);
  if (index >= plan.steps.length) return { kind: 'done' };
  return { kind: 'step', index, move: plan.steps[index], remainingMs: plan.stepMs - (into - index * plan.stepMs) };
}

/** The number on the countdown: whole seconds, rounded up, never 0 while there is time left. */
export function secondsLeft(remainingMs: number): number {
  return Math.max(1, Math.ceil(remainingMs / 1000));
}
