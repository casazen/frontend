import { describe, expect, it } from 'vitest';
import type { NotificationPreferences } from '@/types';
import {
  channelAvailability,
  channelCell,
  eventRows,
  eventSave,
  quietHoursSave,
  toApiTime,
  toTimeFieldValue,
  withChannel,
  type ChannelAvailability,
} from '../notification-preferences-model';
import { defaultPreferences } from './notification-preferences-fixtures';

/** Browser push cannot deliver yet; the other three can. */
const AVAILABILITY: ChannelAvailability = { MobilePush: true, BrowserPush: false, Email: true, CounterOnly: true };

describe('the rows of the page (E05/F03/US02)', () => {
  it('eventRows_NewUser_HasOneRowForEachKindOfEventInTheOrderOfTheApiAllMarkedAsDefault', () => {
    const rows = eventRows(defaultPreferences());

    expect(rows.map((row) => row.eventType)).toEqual([
      'NewGuestMessage',
      'UrgentGuestMessage',
      'AiDraftToApprove',
      'NewBooking',
      'BookingCancelled',
      'LegalDeadline',
      'SyncError',
      'ScheduledMessageIssue',
    ]);
    expect(rows.every((row) => row.isDefault)).toBe(true);
    // PO-10: a new guest message is a push and the counter.
    expect(rows[0].channels).toEqual(['MobilePush', 'CounterOnly']);
  });

  it('eventRows_AKindOfEventTheApiRepeatsOrThePageDoesNotKnow_IsShownOnceOrNotAtAll', () => {
    const preferences = defaultPreferences();
    const odd = {
      ...preferences,
      events: [
        ...preferences.events,
        { ...preferences.events[0], channels: ['Email' as const], isDefault: false },
        { eventType: 'SomethingNew', channels: ['Email'], isDefault: true },
      ],
    } as unknown as NotificationPreferences;

    const rows = eventRows(odd);

    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({ eventType: 'NewGuestMessage', channels: ['MobilePush', 'CounterOnly'], isDefault: true });
  });

  it('eventRows_ChannelsOutOfOrderOrUnknown_AreGivenInTheOrderOfTheColumnsWithoutTheUnknownOnes', () => {
    const preferences = defaultPreferences();
    const odd = {
      ...preferences,
      events: [{ eventType: 'NewBooking', channels: ['CounterOnly', 'Carrier', 'MobilePush', 'CounterOnly'], isDefault: false }],
    } as unknown as NotificationPreferences;

    expect(eventRows(odd)[0].channels).toEqual(['MobilePush', 'CounterOnly']);
  });

  it('channelAvailability_ChannelNotListedOrNotAvailable_CannotDeliver', () => {
    const preferences = defaultPreferences();
    preferences.availableChannels = preferences.availableChannels.filter((item) => item.channel !== 'Email');

    expect(channelAvailability(preferences)).toEqual({ MobilePush: true, BrowserPush: false, Email: false, CounterOnly: true });
  });
});

describe('what a switch can do (E05/F03/US02, AC-NF65-3)', () => {
  it('channelCell_ChannelThatCannotDeliver_IsOffAndDisabledWhateverIsStored', () => {
    expect(channelCell('NewBooking', ['MobilePush', 'BrowserPush'], 'BrowserPush', AVAILABILITY)).toEqual({
      checked: false,
      disabled: true,
      lock: 'unavailable',
    });
  });

  it('channelCell_LastChannelOfTheLegalDeadline_IsOnAndLocked', () => {
    expect(channelCell('LegalDeadline', ['Email'], 'Email', AVAILABILITY)).toEqual({
      checked: true,
      disabled: true,
      lock: 'last-legal-channel',
    });
    // The others of the row can still be switched on.
    expect(channelCell('LegalDeadline', ['Email'], 'MobilePush', AVAILABILITY)).toEqual({ checked: false, disabled: false, lock: null });
  });

  it('channelCell_LegalDeadlineWithTwoChannels_CanLoseEitherOfThem', () => {
    expect(channelCell('LegalDeadline', ['MobilePush', 'Email'], 'Email', AVAILABILITY).disabled).toBe(false);
    expect(channelCell('LegalDeadline', ['MobilePush', 'Email'], 'MobilePush', AVAILABILITY).disabled).toBe(false);
  });

  it('channelCell_ChannelStoredThatCannotDeliver_DoesNotCountAsAChannelOfTheLegalDeadline', () => {
    // Browser push is stored next to the email: only the email delivers, so it is the last channel.
    expect(channelCell('LegalDeadline', ['BrowserPush', 'Email'], 'Email', AVAILABILITY).lock).toBe('last-legal-channel');
    // Only browser push is stored: nothing delivers, so the email can be switched on.
    expect(channelCell('LegalDeadline', ['BrowserPush'], 'Email', AVAILABILITY)).toEqual({ checked: false, disabled: false, lock: null });
  });

  it('channelCell_LastChannelOfAnotherKindOfEvent_CanBeSwitchedOff', () => {
    expect(channelCell('BookingCancelled', ['CounterOnly'], 'CounterOnly', AVAILABILITY)).toEqual({
      checked: true,
      disabled: false,
      lock: null,
    });
  });
});

describe('the channels a switch saves (E05/F03/US02, AC-NF65-1 and AC-NF65-3)', () => {
  it('withChannel_SwitchOn_AddsTheChannelInTheOrderOfTheColumns', () => {
    expect(withChannel('NewBooking', ['CounterOnly', 'MobilePush'], 'Email', true, AVAILABILITY)).toEqual([
      'MobilePush',
      'Email',
      'CounterOnly',
    ]);
  });

  it('withChannel_SwitchOff_TakesTheChannelAwayAndKeepsTheOthers', () => {
    expect(withChannel('NewBooking', ['MobilePush', 'CounterOnly'], 'MobilePush', false, AVAILABILITY)).toEqual(['CounterOnly']);
  });

  it('withChannel_OtherKindOfEvent_MayEndWithNoChannelAtAll', () => {
    expect(withChannel('BookingCancelled', ['CounterOnly'], 'CounterOnly', false, AVAILABILITY)).toEqual([]);
  });

  it('withChannel_LegalDeadlineWouldEndWithNoChannel_IsRefusedAndNothingIsSent', () => {
    expect(withChannel('LegalDeadline', ['Email'], 'Email', false, AVAILABILITY)).toBeNull();
    // With a second channel on the same switch is fine.
    expect(withChannel('LegalDeadline', ['Email', 'CounterOnly'], 'Email', false, AVAILABILITY)).toEqual(['CounterOnly']);
  });

  it('withChannel_ChannelThatCannotDeliver_IsRefusedAndNeverSent', () => {
    expect(withChannel('NewBooking', ['MobilePush'], 'BrowserPush', true, AVAILABILITY)).toBeNull();
    // A stored channel that cannot deliver is not written back with the change of another one: the server refuses the whole save for it.
    expect(withChannel('NewBooking', ['MobilePush', 'BrowserPush'], 'Email', true, AVAILABILITY)).toEqual(['MobilePush', 'Email']);
  });

  it('eventSave_OneKindOfEvent_IsTheOnlyOneInTheRequest', () => {
    expect(eventSave('NewBooking', ['MobilePush'])).toEqual({ events: [{ eventType: 'NewBooking', channels: ['MobilePush'] }] });
  });
});

describe('the quiet hours as a time field has them (E05/F03/US02)', () => {
  it.each([
    ['22:00:00', '22:00'],
    ['08:30:00', '08:30'],
    ['08:30', '08:30'],
    ['23:59:59.1234567', '23:59'],
    ['', ''],
    ['not a time', ''],
  ])('toTimeFieldValue_%s_Is%s', (fromTheApi, inTheField) => {
    expect(toTimeFieldValue(fromTheApi)).toBe(inTheField);
  });

  it.each<[string, string | null]>([
    ['22:00', '22:00:00'],
    ['00:00', '00:00:00'],
    ['23:59', '23:59:00'],
    ['', null],
    ['24:00', null],
    ['12:60', null],
    ['8:00', null],
  ])('toApiTime_%s_Is%s', (inTheField, forTheApi) => {
    expect(toApiTime(inTheField)).toBe(forTheApi);
  });

  it('quietHoursSave_BothTimes_AreSentAsHoursMinutesAndSeconds', () => {
    expect(quietHoursSave({ start: '23:30', end: '07:15' })).toEqual({ quietHours: { start: '23:30:00', end: '07:15:00' } });
  });

  it('quietHoursSave_AFieldIsEmpty_SendsNothing', () => {
    expect(quietHoursSave({ start: '', end: '07:15' })).toBeNull();
    expect(quietHoursSave({ start: '23:30', end: '' })).toBeNull();
  });
});
