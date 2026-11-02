import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '@/i18n/config';
import type { ComplianceCockpitAction, ComplianceSummaryItem, ComplianceSummaryResult } from '@/types/compliance.types';
import type { DashboardTodoItem } from '@/types/dashboard.types';
import type { Property } from '@/types/property.types';
import { buildCockpit, deadlineNote, focusToneOf, thenOf, type CockpitContext, type CockpitRow } from '../lib/cockpit-model';
import { fineCount } from '../lib/compliance-tiers';

// 12:00 UTC of 24 September 2026: 14:00 in Rome (CEST), the same day. The clock is handed in, never read.
const NOW = new Date('2026-09-24T12:00:00Z');
const hoursFromNow = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();

const t = i18n.getFixedT('it') as TFunction;
const context: CockpitContext = { t, locale: 'it', hasPermission: () => true, exists: (key) => i18n.exists(key) };

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

const booking = (action: ComplianceCockpitAction, id: string, label: string, dueAt?: string | null): ComplianceSummaryItem => ({
  id,
  label,
  action,
  propertyId: null,
  bookingId: id,
  dueAt,
});
const property = (id: string, label: string): ComplianceSummaryItem => ({ id, label, action: 'ActivateProperty', propertyId: id, bookingId: null });

const build = (summary: ComplianceSummaryResult, extras: Parameters<typeof buildCockpit>[1] = {}) => buildCockpit(summary, extras, context, NOW);
const subjects = (rows: readonly CockpitRow[]) => rows.map((row) => row.subject);

describe('buildCockpit levels', () => {
  it('buildCockpit_AllSections_SeparatesWhatTheLawDatesFromWhatKeepsAPropertyFromStarting', () => {
    const model = build(
      summaryOf({
        alloggiatiManualRequired: { count: 1, items: [booking('SendAlloggiati', 'b1', 'Mario Rossi')] },
        alloggiatiFailures: { count: 1, items: [booking('ResolveAlloggiatiFailure', 'b2', 'Carla Neri')] },
        guestCheckInsIncomplete: { count: 1, items: [booking('CompleteGuestCheckIn', 'b3', 'Anna Verdi')] },
        propertiesPending: { count: 1, items: [property('p1', 'Villa Test')] },
        checkoutsDue: { count: 1, items: [booking('CheckOut', 'b4', 'Luigi Bianchi')] },
        turnoversPending: { count: 1, items: [booking('ConfirmPropertyReady', 'b5', 'Villa Test · Paolo Gialli')] },
      }),
    );

    // No deadline is known: the failure first, then the communication to send, then the data it needs (the order of the sections).
    expect(subjects(model.fine.rows)).toEqual(['Carla Neri', 'Mario Rossi', 'Anna Verdi']);
    expect(subjects(model.start.rows)).toEqual(['Villa Test']);
    expect(subjects(model.chore.rows)).toEqual(['Luigi Bianchi', 'Villa Test · Paolo Gialli']);
    expect(model.fine.rows.every((row) => row.tier === 'fine')).toBe(true);
    expect(model.start.rows.every((row) => row.tier === 'start')).toBe(true);
    expect(model.chore.rows.every((row) => row.tier === 'chore')).toBe(true);
    expect(model.total).toBe(6);
  });

  it('buildCockpit_ServerCountsMoreThanItLists_KeepsTheTotalAndSaysHowManyAreNotListed', () => {
    const model = build(summaryOf({ alloggiatiManualRequired: { count: 12, items: [booking('SendAlloggiati', 'b1', 'Mario Rossi')] } }));

    expect(model.fine.total).toBe(12);
    expect(model.fine.hidden).toBe(11);
    expect(model.fine.rows).toHaveLength(1);
    expect(model.total).toBe(12);
  });

  it('buildCockpit_PartialPayload_TreatsMissingSectionsAsEmpty', () => {
    const model = build({ propertiesPending: { count: 1, items: [property('p1', 'Villa Test')] } } as ComplianceSummaryResult);

    expect(model.fine.total).toBe(0);
    expect(model.chore.total).toBe(0);
    expect(model.start.total).toBe(1);
  });

  it('buildCockpit_NothingPending_HasNoFocus', () => {
    const model = build(summaryOf({}));

    expect(model.total).toBe(0);
    expect(model.focus).toBeNull();
  });
});

describe('buildCockpit order and focus', () => {
  it('buildCockpit_FineRows_NearestDeadlineFirstWhateverTheSection', () => {
    const model = build(
      summaryOf({
        alloggiatiManualRequired: {
          count: 2,
          items: [booking('SendAlloggiati', 'b1', 'Dopodomani', hoursFromNow(40)), booking('SendAlloggiati', 'b2', 'Scaduto da giorni', hoursFromNow(-80))],
        },
        guestCheckInsIncomplete: { count: 1, items: [booking('CompleteGuestCheckIn', 'b3', 'Domani', hoursFromNow(10))] },
        alloggiatiFailures: { count: 1, items: [booking('ResolveAlloggiatiFailure', 'b4', 'Senza scadenza')] },
      }),
    );

    expect(subjects(model.fine.rows)).toEqual(['Scaduto da giorni', 'Domani', 'Dopodomani', 'Senza scadenza']);
  });

  it('buildCockpit_DeadlineOfTheSummary_WinsOverTheOneOfTheHomeTodo', () => {
    const todo = [{ action: 'SendAlloggiati', bookingId: 'b1', propertyId: null, propertyName: 'Casa Como', dueAt: hoursFromNow(-1) }] as unknown as DashboardTodoItem[];
    const summary = summaryOf({
      alloggiatiManualRequired: { count: 1, items: [booking('SendAlloggiati', 'b1', 'Dal riepilogo', hoursFromNow(100))] },
    });

    // The Home's "Da fare" says it is late, the summary says it is in four days: the summary knows every row, the Home only the first ones.
    const [row] = build(summary, { todo }).fine.rows;
    expect(row.note?.tone).toBe('neutral');
    // The Home still says where the stay is.
    expect(row.sub).toBe('Casa Como');
  });

  it('buildCockpit_NoDeadlineInTheSummary_UsesTheOneOfTheHomeTodo', () => {
    const todo = [{ action: 'SendAlloggiati', bookingId: 'b1', propertyId: null, propertyName: 'Casa Como', dueAt: hoursFromNow(-30) }] as unknown as DashboardTodoItem[];
    const summary = summaryOf({ alloggiatiManualRequired: { count: 1, items: [booking('SendAlloggiati', 'b1', 'Mario Rossi')] } });

    expect(build(summary, { todo }).fine.rows[0].note).toEqual({ text: 'Scaduto da 1 giorno', tone: 'danger' });
  });

  it('buildCockpit_SuspendedProperty_ComesBeforeThePendingOnes', () => {
    const properties = [
      { id: 'p1', name: 'Mai partita', complianceStatus: 'Pending' },
      { id: 'p2', name: 'Era attiva', complianceStatus: 'Suspended' },
    ] as unknown as Property[];
    const model = build(summaryOf({ propertiesPending: { count: 2, items: [property('p1', 'Mai partita'), property('p2', 'Era attiva')] } }), { properties });

    expect(subjects(model.start.rows)).toEqual(['Era attiva', 'Mai partita']);
    expect(model.start.rows[0].badge).toEqual({ kind: 'property', status: 'Suspended' });
  });

  it('buildCockpit_PropertiesInOrder_AreListedApartAndNeverCountedAsToDo', () => {
    const properties = [
      { id: 'p1', name: 'Da attivare', complianceStatus: 'Pending' },
      { id: 'p2', name: 'In regola', complianceStatus: 'Active', city: 'Como' },
    ] as unknown as Property[];
    const model = build(summaryOf({ propertiesPending: { count: 1, items: [property('p1', 'Da attivare')] } }), { properties });

    expect(subjects(model.activeProperties)).toEqual(['In regola']);
    expect(model.activeProperties[0].quiet).toBe(true);
    expect(model.total).toBe(1);
  });

  it('buildCockpit_LevelsPresent_FocusIsTheMostPressingOfTheHighestLevel', () => {
    const both = build(
      summaryOf({
        propertiesPending: { count: 1, items: [property('p1', 'Villa Test')] },
        alloggiatiManualRequired: { count: 1, items: [booking('SendAlloggiati', 'b1', 'Mario Rossi')] },
      }),
    );
    expect(both.focus?.subject).toBe('Mario Rossi');
    expect(both.focus?.tier).toBe('fine');

    const onlyStart = build(summaryOf({ propertiesPending: { count: 1, items: [property('p1', 'Villa Test')] } }));
    expect(onlyStart.focus?.subject).toBe('Villa Test');
    expect(onlyStart.focus?.tier).toBe('start');
  });

  it('buildCockpit_RowsOfTheLawHaveTheirDeadlineInWords_TheOtherLevelsStayCalm', () => {
    const model = build(
      summaryOf({
        alloggiatiManualRequired: { count: 1, items: [booking('SendAlloggiati', 'b1', 'Mario Rossi', hoursFromNow(-30))] },
        propertiesPending: { count: 1, items: [property('p1', 'Villa Test')] },
        checkoutsDue: { count: 1, items: [booking('CheckOut', 'b2', 'Luigi Bianchi', hoursFromNow(-30))] },
      }),
    );

    expect(model.fine.rows[0].note).toEqual({ text: 'Scaduto da 1 giorno', tone: 'danger' });
    expect(model.start.rows[0].note).toBeUndefined();
    expect(model.chore.rows[0].note).toBeUndefined();
  });
});

describe('deadlineNote', () => {
  const note = (dueAt: string | null) => deadlineNote(dueAt, { t, locale: 'it' }, NOW);

  it.each([
    ['2026-09-24T11:30:00Z', 'Scaduto da poco'],
    ['2026-09-24T07:00:00Z', 'Scaduto da 5 ore'],
    ['2026-09-23T07:00:00Z', 'Scaduto da 1 giorno'],
    ['2026-09-21T10:00:00Z', 'Scaduto da 3 giorni'],
  ])('deadlineNote_Past_%s_SaysHowLateInWordsAndIsRed', (dueAt, text) => {
    expect(note(dueAt)).toEqual({ text, tone: 'danger' });
  });

  it('deadlineNote_LaterToday_SaysTheHourAndIsRedWithinADay', () => {
    expect(note('2026-09-24T14:30:00Z')).toEqual({ text: 'Entro oggi alle 16:30', tone: 'danger' });
  });

  it('deadlineNote_ThreeDaysAway_IsAmberAndFurtherIsNeutral', () => {
    expect(note('2026-09-27T09:00:00Z')?.tone).toBe('warning');
    expect(note('2026-09-30T09:00:00Z')?.tone).toBe('neutral');
  });

  it.each([
    // The start of a day (the arrival day of a guest) is the end of the day before.
    ['2026-09-24T22:00:00Z', 'Entro oggi', 'danger'],
    ['2026-09-25T22:00:00Z', 'Entro domani', 'warning'],
    ['2026-09-26T22:00:00Z', 'Entro il 26 settembre', 'warning'],
  ])('deadlineNote_MidnightSharp_%s_IsTheEndOfTheDayBefore', (dueAt, text, tone) => {
    expect(note(dueAt)).toEqual({ text, tone });
  });

  it('deadlineNote_NoDeadline_SaysNothingNeverWhenYouCan', () => {
    expect(note(null)).toBeUndefined();
    expect(note('not a date')).toBeUndefined();
  });
});

describe('focus, then and the number of the menu', () => {
  const row = (parts: Partial<CockpitRow>) => ({ tier: 'fine', ...parts }) as CockpitRow;

  it('focusToneOf_Fine_IsRedWhenLateOrFailedAndAmberOtherwise', () => {
    expect(focusToneOf(row({ note: { text: 'x', tone: 'danger' } }))).toBe('danger');
    expect(focusToneOf(row({ badge: { kind: 'alloggiati', status: 'Errore' } }))).toBe('danger');
    expect(focusToneOf(row({ note: { text: 'x', tone: 'warning' } }))).toBe('warning');
    expect(focusToneOf(row({}))).toBe('warning');
  });

  it('focusToneOf_OtherLevels_AreCalm', () => {
    expect(focusToneOf(row({ tier: 'start', note: { text: 'x', tone: 'danger' } }))).toBe('neutral');
    expect(focusToneOf(row({ tier: 'chore' }))).toBe('neutral');
  });

  it('thenOf_RestOfEveryLevel_SaysWhatIsLeftAfterTheOneInTheBlock', () => {
    const model = { fine: { total: 3 }, start: { total: 21 }, chore: { total: 0 } } as Parameters<typeof thenOf>[0];

    expect(thenOf(model, { tier: 'fine' }, t)).toBe('Poi: ancora 2 con scadenza di legge, 21 case da attivare');
    expect(thenOf(model, { tier: 'start' }, t)).toBe('Poi: ancora 3 con scadenza di legge, 20 case da attivare');
  });

  it('thenOf_NothingLeft_SaysNothing', () => {
    const model = { fine: { total: 1 }, start: { total: 0 }, chore: { total: 0 } } as Parameters<typeof thenOf>[0];

    expect(thenOf(model, { tier: 'fine' }, t)).toBeUndefined();
  });

  it('fineCount_SumsTheThreeSectionsOfTheLaw_WhatTheServerCountsAndNotWhatItLists', () => {
    const summary = summaryOf({
      alloggiatiFailures: { count: 1, items: [] },
      alloggiatiManualRequired: { count: 12, items: [booking('SendAlloggiati', 'b1', 'Mario Rossi')] },
      guestCheckInsIncomplete: { count: 2, items: [] },
      propertiesPending: { count: 21, items: [] },
      checkoutsDue: { count: 4, items: [] },
    });

    expect(fineCount(summary)).toBe(15);
  });

  it('fineCount_NothingOrAPartialPayload_IsZero', () => {
    expect(fineCount(undefined)).toBe(0);
    expect(fineCount(null)).toBe(0);
    expect(fineCount({})).toBe(0);
    expect(fineCount('<!doctype html>' as never)).toBe(0);
  });
});
