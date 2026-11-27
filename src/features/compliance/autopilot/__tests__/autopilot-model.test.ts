import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '@/i18n/config';
import type { ComplianceSummaryResult } from '@/types/compliance.types';
import type { AutopilotChatDraft, AutopilotItem, AutopilotOutcome } from '@/types/compliance-autopilot.types';
import { askChannels, autopilotRelevant, failureText, groupOutcomes, groupPlan, namesOf, resultSentence } from '../autopilot-model';

const t = i18n.getFixedT('it') as TFunction;
const exists = (key: string) => i18n.exists(key);

const empty = { count: 0, items: [] };
const summaryOf = (parts: Partial<ComplianceSummaryResult>): ComplianceSummaryResult => ({
  propertiesPending: empty,
  guestCheckInsIncomplete: empty,
  checkoutsDue: empty,
  alloggiatiFailures: empty,
  alloggiatiManualRequired: empty,
  turnoversPending: empty,
  ...parts,
});

const item = (over: Partial<AutopilotItem> = {}): AutopilotItem => ({
  key: 'GuestData:b1',
  topic: 'GuestData',
  status: 'Ready',
  reason: 'ask_guests',
  bookingId: 'b1',
  propertyId: 'p1',
  guestName: 'Anna Verdi',
  propertyName: 'Casa Rossi',
  channels: ['email'],
  dueAt: null,
  ...over,
});

const draft: AutopilotChatDraft = { language: 'it', text: 'Ciao Anna', whatsAppUrl: 'https://wa.me/39333?text=x', smsUrl: 'sms:+39333?&body=x', aiWritten: false };
const outcome = (over: Partial<AutopilotOutcome> = {}): AutopilotOutcome => ({
  key: 'GuestData:b1',
  topic: 'GuestData',
  bookingId: 'b1',
  guestName: 'Anna Verdi',
  propertyName: 'Casa Rossi',
  status: 'Done',
  code: 'email_queued',
  emailStatus: 'Queued',
  emailError: null,
  chat: null,
  errorCode: null,
  ...over,
});

describe('autopilotRelevant', () => {
  it('autopilotRelevant_AStayToLookAt_IsTrueForEachOfTheFourSections', () => {
    const one = { count: 1, items: [] };
    expect(autopilotRelevant(summaryOf({ guestCheckInsIncomplete: one }))).toBe(true);
    expect(autopilotRelevant(summaryOf({ checkoutsDue: one }))).toBe(true);
    expect(autopilotRelevant(summaryOf({ alloggiatiManualRequired: one }))).toBe(true);
    expect(autopilotRelevant(summaryOf({ alloggiatiFailures: one }))).toBe(true);
  });

  it('autopilotRelevant_OnlyHousesToActivateOrTurnovers_IsFalse_AndAMissingSummaryToo', () => {
    const one = { count: 3, items: [] };
    expect(autopilotRelevant(summaryOf({ propertiesPending: one, turnoversPending: one }))).toBe(false);
    expect(autopilotRelevant(undefined)).toBe(false);
    expect(autopilotRelevant({ checkoutsDue: undefined })).toBe(false);
  });
});

describe('namesOf', () => {
  it('namesOf_NamesAPersonOnce_AndJoinsWithTheConjunctionOfTheLanguage', () => {
    const items = [{ guestName: 'Anna Verdi' }, { guestName: ' Bruno Neri ' }, { guestName: 'Anna Verdi' }, { guestName: 'Carla Rossi' }];

    expect(namesOf(items, t, 'it')).toBe('Anna Verdi, Bruno Neri e Carla Rossi');
    expect(namesOf(items, i18n.getFixedT('en') as TFunction, 'en')).toBe('Anna Verdi, Bruno Neri, and Carla Rossi');
  });

  it('namesOf_MoreThanThree_SaysHowManyOthers', () => {
    const items = ['A', 'B', 'C', 'D', 'E'].map((guestName) => ({ guestName }));

    expect(namesOf(items, t, 'it')).toBe('A, B, C e altri 2');
    expect(namesOf(items.slice(0, 4), t, 'it')).toBe('A, B, C e 1 altro');
  });

  it('namesOf_NoName_IsEmpty', () => {
    expect(namesOf([{ guestName: '  ' }], t, 'it')).toBe('');
  });
});

describe('groupPlan', () => {
  it('groupPlan_SplitsWhatTheAssistantDoesFromWhatItLeaves_AndSendsBackOnlyWhatItWillDo', () => {
    const plan = [
      item({ key: 'GuestData:b1' }),
      item({ key: 'Departure:b2', topic: 'Departure', reason: 'close_departure', bookingId: 'b2', channels: [] }),
      item({ key: 'Departure:b3', topic: 'Departure', status: 'Waiting', reason: 'awaiting_guest_data', bookingId: 'b3', channels: [] }),
      item({ key: 'GuestData:b4', status: 'Waiting', reason: 'asked_recently', bookingId: 'b4', channels: [] }),
      item({ key: 'Alloggiati:b5', topic: 'Alloggiati', status: 'Host', reason: 'ready_to_upload', bookingId: 'b5', channels: [] }),
    ];

    const groups = groupPlan({ items: plan });

    expect(groups.ask.map((i) => i.key)).toEqual(['GuestData:b1']);
    expect(groups.close.map((i) => i.key)).toEqual(['Departure:b2']);
    expect(groups.waiting.map((line) => line.reason)).toEqual(['asked_recently', 'awaiting_guest_data']);
    expect(groups.host.map((line) => line.reason)).toEqual(['ready_to_upload']);
    expect(groups.readyKeys).toEqual(['GuestData:b1', 'Departure:b2']);
  });

  it('groupPlan_TheLinesOfTheHost_ComeInOrderOfUrgency_AndAReasonItDoesNotKnowGoesLast', () => {
    const host = (reason: string, id: string) => item({ key: `Alloggiati:${id}`, topic: 'Alloggiati', status: 'Host', reason, bookingId: id, channels: [] });

    const groups = groupPlan({
      items: [host('departure_today', 'a'), host('something_new', 'b'), host('no_contact', 'c'), host('ready_to_upload', 'd'), host('no_contact', 'e')],
    });

    expect(groups.host.map((line) => line.reason)).toEqual(['ready_to_upload', 'no_contact', 'departure_today', 'something_new']);
    expect(groups.host[1].items.map((i) => i.bookingId)).toEqual(['c', 'e']);
    expect(groups.readyKeys).toEqual([]);
  });
});

describe('askChannels', () => {
  it('askChannels_SaysHowTheGuestsAreReached', () => {
    expect(askChannels([item({ channels: ['email'] })])).toBe('email');
    expect(askChannels([item({ channels: ['chat'] })])).toBe('chat');
    expect(askChannels([item({ channels: ['email', 'chat'] })])).toBe('mixed');
    expect(askChannels([item({ channels: ['email'] }), item({ channels: ['chat'] })])).toBe('mixed');
  });
});

describe('groupOutcomes and resultSentence', () => {
  const outcomes: AutopilotOutcome[] = [
    outcome({ key: 'GuestData:b1', bookingId: 'b1', guestName: 'Anna Verdi', chat: draft }),
    outcome({ key: 'GuestData:b2', bookingId: 'b2', guestName: 'Bruno Neri' }),
    outcome({ key: 'GuestData:b3', bookingId: 'b3', guestName: 'Carla Rossi', code: 'chat_ready', emailStatus: 'Failed', emailError: 'queue_failed', chat: { ...draft, aiWritten: true } }),
    outcome({ key: 'Departure:b4', topic: 'Departure', bookingId: 'b4', code: 'departure_closed', emailStatus: null }),
    outcome({ key: 'GuestData:b5', bookingId: 'b5', status: 'Failed', code: 'failed', emailStatus: null, errorCode: 'checkin_already_completed' }),
    outcome({ key: 'Departure:b6', topic: 'Departure', bookingId: 'b6', status: 'Skipped', code: 'no_longer_needed', emailStatus: null }),
  ];

  it('groupOutcomes_SeparatesWhatWasDoneFromWhatTheHostStillSends', () => {
    const groups = groupOutcomes(outcomes);

    expect(groups.emailed.map((o) => o.bookingId)).toEqual(['b1', 'b2']);
    expect(groups.chatNeeded.map((o) => o.bookingId)).toEqual(['b3']);
    expect(groups.chatOptional.map((o) => o.bookingId)).toEqual(['b1']);
    expect(groups.closed.map((o) => o.bookingId)).toEqual(['b4']);
    expect(groups.failed.map((o) => o.bookingId)).toEqual(['b5']);
    expect(groups.skipped.map((o) => o.bookingId)).toEqual(['b6']);
    expect(groups.aiWritten).toBe(true);
  });

  it('resultSentence_SaysOnlyWhatHappened', () => {
    expect(resultSentence(groupOutcomes(outcomes), t, 'it')).toBe(
      "Ho mandato l'e-mail a 2 ospiti, chiuso 1 partenza e preparato 1 messaggio da mandare tu.",
    );
    expect(resultSentence(groupOutcomes([outcome({ chat: draft })]), t, 'it')).toBe("Ho mandato l'e-mail a 1 ospite.");
  });

  it('resultSentence_NothingDone_SaysSo', () => {
    expect(resultSentence(groupOutcomes([outcome({ status: 'Skipped', code: 'no_longer_needed' })]), t, 'it')).toBe('Non c\'era niente di nuovo da fare.');
  });
});

describe('failureText', () => {
  it('failureText_TheReasonOfTheEmailFirst_ThenTheRuleThatRefused_ThenAPlainLine', () => {
    expect(failureText(outcome({ emailError: 'rejected', errorCode: 'checkin_already_completed' }), t, exists)).toBe('L\'indirizzo e-mail è stato rifiutato: controllalo.');
    expect(failureText(outcome({ errorCode: 'checkin_already_completed' }), t, exists)).toContain('già compilato il modulo');
    expect(failureText(outcome({ errorCode: 'a_rule_nobody_translated' }), t, exists)).toBe('Non è andata: riprova tra poco.');
    expect(failureText(outcome({}), t, exists)).toBe('Non è andata: riprova tra poco.');
  });
});
