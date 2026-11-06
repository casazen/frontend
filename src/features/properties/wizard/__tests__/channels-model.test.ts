import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import type { ListingChannelStatus, ListingStatus } from '@/types';
import {
  CONTENT_CHANNELS,
  canTakeTheirs,
  channelEntries,
  firstStepToFix,
  importedSteps,
  missingSteps,
  publishProblemOf,
  selectedChannels,
} from '../channels-model';

const row = (channel: string, overrides: Partial<ListingChannelStatus> = {}): ListingChannelStatus => ({
  channel,
  status: 'Published',
  completeness: 100,
  missing: [],
  lastSyncedAt: null,
  syncLagSeconds: null,
  syncAlert: false,
  errorCode: null,
  reason: null,
  reasonDetail: null,
  changedOutside: [],
  ...overrides,
});

const status = (...channels: ListingChannelStatus[]): ListingStatus => ({ propertyId: 'p1', channels, cinNotSentTo: [] });

function problem(code: string, extra: Record<string, unknown> = {}, httpStatus = 409) {
  return new AxiosError('refused', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: httpStatus,
    statusText: 'Conflict',
    data: { code, ...extra },
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

describe('the channels of the step', () => {
  it('channelEntries_NeverPublished_ListsTheChannelsThatReceiveContent', () => {
    const entries = channelEntries(undefined);

    expect(entries.map((entry) => entry.code)).toEqual([...CONTENT_CHANNELS]);
    expect(entries.every((entry) => entry.row === null && entry.selectable && !entry.managed)).toBe(true);
  });

  it('channelEntries_AChannelManagedOnTheChannel_IsListedAndNotSelectable', () => {
    const entries = channelEntries(status(row('booking_xml'), row('expedia', { status: 'ManagedOnChannel' })));

    expect(entries.map((entry) => entry.code)).toEqual(['booking_xml', 'airbnb_xml', 'homeaway', 'expedia']);
    const expedia = entries.find((entry) => entry.code === 'expedia')!;
    expect(expedia).toMatchObject({ managed: true, selectable: false });
    expect(entries.find((entry) => entry.code === 'booking_xml')?.row?.status).toBe('Published');
  });

  it('selectedChannels_TheOnesThatReceiveContentLessTheOnesTheHostLeftOut', () => {
    const entries = channelEntries(status(row('expedia', { status: 'ManagedOnChannel' })));

    expect(selectedChannels(entries, [])).toEqual(['booking_xml', 'airbnb_xml', 'homeaway']);
    expect(selectedChannels(entries, ['airbnb_xml'])).toEqual(['booking_xml', 'homeaway']);
    expect(selectedChannels(entries, ['booking_xml', 'airbnb_xml', 'homeaway'])).toEqual([]);
  });
});

describe('the steps that lack data', () => {
  it('missingSteps_TheStepsOfTheStatusInTheOrderOfTheWizard_AndOnlyTheOnesTheWizardHas', () => {
    const current = status(row('booking_xml', { missing: ['prices', 'photos'] }), row('airbnb_xml', { missing: ['descriptions', 'photos', 'somethingNew'] }));

    expect(missingSteps(current)).toEqual(['photos', 'descriptions', 'prices']);
    expect(firstStepToFix(current)).toBe('photos');
    expect(firstStepToFix(status(row('booking_xml')))).toBe('channels');
  });

  it('importedSteps_AListingAlreadyOnTheChannels_OpensOnWhatLacksThenTheChannelsAndTheEnd', () => {
    expect(importedSteps(status(row('booking_xml', { missing: ['descriptions', 'base'] })))).toEqual(['base', 'descriptions', 'channels', 'finish']);
    // Nothing lacks: the host still sees the channels and the activation.
    expect(importedSteps(status(row('booking_xml')))).toEqual(['channels', 'finish']);
  });

  it('importedSteps_NoChannelYet_IsNull_TheWizardIsTheWholeOfIt', () => {
    expect(importedSteps(status())).toBeNull();
    expect(importedSteps(undefined)).toBeNull();
  });
});

describe('a refused publication', () => {
  it('publishProblemOf_TheCodesOfTheEndpoint_AreTheKindsTheStepAnswers', () => {
    expect(publishProblemOf(problem('octorate_mapping_unconfirmed'))).toEqual({ kind: 'mapping-unconfirmed' });
    expect(publishProblemOf(problem('octorate_existing_inventory_must_import'))).toEqual({ kind: 'must-import' });
    expect(publishProblemOf(problem('listing_modified_outside', { channels: ['airbnb_xml', 'booking_xml'] }))).toEqual({
      kind: 'modified-outside',
      channels: ['airbnb_xml', 'booking_xml'],
    });
    expect(publishProblemOf(problem('listing_content_incomplete', { missing: ['en.title', 'en.description'] }, 422))).toEqual({
      kind: 'content-incomplete',
      missing: ['en.title', 'en.description'],
    });
  });

  it('publishProblemOf_AnythingElse_IsKeptAsItIs', () => {
    const other = problem('listing_channels_required', {}, 422);

    expect(publishProblemOf(other)).toEqual({ kind: 'other', error: other });
    expect(publishProblemOf(new Error('network'))).toMatchObject({ kind: 'other' });
    // A list that is not a list of texts is no list.
    expect(publishProblemOf(problem('listing_content_incomplete', { missing: 'en.title' }, 422))).toEqual({ kind: 'content-incomplete', missing: [] });
  });
});

describe('a change made outside CasaZen', () => {
  it('canTakeTheirs_OnlyWhenTheDescriptionsAreTheOnlyGroupThatChanged', () => {
    expect(canTakeTheirs(['descriptions'])).toBe(true);
    expect(canTakeTheirs(['descriptions', 'rooms'])).toBe(false);
    expect(canTakeTheirs(['rooms'])).toBe(false);
    expect(canTakeTheirs([])).toBe(false);
  });
});
