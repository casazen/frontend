import type { TFunction } from 'i18next';
import type { NavCountKey, NavGroup, RouteManifestEntry } from '@/config/route-manifest';

export function getNavLabel(entry: RouteManifestEntry, t: TFunction): string {
  if (entry.navKey) {
    return t(entry.navKey);
  }
  return entry.navLabel ?? entry.path;
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
};

export function getNavGroupLabel(group: NavGroup, t: TFunction): string {
  return t(NAV_GROUP_LABELS[group].labelKey);
}

const NAV_COUNT_LABELS: Record<NavCountKey, { labelKey: string }> = {
  bookingRequests: { labelKey: 'nav.count.bookingRequests' },
  supplierRequests: { labelKey: 'nav.count.supplierRequests' },
};

/** What a screen reader says for the counter of an entry, e.g. "2 richieste da approvare". */
export function getNavCountLabel(key: NavCountKey, count: number, t: TFunction): string {
  return t(NAV_COUNT_LABELS[key].labelKey, { count });
}
