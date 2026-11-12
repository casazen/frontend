import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

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
  /** This visit has run something (it worked or it failed): what a step that goes on by itself waits for, so that a visit that only finds the work done does not jump forward. */
  ran: boolean;
}

/**
 * One run for each item, in turn (E09/F02/US04: with several properties the wizard activates each one in its turn). It starts by itself, once for each item:
 * the first one that is not done and was not tried, and the next when that one has ended, whether it worked or not (a refusal of one property does not stop the
 * others). Whatever failed stays in `failures` until `retry` asks again; an item is never run twice by itself, so a step that is left and come back to does
 * not repeat what the server already did.
 *
 * The runs go through one mutation, so that `running` and the moment a run ends are what React Query says (nothing is set while the effect runs).
 */
export function useSequentialRun({ ids, ready, isDone, run }: SequentialRunOptions): SequentialRun {
  const tried = useRef(new Set<string>());
  const [failures, setFailures] = useState<ReadonlyMap<string, unknown>>(() => new Map());
  const [ran, setRan] = useState(false);
  const { mutate, isPending, variables } = useMutation({
    mutationFn: run,
    onError: (error, id) => setFailures((previous) => new Map(previous).set(id, error)),
    onSettled: () => setRan(true),
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
    setFailures((previous) => {
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  };

  return { running: isPending ? (variables ?? null) : null, failures, retry, ran };
}
