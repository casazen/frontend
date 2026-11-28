import type { TFunction } from 'i18next';
import type { NavCountKey, NavGroup, RouteManifestEntry } from '@/config/route-manifest';

export function getNavLabel(entry: RouteManifestEntry, t: TFunction): string {
  if (entry.navKey) {
    return t(entry.navKey);
  }
  return entry.navLabel ?? entry.path;
}

/**
 * The name of an entry on the tabs of its section: the name of the page (`navTabKey`) when the menu names the whole section («Impostazioni»
 * in the menu, «Organizzazione» on the tab), otherwise the name of the menu.
 */
export function getNavTabLabel(entry: RouteManifestEntry, t: TFunction): string {
  return entry.navTabKey ? t(entry.navTabKey) : getNavLabel(entry, t);
}

export function getNavBarLabel(entry: RouteManifestEntry, t: TFunction): string | null {
  return entry.navBarKey && !entry.navCount ? t(entry.navBarKey) : null;
}

// The keys are written out (`*Key:` properties) so that the i18n test finds a missing translation.
const NAV_GROUP_LABELS: Record<NavGroup, { labelKey: string }> = {
  everyday: { labelKey: 'nav.group.everyday' },
  offer: { labelKey: 'nav.group.offer' },
  management: { labelKey: 'nav.group.management' },
  portfolio: { labelKey: 'nav.group.portfolio' },
  work: { labelKey: 'nav.group.work' },
  activity: { labelKey: 'nav.group.activity' },
  platform: { labelKey: 'nav.group.platform' },
  account: { labelKey: 'nav.group.account' },
  owners: { labelKey: 'nav.group.owners' },
  support: { labelKey: 'nav.group.support' },
  content: { labelKey: 'nav.group.content' },
  system: { labelKey: 'nav.group.system' },
};

export function getNavGroupLabel(group: NavGroup, t: TFunction): string {
  return t(NAV_GROUP_LABELS[group].labelKey);
}

const NAV_COUNT_LABELS: Record<NavCountKey, { labelKey: string }> = {
  bookingRequests: { labelKey: 'nav.count.bookingRequests' },
  supplierRequests: { labelKey: 'nav.count.supplierRequests' },
  compliance: { labelKey: 'nav.count.compliance' },
  activities: { labelKey: 'nav.count.activities' },
  messages: { labelKey: 'nav.count.messages' },
};

export function getNavCountLabel(key: NavCountKey, count: number, t: TFunction): string {
  return t(NAV_COUNT_LABELS[key].labelKey, { count });
}
