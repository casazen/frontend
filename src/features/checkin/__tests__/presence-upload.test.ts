import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { browserEnvironment, isRateLimited, isWorthRepeating, newIdempotencyKey, OFFLINE_WAIT_MS, RETRY_DELAYS_MS, uploadPresence, type UploadEnvironment } from '../lib/presence-upload';

const KEY = '0f8b3a52-6a43-4f9d-8e2b-3d6d3f6a9c11';

function httpError(status?: number, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response = status === undefined ? undefined : { status, data: {}, statusText: '', headers: {}, config };
  return new AxiosError('Request failed', code ?? AxiosError.ERR_BAD_REQUEST, config, {}, response);
}

const networkError = () => httpError(undefined, AxiosError.ERR_NETWORK);
const timeoutError = () => httpError(undefined, AxiosError.ECONNABORTED);

/** An environment the test drives: whether the browser is online, the waits that were asked for, the sleeps that were asked for. */
function environment(options: { online?: boolean } = {}) {
  const connection = { online: options.online ?? true };
  const waiters: Array<(online: boolean) => void> = [];
  const sleeps: number[] = [];
  const waitForOnline = vi.fn<UploadEnvironment['waitForOnline']>(
    () =>
      new Promise<boolean>((resolve) => {
        waiters.push(resolve);
      }),
  );
  const env: UploadEnvironment = {
    isOnline: () => connection.online,
    waitForOnline,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
  return {
    env,
    connection,
    sleeps,
    waitForOnline,
    /** The connection is back: whoever waits for it goes on. */
    comeBack: () => {
      connection.online = true;
      waiters.splice(0).forEach((resolve) => resolve(true));
    },
    /** The wait for the connection ran out. */
    giveUpWaiting: () => waiters.splice(0).forEach((resolve) => resolve(false)),
  };
}

describe('presence-upload: the tries and their waits (E72/F02/US01/T02, AC3)', () => {
  it('RETRY_DELAYS_MS_AreOneTwoAndFourSeconds', () => {
    expect([...RETRY_DELAYS_MS]).toEqual([1_000, 2_000, 4_000]);
  });

  it('uploadPresence_TheServerAnswers_SendsOnceWithTheKeyAndNeverWaits', async () => {
    const rig = environment();
    const send = vi.fn().mockResolvedValue({ result: 'ok' });

    const outcome = await uploadPresence(send, KEY, rig.env);

    expect(outcome).toEqual({ kind: 'answered', answer: { result: 'ok' } });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(KEY);
    expect(rig.sleeps).toEqual([]);
    expect(rig.waitForOnline).not.toHaveBeenCalled();
  });

  it('presence-upload: retries reuse the same Idempotency-Key', async () => {
    const rig = environment();
    const keys: string[] = [];
    const send = vi
      .fn<(key: string) => Promise<string>>()
      .mockImplementationOnce(async (key) => {
        keys.push(key);
        throw networkError();
      })
      .mockImplementationOnce(async (key) => {
        keys.push(key);
        throw httpError(503);
      })
      .mockImplementation(async (key) => {
        keys.push(key);
        return 'stored answer';
      });

    const outcome = await uploadPresence(send, KEY, rig.env);

    // Three requests that left the page: the same key on every one, so that the server decides once.
    expect(keys).toEqual([KEY, KEY, KEY]);
    expect(outcome).toEqual({ kind: 'answered', answer: 'stored answer' });
    expect(rig.sleeps).toEqual([1_000, 2_000]);
  });

  it('uploadPresence_ANetworkErrorThenSuccess_SendsTheSameKeyTwiceAndGivesOneAnswer', async () => {
    const rig = environment();
    const send = vi.fn().mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ result: 'ok' });

    const outcome = await uploadPresence(send, KEY, rig.env);

    expect(send.mock.calls).toEqual([[KEY], [KEY]]);
    expect(outcome.kind).toBe('answered');
    expect(rig.sleeps).toEqual([1_000]);
  });

  it('uploadPresence_ThreeFailuresThenAnAnswer_WaitsOneTwoAndFourSecondsAndSendsFourTimes', async () => {
    const rig = environment();
    const send = vi.fn().mockRejectedValueOnce(networkError()).mockRejectedValueOnce(timeoutError()).mockRejectedValueOnce(httpError(502)).mockResolvedValueOnce('answer');

    const outcome = await uploadPresence(send, KEY, rig.env);

    expect(rig.sleeps).toEqual([1_000, 2_000, 4_000]);
    expect(send).toHaveBeenCalledTimes(4);
    expect(outcome).toEqual({ kind: 'answered', answer: 'answer' });
  });

  it('uploadPresence_EveryTryFails_GivesUpAfterTheFourthWithTheLastError', async () => {
    const rig = environment();
    const last = httpError(503);
    const send = vi.fn().mockRejectedValueOnce(networkError()).mockRejectedValueOnce(networkError()).mockRejectedValueOnce(networkError()).mockRejectedValueOnce(last);

    const outcome = await uploadPresence(send, KEY, rig.env);

    expect(send).toHaveBeenCalledTimes(4);
    expect(rig.sleeps).toEqual([1_000, 2_000, 4_000]);
    expect(outcome).toEqual({ kind: 'gave-up', error: last });
  });

  it.each([
    ['a network error', networkError()],
    ['a request that timed out', timeoutError()],
    ['a request that was aborted', httpError(undefined, AxiosError.ECONNABORTED)],
    ['a 500', httpError(500)],
    ['a 502', httpError(502)],
    ['a 503', httpError(503)],
    ['a 504', httpError(504)],
  ])('uploadPresence_%s_IsTriedAgain', async (_name, error) => {
    const rig = environment();
    const send = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('answer');

    const outcome = await uploadPresence(send, KEY, rig.env);

    expect(send).toHaveBeenCalledTimes(2);
    expect(outcome.kind).toBe('answered');
    expect(isWorthRepeating(error)).toBe(true);
  });

  it.each([
    ['a 400', httpError(400)],
    ['a 401', httpError(401)],
    ['a 404', httpError(404)],
    ['a 409', httpError(409)],
    ['a 413', httpError(413)],
    ['a 422', httpError(422)],
    ['a 429', httpError(429)],
    ['a 501', httpError(501)],
    ['a request the page cancelled', httpError(undefined, AxiosError.ERR_CANCELED)],
    ['an error that is not the network\'s', new TypeError('boom')],
  ])('uploadPresence_%s_IsNeverRepeated', async (_name, error) => {
    const rig = environment();
    const send = vi.fn().mockRejectedValue(error);

    const outcome = await uploadPresence(send, KEY, rig.env);

    expect(send).toHaveBeenCalledTimes(1);
    expect(rig.sleeps).toEqual([]);
    expect(outcome).toEqual({ kind: 'refused', error });
    expect(isWorthRepeating(error)).toBe(false);
  });

  it('isRateLimited_OnlyA429_IsTooManyRequests', () => {
    expect(isRateLimited(httpError(429))).toBe(true);
    expect(isRateLimited(httpError(503))).toBe(false);
    expect(isRateLimited(networkError())).toBe(false);
    expect(isRateLimited(new Error('429'))).toBe(false);
  });
});

describe('presence-upload: a browser that is offline (AC3)', () => {
  it('uploadPresence_TheBrowserIsOffline_SendsNothingUntilTheConnectionIsBack', async () => {
    const rig = environment({ online: false });
    const send = vi.fn().mockResolvedValue('answer');

    const pending = uploadPresence(send, KEY, rig.env);
    await Promise.resolve();
    await Promise.resolve();

    expect(send).not.toHaveBeenCalled();
    expect(rig.waitForOnline).toHaveBeenCalledWith(OFFLINE_WAIT_MS);

    rig.comeBack();
    const outcome = await pending;

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(KEY);
    expect(outcome).toEqual({ kind: 'answered', answer: 'answer' });
  });

  it('uploadPresence_TheConnectionNeverComesBack_GivesUpWithoutSendingAndKeepsTheFramesForAManualRetry', async () => {
    const rig = environment({ online: false });
    const send = vi.fn().mockResolvedValue('answer');

    const pending = uploadPresence(send, KEY, rig.env);
    await Promise.resolve();
    await Promise.resolve();
    rig.giveUpWaiting();
    const outcome = await pending;

    expect(send).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('gave-up');
  });

  it('uploadPresence_TheConnectionDropsBetweenTries_WaitsForItAgainBeforeTheNextTryWithTheSameKey', async () => {
    const rig = environment();
    const send = vi.fn().mockImplementationOnce(async () => {
      rig.connection.online = false;
      throw networkError();
    });
    send.mockResolvedValueOnce('answer');

    const pending = uploadPresence(send, KEY, rig.env);
    await vi.waitFor(() => expect(rig.waitForOnline).toHaveBeenCalledTimes(1));

    expect(send).toHaveBeenCalledTimes(1);
    rig.comeBack();
    const outcome = await pending;

    expect(send.mock.calls).toEqual([[KEY], [KEY]]);
    expect(outcome).toEqual({ kind: 'answered', answer: 'answer' });
  });

  it('uploadPresence_TheConnectionIsGoneAfterATryThatFailed_GivesUpWithThatError', async () => {
    const rig = environment();
    const failure = networkError();
    const send = vi.fn().mockImplementationOnce(async () => {
      rig.connection.online = false;
      throw failure;
    });

    const pending = uploadPresence(send, KEY, rig.env);
    await vi.waitFor(() => expect(rig.waitForOnline).toHaveBeenCalledTimes(1));
    rig.giveUpWaiting();

    expect(await pending).toEqual({ kind: 'gave-up', error: failure });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('presence-upload: the environment of the browser', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'onLine');
  });

  const setOnline = (online: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });

  it('browserEnvironment_TheBrowserSaysItIsOnline_IsOnlineAndWaitsForNothing', async () => {
    setOnline(true);
    const env = browserEnvironment();

    expect(env.isOnline()).toBe(true);
    await expect(env.waitForOnline(OFFLINE_WAIT_MS)).resolves.toBe(true);
  });

  it('browserEnvironment_OfflineThenTheOnlineEvent_ResolvesTrueWithoutWaitingForTheTimeout', async () => {
    setOnline(false);
    const env = browserEnvironment();
    expect(env.isOnline()).toBe(false);

    const waiting = env.waitForOnline(OFFLINE_WAIT_MS);
    await vi.advanceTimersByTimeAsync(5_000);
    setOnline(true);
    window.dispatchEvent(new Event('online'));

    await expect(waiting).resolves.toBe(true);
    // The timer of the wait went with it.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('browserEnvironment_OfflineForTooLong_ResolvesFalseAndLetsGoOfTheListener', async () => {
    setOnline(false);
    const env = browserEnvironment();
    const removeListener = vi.spyOn(window, 'removeEventListener');

    const waiting = env.waitForOnline(OFFLINE_WAIT_MS);
    await vi.advanceTimersByTimeAsync(OFFLINE_WAIT_MS);

    await expect(waiting).resolves.toBe(false);
    expect(removeListener).toHaveBeenCalledWith('online', expect.any(Function));
  });

  it('browserEnvironment_Sleep_ResolvesAfterTheTime', async () => {
    const env = browserEnvironment();
    let slept = false;
    void env.sleep(1_000).then(() => {
      slept = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(slept).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(slept).toBe(true);
  });

  it('browserEnvironment_ABrowserThatDoesNotSayIfItIsOnline_IsTakenAsOnline', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => undefined });

    expect(browserEnvironment().isOnline()).toBe(true);
  });
});

describe('presence-upload: the key of a recording', () => {
  it('newIdempotencyKey_AKey_HasTheShapeTheApiWantsAndEveryCallMakesANewOne', () => {
    const first = newIdempotencyKey();
    const second = newIdempotencyKey();

    expect(first).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(second).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(second).not.toBe(first);
  });

  it('newIdempotencyKey_ABrowserWithoutRandomUUID_MakesThirtyTwoRandomHexadecimalDigits', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.forEach((_byte, index) => {
        bytes[index] = 250 - index;
      });
      return bytes;
    });
    vi.stubGlobal('crypto', { getRandomValues });

    const key = newIdempotencyKey();
    vi.unstubAllGlobals();

    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toBe('faf9f8f7f6f5f4f3f2f1f0efeeedeceb');
  });
});
