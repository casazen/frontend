import { describe, expect, it } from 'vitest';
import type { TicinoNotificationDay, TicinoNotificationRow } from '@/types/swissCompliance.types';
import {
  TICINO_STEPS,
  dayStateOf,
  firstStepOf,
  groupRowsOf,
  isFutureDay,
  knownWarningCodesOf,
  minorsCountedOf,
  missingKeysOf,
  stepStateOf,
  warnedStaysOf,
} from '../ticino-day-model';

const guest = (over14 = 0, under14 = 0): TicinoNotificationRow => ({ bookingId: 'b1', guestName: 'Mario Rossi', personsOver14: over14, personsUnder14: under14, kind: 'guest', groupSize: 0 });
const group: TicinoNotificationRow = { bookingId: 'b2', guestName: 'Giulia Neri', personsOver14: 5, personsUnder14: 1, kind: 'group', groupSize: 7 };
const issue = { bookingId: 'b3', position: 1, guestName: 'Anna Verdi', missing: ['birthDate'] };

/** The parts of a day the model reads: ready to notify, nothing declared, no file written. */
const day = (overrides: Partial<TicinoNotificationDay> = {}) =>
  ({ day: '2026-11-19', stayCount: 1, rows: [guest()], issues: [], warnings: [], receiptCount: 0, declaredAt: null, alreadyDeclared: false, fileGeneratedCount: 0, ...overrides }) as TicinoNotificationDay;

describe('the model of the Ticino day (E30/F02/US03/T02)', () => {
  it('TICINO_STEPS_AreTheFiveStepsInTheOrderTheHostDoesThem', () => {
    expect([...TICINO_STEPS]).toEqual(['guests', 'file', 'portal', 'declare', 'receipt']);
  });

  describe('where the layer opens (so it can be left and come back to)', () => {
    it.each<[string, Partial<TicinoNotificationDay>, string]>([
      ['a day ready to notify, no file yet', {}, 'file'],
      ['the file was written: the host is back from the portal', { fileGeneratedCount: 1 }, 'declare'],
      ['some guest misses data', { issues: [issue] }, 'guests'],
      ['nobody is ready', { rows: [], issues: [issue] }, 'guests'],
      ['the day is declared', { alreadyDeclared: true, declaredAt: '2026-11-19T14:20:00Z', fileGeneratedCount: 1 }, 'receipt'],
      ['the day is closed by the receipt', { alreadyDeclared: true, receiptCount: 1 }, 'receipt'],
    ])('firstStepOf_%s', (_name, overrides, expected) => {
      expect(firstStepOf(day(overrides))).toBe(expected);
    });
  });

  describe('how each step stands', () => {
    it('stepStateOf_ADayReadyToNotify_GuestsDoneAndTheRestToDoWithTheProofOptional', () => {
      const states = TICINO_STEPS.map((step) => stepStateOf(step, day()));

      expect(states).toEqual(['done', 'todo', 'todo', 'todo', 'optional']);
    });

    it('stepStateOf_GuestsMissingData_NeedsAttention_AndSoDoesADayWithNoGuestReady', () => {
      expect(stepStateOf('guests', day({ issues: [issue] }))).toBe('attention');
      expect(stepStateOf('guests', day({ rows: [] }))).toBe('attention');
    });

    it('stepStateOf_FileWritten_FileIsDoneButThePortalAndTheDeclarationAreNot', () => {
      const written = day({ fileGeneratedCount: 2 });

      expect(stepStateOf('file', written)).toBe('done');
      expect(stepStateOf('portal', written)).toBe('todo');
      expect(stepStateOf('declare', written)).toBe('todo');
    });

    it('stepStateOf_ADeclaredDay_EveryStepBeforeTheProofIsDone_AndTheProofWaitsForItsReceipt', () => {
      const declared = day({ alreadyDeclared: true, declaredAt: '2026-11-19T14:20:00Z' });

      expect(TICINO_STEPS.map((step) => stepStateOf(step, declared))).toEqual(['done', 'done', 'done', 'done', 'optional']);
      expect(stepStateOf('receipt', { ...declared, receiptCount: 1 })).toBe('done');
    });
  });

  describe('what a day is', () => {
    it.each<[string, Partial<TicinoNotificationDay>, string]>([
      ['no arrival', { stayCount: 0, rows: [] }, 'none'],
      ['still to notify', {}, 'open'],
      ['declared by a person', { declaredAt: '2026-11-19T14:20:00Z', alreadyDeclared: true }, 'declared'],
      ['closed by the receipt alone', { receiptCount: 1, alreadyDeclared: true }, 'receipt'],
    ])('dayStateOf_%s_Is_%s', (_name, overrides, expected) => {
      expect(dayStateOf(day(overrides))).toBe(expected);
    });

    it('isFutureDay_ADayThatHasNotStartedInZurich_IsFuture_TheArrivalDayItselfIsNot', () => {
      // 23:30 UTC of the 18th is already the 19th in Zurich (00:30).
      const lateOnThe18th = new Date('2026-11-18T23:30:00Z');

      expect(isFutureDay({ day: '2026-11-19' }, lateOnThe18th)).toBe(false);
      expect(isFutureDay({ day: '2026-11-20' }, lateOnThe18th)).toBe(true);
      expect(isFutureDay({ day: '2026-11-18' }, lateOnThe18th)).toBe(false);
    });
  });

  describe('the rows and the warnings of the day', () => {
    it('minorsCountedOf_CountsTheChildrenOnTheirParentAndNeverTheMembersOnTheRowOfAGroup', () => {
      // On a group row the two counters hold every other member, adults included.
      expect(minorsCountedOf({ rows: [guest(1, 2), guest(0, 1), group] })).toBe(4);
      expect(minorsCountedOf({ rows: [group] })).toBe(0);
    });

    it('groupRowsOf_AreTheRowsOfTheLeadersOfAGroup', () => {
      expect(groupRowsOf({ rows: [guest(), group] })).toEqual([group]);
    });

    it('missingKeysOf_KnownCodesHaveTheirWords_AnUnknownOneIsLeftOut', () => {
      expect(missingKeysOf(['firstName', 'documentType', 'from_the_future'])).toEqual(['swiss.issues.missing.firstName', 'swiss.issues.missing.documentType']);
    });

    it('warnedStaysOf_EachStayOnce', () => {
      const warnings = [
        { bookingId: 'b1', code: 'parental_authorization_needed' },
        { bookingId: 'b1', code: 'parental_authorization_needed' },
        { bookingId: 'b2', code: 'parental_authorization_needed' },
        { bookingId: 'b3', code: 'group_sheet_incomplete' },
      ];

      expect(warnedStaysOf({ warnings }, 'parental_authorization_needed')).toEqual(['b1', 'b2']);
      expect(warnedStaysOf({ warnings }, 'nothing')).toEqual([]);
    });

    it('knownWarningCodesOf_OnlyTheCodesTheLayerHasWordsFor_OnceEach', () => {
      const warnings = [
        { bookingId: 'b1', code: 'group_sheet_incomplete' },
        { bookingId: 'b2', code: 'group_sheet_incomplete' },
        { bookingId: 'b3', code: 'something_new' },
        { bookingId: 'b4', code: 'parental_authorization_needed' },
      ];

      expect(knownWarningCodesOf({ warnings })).toEqual(['parental_authorization_needed', 'group_sheet_incomplete']);
    });
  });
});
