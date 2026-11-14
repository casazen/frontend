import { describe, expect, it } from 'vitest';
import { DEFAULT_FEATURE_FLAGS, parseFeatureFlags } from '../feature-flags';
import {
  ROUTE_MANIFEST,
  getNavChildren,
  getSecondaryNavEntries,
  getVisibleNavEntries,
  hasEntryPermission,
  isEntryFeatureEnabled,
} from '../route-manifest';

const ASSISTANT_PATH = '/app/short-rent/settings/assistant';
const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === ASSISTANT_PATH);

const holding =
  (...granted: string[]) =>
  (_context: string, permission: string) =>
    granted.includes(permission);

const ON = { messageAssistant: true };

describe('route manifest: the settings of the assistant (E05/F05/US04/T02, behind the flag messageAssistant)', () => {
  it('RouteManifest_Assistant_IsATabOfImpostazioniThatNeedsToWriteTheProperties', () => {
    expect(entry).toBeDefined();
    expect(entry?.context).toBe('short-rent');
    expect(entry?.requiredPermissions).toEqual(['property.write']);
    expect(entry?.navKey).toBe('nav.assistant');
    expect(entry?.navParent).toBe('/app/short-rent/settings/organization');
    expect(entry?.navPlacement).toBeUndefined();
    expect(entry?.featureFlag).toBe('messageAssistant');
  });

  it('RouteManifest_Assistant_FlagIsOffByDefaultWhileLoadingAndWhenTheAnswerIsNotTrue', () => {
    expect(DEFAULT_FEATURE_FLAGS.messageAssistant).toBe(false);
    expect(parseFeatureFlags(undefined).messageAssistant).toBe(false);
    expect(parseFeatureFlags({ messageAssistant: 'true' }).messageAssistant).toBe(false);
    expect(parseFeatureFlags({ messageAssistant: true }).messageAssistant).toBe(true);
    expect(entry && isEntryFeatureEnabled(entry, undefined)).toBe(false);
    expect(entry && isEntryFeatureEnabled(entry, { messageAssistant: false })).toBe(false);
    expect(entry && isEntryFeatureEnabled(entry, ON)).toBe(true);
  });

  it('RouteManifest_Assistant_WithTheFlagOffIsInNoMenuForAnyone', () => {
    const everything = holding('property.read', 'property.write', 'booking.read', 'booking.write', 'approval.decide', 'org.billing.admin');

    for (const features of [undefined, {}, { messageAssistant: false }]) {
      expect(getVisibleNavEntries('short-rent', everything, features).map((page) => page.path)).not.toContain(ASSISTANT_PATH);
      expect(getSecondaryNavEntries('short-rent', everything, features).map((page) => page.path)).not.toContain(ASSISTANT_PATH);
    }
  });

  it('RouteManifest_Assistant_WithTheFlagOnIsReachableOnlyForWhoMayWriteTheProperties', () => {
    const admin = holding('property.read', 'property.write', 'booking.read', 'org.billing.admin');
    const writer = holding('property.read', 'property.write', 'booking.read');
    const reader = holding('property.read', 'booking.read');

    expect(entry && hasEntryPermission(entry, writer)).toBe(true);
    expect(entry && hasEntryPermission(entry, reader)).toBe(false);
    // The organization administrator finds it as a tab of «Impostazioni»; who may write the properties but not open «Impostazioni» finds it in "Altro".
    expect(getNavChildren('/app/short-rent/settings/organization', admin, ON).map((page) => page.path)).toContain(ASSISTANT_PATH);
    expect(getSecondaryNavEntries('short-rent', admin, ON).map((page) => page.path)).not.toContain(ASSISTANT_PATH);
    expect(getSecondaryNavEntries('short-rent', writer, ON).map((page) => page.path)).toContain(ASSISTANT_PATH);
    expect(getSecondaryNavEntries('short-rent', reader, ON).map((page) => page.path)).not.toContain(ASSISTANT_PATH);
  });

  it('RouteManifest_Assistant_LoadsAPageThatIsAComponent', async () => {
    const loaded = await entry!.component();

    expect(typeof loaded.default).toBe('function');
  }, 30_000);
});
