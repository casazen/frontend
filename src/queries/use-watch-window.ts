import { useState } from 'react';
import { useNow } from '@/hooks/use-now';

/**
 * The window in which a page follows by itself what waits for an answer (a change sent to the channel manager, a document waiting for the SDI, a link waiting to be opened).
 * `since` is when the window opened, `over` tells that `watchMs` have passed, `restart` opens it again and `now` is the time as of the last tick (every `pollMs`), kept in the state
 * of the screen so that nothing reads the clock while it renders.
 */
export function useWatchWindow(pollMs: number, watchMs: number) {
  const [since, setSince] = useState(() => Date.now());
  const now = useNow(pollMs);
  return { since, now, setSince, over: now - since >= watchMs, restart: () => setSince(Date.now()) };
}

/**
 * Opens the window again when something that was not waiting starts to wait: a new one appears or a failed one is sent again. Without it the window would run from the opening of
 * the page, and what is sent after the window is long over would be told at once as "no answer yet" and never followed. The state is adjusted while rendering, as React lets a value
 * that follows from what the screen reads (here the ids that wait) be.
 */
export function useRestartOnNewWaiting(watch: Pick<ReturnType<typeof useWatchWindow>, 'now' | 'setSince'>, waitingIds: readonly string[]) {
  const [known, setKnown] = useState<readonly string[]>([]);
  const { now, setSince } = watch;
  if (waitingIds.some((id) => !known.includes(id))) {
    setKnown(waitingIds);
    setSince(now);
  } else if (waitingIds.length < known.length) {
    setKnown(waitingIds);
  }
}
