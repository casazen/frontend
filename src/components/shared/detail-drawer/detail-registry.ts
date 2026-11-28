import type { ComponentType } from 'react';
import { isValidDetailKind } from '@/lib/detail-address';

export interface DetailContentProps {
  id: string;
  close: () => void;
}

export interface DetailTitleProps {
  id: string;
}

export type DetailWidth = 'default' | 'wide';

export interface DetailDef {
  /**
   * What names the drawer. A string is a key of the locale files (the drawer translates it); a component draws the text
   * itself, for a name that comes with the data (the guest of a booking): it can ask for the same query as `Content`, which
   * TanStack Query shares. Until the data is there it shows a generic name, never an empty one.
   */
  title: string | ComponentType<DetailTitleProps>;
  Content: ComponentType<DetailContentProps>;
  width?: DetailWidth;
  pageHref?: (id: string) => string | undefined;
}

const definitions = new Map<string, DetailDef>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version += 1;
  for (const listener of [...listeners]) listener();
}

export function registerDetail(kind: string, def: DetailDef): () => void {
  if (!isValidDetailKind(kind)) {
    throw new Error(`registerDetail: the kind "${kind}" must be a lowercase word (letters, digits and "-", starting with a letter, 32 at most)`);
  }
  definitions.set(kind, def);
  changed();
  return () => {
    if (definitions.get(kind) !== def) return;
    definitions.delete(kind);
    changed();
  };
}

export function getDetail(kind: string): DetailDef | undefined {
  return definitions.get(kind);
}

let hosts = 0;

export function registerHost(): () => void {
  hosts += 1;
  if (import.meta.env.DEV && hosts > 1) console.error('DetailDrawerHost is mounted more than once: the one host of the app is in AppShellLayout.');
  return () => {
    hosts -= 1;
  };
}

export function isHostMounted(): boolean {
  return hosts > 0;
}

export function subscribeToDetails(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDetailsVersion(): number {
  return version;
}
