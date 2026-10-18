import type { QueryClient } from '@tanstack/react-query';
import { Home } from 'lucide-react';
import { getAccessibleAreas } from '@/config/areas';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { ROUTE_MANIFEST, getDefaultRoute, type AppContextKey, type PermissionPredicate } from '@/config/route-manifest';
import i18n, { type AppLocale } from '@/i18n/config';
import { ORG_BILLING_ADMIN_PERMISSION, isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { contextOf } from '@/test/org-contexts';
import type { CommandContext, CommandItem } from '../types';

/** Every permission the pages of an area ask for, and the one of the organization's billing administrator: a full role. */
export function allPermissions(area: AppContextKey): string[] {
  const permissions = new Set<string>([ORG_BILLING_ADMIN_PERMISSION]);
  for (const entry of ROUTE_MANIFEST.filter((candidate) => candidate.context === area)) {
    entry.requiredPermissions.forEach((permission) => permissions.add(permission));
  }
  return [...permissions].sort();
}

interface ContextOptions {
  /** The areas the user has. Default: short rent only. */
  areas?: AppContextKey[];
  /** The area of the page that is open. Default: the first area. */
  activeArea?: AppContextKey;
  /** The permissions the user has in each area. Default: all of them. */
  permissions?: (area: AppContextKey) => string[];
  /** Replaces the whole test of permissions. */
  hasPermission?: PermissionPredicate;
  flags?: Partial<FeatureFlags>;
  locale?: AppLocale;
  queryClient?: QueryClient | null;
  supportEmail?: string | null;
  actions?: Partial<CommandContext['actions']>;
}

/** A context for the sources of the palette, built the way the workspace of the app answers the same questions. */
export function makeContext(options: ContextOptions = {}): CommandContext {
  const areas = options.areas ?? ['short-rent'];
  const locale = options.locale ?? 'it';
  const contexts = areas.map((area) => contextOf(area, undefined, (options.permissions ?? allPermissions)(area)));

  const hasPermission: PermissionPredicate =
    options.hasPermission ??
    ((area, permission) => {
      const found = contexts.find((candidate) => candidate.contextKey === area);
      if (!found) return false;
      if (!permission) return true;
      if (permission === ORG_BILLING_ADMIN_PERMISSION) return isOrgBillingAdmin(contexts);
      return found.permissions.includes(permission);
    });

  return {
    t: i18n.getFixedT(locale),
    locale,
    activeArea: options.activeArea ?? areas[0],
    areas: getAccessibleAreas(contexts),
    hasPermission,
    flags: { ...DEFAULT_FEATURE_FLAGS, ...options.flags },
    getDefaultRoute: (area) => contexts.find((candidate) => candidate.contextKey === area)?.defaultRoute ?? getDefaultRoute(area),
    queryClient: options.queryClient ?? null,
    supportEmail: options.supportEmail ?? null,
    actions: {
      changeLocale: () => undefined,
      signOut: () => undefined,
      writeToSupport: () => undefined,
      ...options.actions,
    },
  };
}

/** A page-like item for the tests of the search and of the palette. */
export function item(id: string, label: string, extra: Partial<CommandItem> = {}): CommandItem {
  return { id, kind: 'page', label, icon: Home, to: `/app/${id}`, ...extra } as CommandItem;
}
