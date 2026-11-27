import { describe, expect, it } from 'vitest';
import type { OctorateListing } from '@/types';
import { channelRowMode, checkPortalIds, connectableStructures, isPortalId, portalGuide, type ChannelRowMode } from '../channel-connect-model';
import type { ChannelAccessView } from '../existing-inventory';
import { listing } from './octorate-fixtures';

describe('the ids of the structures on a portal (E02/F01/US03)', () => {
  const structures = [{ octorateAccommodationId: 'acc-1' }, { octorateAccommodationId: 'acc-2' }, { octorateAccommodationId: 'acc-3' }];

  it('isPortalId_LettersNumbersDotsDashesAndUnderscoresUpToSixtyFourCharacters_AndNothingElse', () => {
    for (const value of ['12345678', 'ab.c_d-9', 'A', 'x'.repeat(64)]) expect(isPortalId(value), value).toBe(true);
    for (const value of ['', 'ab cd', 'a/b', 'é1', 'id;drop', '<1>', 'x'.repeat(65)]) expect(isPortalId(value), value).toBe(false);
  });

  it('checkPortalIds_OnlyTheStructuresThatHaveAnId_AreSentTrimmedInTheOrderTheyAreListed', () => {
    // An id written for a structure that is not on the list is not sent, and neither is a structure left empty.
    const check = checkPortalIds(structures, { 'acc-9': '999', 'acc-3': ' 333 ', 'acc-1': '111', 'acc-2': '   ' });

    expect(check.accommodations).toEqual([
      { accommodationId: 'acc-1', hotelId: '111' },
      { accommodationId: 'acc-3', hotelId: '333' },
    ]);
    expect(check.invalid).toEqual([]);
    expect(checkPortalIds(structures, {}).accommodations).toEqual([]);
    // A name of the prototype is no id.
    expect(checkPortalIds([{ octorateAccommodationId: 'constructor' }], {}).accommodations).toEqual([]);
  });

  it('checkPortalIds_AnIdThatIsNotValid_IsFlaggedAndNothingElseIs', () => {
    expect(checkPortalIds(structures, { 'acc-1': '111', 'acc-2': 'a b', 'acc-3': 'x'.repeat(65) }).invalid).toEqual(['acc-2', 'acc-3']);
  });

  it('connectableStructures_LeavesOutTheListingsTheHostSaidAreNotTheirs', () => {
    const listings: OctorateListing[] = [
      listing({ octorateAccommodationId: 'acc-1' }),
      listing({ octorateAccommodationId: 'acc-2', status: 'Rejected' }),
      listing({ octorateAccommodationId: 'acc-3', status: 'Confirmed' }),
    ];

    expect(connectableStructures(listings).map((item) => item.octorateAccommodationId)).toEqual(['acc-1', 'acc-3']);
    expect(connectableStructures(undefined)).toEqual([]);
  });
});

describe('channelRowMode, what a channel that is not connected asks of the host', () => {
  const mode = (input: { byId?: boolean; view?: ChannelAccessView; idsSent?: boolean; reading?: boolean; structures?: number }): ChannelRowMode =>
    channelRowMode({ byId: true, view: 'notStarted', idsSent: false, reading: false, structures: 2, ...input });

  it('channelRowMode_PortalConnectedById_AsksTheIdsThenTheApprovalOnThePortalAndTheIdsAgainIfTheAccessStopped', () => {
    expect(mode({})).toBe('ids');
    for (const view of ['notStarted', 'waiting', 'verifying', 'needsConfirmation'] as const) expect(mode({ view, idsSent: true }), view).toBe('lastStep');
    expect(mode({ view: 'error', idsSent: true })).toBe('ids');
    expect(mode({ view: 'error' })).toBe('ids');
  });

  it('channelRowMode_EverythingElse_IsThePanel_AndWhileTheStructuresAreReadNothingIsOffered', () => {
    // A portal that is not connected by id; no structure to ask the id of; an access already followed on the panel.
    for (const view of ['notStarted', 'waiting', 'verifying', 'needsConfirmation', 'error'] as const) expect(mode({ byId: false, view, idsSent: true }), view).toBe('panel');
    expect(mode({ structures: 0 })).toBe('panel');
    for (const view of ['waiting', 'verifying', 'needsConfirmation'] as const) expect(mode({ view }), view).toBe('panel');
    // Reading: no flash of the panel, and what is already known wins.
    expect(mode({ reading: true })).toBe('reading');
    expect(mode({ reading: true, idsSent: true })).toBe('lastStep');
    expect(mode({ reading: true, view: 'waiting' })).toBe('panel');
  });
});

describe('portalGuide', () => {
  it('portalGuide_APortalCasazenDoesNotKnowByCode_GetsTheGeneralWordsAndNoLink_WhateverTheCodeIs', () => {
    for (const code of ['271', '', 'constructor', '__proto__']) {
      const guide = portalGuide(code);
      expect(guide.panelHintKey, code).toBe('octorate.connect.existing.channels.panelHint.other');
      expect(guide.lastStepKey, code).toBe('octorate.connect.existing.channels.byId.lastStep.other');
      expect(guide.extranet, code).toBeNull();
    }
  });
});
