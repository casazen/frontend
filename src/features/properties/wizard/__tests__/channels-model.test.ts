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
  missingStepsOf,
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

  it('theCinThatIsMissing_IsFixedInTheLastStep_NotInTheBaseTheServerFilesItUnder', () => {
    // A channel left to fix for the CIN alone: the server names `base` (the data of the property) but the CIN is asked for in the last step.
    const cin = status(row('booking_xml', { status: 'ToFix', errorCode: 'listing_cin_missing', missing: ['base'] }));

    expect(missingStepsOf(cin.channels[0]!, false)).toEqual(['finish']);
    expect(firstStepToFix(cin, false)).toBe('finish');
    expect(importedSteps(cin, false)).toEqual(['channels', 'finish']);

    // The CIN is valid (or not known): the row says what it says, nothing is moved.
    expect(missingStepsOf(cin.channels[0]!, true)).toEqual(['base']);
    expect(missingStepsOf(cin.channels[0]!)).toEqual(['base']);
    expect(firstStepToFix(cin, true)).toBe('base');
    expect(importedSteps(cin, true)).toEqual(['base', 'channels', 'finish']);
  });

  it('theCinThatIsMissing_AndAnotherReasonForBase_ShowsBothSteps_AChannelWithoutBaseShowsNeither', () => {
    // Left to fix for the photos while the CIN is missing as well: `base` may be the rooms or the CIN, so both can be reached.
    const both = row('booking_xml', { status: 'ToFix', errorCode: 'listing_photos_below_minimum', missing: ['base', 'photos'] });
    expect(missingStepsOf(both, false)).toEqual(['base', 'photos', 'finish']);

    // No `base` named: the CIN is not what lacks, whatever the property says.
    expect(missingStepsOf(row('booking_xml', { missing: ['photos'] }), false)).toEqual(['photos']);
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
