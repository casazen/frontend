import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { getDetail } from '@/components/shared/detail-drawer/detail-registry';
import { TICINO_LAYER_KIND } from '@/features/compliance/ticino/ticino-layer-address';
// The one file the shell loads to register the kinds of the drawer.
import '../detail-kinds';
import { ROUTE_MANIFEST, getNavMatchEntries, getVisibleNavEntries, hasEntryPermission } from '../route-manifest';

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const OLD_PATH = '/app/short-rent/compliance/ticino';
const COCKPIT_PATH = '/app/short-rent/compliance';
const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === OLD_PATH);

/** The source of the old page: it must draw nothing of its own (E30/F02/US03/T02, AC4: no parallel Swiss compliance page remains). */
const pageSource = Object.values(import.meta.glob<string>('/src/pages/SwissCompliancePage.tsx', { query: '?raw', import: 'default', eager: true }))[0];

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

/** The old address opened the way a link does, with the page the manifest gives it, and where it ends up. */
async function openOldAddress(search: string) {
  const page = await entry!.component();
  const Page = page.default;
  render(
    <MemoryRouter initialEntries={[`${OLD_PATH}${search}`]}>
      <Routes>
        <Route path={OLD_PATH} element={<Page />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  return (await screen.findByTestId('where')).textContent;
}

afterEach(cleanup);

describe('route manifest: the guided notification to the Ticino police as a layer (E30/F02/US03/T02)', () => {
  it('RouteManifest_OldAddressOfThePage_StaysForWhoReadsTheBookingsInNoMenuAndWithoutAFlag', () => {
    expect(entry).toBeDefined();
    expect(entry?.context).toBe('short-rent');
    expect(entry?.requiredPermissions).toEqual(['booking.read']);
    expect(entry?.featureFlag).toBeUndefined();
    expect(entry?.navPlacement).toBeUndefined();
    expect(entry?.navParent).toBeUndefined();
    expect(entry?.navKey).toBeUndefined();
    expect(getVisibleNavEntries('short-rent', () => true).map((page) => page.path)).not.toContain(OLD_PATH);
    expect(getNavMatchEntries('short-rent', () => true).map((page) => page.path)).not.toContain(OLD_PATH);
    expect(entry && hasEntryPermission(entry, (_context, permission) => permission === 'booking.read')).toBe(true);
    expect(entry && hasEntryPermission(entry, () => false)).toBe(false);
  });

  it('RouteManifest_TheLayerIsAKindOfTheDrawerThatTheShellRegisters_WithNoPageOfItsOwn', () => {
    const def = getDetail(TICINO_LAYER_KIND);

    expect(def).toBeDefined();
    expect(def?.width).toBe('wide');
    // No «Apri la scheda completa»: the page is gone, the layer is what there is.
    expect(def?.pageHref).toBeUndefined();
  });

  it('RouteManifest_TheCockpitIsWhereTheLayerOpens_AndAsksWhatTheLayerNeeds', () => {
    const cockpit = ROUTE_MANIFEST.find((candidate) => candidate.path === COCKPIT_PATH);

    expect(cockpit?.requiredPermissions).toEqual(expect.arrayContaining(['property.read', 'booking.read']));
  });

  it('RouteManifest_OldAddressWithPropertyAndDay_RedirectsToTheCockpitWithTheLayerOpenOnThem', async () => {
    expect(await openOldAddress(`?property=${PROPERTY_ID}&date=2026-11-19`)).toBe(`${COCKPIT_PATH}?detail=ticino:${PROPERTY_ID}:2026-11-19`);
  });

  it('RouteManifest_OldAddressWithoutADay_OpensTheLayerOnTheFirstDayToNotify', async () => {
    expect(await openOldAddress(`?property=${PROPERTY_ID}`)).toBe(`${COCKPIT_PATH}?detail=ticino:${PROPERTY_ID}`);
  });

  it('RouteManifest_OldAddressWithADayThatIsNotADay_LeavesTheDayOut', async () => {
    expect(await openOldAddress(`?property=${PROPERTY_ID}&date=soon`)).toBe(`${COCKPIT_PATH}?detail=ticino:${PROPERTY_ID}`);
  });

  it.each(['', '?property=', '?property=../admin', '?property=a:b', '?date=2026-11-19'])('RouteManifest_OldAddress%s_WithoutAPropertyAnAddressCanHold_OpensTheCockpitAlone', async (search) => {
    expect(await openOldAddress(search)).toBe(COCKPIT_PATH);
  });

  it('RouteManifest_OldPage_DrawsNothingOfItsOwn', () => {
    expect(pageSource).toMatch(/export function SwissCompliancePage\b/);
    // A page of its own would be the parallel page the layer replaced: no shell, no header, no read of the days, no upload.
    expect(pageSource).not.toMatch(/AppShell|PageHeader|useTicinoDay|useUploadReceipt|useDownloadTicinoFile|PlainSection/);
  });
});
