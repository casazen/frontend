import { useEffect, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { CommandItem, RemoteCommandSource } from './types';

const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_MIN_CHARS = 2;
const NO_ITEMS: CommandItem[] = [];

export interface RemoteCommands {
  /** What the server search answered for the text now in the box (nothing while it has not answered). */
  items: CommandItem[];
  /** The text is long enough and has no answer yet: the palette is waiting. */
  pending: boolean;
}

/**
 * The server search behind the palette (UI-13): the hook of the design, switched off today. Without a `source` it does nothing
 * at all: no timer is waited for and no request is made. With one (a stable object: a new one at every render would ask
 * again at every render), it waits for the person to stop typing, asks once for the text, cancels the request when the text
 * changes or the palette closes, and shows only the answer to the text that is in the box now. A source that fails is the
 * same as one that finds nothing: the local results are all there is.
 */
export function useRemoteCommands(query: string, source: RemoteCommandSource | undefined): RemoteCommands {
  const text = query.trim();
  const delay = source?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const minChars = source?.minChars ?? DEFAULT_MIN_CHARS;
  const settled = useDebouncedValue(source ? text : '', delay);
  const toAsk = source && settled.length >= minChars ? settled : null;

  // The answer carries the text it answers: one that arrives for another text is not shown.
  const [answer, setAnswer] = useState<{ query: string; items: CommandItem[] } | null>(null);

  useEffect(() => {
    if (!source || toAsk === null) return undefined;
    const controller = new AbortController();
    source.search(toAsk, { signal: controller.signal }).then(
      (items) => {
        if (!controller.signal.aborted) setAnswer({ query: toAsk, items });
      },
      () => {
        if (!controller.signal.aborted) setAnswer({ query: toAsk, items: NO_ITEMS });
      },
    );
    return () => controller.abort();
  }, [source, toAsk]);

  const eligible = source !== undefined && text.length >= minChars;
  const answered = eligible && answer?.query === text;
  return { items: answered ? answer.items : NO_ITEMS, pending: eligible && !answered };
}
