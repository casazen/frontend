import { createElement } from 'react';
import { getNavIcon } from '@/lib/nav-icons';

/**
 * The icon of a menu entry or of an area, by the name used in the route manifest and in `config/areas.ts`.
 * `getNavIcon` hands back one of the icons of a fixed table, never a new component, so it is safe to use as an element
 * type; `createElement` says so to the linter that cannot know it.
 */
export function NavIcon({ name, className }: { name?: string; className?: string }) {
  return createElement(getNavIcon(name), { className, 'aria-hidden': true });
}
