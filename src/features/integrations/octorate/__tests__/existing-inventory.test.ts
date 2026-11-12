import { describe, expect, it } from 'vitest';
import type { ExistingImportStatus, ExistingInventoryChannel } from '@/types';
import { IMPORT_SEQUENCE, importSequence, isAtMapping, isImporting, shouldStartRun } from '../existing-inventory';

const ROOMS_IN = '2026-11-10T10:05:00Z';

function channel(overrides: Partial<ExistingInventoryChannel> = {}): ExistingInventoryChannel {
  return {
    channelCode: 'booking_xml',
    status: 'AwaitingChannelAccess',
    errorCode: null,
    accessState: 'Verified',
    accessCompletedAt: null,
    roomsImportedAt: null,
    completedAt: null,
    counts: { found: 0, roomsImported: 0, confirmed: 0, pending: 0, leftForLater: 0, rejected: 0, outOfScope: 0, reservationsImported: 0, calendarImported: 0, connected: 0, failed: 0 },
    capabilities: { importRooms: true, importReservations: true, importCalendar: true, markConnected: true },
    items: [],
    ...overrides,
  };
}

/** What each step of the sequence is, in the order of the sequence. */
const statesOf = (stateOfChannel: ExistingInventoryChannel) => importSequence(stateOfChannel).map((step) => step.state);

const EVERYTHING_BROUGHT_IN = { found: 2, roomsImported: 2, confirmed: 2, pending: 0, leftForLater: 0, rejected: 0, outOfScope: 0, reservationsImported: 2, calendarImported: 2, connected: 0, failed: 0 };

describe('importSequence, the durable sequence of a channel (E02/F01/US03/T02, D6)', () => {
  it('importSequence_IsTheSequenceOfTheWizardInItsOrder', () => {
    expect(importSequence(channel()).map((step) => step.id)).toEqual(['rooms', 'mapping', 'reservations', 'calendar', 'connected']);
    expect(importSequence(channel()).map((step) => step.id)).toEqual([...IMPORT_SEQUENCE]);
  });

  it('importSequence_EveryStatusThatIsNotCompleted_NeverShowsTheLastStepDone', () => {
    const notCompleted: ExistingImportStatus[] = ['Draft', 'AwaitingChannelAccess', 'ImportingRooms', 'AwaitingMapping', 'ImportingReservations', 'ImportingCalendar', 'MarkingConnected', 'Failed', 'NeedsAttention'];

    for (const status of notCompleted) {
      // Even with everything counted as brought in: only the server's own word closes the sequence.
      const sequence = importSequence(channel({ status, roomsImportedAt: ROOMS_IN, counts: EVERYTHING_BROUGHT_IN }));
      expect(sequence[sequence.length - 1]?.state, status).not.toBe('done');
    }
  });

  it('importSequence_Completed_ShowsEveryStepDone', () => {
    expect(statesOf(channel({ status: 'Completed', roomsImportedAt: ROOMS_IN, counts: EVERYTHING_BROUGHT_IN }))).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('importSequence_ChannelThatWorks_HasItsCurrentStepAndTheOnesBeforeItDone', () => {
    expect(statesOf(channel({ status: 'ImportingRooms' }))).toEqual(['current', 'pending', 'pending', 'pending', 'pending']);
    expect(statesOf(channel({ status: 'ImportingReservations', roomsImportedAt: ROOMS_IN }))).toEqual(['done', 'done', 'current', 'pending', 'pending']);
    expect(statesOf(channel({ status: 'ImportingCalendar', roomsImportedAt: ROOMS_IN }))).toEqual(['done', 'done', 'done', 'current', 'pending']);
    expect(statesOf(channel({ status: 'MarkingConnected', roomsImportedAt: ROOMS_IN }))).toEqual(['done', 'done', 'done', 'done', 'current']);
  });

  it('importSequence_ChannelThatHasNotStarted_HasNothingDoneAndNothingCurrent', () => {
    expect(statesOf(channel({ status: 'Draft' }))).toEqual(['pending', 'pending', 'pending', 'pending', 'pending']);
    expect(statesOf(channel({ status: 'AwaitingChannelAccess' }))).toEqual(['pending', 'pending', 'pending', 'pending', 'pending']);
  });

  it('importSequence_ChannelAtTheMapping_WaitsForTheHostThere', () => {
    expect(statesOf(channel({ status: 'AwaitingMapping', roomsImportedAt: ROOMS_IN }))).toEqual(['done', 'attention', 'pending', 'pending', 'pending']);
  });

  it('importSequence_ChannelThatStopped_StopsWhereItsCountsSayAndTheNextStepsAreNotDone', () => {
    const counts = { ...EVERYTHING_BROUGHT_IN };
    // No rooms in: it stopped at the first step.
    expect(statesOf(channel({ status: 'Failed' }))).toEqual(['attention', 'pending', 'pending', 'pending', 'pending']);
    // Listings still to decide: at the matching.
    expect(statesOf(channel({ status: 'NeedsAttention', roomsImportedAt: ROOMS_IN, counts: { ...counts, pending: 1 } }))).toEqual(['done', 'attention', 'pending', 'pending', 'pending']);
    // Reservations short of the confirmed listings: at the reservations.
    expect(statesOf(channel({ status: 'Failed', roomsImportedAt: ROOMS_IN, counts: { ...counts, reservationsImported: 1 } }))).toEqual(['done', 'done', 'attention', 'pending', 'pending']);
    // Calendars short of the confirmed listings: at the calendars.
    expect(statesOf(channel({ status: 'NeedsAttention', roomsImportedAt: ROOMS_IN, counts: { ...counts, calendarImported: 1 } }))).toEqual(['done', 'done', 'done', 'attention', 'pending']);
  });
});

describe('what the screens of the import wait for (E02/F01/US03/T02, D6)', () => {
  it('shouldStartRun_OnlyAChannelWhoseAccessIsGivenAndWhoseRoomsAreNotIn_StartsTheImportByItself', () => {
    const batchOf = (channels: ExistingInventoryChannel[]) => ({ channels }) as Parameters<typeof shouldStartRun>[0];

    expect(shouldStartRun(batchOf([channel({ accessState: 'Verified', status: 'AwaitingChannelAccess' })]))).toBe(true);
    expect(shouldStartRun(batchOf([channel({ accessState: 'Confirmed', status: 'Draft' })]))).toBe(true);
    // The access is not given, the rooms are in, or the channel stopped: nothing starts by itself (a channel that stopped is run again by the host).
    expect(shouldStartRun(batchOf([channel({ accessState: 'Waiting', status: 'AwaitingChannelAccess' })]))).toBe(false);
    expect(shouldStartRun(batchOf([channel({ accessState: 'Verified', status: 'AwaitingMapping' })]))).toBe(false);
    expect(shouldStartRun(batchOf([channel({ accessState: 'Verified', status: 'Failed' })]))).toBe(false);
    expect(shouldStartRun(undefined)).toBe(false);
  });

  it('isAtMapping_IsTrueOnlyWhenSomeChannelWaitsForTheHostAndNoneIsStillImporting', () => {
    const batchOf = (channels: ExistingInventoryChannel[]) => ({ channels }) as Parameters<typeof isAtMapping>[0];

    expect(isAtMapping(batchOf([channel({ status: 'AwaitingMapping' })]))).toBe(true);
    expect(isAtMapping(batchOf([channel({ status: 'AwaitingMapping' }), channel({ channelCode: 'airbnb_xml', status: 'ImportingRooms' })]))).toBe(false);
    expect(isAtMapping(batchOf([channel({ status: 'Completed' })]))).toBe(false);
    expect(isAtMapping(undefined)).toBe(false);
    expect(isImporting(batchOf([channel({ status: 'ImportingCalendar' })]))).toBe(true);
    expect(isImporting(batchOf([channel({ status: 'AwaitingMapping' })]))).toBe(false);
  });
});
