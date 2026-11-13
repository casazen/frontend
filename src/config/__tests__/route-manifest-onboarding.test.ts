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

  it('RouteManifest_ThePlanPage_IsAnEntryOfAltroWithAnIconTheMenuKnows', () => {
    expect(entry?.navPlacement).toBe('secondary');
    expect(entry?.navKey).toBe('nav.onboardingPlan');
    expect(entry?.navOrder).toBe(32);
    expect(entry?.icon).toBe('ClipboardCheck');
    expect(entry?.icon && NAV_ICONS[entry.icon]).toBeDefined();
    expect(entry?.navParent).toBeUndefined();
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

  it('RouteManifest_WithTheFlagOn_ThePlanIsInAltroOfShortRentAfterTheCrmEntryAndInNoOtherArea', () => {
    expect(entry && isEntryFeatureEnabled(entry, flagOn)).toBe(true);

    const secondary = getSecondaryNavEntries('short-rent', allowAll, flagOn).map((page) => page.path);
    expect(secondary).toContain(ONBOARDING_PLAN_PATH);
    // Altro is ordered by `navOrder`: the plan (32) comes after the entries that were already there, the To do list (the last one) apart.
    expect(secondary.indexOf(ONBOARDING_PLAN_PATH)).toBeGreaterThan(0);
    expect(getNavMatchEntries('short-rent', allowAll, flagOn).map((page) => page.path)).toContain(ONBOARDING_PLAN_PATH);
    for (const area of ['long-rent', 'supplier', 'admin'] as const) {
      expect(getVisibleNavEntries(area, allowAll, flagOn).map((page) => page.path)).not.toContain(ONBOARDING_PLAN_PATH);
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

  it('RouteManifest_TheSettingsPage_IsAnEntryOfAltroBehindTheFlagForTheOrganizationAdministrator', () => {
    expect(settings?.context).toBe('short-rent');
    expect(settings?.featureFlag).toBe('octorateOnboarding');
    expect(settings?.requiredPermissions).toEqual([]);
    expect(settings?.orgBillingAdmin).toBe(true);
    expect(settings?.navKey).toBe('nav.integrationSettings');
    expect(settings?.navPlacement).toBe('secondary');
    expect(settings?.navOrder).toBe(34);
    expect(settings?.icon).toBe('Settings');
    expect(settings?.icon && NAV_ICONS[settings.icon]).toBeDefined();
    expect(ONBOARDING_ROUTES.filter((route) => route.path === SETTINGS_PATH)).toHaveLength(1);
  });

  it('RouteManifest_TheSettingsPage_IsInTheMenuOnlyForTheAdministratorWithTheFlagOnAndTheAddressStaysReachable', () => {
    const inAltro = (hasPermission: (context: string, permission: string) => boolean, features?: Partial<typeof flagOn>) =>
      getSecondaryNavEntries('short-rent', hasPermission as never, features).map((page) => page.path);

    expect(inAltro(admin, flagOn)).toContain(SETTINGS_PATH);
    // Anyone else has no entry, and with the flag off nobody has one: the page does not exist.
    expect(inAltro(notAdmin, flagOn)).not.toContain(SETTINGS_PATH);
    for (const features of [undefined, {}, DEFAULT_FEATURE_FLAGS]) expect(inAltro(admin, features)).not.toContain(SETTINGS_PATH);
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
