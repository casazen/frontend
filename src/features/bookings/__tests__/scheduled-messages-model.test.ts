import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '@/i18n/config';
import type { ScheduledMessage, ScheduledMessageStatus } from '@/types';
import {
  FIX_LABEL_KEYS,
  PLACEHOLDER_KEYS,
  TEMPLATE_VARIABLES,
  asInstant,
  channelLineOf,
  endedReasonOf,
  failureReasonOf,
  formatOnPropertyClock,
  hasOpenMessage,
  isAboutToChange,
  isTemplateVariable,
  missingCodesOf,
  missingCodesOfProblem,
  missingFromText,
  missingItemOf,
  sortedInTimeOrder,
  splitPlaceholders,
  statusViewOf,
  variablesUsedIn,
  withVariablesInPlaceOfStandIns,
} from '../lib/scheduled-messages';

// The words the section «Messaggi programmati» says about a message (E05/F07/US02, NF-71): what the model gives for each state, reason and channel the server can send.

function message(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    id: 'm-1',
    bookingId: 'b-1',
    routineId: 'r-1',
    routineName: 'Messaggio di arrivo',
    actionIndex: 0,
    plannedAtUtc: '2026-11-24T07:00:00Z',
    timeZone: 'Europe/Rome',
    status: 'Scheduled',
    blockedReason: null,
    skipReason: null,
    edited: false,
    outsideHours: false,
    sentAt: null,
    sentThreadKey: null,
    channel: 'Ota',
    channelReason: null,
    text: 'Ciao Mario',
    missingVariables: [],
    canEdit: true,
    canSkip: true,
    canSendNow: true,
    ...overrides,
  };
}

const STATUSES: ScheduledMessageStatus[] = ['Scheduled', 'Sent', 'Skipped', 'Blocked', 'Failed', 'Expired', 'Cancelled'];

/** Every code of the server that says why a message waits (`ScheduledMessageReasons`, the thirteen variables of a template). */
const VARIABLES = TEMPLATE_VARIABLES.map((variable) => variable.name);
const BLOCKED_CODES = [
  ...VARIABLES.map((name) => `variable_missing:${name}`),
  'id_not_verified',
  'access_code_held',
  'template_missing',
  'message_text_invalid',
  'check_in_in_progress',
];
const ENDED_CODES = [
  'channel_rule',
  'contact_unavailable',
  'mapping_not_confirmed',
  'campaign_needs_consent',
  'check_in_completed',
  'check_in_with_operator',
  'check_in_not_open',
  'booking_cancelled',
  'routine_inactive',
  'condition_not_met',
  'missed',
  'check_out_reached',
];
const FAILURE_CODES = ['chat_not_licensed', 'octorate_message_error', 'octorate_rate_limited', 'octorate_unavailable', 'message_unconfirmed', 'manual_verify'];
const NO_CHANNEL_CODES = ['mapping_not_confirmed', 'thread_closed', 'no_conversation', 'contact_info_unavailable', 'octorate_not_connected', 'channel_unknown'];

/** Every key the model can give for those codes. */
function everyKey(): string[] {
  const keys: string[] = [];
  for (const status of STATUSES) keys.push(statusViewOf(status).labelKey);
  keys.push(statusViewOf('SomethingNew').labelKey);
  for (const code of BLOCKED_CODES) keys.push(missingItemOf(code).itemKey);
  keys.push(missingItemOf('a-code-of-a-later-server').itemKey);
  for (const place of Object.values(FIX_LABEL_KEYS)) keys.push(place);
  for (const status of ['Skipped', 'Cancelled', 'Expired'] as const) {
    for (const code of [...ENDED_CODES, 'person', 'a-code-of-a-later-server']) {
      const ended = endedReasonOf({ status, skipReason: code });
      if (ended) keys.push(ended.reasonKey);
    }
  }
  for (const code of [...FAILURE_CODES, 'a-code-of-a-later-server', null]) keys.push(failureReasonOf(code).reasonKey);
  for (const channel of ['Ota', 'Direct', 'Email', 'None'] as const) {
    for (const code of [...NO_CHANNEL_CODES, 'a-code-of-a-later-server', null]) {
      const line = channelLineOf({ status: 'Scheduled', channel, channelReason: code });
      if (line) keys.push(line.channelKey, ...(line.reasonKey ? [line.reasonKey] : []));
    }
  }
  keys.push(...Object.values(PLACEHOLDER_KEYS), ...TEMPLATE_VARIABLES.map((variable) => variable.labelKey));
  return [...new Set(keys)];
}

describe('the words of a scheduled message', () => {
  it.each(['it', 'en'] as const)('everySentenceTheModelCanGive_HasItsOwnTextIn_%s_AndNamesNoSupplier', async (lng) => {
    await i18n.changeLanguage(lng);
    const t = i18n.getFixedT(lng) as TFunction;

    const keys = everyKey();
    // The scan really reaches the tables of the model.
    expect(keys.length).toBeGreaterThan(70);
    for (const key of keys) {
      const sentence = t(key);
      expect(sentence, key).not.toBe(key);
      expect(sentence.trim(), key).not.toBe('');
      // The interface says «il canale» and «la chat del portale», never who carries the message (NF-12).
      expect(sentence, key).not.toMatch(/octorate|airbnb|booking\.com|vrbo|expedia|partner/i);
    }
    await i18n.changeLanguage('it');
  });

  it('statusViewOf_EveryStatusOfTheServer_HasItsOwnWordsAndAnUnknownOneIsToldAsUnknown', () => {
    const labels = new Set(STATUSES.map((status) => statusViewOf(status).labelKey));
    expect(labels.size).toBe(STATUSES.length);
    for (const unknown of ['SomethingNew', 'constructor', '__proto__', '']) {
      expect(statusViewOf(unknown).labelKey, unknown).toBe('booking.scheduledMessages.status.unknown');
    }
  });

  it('statusViewOf_AFailedMessage_IsNeverToldAsSent', () => {
    expect(statusViewOf('Failed').labelKey).not.toBe(statusViewOf('Sent').labelKey);
    expect(statusViewOf('Failed').badge).toBe('destructive');
    expect(statusViewOf('Sent').badge).toBe('success');
    // Neither a message the channel did not take nor one that is held back says «inviato».
    const it_ = i18n.getFixedT('it');
    for (const status of ['Failed', 'Blocked', 'Scheduled', 'Skipped', 'Cancelled', 'Expired'] as const) {
      expect(it_(statusViewOf(status).labelKey), status).not.toMatch(/^inviato$/i);
    }
  });

  describe('endedReasonOf', () => {
    it('SkippedByAPerson_SaysItWasAPersonAndNeverWhichOne', () => {
      expect(endedReasonOf({ status: 'Skipped', skipReason: 'person' })).toEqual({ reasonKey: 'booking.scheduledMessages.reason.person', byPerson: true });
    });

    it('SkippedByTheSystem_SaysWhy_AndACodeOfALaterServerGetsTheSentenceOfItsState', () => {
      expect(endedReasonOf({ status: 'Skipped', skipReason: 'check_in_completed' })).toEqual({ reasonKey: 'booking.scheduledMessages.reason.checkInCompleted', byPerson: false });
      expect(endedReasonOf({ status: 'Skipped', skipReason: 'a-code-of-a-later-server' })?.reasonKey).toBe('booking.scheduledMessages.reason.otherSkipped');
      expect(endedReasonOf({ status: 'Cancelled', skipReason: null })?.reasonKey).toBe('booking.scheduledMessages.reason.otherCancelled');
      expect(endedReasonOf({ status: 'Expired', skipReason: 'constructor' })?.reasonKey).toBe('booking.scheduledMessages.reason.otherExpired');
    });

    it('APersonCancelsNothing_TheCodePersonOnACancelledMessageIsNotASkipByAPerson', () => {
      expect(endedReasonOf({ status: 'Cancelled', skipReason: 'person' })?.byPerson).toBe(false);
    });

    it.each(['Scheduled', 'Sent', 'Blocked', 'Failed'] as const)('%s_HasNoReasonOfEnding', (status) => {
      expect(endedReasonOf({ status, skipReason: 'person' })).toBeNull();
    });
  });

  describe('missingCodesOf: what a blocked message waits for', () => {
    it('TheVariablesTheBookingLacksAndTheReasonOfTheRow_AreListedOnceEach', () => {
      const blocked = message({ status: 'Blocked', blockedReason: 'id_not_verified', missingVariables: ['access_code', 'check_in_time'] });
      expect(missingCodesOf(blocked)).toEqual(['variable_missing:access_code', 'variable_missing:check_in_time', 'id_not_verified']);
      // The reason that names a variable already listed is not said twice.
      expect(missingCodesOf(message({ status: 'Blocked', blockedReason: 'variable_missing:access_code', missingVariables: ['access_code'] }))).toEqual(['variable_missing:access_code']);
    });

    it('ABlockedMessageThatNamesNothing_StillSaysSomethingIsMissing', () => {
      const codes = missingCodesOf(message({ status: 'Blocked', blockedReason: null, missingVariables: [] }));
      expect(codes.map((code) => missingItemOf(code).itemKey)).toEqual(['booking.scheduledMessages.blocked.item.unknown']);
    });

    it.each(['Sent', 'Skipped', 'Cancelled', 'Expired'] as const)('%s_WaitsForNothing_EvenWithAReasonOnTheRow', (status) => {
      expect(missingCodesOf(message({ status, blockedReason: 'chat_not_licensed', missingVariables: ['guest_name'] }))).toEqual([]);
    });

    // A planned or a failed message whose booking lacks a datum is held back when its time comes (or when it is tried again): the data are said for every open message. The code that sits on a failed
    // row is why the last send did not go, which has its own sentence: it is never one of the things the message waits for.
    it.each(['Scheduled', 'Failed'] as const)('%s_WaitsForTheDataTheBookingLacks_ButNeverForTheReasonOfTheRow', (status) => {
      expect(missingCodesOf(message({ status, blockedReason: 'chat_not_licensed', missingVariables: ['guest_name', 'check_in_time'] }))).toEqual([
        'variable_missing:guest_name',
        'variable_missing:check_in_time',
      ]);
      expect(missingCodesOf(message({ status, blockedReason: 'chat_not_licensed', missingVariables: [] }))).toEqual([]);
    });

    it('ACodeThatIsNotAVariable_InTheMissingVariablesOfTheServer_IsToldWithItsOwnSentence_NotAsAVariable', () => {
      const codes = missingCodesOf(message({ status: 'Blocked', blockedReason: 'template_missing', missingVariables: ['template_missing'] }));
      expect(codes).toEqual(['template_missing']);
      expect(missingItemOf(codes[0] ?? '').itemKey).toBe('booking.scheduledMessages.blocked.item.templateMissing');
    });

    it('EveryVariableOfATemplate_HasASentenceOfItsOwn_AndTheOnesOfThePropertyHaveALinkToIt', () => {
      const sentences = new Set(VARIABLES.map((name) => missingItemOf(`variable_missing:${name}`).itemKey));
      expect(sentences.size).toBe(VARIABLES.length);
      for (const name of ['check_in_time', 'check_out_time', 'check_in_method', 'access_code', 'property_address']) {
        expect(missingItemOf(`variable_missing:${name}`).fix, name).toBe('property');
      }
      expect(missingItemOf('id_not_verified').fix).toBe('guest');
      expect(missingItemOf('template_missing').fix).toBe('routines');
    });

    it('ACodeOfALaterServer_IsTheGenericSentence_NeverTheCode', () => {
      for (const code of ['constructor', '__proto__', 'variable_missing:something_new', 'something_new']) {
        expect(missingItemOf(code).itemKey, code).toBe('booking.scheduledMessages.blocked.item.unknown');
      }
    });
  });

  it('missingCodesOfProblem_TheMissingOfARefusedSendNow_KeepsOnlyTheTexts', () => {
    expect(missingCodesOfProblem({ code: 'scheduled_message_blocked', missing: ['variable_missing:access_code', 7, null, '', 'id_not_verified', 'id_not_verified'] })).toEqual([
      'variable_missing:access_code',
      'id_not_verified',
    ]);
    for (const data of [undefined, null, 'text', {}, { missing: 'access_code' }, { missing: {} }]) expect(missingCodesOfProblem(data)).toEqual([]);
  });

  describe('channelLineOf: how the guest is reached', () => {
    it.each([
      ['Ota', 'booking.scheduledMessages.channel.ota'],
      ['Direct', 'booking.scheduledMessages.channel.direct'],
      ['Email', 'booking.scheduledMessages.channel.email'],
    ] as const)('AnOpenMessageOn_%s_SaysTheWay', (channel, key) => {
      expect(channelLineOf({ status: 'Scheduled', channel, channelReason: null })).toEqual({ channelKey: key, reasonKey: null });
    });

    it('AnOpenMessageWithNoWay_SaysWhy_AndACodeOfALaterServerGetsTheGenericReason', () => {
      expect(channelLineOf({ status: 'Blocked', channel: 'None', channelReason: 'thread_closed' })?.reasonKey).toBe('booking.scheduledMessages.channel.reason.threadClosed');
      expect(channelLineOf({ status: 'Failed', channel: 'None', channelReason: 'something_new' })?.reasonKey).toBe('booking.scheduledMessages.channel.reason.other');
      expect(channelLineOf({ status: 'Scheduled', channel: 'None', channelReason: null })?.reasonKey).toBe('booking.scheduledMessages.channel.reason.other');
    });

    // The server answers the channel only for a message that can still go: for one that is over it is `None` with no reason, which is not «no way to the guest».
    it.each(['Sent', 'Skipped', 'Cancelled', 'Expired'] as const)('AMessageThatIs_%s_HasNoLineAboutTheChannel', (status) => {
      expect(channelLineOf({ status, channel: 'None', channelReason: null })).toBeNull();
    });
  });

  describe('failureReasonOf', () => {
    it('EveryCodeOfTheChannelHasASentence_AndTheOnesThatDoNotSayTheMessageLeftAreNotCalledSent', () => {
      const it_ = i18n.getFixedT('it');
      const sentences = FAILURE_CODES.map((code) => it_(failureReasonOf(code).reasonKey));
      expect(new Set(sentences).size).toBe(FAILURE_CODES.length);
      // «Non sappiamo se è arrivato» for a message whose outcome nobody knows: never «inviato».
      expect(it_(failureReasonOf('manual_verify').reasonKey)).toMatch(/non sappiamo/i);
      expect(it_(failureReasonOf('message_unconfirmed').reasonKey)).toMatch(/non lo consideriamo inviato/i);
    });

    it('ACodeOfALaterServerOrNone_IsTheGenericSentence', () => {
      for (const code of ['something_new', 'constructor', '__proto__', '', null, undefined]) {
        expect(failureReasonOf(code).reasonKey, String(code)).toBe('booking.scheduledMessages.failure.other');
      }
    });
  });
});

describe('the text of a scheduled message', () => {
  it('splitPlaceholders_TheThreeStandInsOfThePreview_AreSeparatedFromTheWords', () => {
    expect(splitPlaceholders('Ciao Mario, il tuo link: [check_in_link]. Il codice è [access_code]!\nRecensisci: [review_link]')).toEqual([
      { kind: 'text', text: 'Ciao Mario, il tuo link: ' },
      { kind: 'placeholder', name: 'check_in_link' },
      { kind: 'text', text: '. Il codice è ' },
      { kind: 'placeholder', name: 'access_code' },
      { kind: 'text', text: '!\nRecensisci: ' },
      { kind: 'placeholder', name: 'review_link' },
    ]);
    expect(splitPlaceholders('Nessun segnaposto [qui]')).toEqual([{ kind: 'text', text: 'Nessun segnaposto [qui]' }]);
    expect(splitPlaceholders('')).toEqual([]);
  });

  // PRIVACY and DATA: what is saved must make the link and the code when the message goes out. A text saved with `[check_in_link]` would reach the guest with the brackets.
  it('withVariablesInPlaceOfStandIns_TheStandInsBecomeTheVariablesTheyStandFor_SoNeitherReachesTheGuestAsBrackets', () => {
    expect(withVariablesInPlaceOfStandIns('Link: [check_in_link] codice: [access_code] recensione: [review_link]')).toBe(
      'Link: {{check_in_link}} codice: {{access_code}} recensione: {{review_link}}',
    );
    expect(withVariablesInPlaceOfStandIns('[check_in_link] [check_in_link]')).toBe('{{check_in_link}} {{check_in_link}}');
    // Anything else in brackets is the host's own text.
    expect(withVariablesInPlaceOfStandIns('Vedi [nota] e [guest_name]')).toBe('Vedi [nota] e [guest_name]');
    // Idempotent: a text that already has the variables is left as it is.
    expect(withVariablesInPlaceOfStandIns(withVariablesInPlaceOfStandIns('[access_code]'))).toBe('{{access_code}}');
  });

  it('templateVariables_AreTheThirteenOfTheServerInItsOrder_EachOnceWithAButton', () => {
    expect(VARIABLES).toEqual([
      'guest_name',
      'property_name',
      'booking_code',
      'check_in_date',
      'check_out_date',
      'check_in_time',
      'check_out_time',
      'host_name',
      'check_in_link',
      'check_in_method',
      'access_code',
      'property_address',
      'review_link',
    ]);
    expect(new Set(TEMPLATE_VARIABLES.map((variable) => variable.labelKey)).size).toBe(13);
  });

  it('isTemplateVariable_OnlyTheThirteenNamesAreVariables_TheCodesOfTheServerAreNot', () => {
    for (const name of VARIABLES) expect(isTemplateVariable(name), name).toBe(true);
    for (const code of ['template_missing', 'message_text_invalid', 'constructor', '', 'Guest_Name']) expect(isTemplateVariable(code), code).toBe(false);
  });

  // DATA: the server takes a variable it has no value for OUT of the text it gives, so a text saved from it would go without the datum.
  describe('missingFromText: the data the text lacks', () => {
    const lacking = { missingVariables: ['check_in_time', 'property_address', 'template_missing'] };

    it('variablesUsedIn_ReadsTheVariablesTheWayTheServerDoes_SpacesAndCapitalsIncluded_AndAStandInIsTheVariableItStandsFor', () => {
      expect([...variablesUsedIn('Ciao {{guest_name}}, {{ Check_In_Time }} e [check_in_link] {{review_link}}')].sort()).toEqual(['check_in_link', 'check_in_time', 'guest_name', 'review_link']);
      expect([...variablesUsedIn('Nessuna variabile {nome} [nota]')]).toEqual([]);
    });

    it('TheDataTheBookingLacksAndTheTextDoesNotName_AreTheOnesThatWouldGoMissing', () => {
      expect(missingFromText(lacking, 'Il check-in è dalle.')).toEqual(['check_in_time', 'property_address']);
      expect(missingFromText(lacking, 'Dalle {{check_in_time}} in {{ property_address }}.')).toEqual([]);
      expect(missingFromText(lacking, 'In {{property_address}}.')).toEqual(['check_in_time']);
    });

    it('ACodeThatIsNotAVariable_IsNeverSomethingToPutBack', () => {
      expect(missingFromText({ missingVariables: ['template_missing', 'message_text_invalid'] }, 'Ciao')).toEqual([]);
      expect(missingFromText({ missingVariables: [] }, 'Ciao')).toEqual([]);
    });
  });
});

describe('time', () => {
  it('formatOnPropertyClock_ShowsTheClockOfTheProperty_WhateverTheZoneOfTheBrowser_AcrossTheTwoChangesOfSummerTime', () => {
    // 24 November: Rome is on winter time (UTC+1). 24 July: summer time (UTC+2). The same instant of the plan is 08:00 on one day and 09:00 on the other.
    expect(formatOnPropertyClock('2026-11-24T07:00:00Z', 'Europe/Rome', 'it')).toContain('08:00');
    expect(formatOnPropertyClock('2026-07-24T07:00:00Z', 'Europe/Rome', 'it')).toContain('09:00');
    // The day the clocks change in autumn (25 October 2026): 06:30 UTC is 07:30 in Rome (UTC+1), 00:30 UTC is 02:30 (UTC+2).
    expect(formatOnPropertyClock('2026-10-25T06:30:00Z', 'Europe/Rome', 'it')).toContain('07:30');
    expect(formatOnPropertyClock('2026-10-25T00:30:00Z', 'Europe/Rome', 'it')).toContain('02:30');
    // A property on another clock is read on that clock.
    expect(formatOnPropertyClock('2026-11-24T07:00:00Z', 'Europe/London', 'en')).toContain('07:00');
  });

  it('formatOnPropertyClock_SaysTheDayAndTheNameOfTheZone', () => {
    const text = formatOnPropertyClock('2026-11-24T07:00:00Z', 'Europe/Rome', 'it');
    expect(text).toMatch(/24/);
    expect(text).toMatch(/nov/i);
    expect(text).toMatch(/CET|GMT\+1/);
    expect(formatOnPropertyClock('2026-11-24T07:00:00Z', 'Europe/Rome', 'it', false)).not.toMatch(/mar/i);
  });

  it('formatOnPropertyClock_AZoneTheBrowserDoesNotKnow_IsReadOnTheClockOfRome_AndNothingIsInvented', () => {
    expect(formatOnPropertyClock('2026-11-24T07:00:00Z', 'Mars/Olympus', 'it')).toContain('08:00');
    expect(formatOnPropertyClock('2026-11-24T07:00:00Z', '', 'it')).toContain('08:00');
    expect(formatOnPropertyClock(null, 'Europe/Rome', 'it')).toBe('');
    expect(formatOnPropertyClock('not a date', 'Europe/Rome', 'it')).toBe('');
  });

  it('asInstant_ATimeWithNoZone_IsUtc_NeverTheClockOfTheBrowser', () => {
    expect(asInstant('2026-11-24T07:00:00')?.toISOString()).toBe('2026-11-24T07:00:00.000Z');
    expect(asInstant('2026-11-24T08:00:00+01:00')?.toISOString()).toBe('2026-11-24T07:00:00.000Z');
    expect(asInstant('2026-11-24T07:00:00Z')?.toISOString()).toBe('2026-11-24T07:00:00.000Z');
    expect(asInstant('')).toBeNull();
    expect(asInstant(undefined)).toBeNull();
    expect(asInstant('nope')).toBeNull();
  });

  it('sortedInTimeOrder_PutsTheMessagesInTheOrderTheyGoOut_TheOnesWithoutATimeLast', () => {
    const later = message({ id: 'later', plannedAtUtc: '2026-11-26T07:00:00Z' });
    const sooner = message({ id: 'sooner', plannedAtUtc: '2026-11-24T07:00:00Z', actionIndex: 2 });
    const sameMomentFirstAction = message({ id: 'first', plannedAtUtc: '2026-11-24T07:00:00Z', actionIndex: 0 });
    const noTime = message({ id: 'no-time', plannedAtUtc: 'nope' });
    expect(sortedInTimeOrder([later, noTime, sooner, sameMomentFirstAction]).map((item) => item.id)).toEqual(['first', 'sooner', 'later', 'no-time']);
  });

  describe('isAboutToChange: whether an open page reads the list again by itself', () => {
    const now = new Date('2026-11-24T06:00:00Z');

    it('AMessageDueWithinTwoHoursOrOverdue_Changes_AMessageForDaysAwayDoesNot', () => {
      expect(isAboutToChange([message({ plannedAtUtc: '2026-11-24T07:00:00Z' })], now)).toBe(true);
      expect(isAboutToChange([message({ plannedAtUtc: '2026-11-24T05:00:00Z' })], now)).toBe(true);
      expect(isAboutToChange([message({ plannedAtUtc: '2026-11-24T10:00:00Z' })], now)).toBe(false);
      expect(isAboutToChange([message({ plannedAtUtc: '2026-11-27T07:00:00Z' })], now)).toBe(false);
    });

    it('ABlockedOrFailedMessage_Changes_BecauseTheSweepTriesItAgain', () => {
      expect(isAboutToChange([message({ status: 'Blocked', plannedAtUtc: '2026-12-01T07:00:00Z' })], now)).toBe(true);
      expect(isAboutToChange([message({ status: 'Failed', plannedAtUtc: '2026-12-01T07:00:00Z' })], now)).toBe(true);
    });

    it('OnlyEndedMessagesOrNoMessages_AskForNothing', () => {
      for (const status of ['Sent', 'Skipped', 'Cancelled', 'Expired'] as const) {
        expect(isAboutToChange([message({ status, plannedAtUtc: '2026-11-24T05:00:00Z' })], now), status).toBe(false);
      }
      expect(isAboutToChange([], now)).toBe(false);
      expect(isAboutToChange(undefined, now)).toBe(false);
    });
  });

  // `isAboutToChange` is judged when the query or the component is updated, not as the clock moves: whether the page reads at all is judged by this, which does not depend on the clock.
  describe('hasOpenMessage: whether any message can still change by itself', () => {
    it.each(['Scheduled', 'Blocked', 'Failed'] as const)('AMessageThatIs_%s_CanStillChange_HoweverFarItsTime', (status) => {
      expect(hasOpenMessage([message({ status, plannedAtUtc: '2027-01-01T07:00:00Z' })])).toBe(true);
    });

    it('OnlyEndedMessagesOrNoMessages_CannotChange', () => {
      for (const status of ['Sent', 'Skipped', 'Cancelled', 'Expired'] as const) expect(hasOpenMessage([message({ status })]), status).toBe(false);
      expect(hasOpenMessage([])).toBe(false);
      expect(hasOpenMessage(undefined)).toBe(false);
      expect(hasOpenMessage([message({ status: 'Sent' }), message({ id: 'm-2', status: 'Scheduled' })])).toBe(true);
    });
  });
});
