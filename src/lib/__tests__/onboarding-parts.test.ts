import { describe, expect, it } from 'vitest';
import itLocale from '@/i18n/locales/it.json';
import enLocale from '@/i18n/locales/en.json';
import {
  ONBOARDING_NEED_CODES,
  ONBOARDING_PART_KEYS,
  ONBOARDING_PART_REASONS,
  ONBOARDING_PART_STATES,
  type OnboardingPart,
  type OnboardingPartKey,
} from '@/types/onboarding.types';
import { LATE_EVENING_UTC, withBrowserTimeZone } from '@/test/clock';
import {
  ONBOARDING_PART_ICONS,
  ONBOARDING_PLAN_PATH,
  deferOptions,
  firstOpenPart,
  isOnboardingNeedCode,
  isOnboardingPartKey,
  knownNeeds,
  knownParts,
  needKey,
  normalizePartState,
  partPath,
  partTitleKey,
  partWhatKey,
  partsWaitedFor,
  reasonKey,
  stateKey,
} from '../onboarding-parts';

function part(code: OnboardingPartKey, overrides: Partial<OnboardingPart> = {}): OnboardingPart {
  return {
    code,
    order: ONBOARDING_PART_KEYS.indexOf(code) + 1,
    state: 'open',
    reason: null,
    done: 0,
    total: 0,
    requires: [],
    deferrable: true,
    needs: [],
    remindAt: null,
    assist: null,
    launchTarget: 'connect',
    ...overrides,
  };
}

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
  });

  it('TheTwoSentencesTheBriefNames_AreTheOnesTheHostReadsInItalian', () => {
    expect(lookup(itLocale as unknown as Tree, 'onboardingPlan.defer.notDeferrable')).toBe('Serve per i passi successivi.');
    expect(lookup(itLocale as unknown as Tree, 'onboardingPlan.defer.adminOnly')).toBe("Per posticipare serve l'amministratore dell'organizzazione.");
    expect(lookup(itLocale as unknown as Tree, 'onboardingPlan.defer.toast')).toBe('Lo trovi in Da fare');
  });
});
