import type { ComponentType } from 'react';
import { isValidDetailKind } from '@/lib/detail-address';

/** What the inside of a drawer is given. */
export interface DetailContentProps {
  /** The id of the thing to show, as the address holds it (checked: see `lib/detail-address`). */
  id: string;
  /** Closes the drawer. The drawer owns the address: a content never writes `?detail=` itself. */
  close: () => void;
}

export interface DetailTitleProps {
  id: string;
}

/** `default` is a panel of 36rem on a screen with room; `wide` one of 42rem. On a phone both are the full width. */
export type DetailWidth = 'default' | 'wide';

/** How one kind of thing is shown in the drawer. */
export interface DetailDef {
  /**
   * What names the drawer. A string is a key of the locale files (the drawer translates it); a component draws the text
   * itself, for a name that comes with the data (the guest of a booking): it can ask for the same query as `Content`, which
   * TanStack Query shares. Until the data is there it shows a generic name, never an empty one.
   */
  title: string | ComponentType<DetailTitleProps>;
  /** The inside of the drawer. It loads its own data with TanStack Query and may be a `lazy` component. */
  Content: ComponentType<DetailContentProps>;
  /** Default: `default`. */
  width?: DetailWidth;
  /** The page of the thing, when there is one: the drawer offers "Apri la scheda completa" in its foot. */
  pageHref?: (id: string) => string | undefined;
}

const definitions = new Map<string, DetailDef>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version += 1;
  for (const listener of [...listeners]) listener();
}

/**
 * Says how a kind of thing is shown in the drawer (UI-15): `registerDetail('booking', { title, Content })`, once, at the top
 * of the module of that feature. The kind is a lowercase word; it is what the address holds (`?detail=booking:…`). A kind that
 * is registered again replaces the first (a hot reload runs the module twice). Returns the function that takes it away again,
 * for a test or a page that registers only while it is there.
 */
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

/** The definition of a kind, or undefined if nothing registered it. */
export function getDetail(kind: string): DetailDef | undefined {
  return definitions.get(kind);
}

let hosts = 0;

/**
 * The host of the drawer says it is on the page. `open` needs one to show anything: on a route outside the shell (a public
 * page) it would only add a history entry that nothing draws. A second host would draw every drawer twice, so it is said loudly.
 */
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

/** For `useSyncExternalStore`: a kind that registers after the first render (a chunk that loaded later) is picked up. */
export function subscribeToDetails(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDetailsVersion(): number {
  return version;
}
