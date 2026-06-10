import type { TFunction } from 'i18next';
import type { RouteManifestEntry } from '@/config/route-manifest';

export function getNavLabel(entry: RouteManifestEntry, t: TFunction): string {
  if (entry.navKey) {
    return t(entry.navKey);
  }
  return entry.navLabel ?? entry.path;
}

export function getNavGroupLabel(group: string, t: TFunction): string {
  return t(`nav.group.${group}`);
}
