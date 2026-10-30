import { describe, expect, it } from 'vitest';
import { townPoint } from '../engine/region/registry';
import { isPositionSet, roundCoord } from '../engine/view';
import { loadRegionData } from '../load';

/**
 * A house whose host never gave the coordinates is stored with `0, 0`, and the public data carry it as it is: it must not be taken for
 * a place (the Gulf of Guinea, where every pin of such a site used to go and be refused as «Posizione non disponibile»), and the
 * map puts it at its comune instead, from the towns of its own data.
 */
describe('isPositionSet', () => {
  it('isPositionSet_ZeroZero_IsNotAPosition', () => {
    expect(isPositionSet(0, 0)).toBe(false);
    expect(isPositionSet(0.0, -0)).toBe(false);
  });

  it('isPositionSet_NotNumbers_IsNotAPosition', () => {
    expect(isPositionSet(Number.NaN, 9.1)).toBe(false);
    expect(isPositionSet(45.8, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isPositionSet(undefined, undefined)).toBe(false);
    expect(isPositionSet(null, 9.1)).toBe(false);
    expect(isPositionSet('45.8', '9.1')).toBe(false);
  });

  it('isPositionSet_ARealPlace_IsAPosition', () => {
    expect(isPositionSet(45.81, 9.08)).toBe(true);
    // One zero is a real line of the globe (the Greenwich meridian, the equator): only both together mean «not set».
    expect(isPositionSet(51.48, 0)).toBe(true);
    expect(isPositionSet(0, 9.1)).toBe(true);
  });
});

describe('townPoint', () => {
  it('townPoint_DataNotLoadedYet_IsNull', () => {
    expect(townPoint('Como')).toBeNull();
  });

  it('townPoint_AfterTheBaseIsLoaded_FindsAComuneByNameWhateverTheCaseAndTheAccents', async () => {
    await loadRegionData('italia');

    const como = townPoint('Como');
    expect(como).not.toBeNull();
    expect(como?.lat).toBeCloseTo(45.81, 0);
    expect(como?.lon).toBeCloseTo(9.08, 0);
    expect(townPoint('  MILANO ')?.lat).toBeCloseTo(45.46, 0);
    expect(townPoint('roma')?.lon).toBeCloseTo(12.5, 0);
  });

  it('townPoint_AFoundTown_IsAPublicPointWithTwoDecimalsAtMost', () => {
    for (const name of ['Como', 'Milano', 'Roma', 'Firenze']) {
      const point = townPoint(name);
      expect(point, name).not.toBeNull();
      expect(roundCoord(point!.lat), name).toBe(point!.lat);
      expect(roundCoord(point!.lon), name).toBe(point!.lon);
    }
  });

  it('townPoint_UnknownOrEmptyName_IsNull', () => {
    expect(townPoint('Atlantide')).toBeNull();
    expect(townPoint('')).toBeNull();
    expect(townPoint('   ')).toBeNull();
    expect(townPoint(undefined)).toBeNull();
    expect(townPoint(null)).toBeNull();
  });
});
