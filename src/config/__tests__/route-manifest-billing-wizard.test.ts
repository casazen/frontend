import { describe, expect, it } from 'vitest';
import { BILLING_SETUP_PATH, LEGACY_ISSUER_PATH, searchOfLegacy } from '@/features/fiscal/billing-wizard/billing-wizard-ids';
import { resolveActiveNavEntry } from '@/lib/nav-active';
import { getManifestCrumbs } from '@/lib/page-crumbs';
import { DEFAULT_FEATURE_FLAGS } from '../feature-flags';
import { ROUTE_MANIFEST, getManifestEntry, getNavMatchEntries, getVisibleNavEntries, hasEntryPermission, isEntryFeatureEnabled } from '../route-manifest';

const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === BILLING_SETUP_PATH);
const legacy = ROUTE_MANIFEST.find((candidate) => candidate.path === LEGACY_ISSUER_PATH);
const ISSUANCE = { ...DEFAULT_FEATURE_FLAGS, fiscalDocumentIssuance: true };

describe('route manifest: the wizard «Fatturazione» (E11/F02/US01/T01)', () => {
  it('RouteManifest_BillingWizard_IsOnItsOwnRouteOfShortRentUnderTheFiscalPage', () => {
    expect(entry).toBeDefined();
    expect(entry?.path).toBe('/app/short-rent/fiscal/setup');
    expect(getManifestEntry('/app/short-rent/fiscal/setup')).toBe(entry);
    expect(entry?.context).toBe('short-rent');
  });

  // Permission rule: what the backend asks to read. The wizard is read-only for who may not write (no `property.write`, or an access to only some of the properties).
  it('RouteManifest_BillingWizard_IsOpenedByWhoReadsThePropertiesAndThePaymentsNotOnlyByWhoWrites', () => {
    expect(entry?.requiredPermissions).toEqual(['property.read', 'payment.read']);

    const withoutPayments = (_context: string, permission: string) => permission !== 'payment.read';
    const readOnly = (_context: string, permission: string) => permission !== 'property.write';
    expect(entry && hasEntryPermission(entry, withoutPayments)).toBe(false);
    expect(entry && hasEntryPermission(entry, readOnly)).toBe(true);
    expect(entry && hasEntryPermission(entry, () => true)).toBe(true);
  });

  // Flag rule: with the issuance off the route is not there for anyone and its address leads to the home of the area, as the backend answers 404.
  it('RouteManifest_BillingWizard_WithTheIssuanceOffIsNotThereForAnyone', () => {
    expect(entry?.featureFlag).toBe('fiscalDocumentIssuance');
    expect(entry && isEntryFeatureEnabled(entry, DEFAULT_FEATURE_FLAGS)).toBe(false);
    expect(entry && isEntryFeatureEnabled(entry, undefined)).toBe(false);
    expect(entry && isEntryFeatureEnabled(entry, ISSUANCE)).toBe(true);
  });

  it('RouteManifest_BillingWizard_IsInNoMenuAndHangsFromNoEntry', () => {
    expect(entry?.navPlacement).toBeUndefined();
    expect(entry?.navParent).toBeUndefined();
    expect(entry?.navKey).toBeUndefined();

    expect(getVisibleNavEntries('short-rent', () => true, ISSUANCE).map((page) => page.path)).not.toContain(BILLING_SETUP_PATH);
    expect(getNavMatchEntries('short-rent', () => true, ISSUANCE).map((page) => page.path)).not.toContain(BILLING_SETUP_PATH);
  });

  it('RouteManifest_BillingWizard_HighlightsIncassiAndItsTrailGoesThroughTheFiscalPage', () => {
    // Like the other pages of the fiscal section: the entry of the section is the one highlighted.
    const active = resolveActiveNavEntry(BILLING_SETUP_PATH, getNavMatchEntries('short-rent', () => true, ISSUANCE));
    expect(active?.path).toBe('/app/short-rent/payments');

    const trail = getManifestCrumbs({
      contextKey: 'short-rent',
      pathname: BILLING_SETUP_PATH,
      current: 'Fatturazione',
      t: ((key: string) => key) as never,
    });
    expect(trail.map((step) => step.to)).toEqual(['/app/short-rent/payments', '/app/short-rent/fiscal', undefined]);
  });

  // The page is loaded for the first time here, with the whole wizard behind it: the 5 s of the default are not enough on a loaded CI runner.
  it('RouteManifest_BillingWizard_LoadsAPageThatIsAComponent', { timeout: 30_000 }, async () => {
    const page = await entry?.component();

    expect(typeof page?.default).toBe('function');
  });
});

describe('route manifest: the old address of the issuer wizard leads to the wizard «Fatturazione»', () => {
  it('RouteManifest_OldIssuerAddress_StaysInTheManifestAsARedirectOfShortRentThatAsksNothing', async () => {
    expect(legacy).toBeDefined();
    expect(legacy?.path).toBe('/app/short-rent/fiscal/issuer');
    expect(legacy?.context).toBe('short-rent');
    expect(legacy?.requiredPermissions).toEqual([]);
    expect(legacy?.featureFlag).toBeUndefined();
    expect(legacy?.navPlacement).toBeUndefined();
    expect(legacy?.navParent).toBeUndefined();
    const page = await legacy?.component();
    expect(typeof page?.default).toBe('function');
  }, 30_000);

  it('RouteManifest_OldIssuerAddress_KeepsTheStepOfTheOldWizardWhereTheNewOneHasOneForIt', () => {
    expect(searchOfLegacy('')).toBe('');
    expect(searchOfLegacy('?step=regime')).toBe('?step=vat');
    expect(searchOfLegacy('?step=address')).toBe('?step=issuer');
    expect(searchOfLegacy('?step=issuer')).toBe('?step=issuer');
    expect(searchOfLegacy('?step=summary')).toBe('?step=summary');
    // The choice of the issuer is gone with its step, and a step nobody knows opens the wizard where it opens by itself, at what is missing.
    expect(searchOfLegacy('?step=who')).toBe('');
    expect(searchOfLegacy('?step=fatto')).toBe('');
    expect(searchOfLegacy('?step=somewhere&other=1')).toBe('');
    expect(searchOfLegacy('?step=toString')).toBe('');
  });
});
