import { describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import i18n from '@/i18n/config';
import {
  CONDITION_FIELDS,
  EDITOR_EVENT_TYPES,
  actionProblemKey,
  actionToDraft,
  conditionFromRules,
  defaultActionType,
  draftToAction,
  eventOptionsFor,
  executionHeadline,
  isActionUnavailable,
  newActionDraft,
  newRuleDraft,
  nextKeyOf,
  parseExecutionResult,
  readCondition,
  ruleToCondition,
  toAvailability,
  unavailableActionTypes,
  utcInstant,
  withField,
  type RuleDraft,
} from '../routine-model';
import { describeRoutineError } from '../routine-errors';

// E01/F04/US02/T01 (NF-21, ADR-014, ADR-022): what the editor writes is what the routines API takes. These are the rules of the server (`RoutineConditions.ValueErrors`,
// `RoutineActionRules`) as the editor holds itself to them, so that nothing the server would refuse with a 422 is ever sent.

const rule = (overrides: Partial<RuleDraft>): RuleDraft => ({ ...newRuleDraft(1), ...overrides });

describe('the events the editor offers', () => {
  it('eventOptionsFor_Always_NeverOffersTheWeeklyRecurrence', () => {
    expect(EDITOR_EVENT_TYPES).not.toContain('WeeklyRecurrence');
    expect(eventOptionsFor()).not.toContain('WeeklyRecurrence');
    expect(eventOptionsFor('WeeklyRecurrence')).not.toContain('WeeklyRecurrence');
  });

  it('eventOptionsFor_RoutineWithAnEventOutsideTheList_KeepsItSoThePickerShowsIt', () => {
    expect(eventOptionsFor('PaymentFailed')).toEqual([...EDITOR_EVENT_TYPES, 'PaymentFailed']);
    expect(eventOptionsFor('BookingNew')).toEqual([...EDITOR_EVENT_TYPES]);
  });
});

describe('the condition of a routine: the five fields it reads', () => {
  it('conditionFields_AreTheFiveOfTheRoutinesAndNoOtherOfTheCatalog', () => {
    expect(CONDITION_FIELDS.map((field) => field.fieldId).sort()).toEqual(['bookingLeadTime', 'channel', 'guestCount', 'propertyId', 'stayDuration']);
  });

  it('conditionFields_Operators_AreTheOnesOfTheCatalogForEachField', () => {
    const operatorsOf = (fieldId: string) => CONDITION_FIELDS.find((field) => field.fieldId === fieldId)?.operators;
    expect(operatorsOf('propertyId')).toEqual(['in', 'notIn']);
    expect(operatorsOf('channel')).toEqual(['equals', 'notEquals', 'in', 'notIn']);
    for (const count of ['stayDuration', 'guestCount', 'bookingLeadTime']) {
      expect(operatorsOf(count)).toEqual(['equals', 'greaterThan', 'lessThan', 'between']);
    }
  });

  it('ruleToCondition_ValueOfTheKindTheOperatorTakes_IsWrittenWithThatKind', () => {
    expect(ruleToCondition(rule({ fieldId: 'propertyId', operator: 'in', list: ['p1', 'p2'] }))).toEqual({ fieldId: 'propertyId', operator: 'in', value: ['p1', 'p2'] });
    expect(ruleToCondition(rule({ fieldId: 'channel', operator: 'notIn', list: ['Airbnb', 'BookingCom'] }))).toEqual({ fieldId: 'channel', operator: 'notIn', value: ['Airbnb', 'BookingCom'] });
    expect(ruleToCondition(rule({ fieldId: 'channel', operator: 'equals', single: 'Direct' }))).toEqual({ fieldId: 'channel', operator: 'equals', value: 'Direct' });
    // A count is a number, never the text that was typed.
    expect(ruleToCondition(rule({ fieldId: 'guestCount', operator: 'greaterThan', single: '4' }))).toEqual({ fieldId: 'guestCount', operator: 'greaterThan', value: 4 });
    expect(ruleToCondition(rule({ fieldId: 'stayDuration', operator: 'between', low: '2', high: '7' }))).toEqual({ fieldId: 'stayDuration', operator: 'between', value: [2, 7] });
  });

  it.each([
    ['a list of properties with none chosen', rule({ fieldId: 'propertyId', operator: 'in', list: [] })],
    ['a channel list with none chosen', rule({ fieldId: 'channel', operator: 'in', list: [] })],
    ['a channel that is not one of a booking', rule({ fieldId: 'channel', operator: 'equals', single: 'Facebook' })],
    ['a channel with none chosen', rule({ fieldId: 'channel', operator: 'equals', single: '' })],
    ['a count with nothing typed', rule({ fieldId: 'guestCount', operator: 'equals', single: '' })],
    ['a count that is not a whole number', rule({ fieldId: 'guestCount', operator: 'equals', single: '2.5' })],
    ['a negative count', rule({ fieldId: 'stayDuration', operator: 'greaterThan', single: '-1' })],
    ['a count written with letters', rule({ fieldId: 'bookingLeadTime', operator: 'lessThan', single: 'tre' })],
    ['a range with the higher number first', rule({ fieldId: 'stayDuration', operator: 'between', low: '9', high: '2' })],
    ['a range with one end missing', rule({ fieldId: 'stayDuration', operator: 'between', low: '2', high: '' })],
    ['an operator the field does not take', rule({ fieldId: 'propertyId', operator: 'equals', single: 'p1' })],
  ])('ruleToCondition_%s_IsNotACondition', (_label, draft) => {
    expect(ruleToCondition(draft)).toBeNull();
  });

  it('conditionFromRules_NoRule_IsNoCondition', () => {
    expect(conditionFromRules('AND', [])).toBeNull();
  });

  it('conditionFromRules_ARuleThatIsNotComplete_IsNotValid', () => {
    expect(conditionFromRules('AND', [rule({ fieldId: 'guestCount', operator: 'equals', single: '2' }), rule({ key: 2 })])).toBeUndefined();
  });

  it('conditionFromRules_CompleteRules_AreOneGroupOfTheShapeTheApiReads', () => {
    expect(conditionFromRules('OR', [rule({ fieldId: 'guestCount', operator: 'equals', single: '2' }), rule({ key: 2, fieldId: 'channel', operator: 'in', list: ['Airbnb'] })])).toEqual({
      // `version` is a text and the rules are `rules` with a `fieldId`: the shape the first version of the page wrote (`field`, `conditions`) is refused.
      version: '1.0',
      groups: [
        {
          operator: 'OR',
          rules: [
            { fieldId: 'guestCount', operator: 'equals', value: 2 },
            { fieldId: 'channel', operator: 'in', value: ['Airbnb'] },
          ],
        },
      ],
    });
  });

  it('withField_AnotherField_StartsFromItsFirstOperatorAndNothingChosen', () => {
    const changed = withField(rule({ fieldId: 'channel', operator: 'notIn', list: ['Airbnb'], single: 'Direct' }), 'stayDuration');

    expect(changed).toMatchObject({ fieldId: 'stayDuration', operator: 'equals', list: [], single: '', low: '', high: '' });
  });

  it.each([undefined, '', '   ', '{}', 'null', '{"groups":[]}', '{"version":"1.0","groups":[]}'])('readCondition_%j_IsNoConditionAndCanBeEdited', (stored) => {
    expect(readCondition(stored)).toEqual({ kind: 'rules', operator: 'AND', rules: [] });
  });

  it('readCondition_OneGroupOfTheFiveFields_IsShownWhole', () => {
    const read = readCondition(
      JSON.stringify({
        version: '1.0',
        groups: [
          {
            operator: 'OR',
            rules: [
              { fieldId: 'channel', operator: 'notIn', value: ['Airbnb', 'Expedia'] },
              { fieldId: 'stayDuration', operator: 'between', value: [2, 5] },
              { fieldId: 'propertyId', operator: 'in', value: ['p1'] },
              { fieldId: 'bookingLeadTime', operator: 'lessThan', value: 3 },
            ],
          },
        ],
      }),
    );

    expect(read.kind).toBe('rules');
    if (read.kind !== 'rules') return;
    expect(read.operator).toBe('OR');
    expect(read.rules.map((r) => [r.fieldId, r.operator, r.list, r.single, r.low, r.high])).toEqual([
      ['channel', 'notIn', ['Airbnb', 'Expedia'], '', '', ''],
      ['stayDuration', 'between', [], '', '2', '5'],
      ['propertyId', 'in', ['p1'], '', '', ''],
      ['bookingLeadTime', 'lessThan', [], '3', '', ''],
    ]);
    // And it is written back as it was.
    expect(conditionFromRules(read.operator, read.rules)).toEqual({
      version: '1.0',
      groups: [
        {
          operator: 'OR',
          rules: [
            { fieldId: 'channel', operator: 'notIn', value: ['Airbnb', 'Expedia'] },
            { fieldId: 'stayDuration', operator: 'between', value: [2, 5] },
            { fieldId: 'propertyId', operator: 'in', value: ['p1'] },
            { fieldId: 'bookingLeadTime', operator: 'lessThan', value: 3 },
          ],
        },
      ],
    });
  });

  it.each([
    ['not JSON', '{nope'],
    ['not an object', '[1]'],
    ['the first shape of the page (`field`, `conditions`)', '{"version":1,"groups":[{"operator":"AND","conditions":[{"field":"guestCount","operator":"Equals","value":2}]}]}'],
    ['a member nobody reads', '{"version":"1.0","groups":[],"extra":1}'],
    ['two groups', '{"version":"1.0","groups":[{"operator":"AND","rules":[]},{"operator":"OR","rules":[]}]}'],
    ['a field a routine does not read', '{"version":"1.0","groups":[{"operator":"AND","rules":[{"fieldId":"idVerificationStatus","operator":"equals","value":"Verified"}]}]}'],
    ['an operator the field does not take', '{"version":"1.0","groups":[{"operator":"AND","rules":[{"fieldId":"propertyId","operator":"equals","value":"p1"}]}]}'],
    ['a value of another kind', '{"version":"1.0","groups":[{"operator":"AND","rules":[{"fieldId":"guestCount","operator":"equals","value":"2"}]}]}'],
    ['a group operator the server does not read', '{"version":"1.0","groups":[{"operator":"and","rules":[]}]}'],
  ])('readCondition_%s_IsLeftAsItIsAndNeverRewritten', (_label, stored) => {
    expect(readCondition(stored)).toEqual({ kind: 'unsupported' });
  });
});

describe('the actions of a routine', () => {
  it('actionProblemKey_Wait_LastsFromAnHourToAYear', () => {
    const wait = (days: string, hours: string) => ({ ...newActionDraft(1, 'Wait'), days, hours });

    expect(actionProblemKey(wait('0', '1'))).toBeNull();
    expect(actionProblemKey(wait('365', '0'))).toBeNull();
    expect(actionProblemKey(wait('0', '0'))).toBe('routines.problem.wait');
    expect(actionProblemKey(wait('365', '1'))).toBe('routines.problem.wait');
    expect(actionProblemKey(wait('-1', '5'))).toBe('routines.problem.wait');
    expect(actionProblemKey(wait('1.5', '0'))).toBe('routines.problem.wait');
  });

  it('actionProblemKey_Todo_NeedsWordsOfAtMostOneHundredFortyCharactersAndADeadlineOfZeroToSixtyDays', () => {
    const todo = (text: string, dueInDays = '') => ({ ...newActionDraft(1, 'CreateActivity'), text, dueInDays });

    expect(actionProblemKey(todo('Controlla la casa'))).toBeNull();
    expect(actionProblemKey(todo('Controlla la casa', '0'))).toBeNull();
    expect(actionProblemKey(todo('Controlla la casa', '60'))).toBeNull();
    expect(actionProblemKey(todo('   '))).toBe('routines.problem.activityText');
    expect(actionProblemKey(todo('x'.repeat(141)))).toBe('routines.problem.activityText');
    expect(actionProblemKey(todo('x'.repeat(140)))).toBeNull();
    expect(actionProblemKey(todo('Controlla la casa', '61'))).toBe('routines.problem.activityDue');
    expect(actionProblemKey(todo('Controlla la casa', '-1'))).toBe('routines.problem.activityDue');
  });

  it('draftToAction_NumbersTyped_AreNumbersInTheConfiguration', () => {
    expect(draftToAction({ ...newActionDraft(1, 'Wait'), days: '2', hours: '3' })).toEqual({ type: 'Wait', config: { days: 2, hours: 3 } });
    expect(draftToAction({ ...newActionDraft(1, 'CreateActivity'), text: ' Prepara ', dueInDays: '4' })).toEqual({ type: 'CreateActivity', config: { text: 'Prepara', dueInDays: 4 } });
    // No deadline is no `dueInDays`, not a zero.
    expect(draftToAction({ ...newActionDraft(1, 'CreateActivity'), text: 'Prepara' })).toEqual({ type: 'CreateActivity', config: { text: 'Prepara' } });
  });

  it('actionToDraft_StoredConfigurationTheEditorHasNoFieldFor_IsKeptWhenItIsWrittenBack', () => {
    const stored = { type: 'MessageToGuest' as const, config: { channel: 'email', templateId: 't-1' } };

    expect(draftToAction(actionToDraft(1, stored))).toEqual(stored);
    expect(draftToAction(actionToDraft(1, { type: 'AddTag', config: { tag: 'vip' } }))).toEqual({ type: 'AddTag', config: { tag: 'vip' } });
  });

  it('actionToDraft_WaitStoredWithNumbers_ShowsThemAsTyped', () => {
    expect(actionToDraft(1, { type: 'Wait', config: { days: 2, hours: 0 } })).toMatchObject({ days: '2', hours: '0' });
  });

  it('nextKeyOf_ListWithGaps_NeverEqualsAKeyThatIsStillThere', () => {
    expect(nextKeyOf([])).toBe(1);
    expect(nextKeyOf([{ key: 1 }, { key: 4 }])).toBe(5);
  });
});

describe('what the catalog says of the actions', () => {
  const catalog = toAvailability([
    { type: 'Wait', available: true, code: null },
    { type: 'CreateActivity', available: true, code: null },
    { type: 'MessageToGuest', available: false, code: 'routine_action_not_available' },
    { type: 'NotifyOwner', available: false, code: 'routine_action_not_available' },
  ]);

  it('isActionUnavailable_OnlyWhatTheCatalogSays', () => {
    expect(isActionUnavailable(catalog, 'MessageToGuest')).toBe(true);
    expect(isActionUnavailable(catalog, 'Wait')).toBe(false);
    // Not in the catalog, or no catalog (not read yet, or it failed): nothing is marked, the server decides when the routine is switched on.
    expect(isActionUnavailable(catalog, 'AddTag')).toBe(false);
    expect(isActionUnavailable(undefined, 'MessageToGuest')).toBe(false);
  });

  it('unavailableActionTypes_List_NamesEachOnceInTheOrderOfTheList', () => {
    expect(unavailableActionTypes(catalog, [{ type: 'NotifyOwner' }, { type: 'Wait' }, { type: 'MessageToGuest' }, { type: 'NotifyOwner' }])).toEqual(['NotifyOwner', 'MessageToGuest']);
    expect(unavailableActionTypes(undefined, [{ type: 'NotifyOwner' }])).toEqual([]);
  });

  it('defaultActionType_StartsFromAnActionThatRuns', () => {
    expect(defaultActionType(catalog)).toBe('CreateActivity');
    expect(defaultActionType(undefined)).toBe('CreateActivity');
    // Were the To do not to run, the first action of the editor that does, and the wait last of all.
    expect(defaultActionType(toAvailability([{ type: 'CreateActivity', available: false, code: 'x' }, { type: 'MessageToGuest', available: false, code: 'x' }, { type: 'NotifyOwner', available: true, code: null }]))).toBe('NotifyOwner');
    expect(defaultActionType(toAvailability(['CreateActivity', 'MessageToGuest', 'NotifyOwner', 'NotifyStaff', 'NotifyTeam', 'SendAccessCode', 'RequestReview', 'AddTag'].map((type) => ({ type: type as 'AddTag', available: false, code: 'x' }))))).toBe('Wait');
  });
});

describe('the log of an execution', () => {
  it('parseExecutionResult_ResultOfTheEngine_ReadsEachActionAndTheCodeOfTheWhole', () => {
    expect(
      parseExecutionResult(
        JSON.stringify({
          actions: [
            { index: 0, type: 'Wait', outcome: 'done' },
            { index: 1, type: 'SendAccessCode', outcome: 'blocked', code: 'access_code_needs_id_verification' },
          ],
          nextActionIndex: 2,
          code: 'routine_booking_not_active',
        }),
      ),
    ).toEqual({
      actions: [
        { index: 0, type: 'Wait', outcome: 'done' },
        { index: 1, type: 'SendAccessCode', outcome: 'blocked', code: 'access_code_needs_id_verification' },
      ],
      code: 'routine_booking_not_active',
    });
  });

  it.each([undefined, '', '{}', 'not json', '[]', '{"actions":"no"}'])('parseExecutionResult_%j_IsAnEmptyResultAndNeverThrows', (stored) => {
    expect(parseExecutionResult(stored)).toEqual({ actions: [] });
  });

  it('parseExecutionResult_ActionWithAnOutcomeThisVersionDoesNotKnow_IsLeftOut', () => {
    expect(parseExecutionResult(JSON.stringify({ actions: [{ index: 0, type: 'Wait', outcome: 'exploded' }, { index: 1, type: 'Wait', outcome: 'done' }] })).actions).toEqual([
      { index: 1, type: 'Wait', outcome: 'done' },
    ]);
  });

  describe('executionHeadline', () => {
    const actionsOf = (...outcomes: Array<'done' | 'simulated' | 'blocked' | 'failed' | 'waiting'>) => outcomes.map((outcome) => ({ outcome }));

    it('executionHeadline_SuccessWithAnActionReallyDone_IsAGreenCompleted', () => {
      expect(executionHeadline('Success', actionsOf('done'))).toEqual({ labelKey: 'routines.log.outcome.success', tone: 'success' });
      expect(executionHeadline('Success', actionsOf('done', 'blocked'))).toEqual({ labelKey: 'routines.log.outcome.success', tone: 'success' });
    });

    it('executionHeadline_SuccessWhoseActionsWereOnlySimulated_IsASimulationInNeutral', () => {
      expect(executionHeadline('Success', actionsOf('simulated', 'simulated'))).toEqual({ labelKey: 'routines.log.outcome.simulated', tone: 'neutral' });
      // A simulation with an action that a guardrail would have stopped is still a simulation.
      expect(executionHeadline('Success', actionsOf('blocked', 'simulated'))).toEqual({ labelKey: 'routines.log.outcome.simulated', tone: 'neutral' });
    });

    it('executionHeadline_SuccessWhoseActionsWereOnlyBlocked_IsBlockedInNeutral', () => {
      expect(executionHeadline('Success', actionsOf('blocked'))).toEqual({ labelKey: 'routines.log.outcome.blocked', tone: 'neutral' });
    });

    it('executionHeadline_SuccessWithNoActionToTell_IsNeverGreen', () => {
      expect(executionHeadline('Success', [])).toEqual({ labelKey: 'routines.log.outcome.success', tone: 'neutral' });
    });

    it('executionHeadline_OtherOutcomes_KeepTheirOwnWordsAndTone', () => {
      expect(executionHeadline('Failed', actionsOf('failed'))).toEqual({ labelKey: 'routines.log.outcome.failed', tone: 'danger' });
      // Actions that were only simulated or blocked do not soften a run that failed.
      expect(executionHeadline('Failed', actionsOf('simulated'))).toEqual({ labelKey: 'routines.log.outcome.failed', tone: 'danger' });
      expect(executionHeadline('Waiting', actionsOf('waiting'))).toEqual({ labelKey: 'routines.log.outcome.waiting', tone: 'neutral' });
      expect(executionHeadline('Running', [])).toEqual({ labelKey: 'routines.log.outcome.running', tone: 'neutral' });
      expect(executionHeadline('Pending', [])).toEqual({ labelKey: 'routines.log.outcome.pending', tone: 'neutral' });
      expect(executionHeadline('SomethingNew', actionsOf('done'))).toEqual({ labelKey: 'routines.log.outcome.unknown', tone: 'neutral' });
    });

    it.each(['it', 'en'] as const)('executionHeadline_EveryLabel_HasItsWordsIn_%s', (lng) => {
      const outcomes = ['Success', 'Failed', 'Waiting', 'Running', 'Pending', 'SomethingNew'];
      const runs = [actionsOf('done'), actionsOf('simulated'), actionsOf('blocked'), []];
      const keys = new Set(outcomes.flatMap((outcome) => runs.map((actions) => executionHeadline(outcome, actions).labelKey)));

      for (const key of keys) expect(i18n.exists(key, { lng }), key).toBe(true);
    });
  });

  it('utcInstant_InstantWithNoZone_IsUtcLikeEveryInstantOfTheApi', () => {
    expect(utcInstant('2026-11-10T08:00:00')).toBe('2026-11-10T08:00:00Z');
    expect(utcInstant('2026-11-10T08:00:00Z')).toBe('2026-11-10T08:00:00Z');
    expect(utcInstant('2026-11-10T08:00:00+01:00')).toBe('2026-11-10T08:00:00+01:00');
  });
});

describe('the words for a failed call of the routines API', () => {
  const failed = (status: number, data: Record<string, unknown>) =>
    new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
  const t = i18n.getFixedT('it');

  it('describeRoutineError_ActionsThatCannotRun_NamesThemByTheNamesOfTheEditor', async () => {
    await i18n.changeLanguage('it');

    expect(describeRoutineError(failed(422, { code: 'routine_action_not_available', actions: ['NotifyOwner', 'SendAccessCode'] }), t)).toBe(
      'Non si può attivare: contiene azioni non ancora disponibili (Notifica proprietario, Invia codice di accesso). Puoi provarla in modalità test.',
    );
  });

  it('describeRoutineError_NamesThatThisVersionDoesNotKnow_AreNotShown', async () => {
    await i18n.changeLanguage('it');

    expect(describeRoutineError(failed(422, { code: 'routine_action_not_available', actions: ['SomethingNew'] }), t)).toBe(
      'Questa routine contiene azioni non ancora disponibili: non si può attivare, ma puoi provarla in modalità test.',
    );
  });

  it.each([
    ['routine_event_not_available', 422, 'Questo evento non fa ancora partire nessuna routine: scegline un altro.'],
    ['routines_need_org_scope', 403, 'Le routine valgono per tutti gli immobili dell’organizzazione: per cambiarle serve poterli vedere tutti.'],
    ['routine_limit_reached', 409, 'Hai raggiunto il numero massimo di routine (50): elimina una routine per crearne un’altra.'],
  ])('describeRoutineError_%s_HasItsOwnWordsInBothLanguages', async (code, status, italian) => {
    await i18n.changeLanguage('it');
    expect(describeRoutineError(failed(status, { code }), t)).toBe(italian);

    await i18n.changeLanguage('en');
    const english = describeRoutineError(failed(status, { code }), i18n.getFixedT('en'));
    expect(english).toBeTruthy();
    expect(english).not.toBe(italian);
    await i18n.changeLanguage('it');
  });
});
