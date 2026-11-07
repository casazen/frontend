import { describe, expect, it } from 'vitest';
import { NOTIFICATION_PREFERENCES_PATH } from '@/features/profile/notification-preferences-model';
import { NAV_ICONS } from '@/lib/nav-icons';
import { profilePathForContext } from '@/lib/profile-path';
import {
  ROUTE_MANIFEST,
  getNavChildren,
  getNavMatchEntries,
  getNavSection,
  getSecondaryNavEntries,
  getVisibleNavEntries,
  hasEntryPermission,
  type PermissionPredicate,
  type RouteManifestEntry,
} from '../route-manifest';

const PROFILE = '/app/short-rent/profile';
const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === NOTIFICATION_PREFERENCES_PATH);

const allowAll: PermissionPredicate = () => true;
/** A user who holds no permission at all. */
const nothing: PermissionPredicate = (_context, permission) => !permission;
const paths = (entries: RouteManifestEntry[]) => entries.map((page) => page.path);

describe('route manifest: Notifiche, the second tab of the profile (E05/F03/US02/T01)', () => {
  it('RouteManifest_Notifications_IsAPageOfShortRentThatAsksNoPermission', () => {
    expect(entry?.path).toBe('/app/short-rent/profile/notifications');
    expect(entry?.context).toBe('short-rent');
    // The settings are the user's own: even a user who holds no permission reaches them.
    expect(entry?.requiredPermissions).toEqual([]);
    expect(entry && hasEntryPermission(entry, nothing)).toBe(true);
    expect(entry?.featureFlag).toBeUndefined();
  });

  it('RouteManifest_Notifications_HangsFromTheProfileWithTheNameAndTheIconOfATab', () => {
    expect(entry?.navKey).toBe('nav.notificationPreferences');
    expect(entry?.navParent).toBe(PROFILE);
    expect(NAV_ICONS[entry?.icon ?? '']).toBeDefined();
    // It hangs from the page the menu of the user leads to, which is in no menu.
    expect(profilePathForContext('short-rent')).toBe(PROFILE);
    expect(ROUTE_MANIFEST.find((candidate) => candidate.path === PROFILE)?.navPlacement).toBeUndefined();
  });

  it('RouteManifest_Notifications_IsTheSecondTabOfTheProfileForEveryUser', () => {
    for (const hasPermission of [allowAll, nothing]) {
      expect(paths(getNavChildren(PROFILE, hasPermission))).toEqual([NOTIFICATION_PREFERENCES_PATH]);
      // The same strip on both pages: the profile first.
      expect(paths(getNavSection(PROFILE, hasPermission))).toEqual([PROFILE, NOTIFICATION_PREFERENCES_PATH]);
      expect(paths(getNavSection(NOTIFICATION_PREFERENCES_PATH, hasPermission))).toEqual([PROFILE, NOTIFICATION_PREFERENCES_PATH]);
    }
  });

  it('RouteManifest_Notifications_IsInNoMenuNotEvenInAltroAndNotAmongTheDestinationsOfTheMenu', () => {
    for (const hasPermission of [allowAll, nothing]) {
      expect(paths(getVisibleNavEntries('short-rent', hasPermission))).not.toContain(NOTIFICATION_PREFERENCES_PATH);
      expect(paths(getSecondaryNavEntries('short-rent', hasPermission))).not.toContain(NOTIFICATION_PREFERENCES_PATH);
      // What the palette and the highlight of the menu read: the profile and its tabs are not in it either.
      expect(paths(getNavMatchEntries('short-rent', hasPermission))).not.toContain(NOTIFICATION_PREFERENCES_PATH);
    }
  });

  it('RouteManifest_Notifications_ExistsOnlyInShortRentAndOtherAreasKeepTheirProfileWithoutTabs', () => {
    expect(ROUTE_MANIFEST.filter((candidate) => candidate.path.endsWith('/profile/notifications')).map((page) => page.path)).toEqual([
      NOTIFICATION_PREFERENCES_PATH,
    ]);
    for (const context of ['long-rent', 'supplier', 'admin', 'account'] as const) {
      expect(getNavChildren(profilePathForContext(context), allowAll)).toEqual([]);
    }
  });

  it('RouteManifest_Notifications_LoadsAPageThatIsAComponent', async () => {
    const page = await entry?.component();

    expect(typeof page?.default).toBe('function');
  });
});
