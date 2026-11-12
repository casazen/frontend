import { describe, expect, it } from 'vitest';
import itLocale from '@/i18n/locales/it.json';
import enLocale from '@/i18n/locales/en.json';
import {
  ONBOARDING_NEED_CODES,
  ONBOARDING_PART_KEYS,
  ONBOARDING_PART_REASONS,
  ONBOARDING_PART_STATES,
  ONBOARDING_PATH_STEP_CODES,
  type OnboardingPart,
  type OnboardingPartKey,
  type OnboardingPathStep,
} from '@/types/onboarding.types';
import { path, part, pathStep } from '@/features/onboarding/__tests__/onboarding-fixtures';
import { LATE_EVENING_UTC, withBrowserTimeZone } from '@/test/clock';
import {
  ONBOARDING_PART_ICONS,
  ONBOARDING_PLAN_PATH,
  deferOptions,
  firstOpenPart,
  isOnboardingNeedCode,
  isOnboardingPartKey,
  isPathIncomplete,
  knownNeeds,
  knownParts,
  knownPathSteps,
  needKey,
  nextPathStep,
  nextStepWhyKey,
  normalizePartState,
  partPath,
  partTitleKey,
  partWhatKey,
  partsWaitedFor,
  pathProgress,
  pathStepTitleKey,
  reasonKey,
  stateKey,
  stepAfterPart,
  stepTargetPart,
} from '../onboarding-parts';

type Tree = { [key: string]: string | Tree };

function lookup(tree: Tree, path: string): string | Tree | undefined {
  return path.split('.').reduce<string | Tree | undefined>((node, segment) => (typeof node === 'object' ? node[segment] : undefined), tree);
}

describe('the registry of the parts of the plan (E10/F03)', () => {
  it('ElevenParts_InTheOrderOfThePlan_EachWithAnIcon', () => {
    expect(ONBOARDING_PART_KEYS).toEqual([
      'octorateConnection',
      'properties',
      'channels',
      'listings',
      'pricesRules',
      'compliance',
      'identification',
      'messagesAi',
      'fiscalDocuments',
      'partners',
      'activation',
    ]);
    expect(Object.keys(ONBOARDING_PART_ICONS)).toEqual([...ONBOARDING_PART_KEYS]);
  });

  it('PartPath_IsThePageOfThePartUnderThePlan', () => {
    expect(ONBOARDING_PLAN_PATH).toBe('/app/short-rent/onboarding');
    expect(partPath('octorateConnection')).toBe('/app/short-rent/onboarding/parts/octorateConnection');
    expect(partPath('pricesRules')).toBe('/app/short-rent/onboarding/parts/pricesRules');
  });

  it('IsOnboardingPartKey_OnlyTheElevenCodes', () => {
    for (const key of ONBOARDING_PART_KEYS) expect(isOnboardingPartKey(key)).toBe(true);
    expect(isOnboardingPartKey('OctorateConnection')).toBe(false);
    expect(isOnboardingPartKey('somethingNew')).toBe(false);
    expect(isOnboardingPartKey(undefined)).toBe(false);
    expect(isOnboardingPartKey(3)).toBe(false);
  });

  it('IsOnboardingNeedCode_OnlyTheFiveCodes', () => {
    for (const code of ONBOARDING_NEED_CODES) expect(isOnboardingNeedCode(code)).toBe(true);
    expect(isOnboardingNeedCode('petsAllowed')).toBe(false);
  });

  it('NormalizePartState_AStateThisVersionDoesNotKnow_IsShownAsToDo', () => {
    for (const state of ONBOARDING_PART_STATES) expect(normalizePartState(state)).toBe(state);
    expect(normalizePartState('inProgress')).toBe('open');
    expect(normalizePartState(undefined)).toBe('open');
  });
});

describe('knownParts: the plan as this version of the app can show it', () => {
  it('KnownParts_APartNobodyKnows_IsLeftOut', () => {
    const unknown = { ...part('partners'), code: 'quantumLedger' as OnboardingPartKey };

    const known = knownParts({ parts: [part('channels'), unknown, part('properties')] });

    expect(known.map((item) => item.code)).toEqual(['properties', 'channels']);
  });

  it('KnownParts_PartsOutOfOrder_AreSortedByTheirPlaceInThePlan', () => {
    const known = knownParts({ parts: [part('activation'), part('octorateConnection'), part('listings')] });

    expect(known.map((item) => item.code)).toEqual(['octorateConnection', 'listings', 'activation']);
  });

  it('KnownParts_APartSentTwice_CountsOnce', () => {
    const known = knownParts({ parts: [part('properties', { done: 1 }), part('properties', { done: 3 })] });

    expect(known).toHaveLength(1);
    expect(known[0].done).toBe(1);
  });

  it.each([undefined, null, {}, { parts: null }, { parts: 'no' }])('KnownParts_NoPlanOrNoList_%j_IsEmpty', (plan) => {
    expect(knownParts(plan as never)).toEqual([]);
  });

  it('KnownNeeds_OnlyTheCodesWithATextAreKept', () => {
    expect(knownNeeds({ needs: ['fiscalData', 'petsAllowed', 'lockCode'] as never })).toEqual(['fiscalData', 'lockCode']);
    expect(knownNeeds(undefined)).toEqual([]);
  });

  it('FirstOpenPart_IsTheFirstOneThatIsOpen_AnUnknownStateCountsAsOpen', () => {
    const parts = [part('octorateConnection', { state: 'done' }), part('properties', { state: 'deferred' }), part('channels', { state: 'blocked' }), part('listings')];
    expect(firstOpenPart(parts)?.code).toBe('listings');

    const newer = [part('octorateConnection', { state: 'done' }), part('properties', { state: 'inProgress' as OnboardingPart['state'] })];
    expect(firstOpenPart(newer)?.code).toBe('properties');

    expect(firstOpenPart([part('properties', { state: 'done' })])).toBeNull();
  });

  it('PartsWaitedFor_AreTheRequiredPartsThatAreNotDone', () => {
    const parts = [
      part('octorateConnection', { state: 'done' }),
      part('properties', { state: 'open', requires: ['octorateConnection'] }),
      part('activation', { state: 'blocked', requires: ['octorateConnection', 'properties'] }),
    ];

    expect(partsWaitedFor(parts[2], parts).map((item) => item.code)).toEqual(['properties']);
    expect(partsWaitedFor(parts[1], parts)).toEqual([]);
  });
});

describe('deferOptions: when to be reminded, on the clock of Rome (UX-06)', () => {
  const at = (options: ReturnType<typeof deferOptions>) => Object.fromEntries(options.map((option) => [option.choice, option.remindAt]));

  describe('whatever the time zone of the browser', () => {
    withBrowserTimeZone('America/Los_Angeles');

    it('Winter_EveningTomorrowAndNextWeek_AreEightPmNineAmAndNineAmInRome', () => {
      // 11:00 in Rome (CET, UTC+1).
      expect(at(deferOptions(new Date('2026-11-12T10:00:00Z')))).toEqual({
        evening: '2026-11-12T19:00:00.000Z',
        tomorrow: '2026-11-13T08:00:00.000Z',
        nextWeek: '2026-11-19T08:00:00.000Z',
      });
    });

    it('Summer_UsesTheSummerOffsetOfRome', () => {
      // 12:00 in Rome (CEST, UTC+2).
      expect(at(deferOptions(new Date('2026-07-12T10:00:00Z')))).toEqual({
        evening: '2026-07-12T18:00:00.000Z',
        tomorrow: '2026-07-13T07:00:00.000Z',
        nextWeek: '2026-07-19T07:00:00.000Z',
      });
    });

    it('ClockChangeBetween_TheOffsetIsTheOneOfEachDay', () => {
      // 24 October 2026, 12:00 in Rome (CEST). Summer time ends on the night of the 25th: tomorrow and next week are CET (UTC+1).
      expect(at(deferOptions(new Date('2026-10-24T10:00:00Z')))).toEqual({
        evening: '2026-10-24T18:00:00.000Z',
        tomorrow: '2026-10-25T08:00:00.000Z',
        nextWeek: '2026-10-31T08:00:00.000Z',
      });
    });

    it('ShortlyAfterMidnightInRome_TodayIsTheDayOfRomeNotTheUtcDay', () => {
      // 23:30 UTC of the 24th is 01:30 of the 25th in Rome: this evening is the evening of the 25th.
      expect(at(deferOptions(new Date(LATE_EVENING_UTC)))).toEqual({
        evening: '2026-09-25T18:00:00.000Z',
        tomorrow: '2026-09-26T07:00:00.000Z',
        nextWeek: '2026-10-02T07:00:00.000Z',
      });
    });
  });

  it('ThisEvening_IsOfferedOnlyWhileItIsStillToCome', () => {
    // 19:59 in Rome: still to come. 20:00 sharp and after: the server refuses a reminder in the past, so it is not offered.
    expect(deferOptions(new Date('2026-11-12T18:59:00Z')).map((option) => option.choice)).toEqual(['evening', 'tomorrow', 'nextWeek']);
    expect(deferOptions(new Date('2026-11-12T19:00:00Z')).map((option) => option.choice)).toEqual(['tomorrow', 'nextWeek']);
    expect(deferOptions(new Date('2026-11-12T22:45:00Z')).map((option) => option.choice)).toEqual(['tomorrow', 'nextWeek']);
  });

  it('EveryMoment_IsInTheFutureAndAFullDayOrMoreForTheLaterTwo', () => {
    const now = new Date('2026-11-12T10:00:00Z');

    for (const option of deferOptions(now)) expect(new Date(option.remindAt).getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('the connected path «Inizia con CasaZen» (UX-10, NF-10)', () => {
  const codes = (steps: readonly OnboardingPathStep[]) => steps.map((step) => step.code);

  it('KnownPathSteps_AStepNobodyKnowsOrWithNoKnownPart_IsLeftOutAndTheRestIsInOrder', () => {
    const unknown = { ...pathStep('messagesAi'), code: 'timeTravel' as OnboardingPathStep['code'] };
    const leadsNowhere = pathStep('fiscalDocuments', 'open', { parts: ['somethingNew' as OnboardingPartKey] });
    const mixed = pathStep('connectChannels', 'open', { parts: ['somethingNew' as OnboardingPartKey, 'properties'] });

    const known = knownPathSteps({ steps: [pathStep('pricesCalendar'), unknown, leadsNowhere, mixed, pathStep('pricesCalendar')] });

    expect(codes(known)).toEqual(['connectChannels', 'pricesCalendar']);
    // The parts of a step are reduced to the ones the app knows.
    expect(known[0].parts).toEqual(['properties']);
  });

  it.each([undefined, null, {}, { steps: null }])('KnownPathSteps_NoPath_%j_IsEmpty', (value) => {
    expect(knownPathSteps(value as never)).toEqual([]);
  });

  it('IsPathIncomplete_WhileOneStepIsVisible_AndComplete_WhenNoneIs', () => {
    expect(isPathIncomplete(knownPathSteps(path({ connectChannels: 'done' })))).toBe(true);
    const complete = Object.fromEntries(ONBOARDING_PATH_STEP_CODES.map((code) => [code, 'done'])) as Parameters<typeof path>[0];
    expect(isPathIncomplete(knownPathSteps(path(complete)))).toBe(false);
    // A step nobody provides is not something to do either.
    expect(isPathIncomplete(knownPathSteps(path({ ...complete, messagesAi: 'notAvailable' })))).toBe(false);
  });

  it('PathProgress_CountsTheStepsDoneOverTheStepsThatApply', () => {
    expect(pathProgress(knownPathSteps(path({ connectChannels: 'done', checkListings: 'done' })))).toEqual({ done: 2, total: 6 });
    // A step the server says is not available can never be done: it does not keep the bar from its end.
    expect(pathProgress(knownPathSteps(path({ connectChannels: 'done', messagesAi: 'notAvailable', fiscalDocuments: 'notAvailable' })))).toEqual({ done: 1, total: 4 });
    expect(pathProgress([])).toEqual({ done: 0, total: 0 });
  });

  describe('nextPathStep: the step the server names', () => {
    it('TheStepNamedInNext_WhenItIsVisible', () => {
      const given = path({ connectChannels: 'done' });

      expect(nextPathStep(given, knownPathSteps(given))?.code).toBe('checkListings');
    });

    it('NoStepNamed_NothingIsProposedBecauseTheHostPutOffWhatIsLeft', () => {
      const given = path({ connectChannels: 'deferred', checkListings: 'deferred' }, null);

      expect(nextPathStep(given, knownPathSteps(given))).toBeNull();
    });

    it('AStepThisVersionDoesNotKnow_FallsBackToTheFirstOneThatCanBeProposed', () => {
      const given = { ...path({ connectChannels: 'deferred', checkListings: 'open' }), next: 'timeTravel' as never };

      expect(nextPathStep(given, knownPathSteps(given))?.code).toBe('checkListings');
    });

    it('AStepThisVersionDoesNotKnow_FallbackSkipsTheStepsThatWaitForAnotherPart', () => {
      // The connection is put off, so the listings, the prices and the compliance wait for the properties: the first step that can be done is the messages.
      const given = { ...path({ connectChannels: 'deferred' }), next: 'timeTravel' as never };

      expect(nextPathStep(given, knownPathSteps(given))?.code).toBe('messagesAi');
    });
  });

  describe('stepAfterPart: the one step to suggest at the end of a wizard', () => {
    it('IsTheStepAfterTheOneTheWizardBelongsTo', () => {
      const steps = knownPathSteps(path({ connectChannels: 'done' }));

      expect(stepAfterPart(steps, 'listings')?.code).toBe('pricesCalendar');
      expect(stepAfterPart(steps, 'pricesRules')?.code).toBe('checkInCompliance');
    });

    it('NeverSuggestsTheStepTheHostHasJustBeenThrough_EvenWhenItIsNotDoneYet', () => {
      const steps = knownPathSteps(path());

      expect(stepAfterPart(steps, 'listings')?.code).not.toBe('checkListings');
      expect(stepAfterPart(steps, 'channels')?.code).not.toBe('connectChannels');
      // The listings are the next step once the connection is done.
      expect(stepAfterPart(knownPathSteps(path({ connectChannels: 'done' })), 'channels')?.code).toBe('checkListings');
    });

    it('SkipsAStepThatWaitsForAnotherPart_TheConnectionComesBeforeTheStepsThatHangFromIt', () => {
      // A property is added before the connection is complete: the listings, the prices and the compliance wait for the properties (`blocked`).
      const steps = knownPathSteps(path({ messagesAi: 'notAvailable', fiscalDocuments: 'notAvailable' }));
      expect(steps.filter((step) => step.state === 'blocked').map((step) => step.code)).toEqual(['checkListings', 'pricesCalendar', 'checkInCompliance']);

      // Not «Prezzi e calendario», which is after the listings in the path and cannot be done yet: the step that is left to do, the connection.
      expect(stepAfterPart(steps, 'listings')?.code).toBe('connectChannels');
      expect(stepAfterPart(steps, 'pricesRules')?.code).toBe('connectChannels');
    });

    it('SkipsAStepThatWaitsForAnotherPart_WhateverComesAfterItInThePath', () => {
      // The messages can be done now: they are suggested, the blocked steps between are not.
      const steps = knownPathSteps(path({ fiscalDocuments: 'notAvailable' }));

      expect(stepAfterPart(steps, 'listings')?.code).toBe('messagesAi');
    });

    it('NothingButStepsThatWait_IsNull', () => {
      const steps = knownPathSteps(
        path({ connectChannels: 'blocked', checkListings: 'open', pricesCalendar: 'blocked', checkInCompliance: 'blocked', messagesAi: 'notAvailable', fiscalDocuments: 'notAvailable' }),
      );

      expect(stepAfterPart(steps, 'listings')).toBeNull();
    });

    it('SkipsAStepThatIsDoneNotAvailableOrPutOff', () => {
      const steps = knownPathSteps(path({ connectChannels: 'done', checkListings: 'done', pricesCalendar: 'deferred', checkInCompliance: 'notAvailable' }));

      expect(stepAfterPart(steps, 'listings')?.code).toBe('messagesAi');
    });

    it('NothingAfter_GoesBackToTheFirstStepThatIsStillToDo', () => {
      const steps = knownPathSteps(path({ checkListings: 'done', pricesCalendar: 'done', checkInCompliance: 'done', messagesAi: 'done' }));

      expect(stepAfterPart(steps, 'fiscalDocuments')?.code).toBe('connectChannels');
    });

    it('AWizardOutsideTheSteps_IsFollowedByTheFirstStepToDo', () => {
      const steps = knownPathSteps(path({ connectChannels: 'done' }));

      expect(stepAfterPart(steps, 'identification')?.code).toBe('checkListings');
      expect(stepAfterPart(steps, 'activation')?.code).toBe('checkListings');
    });

    it('NothingLeftToSuggest_IsNull', () => {
      // Only the step of the wizard itself is left, or everything else is put off.
      expect(stepAfterPart(knownPathSteps(path({ checkListings: 'done', pricesCalendar: 'done', checkInCompliance: 'done', messagesAi: 'done', fiscalDocuments: 'done', connectChannels: 'done' })), 'listings')).toBeNull();
      const onlyCurrent = knownPathSteps(path({ connectChannels: 'done', pricesCalendar: 'done', checkInCompliance: 'done', messagesAi: 'done', fiscalDocuments: 'done' }));
      expect(stepAfterPart(onlyCurrent, 'listings')).toBeNull();
    });
  });

  describe('stepTargetPart: the part a step opens', () => {
    const connect = pathStep('connectChannels');

    it('IsTheFirstPartOfTheStepThatIsStillToDo', () => {
      const parts = [part('octorateConnection', { state: 'done' }), part('properties'), part('channels', { state: 'blocked' })];

      expect(stepTargetPart(connect, parts)).toBe('properties');
    });

    it('SkipsPartsThatAreDoneOrNotAvailable', () => {
      const parts = [part('octorateConnection', { state: 'notAvailable' }), part('properties', { state: 'done' }), part('channels', { state: 'deferred' })];

      expect(stepTargetPart(connect, parts)).toBe('channels');
    });

    it('SkipsThePartsThatWaitForAnotherPart_TheFirstOneThatCanBeDoneNowIsOpened', () => {
      const parts = [part('octorateConnection', { state: 'done' }), part('properties', { state: 'blocked' }), part('channels', { state: 'open' })];

      expect(stepTargetPart(connect, parts)).toBe('channels');
    });

    it('OnlyPartsThatWaitAreLeft_IsNullBecauseThereIsNothingToOpen', () => {
      // The properties are not provided, so the channels, which need them, wait for good: no part to open (a link would lead nowhere useful).
      const parts = [part('octorateConnection', { state: 'done' }), part('properties', { state: 'notAvailable', reason: 'mapping_unavailable' }), part('channels', { state: 'blocked' })];

      expect(stepTargetPart(connect, parts)).toBeNull();
      expect(stepTargetPart(pathStep('checkListings'), [part('listings', { state: 'blocked' })])).toBeNull();
    });

    it('WithoutThePlan_OrWhenNothingIsLeft_IsTheFirstPartOfTheStep', () => {
      expect(stepTargetPart(connect, [])).toBe('octorateConnection');
      expect(stepTargetPart(connect, [part('octorateConnection', { state: 'done' }), part('properties', { state: 'done' }), part('channels', { state: 'done' })])).toBe('octorateConnection');
    });
  });
});

describe('the words of the plan, in both languages', () => {
  describe.each([
    ['it', itLocale],
    ['en', enLocale],
  ])('%s', (_language, locale) => {
    const tree = locale as unknown as Tree;
    const text = (key: string) => lookup(tree, key);

    it('EveryPartHasATitleAndALineThatSaysWhatItIsFor', () => {
      for (const key of ONBOARDING_PART_KEYS) {
        expect(text(partTitleKey(key)), partTitleKey(key)).toEqual(expect.any(String));
        expect(text(partWhatKey(key)), partWhatKey(key)).toEqual(expect.any(String));
      }
    });

    it('EveryNeedHasItsText', () => {
      for (const code of ONBOARDING_NEED_CODES) expect(text(needKey(code)), needKey(code)).toEqual(expect.any(String));
    });

    it('EveryReasonAndEveryStateHasItsTextAndThereIsAFallbackForAnUnknownReason', () => {
      for (const reason of ONBOARDING_PART_REASONS) expect(text(reasonKey(reason)), reasonKey(reason)).toEqual(expect.any(String));
      for (const state of ONBOARDING_PART_STATES) expect(text(stateKey(state)), stateKey(state)).toEqual(expect.any(String));
      expect(text('onboardingPlan.reasons.unknown')).toEqual(expect.any(String));
      expect(text('onboardingPlan.states.deferredUntil')).toEqual(expect.any(String));
    });

    it('TheMenuEntryAndTheThreeMomentsOfAReminderHaveTheirText', () => {
      expect(text('nav.onboardingPlan')).toEqual(expect.any(String));
      for (const choice of ['evening', 'tomorrow', 'nextWeek']) expect(text(`onboardingPlan.defer.options.${choice}`)).toEqual(expect.any(String));
    });

    it('EveryStepOfThePathHasItsNameAndTheLineThatSaysWhyItIsTheNextOne', () => {
      for (const code of ONBOARDING_PATH_STEP_CODES) {
        expect(text(pathStepTitleKey(code)), pathStepTitleKey(code)).toEqual(expect.any(String));
        expect(text(nextStepWhyKey(code)), nextStepWhyKey(code)).toEqual(expect.any(String));
      }
    });

    it('TheCardOfThePathAndTheSuggestionAtTheEndOfAWizardHaveTheirText', () => {
      for (const key of ['title', 'progress', 'progressLabel', 'next', 'continue', 'all']) expect(text(`onboardingPlan.path.${key}`), key).toEqual(expect.any(String));
      for (const key of ['kicker', 'continue', 'later', 'laterToast', 'laterDone', 'laterError']) expect(text(`onboardingPlan.nextStep.${key}`), key).toEqual(expect.any(String));
    });
  });

  it('TheTwoSentencesTheBriefNames_AreTheOnesTheHostReadsInItalian', () => {
    expect(lookup(itLocale as unknown as Tree, 'onboardingPlan.defer.notDeferrable')).toBe('Serve per i passi successivi.');
    expect(lookup(itLocale as unknown as Tree, 'onboardingPlan.defer.adminOnly')).toBe("Per posticipare serve l'amministratore dell'organizzazione.");
    expect(lookup(itLocale as unknown as Tree, 'onboardingPlan.defer.toast')).toBe('Lo trovi in Da fare');
  });
});
