import { describe, expect, it } from 'vitest';
import { readDetail } from '@/lib/detail-address';
import { COMPLIANCE_COCKPIT_PATH, TICINO_LAYER_KIND, parseTicinoLayerId, ticinoLayerPath } from '../ticino-layer-address';

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

describe('address of the Ticino layer (E30/F02/US03)', () => {
  it('ticinoLayerPath_PropertyAndDay_IsTheCockpitWithTheLayerOpenOnThatDay', () => {
    expect(ticinoLayerPath(PROPERTY_ID, '2026-11-19')).toBe(`${COMPLIANCE_COCKPIT_PATH}?detail=${TICINO_LAYER_KIND}:${PROPERTY_ID}:2026-11-19`);
  });

  it('ticinoLayerPath_PropertyOnly_OpensOnTheFirstDayToNotify', () => {
    expect(ticinoLayerPath(PROPERTY_ID)).toBe(`/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}`);
    expect(ticinoLayerPath(PROPERTY_ID, null)).toBe(`/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}`);
  });

  it.each(['2026-11', '2026-02-31', '2026-13-01', '19/11/2026', '../x', '2026-11-19/../x', ''])('ticinoLayerPath_DayThatIsNotADay_%s_IsLeftOut', (day) => {
    expect(ticinoLayerPath(PROPERTY_ID, day)).toBe(`/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}`);
  });

  it.each([null, undefined, '', '../admin', 'a:b', 'a b', 'a/b', 'a?b=c', '-abc', '-'.repeat(65)])('ticinoLayerPath_PropertyAnAddressCannotHold_%s_IsTheCockpitAlone', (property) => {
    expect(ticinoLayerPath(property)).toBe('/app/short-rent/compliance');
  });

  it('ticinoLayerPath_TheColonIsWrittenAsItIs_NotAsAnEscape', () => {
    expect(ticinoLayerPath(PROPERTY_ID, '2026-11-19')).not.toContain('%3A');
  });

  it('parseTicinoLayerId_PropertyAndDay_GivesBothBack', () => {
    expect(parseTicinoLayerId(`${PROPERTY_ID}:2026-11-19`)).toEqual({ propertyId: PROPERTY_ID, day: '2026-11-19' });
    expect(parseTicinoLayerId(PROPERTY_ID)).toEqual({ propertyId: PROPERTY_ID });
  });

  it('parseTicinoLayerId_ADayThatIsNotADay_OpensTheProperty_NeverADateNobodyAskedFor', () => {
    expect(parseTicinoLayerId(`${PROPERTY_ID}:2026-02-31`)).toEqual({ propertyId: PROPERTY_ID });
    expect(parseTicinoLayerId(`${PROPERTY_ID}:soon`)).toEqual({ propertyId: PROPERTY_ID });
  });

  it.each(['', ':2026-11-19', `${PROPERTY_ID}:2026-11-19:more`, 'a.b', 'a/b'])('parseTicinoLayerId_IdThisLayerDoesNotMake_%s_IsNull', (id) => {
    expect(parseTicinoLayerId(id)).toBeNull();
  });

  it('ticinoLayerPath_TheDrawerReadsTheAddressBackAsTheKindAndTheIdOfTheLayer', () => {
    const { search } = new URL(ticinoLayerPath(PROPERTY_ID, '2026-11-19'), 'https://app.test');

    const ref = readDetail(search);
    expect(ref).toEqual({ kind: TICINO_LAYER_KIND, id: `${PROPERTY_ID}:2026-11-19` });
    expect(parseTicinoLayerId(ref!.id)).toEqual({ propertyId: PROPERTY_ID, day: '2026-11-19' });
  });
});
