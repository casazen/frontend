import { describe, expect, it } from 'vitest';
import {
  ROUTE_MANIFEST,
  getContextNav,
  getNavChildren,
  type AppContextKey,
  type PermissionPredicate,
} from '@/config/route-manifest';
import type { FeatureFlags } from '@/config/feature-flags';
import { navigationSource } from '../sources/navigation';
import { allPermissions, makeContext } from './test-context';

const AREAS: AppContextKey[] = ['short-rent', 'long-rent', 'supplier', 'admin'];

const FLAGS_OFF: Partial<FeatureFlags> = { otaPartnerApi: false };
const FLAGS_ON: Partial<FeatureFlags> = { otaPartnerApi: true, aiSupplierDiscovery: true, rliProvider: true, eSignProvider: true };

interface Scenario {
  name: string;
  hasPermission: PermissionPredicate;
  flags: Partial<FeatureFlags>;
}

/** Everything a role can look like: all the permissions, none, each one taken away, each one alone; flags off and on. */
function scenariosFor(area: AppContextKey): Scenario[] {
  const permissions = allPermissions(area);
  const scenarios: Scenario[] = [];
  for (const [flagsName, flags] of [['flags off', FLAGS_OFF], ['flags on', FLAGS_ON]] as const) {
    scenarios.push({ name: `everything allowed, ${flagsName}`, hasPermission: () => true, flags });
    scenarios.push({ name: `nothing allowed, ${flagsName}`, hasPermission: () => false, flags });
    for (const missing of permissions) {
      scenarios.push({ name: `without ${missing}, ${flagsName}`, hasPermission: (_area, permission) => permission !== missing, flags });
      scenarios.push({ name: `only ${missing}, ${flagsName}`, hasPermission: (_area, permission) => permission === missing, flags });
    }
  }
  return scenarios;
}

/**
 * What the menu of an area gives its user, asked of the functions of the sidebar and not of the palette: the entries of the
 * menus (`getContextNav`, what the sidebar draws) and the pages that hang from them, which the page of their entry links to
 * (`getNavChildren`, what `NavChildLinks` draws).
 */
function reachableFromTheMenu(area: AppContextKey, scenario: Scenario): Set<string> {
  const nav = getContextNav(area, scenario.hasPermission, scenario.flags);
  const inTheMenus = [...nav.sections.flatMap((section) => section.entries), ...nav.more];
  const children = inTheMenus.flatMap((entry) => getNavChildren(entry.path, scenario.hasPermission, scenario.flags));
  return new Set([...inTheMenus, ...children].map((entry) => entry.path));
}

const pagesOf = (context: ReturnType<typeof makeContext>) => navigationSource.getItems(context);

describe('the pages of the palette are the pages of the menu (UI-06)', () => {
  it.each(AREAS)(
    'NavigationSource_%s_NeverOffersAPageTheMenuWouldNotShowAndNeverHidesOneItWould',
    (area) => {
      const wrong: string[] = [];

      for (const scenario of scenariosFor(area)) {
        const context = makeContext({ areas: [area], hasPermission: scenario.hasPermission, flags: scenario.flags });
        const offered = pagesOf(context).map((entry) => entry.to);
        const expected = reachableFromTheMenu(area, scenario);

        for (const path of offered) if (!expected.has(path)) wrong.push(`${scenario.name}: ${path} is offered and the menu would not show it`);
        for (const path of expected) if (!offered.includes(path)) wrong.push(`${scenario.name}: ${path} is in the menu and missing`);
        if (new Set(offered).size !== offered.length) wrong.push(`${scenario.name}: a page twice`);
      }

      expect(wrong).toEqual([]);
    },
  );

  it('NavigationSource_ThePagesTheMenusNeverShow_AreNotOffered', () => {
    const context = makeContext({ areas: ['short-rent'] });

    const offered = pagesOf(context).map((entry) => entry.to);

    // Plan and billing are reached from the badge of the header, and the detail pages from their lists.
    for (const hidden of ['/app/short-rent/settings/plan', '/app/short-rent/settings/billing', '/app/short-rent/bookings/create']) {
      expect(offered).not.toContain(hidden);
    }
    expect(offered).toContain('/app/short-rent/bookings');
  });

  it('NavigationSource_APageThatHangsFromAnother_IsOfferedWithItsParentInTheSecondLine', () => {
    const context = makeContext({ areas: ['short-rent'] });

    const alloggiati = pagesOf(context).find((entry) => entry.to === '/app/short-rent/alloggiati');

    expect(alloggiati).toMatchObject({ kind: 'page', label: 'Alloggiati', subtitle: 'Adempimenti', area: 'short-rent' });
  });

  it('NavigationSource_OneArea_DoesNotRepeatTheNameOfTheAreaAndSeveralAreasDo', () => {
    const one = pagesOf(makeContext({ areas: ['short-rent'] })).find((entry) => entry.to === '/app/short-rent/bookings');
    expect(one?.subtitle).toBeUndefined();

    const both = pagesOf(makeContext({ areas: ['short-rent', 'long-rent'] }));
    expect(both.find((entry) => entry.to === '/app/short-rent/properties')).toMatchObject({ label: 'Immobili', subtitle: 'Affitti brevi' });
    expect(both.find((entry) => entry.to === '/app/long-rent/properties')).toMatchObject({ label: 'Immobili', subtitle: 'Affitti lunghi' });
    // A page that hangs from another says both.
    expect(both.find((entry) => entry.to === '/app/short-rent/alloggiati')?.subtitle).toBe('Adempimenti · Affitti brevi');
  });

  it('NavigationSource_AreasTheUserDoesNotHave_AreNotThere', () => {
    const owner = pagesOf(makeContext({ areas: ['short-rent'] })).map((entry) => entry.to);

    expect(owner.every((path) => path.startsWith('/app/short-rent'))).toBe(true);
    expect(owner).not.toContain('/app/admin/users');
    expect(owner).not.toContain('/app/long-rent/leases');
  });

  it('NavigationSource_TheLabelsAreInTheLanguageOfTheInterface', () => {
    const italian = pagesOf(makeContext({ areas: ['long-rent'], locale: 'it' }));
    const english = pagesOf(makeContext({ areas: ['long-rent'], locale: 'en' }));

    expect(italian.find((entry) => entry.to === '/app/long-rent/leases')?.label).toBe('Contratti');
    expect(english.find((entry) => entry.to === '/app/long-rent/leases')?.label).toBe('Leases');
    // The words that find a page are in the language too.
    expect(italian.find((entry) => entry.to === '/app/long-rent/leases')?.keywords).toContain('inquilini');
    expect(english.find((entry) => entry.to === '/app/long-rent/leases')?.keywords).toContain('tenants');
  });

  it('NavigationSource_APageWithOtherWords_CarriesThemAsKeywordsNotAsLabel', () => {
    const dashboard = pagesOf(makeContext({ areas: ['short-rent'] })).find((entry) => entry.to === '/app/short-rent');

    expect(dashboard?.keywords).toEqual(expect.arrayContaining(['oggi', 'home', 'panoramica']));
    expect(dashboard?.label).not.toContain('|');
  });

  it('NavigationSource_EveryPageOfTheMenus_HasAnIconALabelAndAPathWithNoParameter', () => {
    const everything = AREAS.flatMap((area) => pagesOf(makeContext({ areas: [area], flags: FLAGS_ON })));

    expect(everything.length).toBeGreaterThan(20);
    for (const entry of everything) {
      expect(entry.label.trim(), entry.id).not.toBe('');
      expect(entry.icon, entry.id).toBeTruthy();
      expect(entry.to, entry.id).toMatch(/^\/app\/[a-z-]+/);
      // A page with an `:id` could not be opened from here.
      expect(entry.to, entry.id).not.toContain(':');
      expect(entry.id).toBe(`page:${entry.to}`);
    }
  });

  it('NavigationSource_ThePagesTheMenusReach_AreAllInTheManifest', () => {
    const paths = new Set(ROUTE_MANIFEST.map((entry) => entry.path));
    const everything = AREAS.flatMap((area) => pagesOf(makeContext({ areas: [area], flags: FLAGS_ON })));

    for (const entry of everything) expect(paths.has(entry.to as string), entry.id).toBe(true);
  });
});
