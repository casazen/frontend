import { describe, expect, it } from 'vitest';
import { FISCAL_DOCUMENTS_PATH } from '@/features/fiscal/documents/document-paths';
import { DEFAULT_FEATURE_FLAGS, isFeatureRuleEnabled, parseFeatureFlags } from '../feature-flags';
import { ROUTE_MANIFEST, getManifestEntry, getNavSection, hasEntryPermission, isEntryFeatureEnabled } from '../route-manifest';

const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === FISCAL_DOCUMENTS_PATH);
const allow = () => true;
const ISSUANCE = { ...DEFAULT_FEATURE_FLAGS, fiscalDocumentIssuance: true };
const IMPORT = { ...DEFAULT_FEATURE_FLAGS, octorateDocumentImport: true };

describe('route manifest: the fiscal documents (E06/F03/US04/T01)', () => {
  it('RouteManifest_FiscalDocuments_IsOnTheRouteTheLedgerOfThePaymentsLinksTo', () => {
    expect(FISCAL_DOCUMENTS_PATH).toBe('/app/short-rent/fiscal/documents');
    expect(entry).toBeDefined();
    expect(getManifestEntry('/app/short-rent/fiscal/documents')).toBe(entry);
    expect(entry?.context).toBe('short-rent');
  });

  // Permission rule: what the backend asks. The list, the files and the downloads need `payment.read`; the setting that tells who issues needs `property.read` as well.
  it('RouteManifest_FiscalDocuments_NeedsThePermissionsOfTheEndpointsItReads', () => {
    expect(entry?.requiredPermissions).toEqual(['property.read', 'payment.read']);

    const withoutPayments = (_context: string, permission: string) => permission !== 'payment.read';
    const withoutProperties = (_context: string, permission: string) => permission !== 'property.read';
    expect(entry && hasEntryPermission(entry, withoutPayments)).toBe(false);
    expect(entry && hasEntryPermission(entry, withoutProperties)).toBe(false);
    expect(entry && hasEntryPermission(entry, allow)).toBe(true);
  });

  // Flag rule: with both flags off (the default of the backend) nothing changes for anyone: no tab, no link, and the address leads to the home of the area.
  it('RouteManifest_FiscalDocuments_WithBothFlagsOffIsNotThereForAnyone', () => {
    expect(entry?.featureFlag).toEqual(['fiscalDocumentIssuance', 'octorateDocumentImport']);

    expect(entry && isEntryFeatureEnabled(entry, DEFAULT_FEATURE_FLAGS)).toBe(false);
    expect(entry && isEntryFeatureEnabled(entry, undefined)).toBe(false);
    expect(entry && isEntryFeatureEnabled(entry, {})).toBe(false);
    expect(getNavSection(FISCAL_DOCUMENTS_PATH, allow, DEFAULT_FEATURE_FLAGS)).toEqual([]);
    expect(getNavSection('/app/short-rent/payments', allow, DEFAULT_FEATURE_FLAGS).map((page) => page.path)).not.toContain(FISCAL_DOCUMENTS_PATH);
  });

  it.each([
    ['CasaZen issues', ISSUANCE],
    ['the channel manager documents are imported', IMPORT],
  ])('RouteManifest_FiscalDocuments_When_%s_IsThere', (_case, flags) => {
    expect(entry && isEntryFeatureEnabled(entry, flags)).toBe(true);
  });

  it('RouteManifest_FiscalDocuments_IsATabOfIncassiRightAfterRegimeFiscale', () => {
    expect(entry?.navParent).toBe('/app/short-rent/payments');
    expect(entry?.navKey).toBe('nav.fiscalDocuments');
    expect(entry?.navPlacement).toBeUndefined();

    const fiscal = getManifestEntry('/app/short-rent/fiscal');
    const stripe = getManifestEntry('/app/short-rent/settings/payments');
    expect(entry?.navOrder).toBeGreaterThan(fiscal?.navOrder ?? Number.POSITIVE_INFINITY);
    expect(entry?.navOrder).toBeLessThan(stripe?.navOrder ?? Number.NEGATIVE_INFINITY);

    const tabs = getNavSection(FISCAL_DOCUMENTS_PATH, allow, ISSUANCE).map((page) => page.path);
    expect(tabs).toContain(FISCAL_DOCUMENTS_PATH);
    expect(tabs.indexOf(FISCAL_DOCUMENTS_PATH)).toBe(tabs.indexOf('/app/short-rent/fiscal') + 1);
  });

  // The tab of whoever may not read what the page reads is not drawn: no tab that ends on a reserved page.
  it('RouteManifest_FiscalDocuments_IsNoTabForWhoMayNotReadPayments', () => {
    const withoutPayments = (_context: string, permission: string) => permission !== 'payment.read';

    expect(getNavSection('/app/short-rent/fiscal', withoutPayments, ISSUANCE).map((page) => page.path)).not.toContain(FISCAL_DOCUMENTS_PATH);
  });

  // The payment ledger (E06/F04/US01/T04) draws the link to the documents only when this entry is in the manifest, its flags are on and the caller holds what it asks:
  // the same three things, in the same order, as its `documentLinkOf`. With the flags off the link is not drawn; with them on it lights up by itself.
  it('RouteManifest_FiscalDocuments_TheLinkOfThePaymentLedgerLightsUpByItselfOnlyWhereThePageExists', () => {
    const linkOf = (permission: (context: 'short-rent', permission: string) => boolean, flags: Partial<typeof DEFAULT_FEATURE_FLAGS> | undefined) => {
      const found = getManifestEntry(FISCAL_DOCUMENTS_PATH);
      return found && isEntryFeatureEnabled(found, flags) && hasEntryPermission(found, permission) ? found.path : null;
    };
    const withoutPayments = (_context: 'short-rent', permission: string) => permission !== 'payment.read';

    expect(linkOf(allow, DEFAULT_FEATURE_FLAGS)).toBeNull();
    expect(linkOf(allow, ISSUANCE)).toBe(FISCAL_DOCUMENTS_PATH);
    expect(linkOf(allow, IMPORT)).toBe(FISCAL_DOCUMENTS_PATH);
    expect(linkOf(withoutPayments, ISSUANCE)).toBeNull();
    expect(linkOf(allow, undefined)).toBeNull();
  });

  it('RouteManifest_FiscalDocuments_LoadsAPageThatIsAComponent', { timeout: 30_000 }, async () => {
    const page = await entry?.component();

    expect(typeof page?.default).toBe('function');
  });
});

describe('feature flags of the fiscal documents', () => {
  it('ParseFeatureFlags_TheTwoFlagsOfTheDocuments_AreReadFromTheCamelCaseKeysOfTheBackend', () => {
    expect(DEFAULT_FEATURE_FLAGS.fiscalDocumentIssuance).toBe(false);
    expect(DEFAULT_FEATURE_FLAGS.octorateDocumentImport).toBe(false);

    const flags = parseFeatureFlags({ fiscalDocumentIssuance: true, octorateDocumentImport: 'yes' });
    expect(flags.fiscalDocumentIssuance).toBe(true);
    // Anything but `true` is off.
    expect(flags.octorateDocumentImport).toBe(false);
  });

  it('IsFeatureRuleEnabled_AListOfFlags_IsMetWhileAnyOfThemIsOn', () => {
    const rule = ['fiscalDocumentIssuance', 'octorateDocumentImport'] as const;

    expect(isFeatureRuleEnabled(DEFAULT_FEATURE_FLAGS, rule)).toBe(false);
    expect(isFeatureRuleEnabled(ISSUANCE, rule)).toBe(true);
    expect(isFeatureRuleEnabled(IMPORT, rule)).toBe(true);
    expect(isFeatureRuleEnabled(undefined, rule)).toBe(false);
  });

  it('IsFeatureRuleEnabled_OneFlagANoRuleAndAnEmptyList_KeepTheirMeaning', () => {
    expect(isFeatureRuleEnabled(undefined, undefined)).toBe(true);
    expect(isFeatureRuleEnabled(DEFAULT_FEATURE_FLAGS, 'octorateConnector')).toBe(false);
    expect(isFeatureRuleEnabled({ ...DEFAULT_FEATURE_FLAGS, octorateConnector: true }, 'octorateConnector')).toBe(true);
    // A page nobody can turn on is hidden, not shown.
    expect(isFeatureRuleEnabled({ ...DEFAULT_FEATURE_FLAGS, octorateConnector: true }, [])).toBe(false);
  });
});
