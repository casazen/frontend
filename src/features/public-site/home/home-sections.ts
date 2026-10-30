import { useSyncExternalStore } from 'react';

/**
 * The sections of the home that exist now (DB-07b), told by the page to the header. The header of the booking site is drawn by the
 * shell, above whatever page is open, and a link to a section that this site does not have (no zones, say) would lead nowhere: the
 * home publishes the ids of the sections it drew and takes them back when it goes, and the header links only those. It is a
 * module-level store because the page and the header are not parent and child.
 */
export type HomeSectionId = 'case' | 'perche' | 'zone' | 'domande';

/** In the order they are on the page. */
export const HOME_SECTION_IDS: readonly HomeSectionId[] = ['case', 'perche', 'zone', 'domande'];

let published: readonly HomeSectionId[] = [];
const listeners = new Set<() => void>();

export function publishHomeSections(next: readonly HomeSectionId[]): void {
  if (next.length === published.length && next.every((id, index) => id === published[index])) return;
  published = next;
  for (const listener of listeners) listener();
}

export function useHomeSections(): readonly HomeSectionId[] {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => published,
    () => published,
  );
}

export function isHomeSectionId(value: string | null | undefined): value is HomeSectionId {
  return (HOME_SECTION_IDS as readonly string[]).includes(value ?? '');
}
