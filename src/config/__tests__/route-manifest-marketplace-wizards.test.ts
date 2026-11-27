import { describe, expect, it } from 'vitest';
import { DEFAULT_FEATURE_FLAGS } from '../feature-flags';
import { marketplaceActivationPath, marketplaceFunctionRequestPath, marketplacePartnerActivationPath } from '@/features/marketplace/lib/marketplace-paths';
import { ROUTE_MANIFEST, getNavMatchEntries, getVisibleNavEntries, hasEntryPermission, isEntryFeatureEnabled } from '../route-manifest';

const ACTIVATION = '/app/short-rent/marketplace/activate/:kind/:code';
const LICENSED = '/app/short-rent/marketplace/request/:moduleCode';
const PARTNER = '/app/short-rent/marketplace/partners/:code/activate';
const WIZARDS = [ACTIVATION, LICENSED, PARTNER] as const;

const entryOf = (path: string) => ROUTE_MANIFEST.find((candidate) => candidate.path === path);

describe('route manifest: the guided activation wizards of the Marketplace (E09/F02/US04)', () => {
  it.each(WIZARDS)('RouteManifest_Wizard_%s_IsOnItsOwnRouteOfShortRentThatWritesTheIntegrations', (path) => {
    const entry = entryOf(path);

    expect(entry).toBeDefined();
    expect(entry?.context).toBe('short-rent');
    expect(entry?.requiredPermissions).toEqual(['ota.write']);

    // Who may only read the integrations cannot activate one: the backend refuses it too.
    const readOnly = (_context: string, permission: string) => permission !== 'ota.write';
    expect(entry && hasEntryPermission(entry, readOnly)).toBe(false);
    expect(entry && hasEntryPermission(entry, () => true)).toBe(true);
  });

  it.each(WIZARDS)('RouteManifest_Wizard_%s_IsInNoMenuAndHangsFromNoEntry', (path) => {
    const entry = entryOf(path);
    expect(entry?.navPlacement).toBeUndefined();
    expect(entry?.navParent).toBeUndefined();
    expect(entry?.navKey).toBeUndefined();

    const allOn = { ...DEFAULT_FEATURE_FLAGS, octorateConnector: true, octorateOnboarding: true };
    expect(getVisibleNavEntries('short-rent', () => true, allOn).map((page) => page.path)).not.toContain(path);
    expect(getNavMatchEntries('short-rent', () => true, allOn).map((page) => page.path)).not.toContain(path);
  });

  it.each([ACTIVATION, LICENSED])('RouteManifest_Wizard_%s_NeedsTheChannelManagerFlagLikeTheEndpointsItCalls', (path) => {
    const entry = entryOf(path);

    expect(entry?.featureFlag).toBe('octorateConnector');
    expect(entry && isEntryFeatureEnabled(entry, DEFAULT_FEATURE_FLAGS)).toBe(false);
    expect(entry && isEntryFeatureEnabled(entry, { ...DEFAULT_FEATURE_FLAGS, octorateConnector: true })).toBe(true);
  });

  it('RouteManifest_PartnerWizard_NeedsNoFlagBecauseThePartnersNeverDependOnTheChannelManager', () => {
    const entry = entryOf(PARTNER);

    expect(entry?.featureFlag).toBeUndefined();
    expect(entry && isEntryFeatureEnabled(entry, DEFAULT_FEATURE_FLAGS)).toBe(true);
  });

  it('RouteManifest_Wizards_AreTheAddressesTheCardsOfTheMarketplaceLeadTo', () => {
    // The pages of the marketplace build these addresses (`marketplace-paths`): the routes are the ones they point to.
    expect(marketplaceActivationPath('Channel', '142')).toBe('/app/short-rent/marketplace/activate/channel/142');
    expect(marketplaceFunctionRequestPath('chat')).toBe('/app/short-rent/marketplace/request/chat');
    expect(marketplacePartnerActivationPath('beds24')).toBe('/app/short-rent/marketplace/partners/beds24/activate');
  });

  // The first import of a page pulls in the whole wizard (its steps, the guided panel of the channel manager): slow on a loaded machine, hence the room.
  it.each(WIZARDS)('RouteManifest_Wizard_%s_LoadsAPageThatIsAComponent', { timeout: 60_000 }, async (path) => {
    const page = await entryOf(path)?.component();

    expect(typeof page?.default).toBe('function');
  });
});
