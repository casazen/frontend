import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, isAxiosError, type InternalAxiosRequestConfig } from 'axios';

export function withoutRequest(error: unknown): unknown {
  if (!isAxiosError(error)) return error;
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  if (error.config?.public !== undefined) config.public = error.config.public;
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
  ids: readonly string[];
  ready: boolean;
  isDone: (id: string) => boolean;
  run: (id: string) => Promise<unknown>;
}

interface SequentialRun {
  running: string | null;
  failures: ReadonlyMap<string, unknown>;
  retry: (id: string) => void;
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
