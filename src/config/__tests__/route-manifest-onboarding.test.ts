import { describe, expect, it } from 'vitest';
import { NAV_ICONS } from '@/lib/nav-icons';
import { ONBOARDING_PLAN_PATH } from '@/lib/onboarding-parts';
import { DEFAULT_FEATURE_FLAGS, isFeatureEnabled, parseFeatureFlags } from '../feature-flags';
import { ONBOARDING_ROUTES } from '../onboarding-routes';
import {
  ROUTE_MANIFEST,
  getNavMatchEntries,
  getSecondaryNavEntries,
  getVisibleNavEntries,
  hasEntryPermission,
  isEntryFeatureEnabled,
} from '../route-manifest';

const allowAll = () => true;
const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === ONBOARDING_PLAN_PATH);
const flagOn = { ...DEFAULT_FEATURE_FLAGS, octorateOnboarding: true };

describe('route manifest: the plan «Inizia con CasaZen» (E10/F03/US01/T02)', () => {
  it('RouteManifest_ThePlanPage_IsInTheManifestOnceThroughOnboardingRoutes', () => {
    expect(ONBOARDING_ROUTES.map((route) => route.path)).toContain('/app/short-rent/onboarding');
    // The manifest spreads the list once: every entry of it is in the manifest, and none twice.
    for (const route of ONBOARDING_ROUTES) {
      expect(ROUTE_MANIFEST.filter((candidate) => candidate.path === route.path), route.path).toHaveLength(1);
    }
    expect(ROUTE_MANIFEST.filter((candidate) => ONBOARDING_ROUTES.includes(candidate))).toHaveLength(ONBOARDING_ROUTES.length);
  });

  it('RouteManifest_ThePlanPage_IsOnItsRouteOfShortRentBehindTheFlagAndNeedsToReadTheProperties', () => {
    expect(entry?.path).toBe('/app/short-rent/onboarding');
    expect(entry?.context).toBe('short-rent');
    expect(entry?.featureFlag).toBe('octorateOnboarding');
    expect(entry?.requiredPermissions).toEqual(['property.read']);

    // A role that cannot read the properties does not get the plan page: the server asks the same.
    const without = (_context: string, permission: string) => permission !== 'property.read';
    expect(entry && hasEntryPermission(entry, without)).toBe(false);
    expect(entry && hasEntryPermission(entry, allowAll)).toBe(true);
  });

  it('RouteManifest_ThePlanPage_IsInNoMenuSinceItIsTheFirstWizardAndTheGuide', () => {
    // «Inizia con CasaZen» is the welcome of the first access (`FirstRunWizard`) and the road of the «Guida»: no entry of the menu.
    expect(entry?.navPlacement).toBeUndefined();
    expect(entry?.navParent).toBeUndefined();
    // Its name stays, for the trail of its pages.
    expect(entry?.navKey).toBe('nav.onboardingPlan');
    expect(entry?.icon).toBe('ClipboardCheck');
    expect(entry?.icon && NAV_ICONS[entry.icon]).toBeDefined();
  });

  it('RouteManifest_WhileTheFlagIsOff_ThePageDoesNotExistAndIsInNoMenu', () => {
    expect(entry && isEntryFeatureEnabled(entry, DEFAULT_FEATURE_FLAGS)).toBe(false);
    expect(entry && isEntryFeatureEnabled(entry, undefined)).toBe(false);
    expect(entry && isEntryFeatureEnabled(entry, {})).toBe(false);

    for (const features of [undefined, {}, DEFAULT_FEATURE_FLAGS, { ...DEFAULT_FEATURE_FLAGS, octorateConnector: true }]) {
      expect(getVisibleNavEntries('short-rent', allowAll, features).map((page) => page.path)).not.toContain(ONBOARDING_PLAN_PATH);
      expect(getSecondaryNavEntries('short-rent', allowAll, features).map((page) => page.path)).not.toContain(ONBOARDING_PLAN_PATH);
    }
  });

  it('RouteManifest_WithTheFlagOn_ThePlanExistsButIsInNoMenuOfAnyArea', () => {
    expect(entry && isEntryFeatureEnabled(entry, flagOn)).toBe(true);

    for (const area of ['short-rent', 'long-rent', 'supplier', 'admin'] as const) {
      expect(getVisibleNavEntries(area, allowAll, flagOn).map((page) => page.path)).not.toContain(ONBOARDING_PLAN_PATH);
      expect(getNavMatchEntries(area, allowAll, flagOn).map((page) => page.path)).not.toContain(ONBOARDING_PLAN_PATH);
    }
  });

  // The first import of a page pulls in the whole shell: slow on a loaded machine, hence the room.
  it('RouteManifest_ThePlanPage_LoadsAPageThatIsAComponent', { timeout: 60_000 }, async () => {
    const page = await entry?.component();

    expect(typeof page?.default).toBe('function');
  });
});

describe('route manifest: the pages of the parts, the panel steps and the summary (E10/F03/US02)', () => {
  const PAGES = [
    { path: '/app/short-rent/onboarding/parts/:partKey', permissions: ['property.read'] },
    { path: '/app/short-rent/onboarding/summary', permissions: ['property.read'] },
    { path: '/app/short-rent/onboarding/panel/:kind', permissions: ['property.write'] },
    { path: '/app/short-rent/onboarding/panel', permissions: ['property.write'] },
  ] as const;

  it.each(PAGES)('RouteManifest_$path_IsOnItsRouteOfShortRentBehindTheFlagAndInNoMenu', ({ path, permissions }) => {
    const page = ROUTE_MANIFEST.find((candidate) => candidate.path === path);

    expect(page, path).toBeDefined();
    expect(page?.context).toBe('short-rent');
    expect(page?.featureFlag).toBe('octorateOnboarding');
    expect(page?.requiredPermissions).toEqual(permissions);
    expect(page?.navPlacement).toBeUndefined();
    expect(page?.navParent).toBeUndefined();
    expect(page && isEntryFeatureEnabled(page, DEFAULT_FEATURE_FLAGS)).toBe(false);
    expect(page && isEntryFeatureEnabled(page, flagOn)).toBe(true);
    for (const features of [undefined, {}, DEFAULT_FEATURE_FLAGS, flagOn]) {
      expect(getVisibleNavEntries('short-rent', allowAll, features).map((candidate) => candidate.path)).not.toContain(path);
    }
  });

  // The first import of a page pulls in the whole shell: slow on a loaded machine, hence the room.
  it.each(PAGES)('RouteManifest_$path_LoadsAPageThatIsAComponent', { timeout: 60_000 }, async ({ path }) => {
    const page = await ROUTE_MANIFEST.find((candidate) => candidate.path === path)?.component();

    expect(typeof page?.default).toBe('function');
  });
});

describe('route manifest: the integration settings (E10/F03/US03/T01)', () => {
  const SETTINGS_PATH = '/app/short-rent/settings/integration';
  const settings = ROUTE_MANIFEST.find((candidate) => candidate.path === SETTINGS_PATH);
  const admin = (_context: string, permission: string) => permission === 'org.billing.admin';
  const notAdmin = () => false;

  it('RouteManifest_TheSettingsPage_IsATabOfImpostazioniBehindTheFlagForTheOrganizationAdministrator', () => {
    expect(settings?.context).toBe('short-rent');
    expect(settings?.featureFlag).toBe('octorateOnboarding');
    expect(settings?.requiredPermissions).toEqual([]);
    expect(settings?.orgBillingAdmin).toBe(true);
    expect(settings?.navKey).toBe('nav.integrationSettings');
    expect(settings?.navParent).toBe('/app/short-rent/settings/organization');
    expect(settings?.navPlacement).toBeUndefined();
    expect(settings?.icon).toBe('Settings');
    expect(settings?.icon && NAV_ICONS[settings.icon]).toBeDefined();
    expect(ONBOARDING_ROUTES.filter((route) => route.path === SETTINGS_PATH)).toHaveLength(1);
  });

  it('RouteManifest_TheSettingsPage_IsReachableOnlyForTheAdministratorWithTheFlagOnAndTheAddressStaysReachable', () => {
    const reachable = (hasPermission: (context: string, permission: string) => boolean, features?: Partial<typeof flagOn>) =>
      getNavMatchEntries('short-rent', hasPermission as never, features).map((page) => page.path);

    expect(reachable(admin, flagOn)).toContain(SETTINGS_PATH);
    // It is never an entry of "Altro": its section («Impostazioni») is the administrator's too.
    expect(getSecondaryNavEntries('short-rent', admin as never, flagOn).map((page) => page.path)).not.toContain(SETTINGS_PATH);
    // Anyone else has no way in, and with the flag off nobody has one: the page does not exist.
    expect(reachable(notAdmin, flagOn)).not.toContain(SETTINGS_PATH);
    for (const features of [undefined, {}, DEFAULT_FEATURE_FLAGS]) expect(reachable(admin, features)).not.toContain(SETTINGS_PATH);
    // The route guard asks no permission (the menu does, through `orgBillingAdmin`): a person who is not the administrator who opens the address is told
    // who manages the page by the page itself, and meets no 403.
    expect(settings?.requiredPermissions).toEqual([]);
    expect(settings && hasEntryPermission(settings, admin)).toBe(true);
    expect(settings && hasEntryPermission(settings, notAdmin)).toBe(false);
  });

  // The first import of a page pulls in the whole shell: slow on a loaded machine, hence the room.
  it('RouteManifest_TheSettingsPage_LoadsAPageThatIsAComponent', { timeout: 60_000 }, async () => {
    const page = await settings?.component();

    expect(typeof page?.default).toBe('function');
  });
});

describe('route manifest: the bulk configuration (E10/F03/US03/T02)', () => {
  const BULK_PATH = '/app/short-rent/onboarding/bulk';
  const bulk = ROUTE_MANIFEST.find((candidate) => candidate.path === BULK_PATH);

  it('RouteManifest_TheBulkPage_IsOnItsRouteBehindTheFlagInNoMenuAndForTheOrganizationAdministrator', () => {
    expect(bulk?.context).toBe('short-rent');
    expect(bulk?.featureFlag).toBe('octorateOnboarding');
    expect(bulk?.requiredPermissions).toEqual([]);
    expect(bulk?.orgBillingAdmin).toBe(true);
    expect(bulk?.navPlacement).toBeUndefined();
    expect(bulk?.navParent).toBeUndefined();
    expect(bulk?.navKey).toBeUndefined();
    expect(ONBOARDING_ROUTES.filter((route) => route.path === BULK_PATH)).toHaveLength(1);
    expect(bulk && isEntryFeatureEnabled(bulk, DEFAULT_FEATURE_FLAGS)).toBe(false);
    expect(bulk && isEntryFeatureEnabled(bulk, flagOn)).toBe(true);
    for (const features of [undefined, {}, DEFAULT_FEATURE_FLAGS, flagOn]) {
      expect(getVisibleNavEntries('short-rent', allowAll, features).map((candidate) => candidate.path)).not.toContain(BULK_PATH);
      expect(getSecondaryNavEntries('short-rent', allowAll, features).map((candidate) => candidate.path)).not.toContain(BULK_PATH);
    }
  });

  // The first import of a page pulls in the whole shell: slow on a loaded machine, hence the room.
  it('RouteManifest_TheBulkPage_LoadsAPageThatIsAComponent', { timeout: 60_000 }, async () => {
    const page = await bulk?.component();

    expect(typeof page?.default).toBe('function');
  });
});

describe('route manifest: the staff queue of the assist requests (E10/F03/US03/T03)', () => {
  const ASSIST_PATH = '/app/admin/onboarding-assist';
  const assist = ROUTE_MANIFEST.find((candidate) => candidate.path === ASSIST_PATH);
  const staff = (_context: string, permission: string) => permission === 'admin.users.read';

  it('RouteManifest_TheAssistQueue_IsTheFirstEntryOfSupportoOfTheStaffAreaBehindTheFlagAndAsksWhatTheOtherQueuePagesAsk', () => {
    expect(assist?.context).toBe('admin');
    expect(assist?.requiredPermissions).toEqual(['admin.users.read']);
    expect(assist?.featureFlag).toBe('octorateOnboarding');
    expect(assist?.navKey).toBe('nav.onboardingAssist');
    expect(assist?.navGroup).toBe('support');
    expect(assist?.navPlacement).toBe('primary');
    expect(assist?.navOrder).toBe(4);
    expect(assist?.icon).toBe('Wrench');
    expect(assist?.icon && NAV_ICONS[assist.icon]).toBeDefined();
    expect(ONBOARDING_ROUTES.filter((route) => route.path === ASSIST_PATH)).toHaveLength(1);
  });

  it('RouteManifest_TheAssistQueue_IsInTheMenuOnlyForTheStaffWithTheFlagOnAndInNoOtherArea', () => {
    const inMenu = (area: 'admin' | 'short-rent', hasPermission: (context: string, permission: string) => boolean, features?: Partial<typeof flagOn>) =>
      getVisibleNavEntries(area, hasPermission as never, features).map((page) => page.path);

    expect(inMenu('admin', staff, flagOn)).toContain(ASSIST_PATH);
    expect(assist && hasEntryPermission(assist, () => false)).toBe(false);
    expect(inMenu('admin', () => false, flagOn)).not.toContain(ASSIST_PATH);
    for (const features of [undefined, {}, DEFAULT_FEATURE_FLAGS]) expect(inMenu('admin', staff, features)).not.toContain(ASSIST_PATH);
    expect(inMenu('short-rent', allowAll, flagOn)).not.toContain(ASSIST_PATH);
  });

  // The first import of a page pulls in the whole shell: slow on a loaded machine, hence the room.
  it('RouteManifest_TheAssistQueue_LoadsAPageThatIsAComponent', { timeout: 60_000 }, async () => {
    const page = await assist?.component();

    expect(typeof page?.default).toBe('function');
  });
});

describe('feature flag octorateOnboarding (mirror of the backend Features:OctorateOnboarding)', () => {
  it('FeatureFlags_OctorateOnboarding_IsOffByDefaultAndWhileTheFlagsAreNotLoaded', () => {
    expect(DEFAULT_FEATURE_FLAGS.octorateOnboarding).toBe(false);
    expect(isFeatureEnabled(undefined, 'octorateOnboarding')).toBe(false);
    expect(isFeatureEnabled({}, 'octorateOnboarding')).toBe(false);
  });

  it('FeatureFlags_OctorateOnboarding_IsReadAsTheCamelCaseKeyOfThePublicFeaturesAndAnythingButTrueIsOff', () => {
    expect(parseFeatureFlags({ octorateOnboarding: true }).octorateOnboarding).toBe(true);
    expect(parseFeatureFlags({ octorateOnboarding: 'true' }).octorateOnboarding).toBe(false);
    expect(parseFeatureFlags({ OctorateOnboarding: true }).octorateOnboarding).toBe(false);
    expect(parseFeatureFlags({}).octorateOnboarding).toBe(false);
    expect(parseFeatureFlags(null).octorateOnboarding).toBe(false);
  });
});
