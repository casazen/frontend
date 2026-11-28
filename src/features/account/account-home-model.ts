import type { CalmTone } from '@/components/shared/calm';
import {
  getManifestEntry,
  hasEntryPermission,
  type AppContextKey,
  type PermissionPredicate,
  type RouteManifestEntry,
} from '@/config/route-manifest';
import type { OrgOverview } from '@/types/org-team.types';

export const ACCOUNT_PROFILE_PATH = '/app/account/profile';

export const ACCOUNT_PEOPLE_PATH = '/app/account/people';
export const ACCOUNT_PROPERTIES_PATH = '/app/account/properties';
export const ACCOUNT_INTEGRATIONS_PATH = '/app/account/integrations';
export const ACCOUNT_ACTIVITY_PATH = '/app/account/security';

export type HomeItemKind = 'billing' | 'invitations' | 'properties' | 'alloggiati';

export interface HomeItem {
  kind: HomeItemKind;
  tone: CalmTone;
  count: number;
  days: number | null;
  destinations: readonly string[];
}

/**
 * The things that need a look, from the overview and nothing else: a failed payment of the plan, invitations nobody has accepted, short-term
 * properties that cannot receive bookings yet, properties without Alloggiati Web credentials. The overview leaves out a section the
 * person has no permission for, so what it does not say is not an item. The queue of the requests for access and the trusted suppliers
 * are not here: they come with their own tasks (the overview counts 0 for both until then).
 */
export function buildHomeItems(overview: OrgOverview): HomeItem[] {
  const items: HomeItem[] = [];
  if (overview.standing === 'attention') {
    items.push({ kind: 'billing', tone: 'warning', count: 0, days: null, destinations: [] });
  }

  const pending = overview.invitations?.pending ?? 0;
  if (pending > 0) {
    items.push({ kind: 'invitations', tone: 'info', count: pending, days: overview.invitations?.oldestPendingDays ?? null, destinations: [ACCOUNT_PEOPLE_PATH] });
  }

  const toComplete = overview.properties?.toComplete ?? 0;
  if (toComplete > 0) {
    items.push({ kind: 'properties', tone: 'warning', count: toComplete, days: null, destinations: [ACCOUNT_PROPERTIES_PATH, '/app/short-rent/properties'] });
  }

  const withoutCredentials = overview.alloggiati?.propertiesWithoutCredentials ?? 0;
  if (withoutCredentials > 0) {
    items.push({ kind: 'alloggiati', tone: 'info', count: withoutCredentials, days: null, destinations: [ACCOUNT_INTEGRATIONS_PATH] });
  }

  return items;
}

export interface Reach {
  contexts: readonly { contextKey: AppContextKey }[];
  hasPermission: PermissionPredicate;
}

export function reachableEntry(paths: readonly string[], { contexts, hasPermission }: Reach): RouteManifestEntry | undefined {
  for (const path of paths) {
    const entry = getManifestEntry(path);
    if (entry && contexts.some((context) => context.contextKey === entry.context) && hasEntryPermission(entry, hasPermission)) return entry;
  }
  return undefined;
}

export function activePeople(overview: OrgOverview): number | null {
  if (!overview.seats) return null;
  return Math.max(overview.seats.used - (overview.invitations?.pending ?? 0), 0);
}
