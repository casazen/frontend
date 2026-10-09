import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { CommandItem, RemoteCommandSource } from '../types';
import { useRemoteCommands } from '../use-remote-commands';
import { item } from './test-context';

interface Call {
  query: string;
  signal: AbortSignal;
  resolve: (items: CommandItem[]) => void;
  reject: (error: Error) => void;
}

/** A server search that the test answers by hand, call by call. */
function fakeSource(extra: Partial<RemoteCommandSource> = {}) {
  const calls: Call[] = [];
  const source: RemoteCommandSource = {
    search: (query, { signal }) =>
      new Promise<CommandItem[]>((resolve, reject) => {
        calls.push({ query, signal, resolve, reject });
      }),
    ...extra,
  };
  return { source, calls };
}

function typing(initial: string, source?: RemoteCommandSource) {
  return renderHook(({ query }) => useRemoteCommands(query, source), { initialProps: { query: initial } });
}

const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('useRemoteCommands: the hook of the server search (UI-06, UI-13)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('UseRemoteCommands_NoSource_NeverAsksAnythingAndNeverWaits', async () => {
    const view = typing('mario');

    await flush(5_000);
    view.rerender({ query: 'mario rossi' });
    await flush(5_000);

    expect(view.result.current).toEqual({ items: [], pending: false });
  });

  it('UseRemoteCommands_Source_WaitsForThePersonToStopTypingAndAsksOnceForTheLastText', async () => {
    const { source, calls } = fakeSource();
    const view = typing('', source);

    view.rerender({ query: 'ma' });
    await flush(100);
    view.rerender({ query: 'mar' });
    await flush(100);
    view.rerender({ query: 'mario' });
    expect(calls).toHaveLength(0);

    await flush(250);

    expect(calls.map((call) => call.query)).toEqual(['mario']);
    expect(view.result.current.pending).toBe(true);
  });

  it('UseRemoteCommands_TooFewCharacters_DoNotAskForAnything', async () => {
    const { source, calls } = fakeSource();
    const view = typing('m', source);

    await flush(1_000);
    expect(calls).toHaveLength(0);
    expect(view.result.current.pending).toBe(false);

    view.rerender({ query: 'ma' });
    await flush(250);
    expect(calls).toHaveLength(1);
  });

  it('UseRemoteCommands_TheSourceChoosesItsOwnDelayAndMinimum', async () => {
    const { source, calls } = fakeSource({ debounceMs: 600, minChars: 4 });
    const view = typing('mar', source);

    await flush(2_000);
    expect(calls).toHaveLength(0);

    view.rerender({ query: 'mari' });
    await flush(500);
    expect(calls).toHaveLength(0);
    await flush(100);
    expect(calls.map((call) => call.query)).toEqual(['mari']);
  });

  it('UseRemoteCommands_Answer_ShowsForTheTextItAnswersAndStopsBeingPending', async () => {
    const { source, calls } = fakeSource();
    const view = typing('mario', source);
    await flush(250);

    const found = item('guest:1', 'Mario Rossi', { kind: 'guest' });
    await act(async () => calls[0].resolve([found]));

    expect(view.result.current).toEqual({ items: [found], pending: false });
  });

  it('UseRemoteCommands_TextThatChanged_CancelsTheRequestAndDropsTheAnswerThatComesLate', async () => {
    const { source, calls } = fakeSource();
    const view = typing('mario', source);
    await flush(250);
    const first = calls[0];

    view.rerender({ query: 'maria' });
    await flush(250);
    expect(first.signal.aborted).toBe(true);
    expect(calls).toHaveLength(2);

    // The old request answers anyway: what it says is not for this text.
    await act(async () => first.resolve([item('guest:old', 'Mario Verdi', { kind: 'guest' })]));
    expect(view.result.current.items).toEqual([]);
    expect(view.result.current.pending).toBe(true);

    const found = item('guest:2', 'Maria Neri', { kind: 'guest' });
    await act(async () => calls[1].resolve([found]));
    expect(view.result.current.items).toEqual([found]);
  });

  it('UseRemoteCommands_AnAnswerForAnEarlierText_IsNotShownWhileTheNewTextIsStillBeingTyped', async () => {
    const { source, calls } = fakeSource();
    const view = typing('mario', source);
    await flush(250);
    await act(async () => calls[0].resolve([item('guest:1', 'Mario Rossi', { kind: 'guest' })]));
    expect(view.result.current.items).toHaveLength(1);

    view.rerender({ query: 'mario r' });

    expect(view.result.current.items).toEqual([]);
  });

  it('UseRemoteCommands_FailingSearch_IsTheSameAsOneThatFindsNothing', async () => {
    const { source, calls } = fakeSource();
    const view = typing('mario', source);
    await flush(250);

    await act(async () => calls[0].reject(new Error('503')));

    expect(view.result.current).toEqual({ items: [], pending: false });
  });

  it('UseRemoteCommands_PaletteThatCloses_CancelsTheRequestInFlight', async () => {
    const { source, calls } = fakeSource();
    const view = typing('mario', source);
    await flush(250);

    view.unmount();

    expect(calls[0].signal.aborted).toBe(true);
  });
});
