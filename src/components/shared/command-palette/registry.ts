import { useEffect, useSyncExternalStore } from 'react';
import type { CommandSource } from './types';

const sources = new Map<string, CommandSource>();
const listeners = new Set<() => void>();
const NONE: readonly CommandSource[] = [];
let snapshot: readonly CommandSource[] = NONE;

function publish() {
  snapshot = sources.size === 0 ? NONE : [...sources.values()];
  listeners.forEach((listener) => listener());
}

export function registerCommands(source: CommandSource): () => void {
  sources.set(source.id, source);
  publish();
  return () => {
    if (sources.get(source.id) === source) {
      sources.delete(source.id);
      publish();
    }
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRegisteredCommandSources(): readonly CommandSource[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => NONE,
  );
}

export function useRegisterCommands(source: CommandSource): void {
  useEffect(() => registerCommands(source), [source]);
}
