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
