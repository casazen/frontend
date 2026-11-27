import { describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import i18n from '@/i18n/config';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';
import type { KnowledgeEntry } from '@/types/assistant-settings.types';
import { ASSISTANT_TONES, KNOWLEDGE_ENTRY_KINDS, KNOWLEDGE_TOPICS, OFFERED_MODES } from '@/types/assistant-settings.types';
import {
  ASSISTANT_LANGUAGES,
  SITUATION_CODES,
  TOPIC_NAMES,
  answerSource,
  assistantProblemMessage,
  draftOutcomeView,
  entryFieldsOf,
  entryProblem,
  entryRequestOf,
  hasPropertyExceptions,
  hoursApi,
  hoursInput,
  hoursProblem,
  isNotFound,
  modeKey,
  pendingDraftOf,
  relaxedThreshold,
  relaxedTopics,
  situationText,
  topicOptions,
  topicText,
} from '../lib/assistant-model';

type Tree = { [key: string]: string | Tree };

/** A key of a locale file, or `undefined`. */
function textOf(locale: unknown, key: string): string | undefined {
  let node: unknown = locale;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Tree)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

const LOCALES = [
  ['it', it_],
  ['en', en],
] as const;

function expectKeyInBothLocales(key: string) {
  for (const [language, locale] of LOCALES) expect(textOf(locale, key), `${key} (${language})`).toBeTypeOf('string');
}

function httpError(status: number, data: Record<string, unknown>): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

function draft(overrides: Partial<ApprovalQueueItem> = {}): ApprovalQueueItem {
  return {
    id: 'a1',
    itemType: 'MessageDraft',
    itemId: 'i1',
    contentText: 'Il check-in è dalle 15.',
    contentVersion: null,
    isAiGenerated: true,
    status: 'Pending',
    approvedByUserId: null,
    approvedAt: null,
    createdAt: '2026-11-10T08:00:00Z',
    expiresAt: '2026-11-17T08:00:00Z',
    propertyId: 'p1',
    originAction: 'SendGuestMessage',
    originActionStatus: 'Pending',
    originActionError: null,
    originActionExecutedAt: null,
    originActionResult: null,
    confidenceScore: 0.9,
    situationCode: 'check_in_time',
    threadKey: 'ota:1',
    editedContentText: null,
    editedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

describe('the words of the assistant screens exist in both languages', () => {
  it.each(SITUATION_CODES)('assistant.situation.%s_HasAWordInItAndEn', (code) => {
    expectKeyInBothLocales(`assistant.situation.${code}`);
  });

  it.each(KNOWLEDGE_TOPICS)('assistant.knowledge.topic.%s_HasAWordInItAndEn', (topic) => {
    expectKeyInBothLocales(`assistant.knowledge.topic.${topic}`);
  });

  it.each(KNOWLEDGE_ENTRY_KINDS)('assistant.knowledge.kind.%s_HasAWordInItAndEn', (kind) => {
    expectKeyInBothLocales(`assistant.knowledge.kind.${kind}`);
  });

  it.each(ASSISTANT_TONES)('assistant.tone.%s_HasAWordInItAndEn', (tone) => {
    expectKeyInBothLocales(`assistant.tone.${tone}`);
  });

  it.each(ASSISTANT_LANGUAGES)('assistant.language.%s_HasAWordInItAndEn', (code) => {
    expectKeyInBothLocales(`assistant.language.${code}`);
  });

  it.each(['escalate', 'draft', 'notActive'])('assistant.mode.%s_HasItsNameAndItsExplanationInItAndEn', (mode) => {
    expectKeyInBothLocales(`assistant.mode.${mode}`);
    expectKeyInBothLocales(`assistant.mode.${mode}Explain`);
  });

  it('draftOutcomeView_EveryReasonOfTheDecisionLog_HasASentenceInItAndEn', () => {
    const reasons = [
      'thread_not_found',
      'message_not_found',
      'property_unassigned',
      'thread_closed',
      'octorate_not_connected',
      'mapping_not_confirmed',
      'assistant_disabled',
      'ai_provider_not_configured',
      'ai_budget_exceeded',
      'ai_provider_error',
      'ai_invalid_answer',
      'message_too_old',
      'superseded',
      'host_already_replied',
    ];
    for (const reason of reasons) {
      const view = draftOutcomeView({ decision: 'NotHandled', reason });
      expect(view?.key, reason).toBe(`assistant.draft.reason.${reason}`);
      expectKeyInBothLocales(view!.key);
    }
    for (const reason of ['mode_escalate', 'forbidden_topic', 'topic_not_allowed']) {
      const view = draftOutcomeView({ decision: 'Escalated', reason });
      expect(view?.key, reason).toBe(`assistant.draft.outcome.escalated.${reason}`);
      expectKeyInBothLocales(view!.key);
    }
    expectKeyInBothLocales('assistant.draft.reason.unknown');
    expectKeyInBothLocales('assistant.draft.outcome.escalated.default');
  });

  it('theTextsOfTheAssistant_NameNeitherTheProviderOfTheAiNorTheChannelManager', () => {
    const named = /octorate|openai|anthropic|claude|gpt|gemini|mistral|concordato\s*facile/i;
    const all: Array<[string, string]> = [];
    const collect = (node: unknown, path: string) => {
      if (typeof node === 'string') all.push([path, node]);
      else if (node !== null && typeof node === 'object') Object.entries(node).forEach(([key, value]) => collect(value, `${path}.${key}`));
    };
    for (const [, locale] of LOCALES) collect((locale as unknown as Tree).assistant, 'assistant');

    expect(all.length).toBeGreaterThan(200);
    expect(all.filter(([, text]) => named.test(text)).map(([key]) => key)).toEqual([]);
  });

  it('situationText_KnownAndUnknownCode_WordsBoth', () => {
    expect(situationText('wifi', i18n.getFixedT('it'), i18n)).toBe('Wi-Fi');
    expect(situationText('check_in_time', i18n.getFixedT('en'), i18n)).toBe('Check-in time');
    // A code a later version adds is written as a phrase, never as a raw identifier.
    expect(situationText('late_arrival_card', i18n.getFixedT('en'), i18n)).toBe('Late arrival card');
  });

  it('topicText_TopicsAndSituationsOfTheLists_AreWordedAndAnUnknownNameIsAPhrase', () => {
    const t = i18n.getFixedT('en');
    expect(topicText('CheckIn', t, i18n)).toBe('Check-in');
    // A situation that is not a topic is worded as the situation.
    expect(topicText('InvoiceRequest', t, i18n)).toBe('Invoice request');
    expect(topicText('SomethingNew', t, i18n)).toBe('Something new');
    expect(TOPIC_NAMES).toEqual(expect.arrayContaining(['CheckIn', 'Faq', 'InvoiceRequest', 'Other']));
    // A name that is both a topic and a situation is listed once.
    expect(TOPIC_NAMES.filter((name) => name === 'Parking')).toHaveLength(1);
    // A name the server holds and this version does not know is kept in the list, so that a save does not drop it.
    expect(topicOptions(['Parking', 'SomethingNew'])).toContain('SomethingNew');
  });
});

describe('the hours', () => {
  it('hoursInput_And_hoursApi_RoundTripTheSecondsTheServerWrites', () => {
    expect(hoursInput('09:30:00')).toBe('09:30');
    expect(hoursInput(null)).toBe('');
    expect(hoursApi('09:30')).toBe('09:30:00');
    expect(hoursApi('')).toBeNull();
  });

  it('hoursProblem_OneEndOnlyOrTheSameTime_IsRefusedLikeTheServerDoes', () => {
    expect(hoursProblem('', '')).toBeNull();
    expect(hoursProblem('09:00', '')).toBe('bothEnds');
    expect(hoursProblem('', '21:00')).toBe('bothEnds');
    expect(hoursProblem('09:00', '09:00')).toBe('sameTime');
    // A window across midnight is allowed.
    expect(hoursProblem('22:00', '06:00')).toBeNull();
  });
});

describe('the draft of a conversation', () => {
  it('pendingDraftOf_DraftsOfSeveralConversations_IsTheNewestOfThisOneAndNothingElse', () => {
    const items = [
      draft({ id: 'old', createdAt: '2026-11-10T08:00:00Z' }),
      draft({ id: 'new', createdAt: '2026-11-10T09:00:00Z' }),
      draft({ id: 'other', threadKey: 'ota:2', createdAt: '2026-11-10T10:00:00Z' }),
      draft({ id: 'campaign', itemType: 'Campaign', createdAt: '2026-11-10T11:00:00Z' }),
      draft({ id: 'decided', status: 'Approved', createdAt: '2026-11-10T12:00:00Z' }),
    ];

    expect(pendingDraftOf(items, 'ota:1')?.id).toBe('new');
    expect(pendingDraftOf(items, 'ota:3')).toBeNull();
    expect(pendingDraftOf(undefined, 'ota:1')).toBeNull();
  });

  it('draftOutcomeView_ADraftThatWasWritten_NeedsNoSentence', () => {
    expect(draftOutcomeView({ decision: 'Drafted', reason: null })).toBeNull();
  });

  it('draftOutcomeView_NothingThatIsNotADraft_IsToldAsASuccess', () => {
    for (const decision of ['Escalated', 'NotHandled', 'AutoSent', 'SomethingNew']) {
      const view = draftOutcomeView({ decision, reason: null });
      expect(view, decision).not.toBeNull();
      expect(['warning', 'info']).toContain(view!.tone);
    }
  });

  it('draftOutcomeView_ReasonThatIsNotACode_FallsBackToTheGeneralSentence', () => {
    expect(draftOutcomeView({ decision: 'NotHandled', reason: 'Some Free Text' })?.key).toBe('assistant.draft.reason.unknown');
    expect(draftOutcomeView({ decision: 'NotHandled', reason: 'never_heard_of_it' })?.key).toBe('assistant.draft.reason.unknown');
  });

  it('draftOutcomeView_AssistantDisabled_PointsToTheSettingsAndAToDoPointsToTheList', () => {
    expect(draftOutcomeView({ decision: 'NotHandled', reason: 'assistant_disabled' })).toMatchObject({ settingsLink: true, todoLink: false });
    expect(draftOutcomeView({ decision: 'Escalated', reason: 'mode_escalate' })).toMatchObject({ settingsLink: false, todoLink: true });
  });
});

describe('errors', () => {
  it('assistantProblemMessage_CodeOfTheAssistant_IsTheSentenceOfThatCode', () => {
    const t = i18n.getFixedT('it');
    expect(assistantProblemMessage(httpError(409, { code: 'assistant_concurrent_change' }), t)).toContain('Qualcuno ha cambiato le istruzioni');
    expect(assistantProblemMessage(httpError(422, { code: 'assistant_threshold_invalid' }), t)).toBe('La soglia di affidabilità non è valida.');
  });

  it('isNotFound_AnyFourOhFour_IsNotFoundWhateverTheCodeAndOnlyThat', () => {
    expect(isNotFound(httpError(404, {}))).toBe(true);
    expect(isNotFound(httpError(404, { code: 'property_not_found' }))).toBe(true);
    expect(isNotFound(httpError(403, {}))).toBe(false);
    expect(isNotFound(new Error('x'))).toBe(false);
  });
});

describe('the modes', () => {
  it('offeredModes_OnlyEscalateAndDraft_ThisReleaseNeverSendsByItself', () => {
    expect([...OFFERED_MODES]).toEqual(['Escalate', 'Draft']);
  });

  it('modeKey_AnAutomaticMode_IsNotShownAsIfItWorked', () => {
    expect(modeKey('Escalate')).toBe('escalate');
    expect(modeKey('Draft')).toBe('draft');
    expect(modeKey('Automatic')).toBe('notActive');
    expect(modeKey('AutomaticWithExceptions')).toBe('notActive');
    expect(modeKey('SomethingNew')).toBe('notActive');
  });

  it('answerSource_TemplateTopicOrNothing_IsWhatTheServerSays', () => {
    expect(answerSource({ hasTemplate: true, source: 'WiFi' })).toEqual({ kind: 'template' });
    expect(answerSource({ hasTemplate: false, source: 'WiFi' })).toEqual({ kind: 'topic', topic: 'WiFi' });
    expect(answerSource({ hasTemplate: false, source: null })).toEqual({ kind: 'none' });
  });
});

describe('what an exception of a property loosens', () => {
  it('relaxedTopics_PropertyListThatLetsThroughATopicTheOrganizationForbids_NamesIt', () => {
    expect(relaxedTopics(['Money', 'Parking'], ['Money'])).toEqual(['Parking']);
    // An empty list of its own means that nothing is forbidden for the property: everything the organization forbids is loosened.
    expect(relaxedTopics(['Money', 'Parking'], [])).toEqual(['Money', 'Parking']);
    // The property that follows the organization loosens nothing; names compare without regard to case.
    expect(relaxedTopics(['Money'], null)).toEqual([]);
    expect(relaxedTopics(['Money'], ['money'])).toEqual([]);
  });

  it('relaxedThreshold_LowerThanTheOrganizations_IsLooser', () => {
    expect(relaxedThreshold(0.7, 0.85)).toBe(true);
    expect(relaxedThreshold(0.9, 0.85)).toBe(false);
    expect(relaxedThreshold(null, 0.85)).toBe(false);
    // The organization's value is not known (the person may not read it): nothing is claimed.
    expect(relaxedThreshold(0.7, undefined)).toBe(false);
  });

  it('hasPropertyExceptions_AnyFieldThatIsNotNull_IsAnException', () => {
    const none = { propertyId: 'p1', enabled: null, tone: null, signature: null, hoursFrom: null, hoursTo: null, confidenceThreshold: null, forbiddenTopics: null, updatedAt: null };
    expect(hasPropertyExceptions(none)).toBe(false);
    expect(hasPropertyExceptions({ ...none, forbiddenTopics: [] })).toBe(true);
    expect(hasPropertyExceptions({ ...none, confidenceThreshold: 0.7 })).toBe(true);
    expect(hasPropertyExceptions({ ...none, enabled: false })).toBe(true);
  });
});

describe('the entries of the knowledge', () => {
  const entry: KnowledgeEntry = {
    id: 'e1',
    propertyId: 'p1',
    topic: 'WiFi',
    kind: 'Faq',
    source: 'Custom',
    title: 'Qual è la password del Wi-Fi?',
    text: 'È in cucina.',
    language: 'it',
    lessonId: null,
    isActive: true,
    inherited: false,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  };

  it('entryProblem_TheRulesOfTheServer_AreFoundBeforeTheRequest', () => {
    const fields = entryFieldsOf(entry);
    expect(entryProblem(fields)).toBeNull();
    expect(entryProblem({ ...fields, text: '   ' })).toMatchObject({ field: 'text', key: 'assistant.knowledge.entry.error.textRequired' });
    expect(entryProblem({ ...fields, text: 'x'.repeat(1001) })).toMatchObject({ field: 'text', max: 1000 });
    expect(entryProblem({ ...fields, title: ' ' })).toMatchObject({ field: 'title', key: 'assistant.knowledge.entry.error.questionRequired' });
    // Only a question has a title: a fact needs none.
    expect(entryProblem({ ...fields, kind: 'Fact', title: '' })).toBeNull();
  });

  it('entryRequestOf_ChangingOneField_SendsTheWholeEntryBack', () => {
    const request = entryRequestOf({ ...entryFieldsOf(entry), isActive: false });

    expect(request).toEqual({ topic: 'WiFi', kind: 'Faq', title: 'Qual è la password del Wi-Fi?', text: 'È in cucina.', language: 'it', isActive: false });
    // A fact carries no title, and «any language» is null.
    expect(entryRequestOf({ ...entryFieldsOf({ ...entry, kind: 'Fact', language: null }) })).toMatchObject({ kind: 'Fact', title: null, language: null });
  });

  it('entryFieldsOf_NewEntryForAMissingTopic_StartsOnThatTopic', () => {
    expect(entryFieldsOf(null, 'Parking')).toMatchObject({ topic: 'Parking', kind: 'Fact', text: '', isActive: true });
    expect(entryFieldsOf(null, 'Faq')).toMatchObject({ topic: 'Faq', kind: 'Faq' });
  });
});
