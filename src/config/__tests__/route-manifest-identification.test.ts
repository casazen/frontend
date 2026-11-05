import { describe, it, expect } from 'vitest';
import { ROUTE_MANIFEST, getNavChildren, getNavMatchEntries, getVisibleNavEntries } from '../route-manifest';

const IDENTIFICATION = '/app/short-rent/compliance/identification';
const ENTRANCE_QR = '/app/short-rent/properties/:propertyId/qr';

const entryOf = (path: string) => {
  const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === path);
  if (!entry) throw new Error(`no manifest entry for ${path}`);
  return entry;
};

/** The source of the entrance QR page: the route and the page agree on the name of the parameter through it. */
const qrPageSource = Object.values(
  import.meta.glob<string>('/src/pages/PropertyQrCode.tsx', { query: '?raw', import: 'default', eager: true }),
)[0];

describe('route-manifest identification and entrance QR (E03/F01/US03)', () => {
  it('registers Identificazione e accesso as a tab of Adempimenti for who may write the properties', () => {
    const entry = entryOf(IDENTIFICATION);

    expect(entry).toMatchObject({
      context: 'short-rent',
      requiredPermissions: ['property.write'],
      navParent: '/app/short-rent/compliance',
      navKey: 'nav.identification',
    });
    // In no menu: it is a tab of the section, and the entry it hangs from stays the highlighted one.
    expect(entry.navPlacement).toBeUndefined();
    expect(getVisibleNavEntries('short-rent', () => true).map((page) => page.path)).not.toContain(IDENTIFICATION);
    expect(getNavChildren('/app/short-rent/compliance', () => true).map((page) => page.path)).toContain(IDENTIFICATION);
  });

  it('gives no tab to who may only read the properties: setting a code is writing', () => {
    const readOnly = (_context: string, permission: string) => permission !== 'property.write';

    expect(getNavChildren('/app/short-rent/compliance', readOnly).map((page) => page.path)).not.toContain(IDENTIFICATION);
  });

  it('registers the entrance QR of a property in no menu, for who may read the properties', () => {
    const entry = entryOf(ENTRANCE_QR);

    expect(entry).toMatchObject({ context: 'short-rent', requiredPermissions: ['property.read'] });
    expect(entry.navPlacement).toBeUndefined();
    expect(entry.navParent).toBeUndefined();
    expect(getNavMatchEntries('short-rent', () => true).map((page) => page.path)).not.toContain(ENTRANCE_QR);
  });

  it('opens a page that exports PropertyQrCodePage and reads the property from :propertyId', () => {
    expect(qrPageSource).toMatch(/export function PropertyQrCodePage\b/);
    expect(qrPageSource).toMatch(/useParams<\{\s*propertyId: string\s*\}>\(\)/);
    expect(entryOf(ENTRANCE_QR).path).toContain('/:propertyId/');
  });
});
