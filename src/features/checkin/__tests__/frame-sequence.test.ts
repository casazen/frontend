import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSequenceRecorder, FRAME_JPEG_QUALITY, fitLongSide, phaseAt, releaseSequence, secondsLeft, totalDurationMs } from '../lib/frame-sequence';

/** What the canvas was asked to encode, one entry for each `toBlob`. */
let encoded: Array<{ width: number; height: number; type: string | undefined; quality: unknown }> = [];
/** What was drawn on the canvas, one entry for each `drawImage`. */
let drawn: Array<{ width: number; height: number }> = [];
/** How the browser answers `toBlob`: at once, later (a timer), or with nothing (it could not encode). */
let encoder: { mode: 'now' | 'later' | 'fails'; failFirst: number; delayMs: number } = { mode: 'now', failFirst: 0, delayMs: 0 };

/** A video that has a picture of `size` (change `size` to change the picture, as a phone that is turned does). */
function fakeVideo(size = { width: 640, height: 480 }) {
  const video = document.createElement('video');
  Object.defineProperty(video, 'videoWidth', { configurable: true, get: () => size.width });
  Object.defineProperty(video, 'videoHeight', { configurable: true, get: () => size.height });
  return { video, size };
}

function recorderOf(overrides: Partial<Parameters<typeof createSequenceRecorder>[0]> & { video?: HTMLVideoElement } = {}) {
  const { video } = overrides.video ? { video: overrides.video } : fakeVideo();
  const canvas = document.createElement('canvas');
  const onFull = vi.fn();
  const onResized = vi.fn();
  const recorder = createSequenceRecorder({ video, canvas, targetFps: 10, maxFrames: 100, maxFrameSide: 320, onFull, onResized, ...overrides });
  return { recorder, canvas, video, onFull, onResized };
}

/** Lets the timers run for `ms` (and the promises they settle). */
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  encoded = [];
  drawn = [];
  encoder = { mode: 'now', failFirst: 0, delayMs: 0 };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        drawImage: (_source: unknown, _x: number, _y: number, width: number, height: number) => drawn.push({ width, height }),
      }) as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type, quality) {
    encoded.push({ width: this.width, height: this.height, type, quality });
    const fails = encoder.mode === 'fails' || encoded.length <= encoder.failFirst;
    const answer = () => callback(fails ? null : new Blob([`frame-${encoded.length}`], { type }));
    if (encoder.mode === 'later') setTimeout(answer, encoder.delayMs);
    else answer();
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('frame-sequence: the size of a frame', () => {
  it.each([
    [640, 480, 320, { width: 320, height: 240 }],
    [480, 640, 320, { width: 240, height: 320 }],
    [640, 480, 480, { width: 480, height: 360 }],
    [1280, 720, 640, { width: 640, height: 360 }],
    [640, 480, 640, { width: 640, height: 480 }],
    [320, 240, 640, { width: 320, height: 240 }],
    [4000, 1, 100, { width: 100, height: 1 }],
  ])('fitLongSide_%ix%i_AtMost%i_Is%j', (width, height, side, expected) => {
    expect(fitLongSide(width, height, side)).toEqual(expected);
  });
});

describe('frame-sequence: the recorder takes timed frames (E72/F02/US01/T01, AC3)', () => {
  it('createSequenceRecorder_AFewSeconds_TimestampsStartAtZeroAreWholeNumbersAndGrowStrictly', async () => {
    const { recorder } = recorderOf();

    recorder.start();
    await run(1_000);
    const sequence = await recorder.finish();

    expect(sequence.frames.length).toBeGreaterThan(8);
    expect(sequence.timestamps).toHaveLength(sequence.frames.length);
    expect(sequence.timestamps[0]).toBe(0);
    for (const stamp of sequence.timestamps) expect(Number.isInteger(stamp)).toBe(true);
    for (let index = 1; index < sequence.timestamps.length; index += 1) {
      expect(sequence.timestamps[index]).toBeGreaterThan(sequence.timestamps[index - 1]);
    }
  });

  it('createSequenceRecorder_TenFramesASecond_TakesTheFirstFrameAtOnceAndOneEveryHundredMilliseconds', async () => {
    const { recorder } = recorderOf({ targetFps: 10 });

    recorder.start();
    await run(1_000);
    const sequence = await recorder.finish();

    // At 0 ms and then at 100, 200 ... 1000 ms.
    expect(sequence.timestamps).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  });

  it('createSequenceRecorder_TheFirstFrameIsTheStartOfTheSequence_NotTheMomentTheRecorderWasMade', async () => {
    const { recorder } = recorderOf();
    await run(5_000);

    recorder.start();
    await run(300);
    const sequence = await recorder.finish();

    expect(sequence.timestamps[0]).toBe(0);
    expect(Math.max(...sequence.timestamps)).toBeLessThan(400);
  });

  it('createSequenceRecorder_TheCameraHasNoPictureYet_TakesNothingUntilItHasOneAndStartsThenAtZero', async () => {
    const { video, size } = fakeVideo({ width: 0, height: 0 });
    const { recorder } = recorderOf({ video });

    recorder.start();
    await run(500);
    size.width = 640;
    size.height = 480;
    await run(300);
    const sequence = await recorder.finish();

    expect(sequence.frames.length).toBeGreaterThan(0);
    expect(sequence.timestamps[0]).toBe(0);
    expect(sequence.frames.length).toBeLessThan(5);
  });

  it('createSequenceRecorder_AClockThatDoesNotMove_NeverMakesTwoFramesOfTheSameTimestamp', async () => {
    let now = 0;
    const { recorder } = recorderOf({ now: () => now, targetFps: 10 });

    recorder.start();
    // The timer fires again but the clock has not moved: those are not frames.
    await run(300);
    now = 100;
    await run(100);
    now = 100;
    await run(100);
    now = 200;
    await run(100);
    const sequence = await recorder.finish();

    expect(sequence.timestamps).toEqual([0, 100, 200]);
  });

  it('createSequenceRecorder_MoreFramesThanTheCap_StopsAtTheCapAndSaysSo', async () => {
    const { recorder, onFull } = recorderOf({ maxFrames: 5 });

    recorder.start();
    await run(2_000);
    const sequence = await recorder.finish();

    expect(sequence.frames).toHaveLength(5);
    expect(sequence.timestamps).toEqual([0, 100, 200, 300, 400]);
    expect(onFull).toHaveBeenCalledTimes(1);
    expect(encoded).toHaveLength(5);
  });

  it('createSequenceRecorder_ACapOfOne_TakesOneFrameAtStartAndNoMore', async () => {
    const { recorder, onFull } = recorderOf({ maxFrames: 1 });

    recorder.start();
    await run(1_000);
    const sequence = await recorder.finish();

    expect(sequence.frames).toHaveLength(1);
    expect(onFull).toHaveBeenCalledTimes(1);
  });

  it('createSequenceRecorder_AFrame_IsAJpegAt70PercentDrawnWithItsLongSideAtMostTheLimit', async () => {
    const { recorder, canvas } = recorderOf({ maxFrameSide: 320 });

    recorder.start();
    await run(200);
    const sequence = await recorder.finish();

    expect(FRAME_JPEG_QUALITY).toBe(0.7);
    expect(encoded.length).toBeGreaterThan(1);
    for (const call of encoded) expect(call).toEqual({ width: 320, height: 240, type: 'image/jpeg', quality: 0.7 });
    for (const size of drawn) expect(size).toEqual({ width: 320, height: 240 });
    for (const frame of sequence.frames) expect(frame.type).toBe('image/jpeg');
    // The canvas is empty once the sequence is out.
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it('createSequenceRecorder_AnUprightPicture_KeepsItsShapeWithTheLongSideAtTheLimit', async () => {
    const { video } = fakeVideo({ width: 480, height: 640 });
    const { recorder } = recorderOf({ video, maxFrameSide: 320 });

    recorder.start();
    await run(100);
    await recorder.finish();

    expect(drawn[0]).toEqual({ width: 240, height: 320 });
  });

  it('createSequenceRecorder_APictureSmallerThanTheLimit_IsNeverMadeLarger', async () => {
    const { video } = fakeVideo({ width: 320, height: 240 });
    const { recorder } = recorderOf({ video, maxFrameSide: 640 });

    recorder.start();
    await run(100);
    await recorder.finish();

    expect(drawn[0]).toEqual({ width: 320, height: 240 });
  });

  it('createSequenceRecorder_FramesStillBeingEncoded_AreWaitedForAndComeOutInTheOrderTheyWereTaken', async () => {
    encoder = { mode: 'later', failFirst: 0, delayMs: 250 };
    const { recorder } = recorderOf();

    recorder.start();
    await run(300);
    const finished = recorder.finish();
    await run(300);
    const sequence = await finished;

    expect(sequence.frames).toHaveLength(sequence.timestamps.length);
    expect(sequence.timestamps).toEqual([...sequence.timestamps].sort((a, b) => a - b));
    expect(sequence.frames.length).toBeGreaterThanOrEqual(3);
  });

  it('createSequenceRecorder_ABrowserThatNeverEncodes_DoesNotKeepTheGuestWaitingForEver', async () => {
    encoder = { mode: 'later', failFirst: 0, delayMs: 1_000_000 };
    const { recorder } = recorderOf();

    recorder.start();
    await run(200);
    const finished = recorder.finish();
    await run(6_000);
    const sequence = await finished;

    expect(sequence.frames).toEqual([]);
    expect(sequence.timestamps).toEqual([]);
  });

  it('createSequenceRecorder_AFrameTheBrowserCannotEncode_IsNotInTheSequenceAndTheFirstThatIsKeptIsTheStart', async () => {
    encoder = { mode: 'now', failFirst: 2, delayMs: 0 };
    const { recorder } = recorderOf({ targetFps: 10 });

    recorder.start();
    await run(500);
    const sequence = await recorder.finish();

    // The first two frames (0 and 100 ms) failed: the sequence starts at the third, and that is 0.
    expect(sequence.timestamps).toEqual([0, 100, 200, 300]);
    expect(sequence.frames).toHaveLength(4);
  });

  it('createSequenceRecorder_NoFrameCanBeEncoded_GivesAnEmptySequence', async () => {
    encoder = { mode: 'fails', failFirst: 0, delayMs: 0 };
    const { recorder } = recorderOf();

    recorder.start();
    await run(300);

    expect(await recorder.finish()).toEqual({ frames: [], timestamps: [] });
  });
});

describe('frame-sequence: a picture that changes shape (rotation)', () => {
  it('createSequenceRecorder_ThePhoneIsTurnedWhileRecording_StopsTakingFramesAndSaysSoOnce', async () => {
    const { video, size } = fakeVideo({ width: 640, height: 480 });
    const { recorder, onResized } = recorderOf({ video });

    recorder.start();
    await run(300);
    const before = encoded.length;
    size.width = 480;
    size.height = 640;
    await run(1_000);

    expect(onResized).toHaveBeenCalledTimes(1);
    expect(encoded).toHaveLength(before);
    recorder.discard();
  });

  it('createSequenceRecorder_TheSizeChangesButTheShapeDoesNot_KeepsRecording', async () => {
    const { video, size } = fakeVideo({ width: 640, height: 480 });
    const { recorder, onResized } = recorderOf({ video });

    recorder.start();
    await run(200);
    size.width = 320;
    size.height = 240;
    await run(200);
    const sequence = await recorder.finish();

    expect(onResized).not.toHaveBeenCalled();
    expect(sequence.frames.length).toBeGreaterThanOrEqual(4);
  });
});

describe('frame-sequence: nothing of the frames is kept', () => {
  it('discard_ARecordingThatIsLetGo_ReturnsNothingEmptiesTheCanvasAndTakesNoMoreFrames', async () => {
    encoder = { mode: 'later', failFirst: 0, delayMs: 300 };
    const { recorder, canvas } = recorderOf();

    recorder.start();
    await run(250);
    recorder.discard();
    const taken = encoded.length;
    // The frames that were being encoded come back after the discard: nobody keeps them.
    await run(1_000);

    expect(encoded).toHaveLength(taken);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(await recorder.finish()).toEqual({ frames: [], timestamps: [] });
  });

  it('releaseSequence_ASequence_IsEmptiedInPlaceSoThatWhatStillHoldsItHoldsNothing', () => {
    const sequence = { frames: [new Blob(['a']), new Blob(['b'])], timestamps: [0, 100] };
    const sameFrames = sequence.frames;
    const sameStamps = sequence.timestamps;

    releaseSequence(sequence);

    expect(sameFrames).toHaveLength(0);
    expect(sameStamps).toHaveLength(0);
  });

  it('createSequenceRecorder_AFullRecording_WritesNothingToAnyStorageAndMakesNoAddress', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const createObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
    const consoleCalls = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'debug'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    const { recorder } = recorderOf();

    recorder.start();
    await run(1_000);
    await recorder.finish();

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
    expect(createObjectURL).not.toHaveBeenCalled();
    for (const call of consoleCalls) expect(call).not.toHaveBeenCalled();
    Reflect.deleteProperty(URL, 'createObjectURL');
  });
});

describe('frame-sequence: requestVideoFrameCallback when the browser has it', () => {
  /** A video that calls back for each of its frames, every `everyMs`, the way a camera does. */
  function videoWithFrameCallbacks(everyMs: number) {
    const { video } = fakeVideo();
    const pending = new Map<number, () => void>();
    let next = 1;
    let timer: ReturnType<typeof setInterval> | null = null;
    const api = {
      requested: 0,
      cancelled: [] as number[],
    };
    Object.assign(video, {
      requestVideoFrameCallback: (callback: () => void) => {
        const handle = next;
        next += 1;
        api.requested += 1;
        pending.set(handle, callback);
        return handle;
      },
      cancelVideoFrameCallback: (handle: number) => {
        api.cancelled.push(handle);
        pending.delete(handle);
      },
    });
    timer = setInterval(() => {
      const callbacks = [...pending.entries()];
      pending.clear();
      for (const [, callback] of callbacks) callback();
    }, everyMs);
    return { video, api, stop: () => timer && clearInterval(timer) };
  }

  it('createSequenceRecorder_TheBrowserHasFrameCallbacks_UsesThemAndNotATimer', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const source = videoWithFrameCallbacks(33);
    setIntervalSpy.mockClear();
    const { recorder } = recorderOf({ video: source.video, targetFps: 10 });

    recorder.start();
    await run(1_000);
    const sequence = await recorder.finish();
    source.stop();

    expect(source.api.requested).toBeGreaterThan(10);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(sequence.timestamps[0]).toBe(0);
  });

  it('createSequenceRecorder_ACameraThatDeliversThirtyFramesASecond_IsHeldToTheTargetRate', async () => {
    const source = videoWithFrameCallbacks(33);
    const { recorder } = recorderOf({ video: source.video, targetFps: 10 });

    recorder.start();
    await run(1_000);
    const sequence = await recorder.finish();
    source.stop();

    // About ten frames in a second, not thirty.
    expect(sequence.frames.length).toBeGreaterThanOrEqual(8);
    expect(sequence.frames.length).toBeLessThanOrEqual(12);
    for (let index = 1; index < sequence.timestamps.length; index += 1) {
      expect(sequence.timestamps[index] - sequence.timestamps[index - 1]).toBeGreaterThanOrEqual(80);
    }
  });

  it('createSequenceRecorder_FinishWithACallbackWaiting_CancelsIt', async () => {
    const source = videoWithFrameCallbacks(33);
    const { recorder } = recorderOf({ video: source.video });

    recorder.start();
    await run(200);
    await recorder.finish();
    source.stop();

    expect(source.api.cancelled.length).toBe(1);
  });
});

describe('frame-sequence: the prompts', () => {
  const plan = { leadInMs: 1_500, stepMs: 2_000, steps: ['turn_left', 'look_up', 'turn_right'] };

  it('totalDurationMs_TheLeadInAndEachMove_IsTheirSum', () => {
    expect(totalDurationMs(plan)).toBe(7_500);
  });

  it.each([
    [0, { kind: 'lead-in', remainingMs: 1_500 }],
    [1_499, { kind: 'lead-in', remainingMs: 1 }],
    [1_500, { kind: 'step', index: 0, move: 'turn_left', remainingMs: 2_000 }],
    [2_500, { kind: 'step', index: 0, move: 'turn_left', remainingMs: 1_000 }],
    [3_500, { kind: 'step', index: 1, move: 'look_up', remainingMs: 2_000 }],
    [5_499, { kind: 'step', index: 1, move: 'look_up', remainingMs: 1 }],
    [5_500, { kind: 'step', index: 2, move: 'turn_right', remainingMs: 2_000 }],
    [7_499, { kind: 'step', index: 2, move: 'turn_right', remainingMs: 1 }],
    [7_500, { kind: 'done' }],
    [20_000, { kind: 'done' }],
  ])('phaseAt_%ims_Is%j', (elapsed, expected) => {
    expect(phaseAt(elapsed, plan)).toEqual(expected);
  });

  it('phaseAt_TheMovesComeInTheOrderOfTheChallengeAndNoneIsSkipped', () => {
    const seen: string[] = [];
    for (let at = 0; at < totalDurationMs(plan); at += 100) {
      const phase = phaseAt(at, plan);
      if (phase.kind === 'step' && seen[seen.length - 1] !== phase.move) seen.push(phase.move);
    }

    expect(seen).toEqual(['turn_left', 'look_up', 'turn_right']);
  });

  it('phaseAt_ANoLeadIn_StartsOnTheFirstMove', () => {
    expect(phaseAt(0, { ...plan, leadInMs: 0 })).toEqual({ kind: 'step', index: 0, move: 'turn_left', remainingMs: 2_000 });
  });

  it.each([
    [2_000, 2],
    [1_001, 2],
    [1_000, 1],
    [1, 1],
    [0, 1],
  ])('secondsLeft_%ims_Is%i', (remaining, seconds) => {
    expect(secondsLeft(remaining)).toBe(seconds);
  });
});
