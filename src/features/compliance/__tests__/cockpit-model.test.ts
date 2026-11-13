import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '@/i18n/config';
import type { ComplianceCockpitAction, ComplianceSummaryItem, ComplianceSummaryResult } from '@/types/compliance.types';
import type { DashboardTodoItem } from '@/types/dashboard.types';
import type { Property } from '@/types/property.types';
import { buildCockpit, deadlineNote, focusBodyOf, focusToneOf, thenOf, type CockpitContext, type CockpitRow } from '../lib/cockpit-model';
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
/** An item with its light, as the API sends it with the traffic light on. */
const lit = (item: ComplianceSummaryItem, light: ComplianceSummaryItem['light'], reason?: string): ComplianceSummaryItem => ({ ...item, light, reason });
/** An item about a month of a property (ISTAT, tourist tax) or about its connection. */
const period = (action: ComplianceCockpitAction, propertyId: string, month: string): ComplianceSummaryItem => ({
  id: propertyId,
  label: 'Casa Como',
  action,
  propertyId,
  bookingId: null,
  period: month,
});

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

  it('fineCount_TrafficLightOn_CountsTheRedStaysThatTheLightMovedOutOfTheOldSection', () => {
    // With the light on, a stay to send by hand or with its receipt awaited is in the new sections: the menu keeps counting it while it is red.
    const summary = summaryOf({
      alloggiatiManualRequired: { count: 1, items: [booking('SendAlloggiati', 'b0', 'Anna Verdi')] },
      manualSendsRequired: { count: 3, items: [lit(booking('SendAlloggiatiManually', 'b1', 'Mario Rossi'), 'Red'), lit(booking('SendAlloggiatiManually', 'b2', 'Carla Neri'), 'Yellow')] },
      receiptsToUpload: { count: 1, items: [lit(booking('UploadAlloggiatiReceipt', 'b3', 'Luigi Bianchi'), 'Red'), lit(booking('UploadAlloggiatiReceipt', 'b4', 'Paolo Gialli'), 'Green')] },
      // The other new sections are not what the menu counts: ISTAT, the tax and the police send are on the page.
      periodItems: { count: 1, items: [lit(period('UploadIstatProof', 'p1', '2026-08'), 'Red')] },
    });

    // The one of the old section, and the two reds of the new ones: not the yellow, not the green, not the period.
    expect(fineCount(summary)).toBe(3);
  });
});

describe('buildCockpit and the traffic light (NF-52)', () => {
  it('buildCockpit_AnItemWithoutALight_IsToVerifyAndNeverGreen', () => {
    const model = build(summaryOf({ alloggiatiManualRequired: { count: 1, items: [booking('SendAlloggiati', 'b1', 'Mario Rossi')] } }));

    expect(model.fine.rows[0].light).toBe('unknown');
    expect(model.green).toEqual([]);
    expect(model.lights).toMatchObject({ unknown: 1, green: 0, needs: 1, lightsOn: false });
  });

  it.each(['green', 'GREEN', 'Blue', 3, {}, ''])('buildCockpit_LightThisVersionDoesNotKnow_%j_IsToVerifyNeverGreen', (light) => {
    const item = lit(booking('SendAlloggiati', 'b1', 'Mario Rossi'), light as never);
    const model = build(summaryOf({ alloggiatiManualRequired: { count: 1, items: [item] } }));

    expect(model.fine.rows[0].light).toBe('unknown');
    expect(model.green).toEqual([]);
  });

  it('buildCockpit_RowsOfALevel_AreRedFirstThenYellowThenWhatHasNoLightWhateverTheDeadline', () => {
    const model = build(
      summaryOf({
        receiptsToUpload: {
          count: 3,
          items: [
            lit(booking('UploadAlloggiatiReceipt', 'b1', 'Gialla', hoursFromNow(-80)), 'Yellow'),
            booking('UploadAlloggiatiReceipt', 'b2', 'Senza luce', hoursFromNow(-100)),
            lit(booking('UploadAlloggiatiReceipt', 'b3', 'Rossa lontana', hoursFromNow(200)), 'Red'),
          ],
        },
      }),
    );

    // The deadline orders inside a light, never across lights.
    expect(subjects(model.fine.rows)).toEqual(['Rossa lontana', 'Gialla', 'Senza luce']);
    expect(model.fine.rows.map((row) => row.light)).toEqual(['red', 'yellow', 'unknown']);
  });

  it('buildCockpit_GreenItems_AreListedApartAndNeverCountedAsThingsToDo', () => {
    const model = build(
      summaryOf({
        receiptsToUpload: {
          count: 1,
          items: [
            lit(booking('UploadAlloggiatiReceipt', 'b1', 'Mario Rossi'), 'Green', 'receipt_archived'),
            lit(booking('UploadAlloggiatiReceipt', 'b2', 'Carla Neri'), 'Red', 'receipt_missing'),
          ],
        },
      }),
    );

    expect(subjects(model.fine.rows)).toEqual(['Carla Neri']);
    expect(model.fine.total).toBe(1);
    expect(model.fine.hidden).toBe(0);
    expect(model.total).toBe(1);
    // The green one is named for what it is (nothing is asked), has no button and its page is the title.
    expect(subjects(model.green)).toEqual(['Mario Rossi']);
    expect(model.green[0]).toMatchObject({ light: 'green', quiet: true, title: 'Ricevuta di Alloggiati Web: Mario Rossi', reason: 'La ricevuta è archiviata.' });
    expect(model.green[0].note).toBeUndefined();
  });

  it('buildCockpit_ServerCountsMoreThanItLists_GreensAreNotPartOfWhatIsHidden', () => {
    const items = [
      lit(booking('SendAlloggiatiManually', 'b1', 'Uno'), 'Red'),
      lit(booking('SendAlloggiatiManually', 'b2', 'Due'), 'Red'),
      ...['Tre', 'Quattro', 'Cinque'].map((name, index) => lit(booking('SendAlloggiatiManually', `g${index}`, name), 'Green')),
    ];
    const model = build(summaryOf({ manualSendsRequired: { count: 5, items } }));

    // Five need attention and two are listed: three are not, whatever the three green ones listed say.
    expect(model.fine.total).toBe(5);
    expect(model.fine.hidden).toBe(3);
    expect(model.fine.rows).toHaveLength(2);
    expect(model.green).toHaveLength(3);
  });

  it('buildCockpit_ReasonOfTheApi_IsInPlainWordsAndACodeThisVersionDoesNotKnowIsGeneric', () => {
    const model = build(
      summaryOf({
        receiptsToUpload: {
          count: 2,
          items: [
            lit(booking('UploadAlloggiatiReceipt', 'b1', 'Mario Rossi'), 'Yellow', 'entrusted_to_channel_manager'),
            lit(booking('UploadAlloggiatiReceipt', 'b2', 'Carla Neri'), 'Red', 'a_code_of_a_newer_server'),
          ],
        },
      }),
    );

    const [red, yellow] = model.fine.rows;
    expect(yellow.reason).toBe('Se ne occupa il tuo channel manager: aspettiamo la ricevuta.');
    expect(red.reason).toBe("C'è qualcosa da fare.");
    expect(JSON.stringify(model)).not.toContain('a_code_of_a_newer_server');
  });

  it('buildCockpit_EntrustedToTheChannelManager_IsYellowWithItsOwnReasonAndStillOpensTheStay', () => {
    const model = build(
      summaryOf({
        receiptsToUpload: { count: 1, items: [lit(booking('UploadAlloggiatiReceipt', 'b1', 'Mario Rossi'), 'Yellow', 'entrusted_to_channel_manager')] },
      }),
    );

    const [row] = model.fine.rows;
    expect(row).toMatchObject({ light: 'yellow', to: '/app/short-rent/bookings/b1?tab=alloggiati' });
    // Still something the host may do (it opens the stay with a button), unlike an item that is done.
    expect(row.quiet).toBeUndefined();
    expect(row.title).toBe('Carica la ricevuta di Alloggiati Web: Mario Rossi');
    expect(focusToneOf(row)).toBe('info');
  });

  it('buildCockpit_SectionsOfTheLight_AreInTheirLevels', () => {
    const model = build(
      summaryOf({
        identityPending: { count: 1, items: [lit(booking('VerifyIdentity', 'b1', 'Anna Verdi'), 'Red', 'identity_missing')] },
        connectionsToFix: { count: 1, items: [lit(period('ActivateOctorateSend', 'p1', '2026-08'), 'Red', 'connection_inactive')] },
        periodItems: { count: 1, items: [lit(period('UploadIstatProof', 'p1', '2026-08'), 'Red', 'deadline_overdue')] },
        manualSendsRequired: { count: 1, items: [lit(booking('SendAlloggiatiManually', 'b2', 'Mario Rossi'), 'Red', 'over_thirty_nights_not_sent')] },
      }),
    );

    expect(subjects(model.fine.rows).sort()).toEqual(['Casa Como', 'Casa Como', 'Mario Rossi']);
    expect(subjects(model.chore.rows)).toEqual(['Anna Verdi']);
    expect(model.total).toBe(4);
  });

  it('buildCockpit_TwoMonthsOfTheSameProperty_AreTwoRowsEachWithItsMonth', () => {
    const model = build(
      summaryOf({
        periodItems: {
          count: 2,
          items: [lit(period('UploadIstatProof', 'p1', '2026-08'), 'Red'), lit(period('UploadIstatProof', 'p1', '2026-09'), 'Red')],
        },
      }),
    );

    expect(new Set(model.fine.rows.map((row) => row.id)).size).toBe(2);
    expect(model.fine.rows.map((row) => row.title)).toEqual(
      expect.arrayContaining(['Carica la prova ISTAT di agosto 2026: Casa Como', 'Carica la prova ISTAT di settembre 2026: Casa Como']),
    );
    // Each opens the archive on its own month.
    expect(model.fine.rows.map((row) => row.to).sort()).toEqual([
      '/app/short-rent/alloggiati/reports?kind=IstatProof&property=p1&period=2026-08',
      '/app/short-rent/alloggiati/reports?kind=IstatProof&property=p1&period=2026-09',
    ]);
  });

  it('buildCockpit_AnItemListedInTwoSections_IsOneRow', () => {
    const same = lit(booking('SendAlloggiatiManually', 'b1', 'Mario Rossi'), 'Red');
    const model = build(summaryOf({ manualSendsRequired: { count: 1, items: [same] }, receiptsToUpload: { count: 1, items: [{ ...same }] } }));

    expect(model.fine.rows).toHaveLength(1);
  });

  it('buildCockpit_FocusIsTheWorstLightFirst_ARedOfTheUpkeepBeatsAYellowOfTheLaw', () => {
    const model = build(
      summaryOf({
        receiptsToUpload: { count: 1, items: [lit(booking('UploadAlloggiatiReceipt', 'b1', 'In corso'), 'Yellow')] },
        checkoutsDue: { count: 1, items: [lit(booking('CheckOut', 'b2', 'Da chiudere'), 'Red')] },
      }),
    );

    expect(model.focus?.subject).toBe('Da chiudere');
    // Without lights the level decides, as it always did.
    const legacy = build(
      summaryOf({
        receiptsToUpload: { count: 1, items: [booking('UploadAlloggiatiReceipt', 'b1', 'Della legge')] },
        checkoutsDue: { count: 1, items: [booking('CheckOut', 'b2', 'Da chiudere')] },
      }),
    );
    expect(legacy.focus?.subject).toBe('Della legge');
  });

  it('buildCockpit_PropertyWithSomethingToDo_IsNotInOrderWhateverItsStatusSays', () => {
    const properties = [
      { id: 'p1', name: 'Con la connessione spenta', complianceStatus: 'Active' },
      { id: 'p2', name: 'A posto', complianceStatus: 'Active' },
    ] as unknown as Property[];
    const model = build(summaryOf({ connectionsToFix: { count: 1, items: [lit(period('ActivateOctorateSend', 'p1', '2026-08'), 'Red')] } }), { properties });

    expect(subjects(model.activeProperties)).toEqual(['A posto']);
  });

  it('buildCockpit_RowsOfTheLights_DropTheOldStatusBadgeOfAlloggiatiWhenTheApiSendsTheLight', () => {
    const withLight = build(summaryOf({ alloggiatiFailures: { count: 1, items: [lit(booking('ResolveAlloggiatiFailure', 'b1', 'Mario Rossi'), 'Red', 'alloggiati_failed')] } }));
    const withoutLight = build(summaryOf({ alloggiatiFailures: { count: 1, items: [booking('ResolveAlloggiatiFailure', 'b1', 'Mario Rossi')] } }));

    // One pill, not two: the reason says what the badge said once the light is the API's.
    expect(withLight.fine.rows[0].badge).toBeUndefined();
    expect(withoutLight.fine.rows[0].badge).toEqual({ kind: 'alloggiati', status: 'Errore' });
  });

  it('buildCockpit_RowsOfTheLaw_HaveNoDeadlineInWordsOnceTheyAreDone', () => {
    const model = build(
      summaryOf({
        receiptsToUpload: { count: 0, items: [lit(booking('UploadAlloggiatiReceipt', 'b1', 'Mario Rossi', hoursFromNow(-30)), 'Green')] },
      }),
    );

    expect(model.green[0].note).toBeUndefined();
  });

  it('focusToneOf_InProgress_IsCalmInfoNotAWarning', () => {
    expect(focusToneOf({ tier: 'fine', light: 'yellow', note: { text: 'x', tone: 'danger' } } as CockpitRow)).toBe('info');
    expect(focusToneOf({ tier: 'fine', light: 'red', note: { text: 'x', tone: 'danger' } } as CockpitRow)).toBe('danger');
  });

  it('focusBodyOf_ReasonThenWhereAndWhatIsLacking', () => {
    expect(focusBodyOf({ reason: 'Non è stato inviato.', sub: 'Casa Como', detail: 'Manca: Documento' })).toBe('Non è stato inviato. Casa Como · Manca: Documento');
    expect(focusBodyOf({ reason: undefined, sub: 'Casa Como', detail: undefined })).toBe('Casa Como');
    expect(focusBodyOf({})).toBeUndefined();
  });
});
