import { describe, expect, it } from 'vitest';
import { MAIN_SALES_CHANNEL_CODES, splitMainChannels } from '../lib/main-channels';

const portal = (code: string) => ({ code, name: `Portal ${code}` });
const codes = (list: { code: string }[]) => list.map((entry) => entry.code);

describe('splitMainChannels («i principali» and «Visualizza altri»)', () => {
  it('splitMainChannels_ShowsTheMainChannelsInTheirOrder_AndKeepsTheOthersInTheCatalogOrder', () => {
    // The catalog's order (preferred first, then by name) is not the order of the main channels.
    const catalog = ['271', '274', '142', '277', '4', '518', '235', '333', '369', '596'].map(portal);

    const split = splitMainChannels(catalog);

    expect(codes(split.main)).toEqual([...MAIN_SALES_CHANNEL_CODES]);
    expect(codes(split.others)).toEqual(['277', '518', '596']);
  });

  it('splitMainChannels_AChannelHeldInView_IsNeverHidden', () => {
    const catalog = ['277', '142', '518', '274'].map(portal);

    const split = splitMainChannels(catalog, (entry) => entry.code === '518');

    expect(codes(split.main)).toEqual(['142', '274', '518']);
    expect(codes(split.others)).toEqual(['277']);
  });

  it('splitMainChannels_NoMainChannelInTheList_HidesNothing', () => {
    const catalog = ['PORTAL1', 'booking_xml'].map(portal);

    const split = splitMainChannels(catalog);

    expect(codes(split.main)).toEqual(['PORTAL1', 'booking_xml']);
    expect(split.others).toEqual([]);
  });
});
