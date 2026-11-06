import { describe, expect, it } from 'vitest';
import { OCTORATE_CONNECT_PATH } from '@/features/integrations/octorate/octorate-callback';
import { DEFAULT_FEATURE_FLAGS, isFeatureEnabled, parseFeatureFlags } from '../feature-flags';
import {
  ROUTE_MANIFEST,
  getNavMatchEntries,
  getVisibleNavEntries,
  hasEntryPermission,
  isEntryFeatureEnabled,
} from '../route-manifest';

const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === OCTORATE_CONNECT_PATH);

describe('route manifest: the connect wizard of the channel manager (E02/F01/US01/T04)', () => {
  it('RouteManifest_ConnectWizard_IsOnItsOwnRouteOfShortRentAndTheCallbackAddress', () => {
    expect(entry).toBeDefined();
    expect(entry?.path).toBe('/app/short-rent/integrations/octorate');
    expect(entry?.context).toBe('short-rent');
    expect(entry?.featureFlag).toBe('octorateConnector');
  });

  it('RouteManifest_ConnectWizard_NeedsThePermissionThatWritesTheConnection', () => {
    expect(entry?.requiredPermissions).toEqual(['ota.write']);

    // Who may only read the integrations cannot connect the org's channel manager: the backend refuses it too.
    const readOnly = (_context: string, permission: string) => permission !== 'ota.write';
    expect(entry && hasEntryPermission(entry, readOnly)).toBe(false);
    expect(entry && hasEntryPermission(entry, () => true)).toBe(true);
  });

  it('RouteManifest_ConnectWizard_IsInNoMenuAndHangsFromNoEntry', () => {
    expect(entry?.navPlacement).toBeUndefined();
    expect(entry?.navParent).toBeUndefined();
    expect(entry?.navKey).toBeUndefined();

    const allOn = { ...DEFAULT_FEATURE_FLAGS, octorateConnector: true };
    expect(getVisibleNavEntries('short-rent', () => true, allOn).map((page) => page.path)).not.toContain(OCTORATE_CONNECT_PATH);
    expect(getNavMatchEntries('short-rent', () => true, allOn).map((page) => page.path)).not.toContain(OCTORATE_CONNECT_PATH);
  });

  it('RouteManifest_ConnectWizard_DoesNotExistWhileTheFlagIsOff', () => {
    expect(entry && isEntryFeatureEnabled(entry, DEFAULT_FEATURE_FLAGS)).toBe(false);
    expect(entry && isEntryFeatureEnabled(entry, { ...DEFAULT_FEATURE_FLAGS, octorateConnector: true })).toBe(true);
    expect(entry && isEntryFeatureEnabled(entry, undefined)).toBe(false);
  });

  it('RouteManifest_ConnectWizard_LoadsAPageThatIsAComponent', async () => {
    const page = await entry?.component();

    expect(typeof page?.default).toBe('function');
  });
});

describe('feature flag octorateConnector (mirror of the backend Features:OctorateConnector)', () => {
  it('FeatureFlags_OctorateConnector_IsOffByDefault', () => {
    expect(DEFAULT_FEATURE_FLAGS.octorateConnector).toBe(false);
    expect(isFeatureEnabled(undefined, 'octorateConnector')).toBe(false);
  });

  it('FeatureFlags_OctorateConnector_IsReadAsTheCamelCaseKeyOfThePublicFeatures', () => {
    expect(parseFeatureFlags({ octorateConnector: true }).octorateConnector).toBe(true);
    // Anything but `true` is off.
    expect(parseFeatureFlags({ octorateConnector: 'true' }).octorateConnector).toBe(false);
    expect(parseFeatureFlags({}).octorateConnector).toBe(false);
  });
});
