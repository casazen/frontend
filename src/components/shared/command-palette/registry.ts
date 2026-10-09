import { useEffect, useSyncExternalStore } from 'react';
import type { CommandSource } from './types';

/**
 * The commands a feature adds to the palette (UI-06). The menus, the actions and the objects in the cache are built in; a
 * help centre, a notifications drawer or a page with commands of its own register a source here when they are on the
 * screen and take it away when they leave, and the palette picks them up the next time it opens. No feature has to be
 * known by the palette, and the palette is not passed anything down the tree.
 */
const sources = new Map<string, CommandSource>();
const listeners = new Set<() => void>();
const NONE: readonly CommandSource[] = [];
let snapshot: readonly CommandSource[] = NONE;

function publish() {
  snapshot = sources.size === 0 ? NONE : [...sources.values()];
  listeners.forEach((listener) => listener());
}

/** Adds `source` to the palette until the returned function is called. A source with the same `id` takes the place of the old one. */
export function registerCommands(source: CommandSource): () => void {
  sources.set(source.id, source);
  publish();
  return () => {
    // Only if it is still this source: the one that replaced it is not taken away.
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

/** The sources registered so far (the palette reads them). */
export function useRegisteredCommandSources(): readonly CommandSource[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => NONE,
  );
}

/**
 * Registers `source` while the component that calls it is on the screen. `source` must not change at every render: define
 * it outside the component, or memoize it.
 */
export function useRegisterCommands(source: CommandSource): void {
  useEffect(() => registerCommands(source), [source]);
}
