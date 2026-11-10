import { describe, expect, it } from 'vitest';
import { ISSUER_PATH } from '@/features/fiscal/issuer-wizard/issuer-paths';
import { resolveActiveNavEntry } from '@/lib/nav-active';
import { getManifestCrumbs } from '@/lib/page-crumbs';
import { DEFAULT_FEATURE_FLAGS } from '../feature-flags';
import { ROUTE_MANIFEST, getNavMatchEntries, getVisibleNavEntries, hasEntryPermission } from '../route-manifest';

const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === ISSUER_PATH);

describe('route manifest: the wizard «Come emetti i documenti?» (E06/F02/US02/T03)', () => {
  it('RouteManifest_IssuerWizard_IsOnItsOwnRouteOfShortRentUnderTheFiscalPage', () => {
    expect(entry).toBeDefined();
    expect(entry?.path).toBe('/app/short-rent/fiscal/issuer');
    expect(entry?.context).toBe('short-rent');
  });

  it('RouteManifest_IssuerWizard_NeedsThePermissionThatWritesTheSettingOfTheOrganization', () => {
    expect(entry?.requiredPermissions).toEqual(['property.write']);

    // Whoever may only read the fiscal pages does not open the wizard: the backend refuses the save too.
    const readOnly = (_context: string, permission: string) => permission !== 'property.write';
    expect(entry && hasEntryPermission(entry, readOnly)).toBe(false);
    expect(entry && hasEntryPermission(entry, () => true)).toBe(true);
  });

  it('RouteManifest_IssuerWizard_IsInNoMenuAndHangsFromNoEntry', () => {
    expect(entry?.navPlacement).toBeUndefined();
    expect(entry?.navParent).toBeUndefined();
    expect(entry?.navKey).toBeUndefined();
    expect(entry?.featureFlag).toBeUndefined();

    expect(getVisibleNavEntries('short-rent', () => true, DEFAULT_FEATURE_FLAGS).map((page) => page.path)).not.toContain(ISSUER_PATH);
    expect(getNavMatchEntries('short-rent', () => true, DEFAULT_FEATURE_FLAGS).map((page) => page.path)).not.toContain(ISSUER_PATH);
  });

  it('RouteManifest_IssuerWizard_HighlightsIncassiAndItsTrailGoesThroughTheFiscalPage', () => {
    // Like the other pages of the fiscal section: the entry of the section is the one highlighted.
    const active = resolveActiveNavEntry(ISSUER_PATH, getNavMatchEntries('short-rent', () => true, DEFAULT_FEATURE_FLAGS));
    expect(active?.path).toBe('/app/short-rent/payments');

    const trail = getManifestCrumbs({
      contextKey: 'short-rent',
      pathname: ISSUER_PATH,
      current: 'Come emetti i documenti?',
      t: ((key: string) => key) as never,
    });
    expect(trail.map((step) => step.to)).toEqual(['/app/short-rent/payments', '/app/short-rent/fiscal', undefined]);
  });

  // The page is loaded for the first time here, with the whole wizard behind it: the 5 s of the default are not enough on a loaded CI runner.
  it('RouteManifest_IssuerWizard_LoadsAPageThatIsAComponent', { timeout: 30_000 }, async () => {
    const page = await entry?.component();

    expect(typeof page?.default).toBe('function');
  });
});
