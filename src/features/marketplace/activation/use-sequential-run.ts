import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, isAxiosError, type InternalAxiosRequestConfig } from 'axios';

/**
 * The failure of a call without the request that failed. An error of axios holds the body that was sent (`config.data`), and the body of the start of an activation holds
 * the username and the password of the portal: whatever keeps the error (the state of a step, the cache of the mutations) would keep them. What a screen needs of a failure
 * stays (the status, the code and the body of the answer, which it turns into words); the request does not. An error that is not one of axios is given back as it is.
 */
export function withoutRequest(error: unknown): unknown {
  if (!isAxiosError(error)) return error;
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const { response } = error;

  return new AxiosError(
    error.message,
    error.code,
    config,
    undefined,
    response ? { status: response.status, statusText: response.statusText, headers: {}, config, data: response.data } : undefined,
  );
}

interface SequentialRunOptions {
  /** The items, in the order they are done: the properties the person chose. */
  ids: readonly string[];
  /** Nothing starts before what the runs depend on has been read. */
  ready: boolean;
  /** The item needs no run (the server already has it, or it cannot be run now): it is skipped. */
  isDone: (id: string) => boolean;
  /** Does the work of one item. A rejection is the failure of that item only. */
  run: (id: string) => Promise<unknown>;
}

interface SequentialRun {
  /** The item being worked on now, or `null`. */
  running: string | null;
  /** The items whose run failed, with what failed: they are not run again by themselves. */
  failures: ReadonlyMap<string, unknown>;
  /** Runs a failed item once more (and, after it, the ones that wait). */
  retry: (id: string) => void;
  /** The items whose run has ended in this visit, whether it worked or not: what tells «not yet tried» from «tried, and the server does not show it». */
  settled: ReadonlySet<string>;
  /** This visit has run something (it worked or it failed): what a step that goes on by itself waits for, so that a visit that only finds the work done does not jump forward. */
  ran: boolean;
}

/**
 * One run for each item, in turn (E09/F02/US04: with several properties the wizard activates each one in its turn). It starts by itself, once for each item:
 * the first one that is not done and was not tried, and the next when that one has ended, whether it worked or not (a refusal of one property does not stop the
 * others). Whatever failed stays in `failures` until `retry` asks again; an item is never run twice by itself, so a step that is left and come back to does
 * not repeat what the server already did.
 *
 * The runs go through one mutation, so that `running` and the moment a run ends are what React Query says (nothing is set while the effect runs). A run may carry the
 * access data of a portal (the start of an activation), so what the mutation keeps of a failure is the failure without its request (`withoutRequest`), and the
 * mutation itself is dropped as soon as nothing watches it (`gcTime: 0`): neither the cache of the mutations nor the state of the step holds what was typed.
 */
export function useSequentialRun({ ids, ready, isDone, run }: SequentialRunOptions): SequentialRun {
  const tried = useRef(new Set<string>());
  const [failures, setFailures] = useState<ReadonlyMap<string, unknown>>(() => new Map());
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set());
  const { mutate, isPending, variables } = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await run(id);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onError: (error, id) => setFailures((previous) => new Map(previous).set(id, error)),
    onSettled: (_data, _error, id) => setSettled((previous) => new Set(previous).add(id)),
  });

  useEffect(() => {
    if (!ready || isPending) return;
    const next = ids.find((id) => !tried.current.has(id) && !isDone(id));
    if (next === undefined) return;
    tried.current.add(next);
    mutate(next);
  }, [ids, ready, isPending, isDone, mutate]);

  const retry = (id: string) => {
    tried.current.delete(id);
    setSettled((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    setFailures((previous) => {
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  };

  return { running: isPending ? (variables ?? null) : null, failures, retry, settled, ran: settled.size > 0 };
}
