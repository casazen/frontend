import {
  getManifestEntry,
  hasEntryPermission,
  isEntryFeatureEnabled,
  type RouteManifestEntry,
} from '@/config/route-manifest';
import type { CommandContext } from '../types';

/**
 * The page of the app at `pattern` (a path of the route manifest, `:id` included) when this user may open it, otherwise
 * `undefined`. It is the question the menus ask of each of their entries and the route guard asks of each page: the user has
 * the area, has the permissions of the page (and the one of the organization's billing administrator when it needs it) and
 * the feature flag of the page is on. A source of the palette offers a destination only when this says yes, so the palette
 * never shows what the menu would not.
 */
export function openablePage(context: CommandContext, pattern: string): RouteManifestEntry | undefined {
  const entry = getManifestEntry(pattern);
  if (!entry) return undefined;
  if (!context.areas.some((area) => area.key === entry.context)) return undefined;
  if (!hasEntryPermission(entry, context.hasPermission)) return undefined;
  return isEntryFeatureEnabled(entry, context.flags) ? entry : undefined;
}

/** The path of a page of the manifest with its `:id` filled in. */
export function pathWithId(pattern: string, id: string): string {
  return pattern.replace(':id', encodeURIComponent(id));
}

/** The words after `|` in a translated list of keywords ("oggi|home|panoramica"), trimmed, without the empty ones. */
export function splitKeywords(text: string): string[] {
  return text
    .split('|')
    .map((word) => word.trim())
    .filter(Boolean);
}
