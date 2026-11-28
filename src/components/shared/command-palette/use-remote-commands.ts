import { useEffect, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { CommandItem, RemoteCommandSource } from './types';

const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_MIN_CHARS = 2;
const NO_ITEMS: CommandItem[] = [];

export interface RemoteCommands {
  items: CommandItem[];
  pending: boolean;
}

export function useRemoteCommands(query: string, source: RemoteCommandSource | undefined): RemoteCommands {
  const text = query.trim();
  const delay = source?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const minChars = source?.minChars ?? DEFAULT_MIN_CHARS;
  const settled = useDebouncedValue(source ? text : '', delay);
  const toAsk = source && settled.length >= minChars ? settled : null;

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
