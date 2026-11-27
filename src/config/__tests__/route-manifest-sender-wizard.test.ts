import { describe, expect, it } from 'vitest';
import { SENDER_WIZARD_PATH, senderWizardPath } from '@/features/compliance/lib/connection-health-model';
import { DEFAULT_FEATURE_FLAGS } from '../feature-flags';
import { ROUTE_MANIFEST, getNavMatchEntries, getVisibleNavEntries, hasEntryPermission, isEntryFeatureEnabled } from '../route-manifest';

const PROPERTY_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === SENDER_WIZARD_PATH);

describe('route manifest: the sender wizard (E03/F01/US02/T02)', () => {
  it('RouteManifest_SenderWizard_IsOnItsOwnRouteOfShortRentThatAsksWhatChangingTheSenderAsks', () => {
    expect(entry).toBeDefined();
    expect(SENDER_WIZARD_PATH).toBe('/app/short-rent/compliance/sender');
    expect(entry?.context).toBe('short-rent');
    expect(entry?.requiredPermissions).toEqual(['property.write']);

    // Who may only read the properties cannot change who sends: the endpoints refuse it too.
    const readOnly = (_context: string, permission: string) => permission !== 'property.write';
    expect(entry && hasEntryPermission(entry, readOnly)).toBe(false);
    expect(entry && hasEntryPermission(entry, () => true)).toBe(true);
  });

  it('RouteManifest_SenderWizard_IsInNoMenuAndHangsFromNoEntry', () => {
    expect(entry?.navPlacement).toBeUndefined();
    expect(entry?.navParent).toBeUndefined();
    expect(entry?.navKey).toBeUndefined();

    expect(getVisibleNavEntries('short-rent', () => true).map((page) => page.path)).not.toContain(SENDER_WIZARD_PATH);
    expect(getNavMatchEntries('short-rent', () => true).map((page) => page.path)).not.toContain(SENDER_WIZARD_PATH);
  });

  it('RouteManifest_SenderWizard_NeedsNoFlagBecauseTheChannelManagerIsOfferedOnlyWhereTheServerSaysItCanSend', () => {
    // With the connector off the wizard still serves the other ways (NF-49): the page is there, and the choice is the server's.
    expect(entry?.featureFlag).toBeUndefined();
    expect(entry && isEntryFeatureEnabled(entry, DEFAULT_FEATURE_FLAGS)).toBe(true);
  });

  it('RouteManifest_SenderWizard_LightsTheActivateButtonOfThePanelForWhoMayOpenItAndNoOneElse', () => {
    // The panel «Invio a Polizia e ISTAT» shows «Attiva o ricollega» only when the page is in the manifest and the person may open it.
    expect(senderWizardPath(PROPERTY_ID, () => true)).toBe(`${SENDER_WIZARD_PATH}?property=${PROPERTY_ID}`);
    expect(senderWizardPath(PROPERTY_ID, (_context, permission) => permission !== 'property.write')).toBeNull();
  });

  // The first import of the page pulls in the whole wizard (its steps, the guided panel of the channel manager): slow on a loaded machine, hence the room.
  it('RouteManifest_SenderWizard_LoadsAPageThatIsAComponent', { timeout: 60_000 }, async () => {
    const page = await entry?.component();

    expect(typeof page?.default).toBe('function');
  });
});
