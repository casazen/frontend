import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { AppContextKey } from '@/config/route-manifest';
import { getManifestCrumbs } from '../page-crumbs';

function crumbs(
  contextKey: AppContextKey,
  pathname: string,
  options: Partial<Parameters<typeof getManifestCrumbs>[0]> = {},
) {
  return getManifestCrumbs({ contextKey, pathname, current: 'Questa pagina', t: i18n.t.bind(i18n), ...options });
}

describe('getManifestCrumbs (UI-05)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('getManifestCrumbs_DetailOfAList_LeadsBackToTheListByItsMenuName', () => {
    expect(crumbs('short-rent', '/app/short-rent/bookings/3f2a9c10-aaaa-bbbb-cccc-1234567890ab')).toEqual([
      { label: 'Prenotazioni', to: '/app/short-rent/bookings' },
      { label: 'Questa pagina' },
    ]);
    expect(crumbs('long-rent', '/app/long-rent/properties/prop-1')).toEqual([
      { label: 'Immobili', to: '/app/long-rent/properties' },
      { label: 'Questa pagina' },
    ]);
  });

  it('getManifestCrumbs_PageDeeperThanADetail_SkipsTheRecordItHangsFrom', () => {
    // `/properties/:id` is one property, not a place with a name: the trail goes through the list.
    expect(crumbs('short-rent', '/app/short-rent/properties/prop-1/edit')).toEqual([
      { label: 'Immobili', to: '/app/short-rent/properties' },
      { label: 'Questa pagina' },
    ]);
  });

  it('getManifestCrumbs_PageThatHangsFromAnEntry_LeadsBackToThatEntry', () => {
    expect(crumbs('short-rent', '/app/short-rent/settings/site-appearance')).toEqual([
      { label: 'Sito di prenotazione', to: '/app/short-rent/vetrina' },
      { label: 'Questa pagina' },
    ]);
    expect(crumbs('short-rent', '/app/short-rent/alloggiati')).toEqual([
      { label: 'Adempimenti', to: '/app/short-rent/compliance' },
      { label: 'Questa pagina' },
    ]);
  });

  it('getManifestCrumbs_StaticSiblingOfADetail_IsNotTakenForTheDetail', () => {
    expect(crumbs('short-rent', '/app/short-rent/properties/create')).toEqual([
      { label: 'Immobili', to: '/app/short-rent/properties' },
      { label: 'Questa pagina' },
    ]);
  });

  it.each<[AppContextKey, string]>([
    ['short-rent', '/app/short-rent'],
    ['short-rent', '/app/short-rent/bookings'],
    ['long-rent', '/app/long-rent/properties'],
    ['supplier', '/app/supplier/dashboard'],
    ['admin', '/app/admin'],
  ])('getManifestCrumbs_%s_%s_HasNothingAboveItSoNoTrail', (contextKey, pathname) => {
    expect(crumbs(contextKey, pathname)).toEqual([]);
  });

  it('getManifestCrumbs_AddressTheManifestDoesNotKnow_HasNoTrail', () => {
    expect(crumbs('short-rent', '/app/short-rent/nowhere/at/all')).toEqual([]);
    // A page of another area is not looked for in this one.
    expect(crumbs('long-rent', '/app/short-rent/bookings/abc')).toEqual([]);
  });

  it('getManifestCrumbs_PageAboveIsOneTheUserMayNotOpen_IsLeftOutAndSoIsTheTrail', () => {
    const noPropertyRead = (_context: AppContextKey, permission: string) => permission !== 'property.read';

    expect(crumbs('long-rent', '/app/long-rent/properties/prop-1', { hasPermission: noPropertyRead })).toEqual([]);
    expect(crumbs('long-rent', '/app/long-rent/properties/prop-1', { hasPermission: () => true })).toHaveLength(2);
  });

  it('getManifestCrumbs_PageAboveIsBehindAFlag_NeedsTheFlagOn', () => {
    expect(crumbs('short-rent', '/app/short-rent/ota/create')).toEqual([]);
    expect(crumbs('short-rent', '/app/short-rent/ota/create', { features: { otaPartnerApi: false } })).toEqual([]);
    expect(crumbs('short-rent', '/app/short-rent/ota/create', { features: { otaPartnerApi: true } })).toEqual([
      { label: 'OTA', to: '/app/short-rent/ota' },
      { label: 'Questa pagina' },
    ]);
  });

  it('getManifestCrumbs_EnglishUi_NamesThePagesInEnglish', async () => {
    await i18n.changeLanguage('en');

    expect(crumbs('short-rent', '/app/short-rent/bookings/abc').map((crumb) => crumb.label)).toEqual(['Bookings', 'Questa pagina']);
  });

  it('getManifestCrumbs_TrailOfAPageItself_EndsWithTheNameItWasGiven', () => {
    const trail = crumbs('long-rent', '/app/long-rent/properties/prop-1', { current: 'Bilocale Monza' });

    expect(trail.at(-1)).toEqual({ label: 'Bilocale Monza' });
  });
});
