import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { TodoActivity } from '@/api/internal-activities.api';
import i18n from '@/i18n/config';
import { describeTodo } from '../lib/todo-model';

const TYPES = ['IdentityVerification', 'MunicipalityTaxRateMissing', 'TouristTaxDeadline'] as const;

const activity = (activityType: string, overrides: Partial<TodoActivity> = {}): TodoActivity => ({
  id: 'a-1',
  activityType,
  action: 'VerifyIdentity',
  entityType: 'Booking',
  entityId: 'b-1',
  propertyId: 'p-1',
  dueAt: null,
  urgency: 'High',
  reason: null,
  createdAt: '2026-11-01T08:00:00Z',
  ...overrides,
});

describe('describeTodo for the types of the traffic light', () => {
  it.each(['it', 'en'] as const)('describeTodo_TypeOfTheLight_HasItsOwnTitleAndWhyIn_%s', async (lng) => {
    await i18n.changeLanguage(lng);
    const t = i18n.getFixedT(lng) as TFunction;
    const generic = describeTodo(activity('SomethingNew'), { t, exists: (key) => i18n.exists(key), locale: lng, propertyNames: new Map() });

    for (const type of TYPES) {
      const text = describeTodo(activity(type), { t, exists: (key) => i18n.exists(key), locale: lng, propertyNames: new Map() });
      expect(text.title, type).not.toBe(generic.title);
      expect(text.why, type).not.toBe(generic.why);
      expect(text.title).not.toMatch(/^activity\.todo/);
    }
    await i18n.changeLanguage('it');
  });
});

const contextOf = (lng: 'it' | 'en', propertyNames: ReadonlyMap<string, string> = new Map()) => ({
  t: i18n.getFixedT(lng) as TFunction,
  exists: (key: string) => i18n.exists(key),
  locale: lng,
  propertyNames,
});

describe('describeTodo and the reasons of the traffic light', () => {
  it.each(['it', 'en'] as const)('describeTodo_ReasonCodeOfTheCompliance_SaysItInTheWordsOfTheCockpit_%s', async (lng) => {
    await i18n.changeLanguage(lng);
    const fixed = i18n.getFixedT(lng);

    const text = describeTodo(activity('ReconnectChannelManager', { action: 'ActivateOctorateSend', reason: 'connection_inactive' }), contextOf(lng));

    expect(text.why).toBe(fixed('compliance.reason.connection_inactive'));
    expect(text.why).not.toBe(fixed('activity.todo.type.ReconnectChannelManager.why'));
    await i18n.changeLanguage('it');
  });

  it.each(['constructor', '__proto__', 'a.b', 'activity.todo.type.unknown.why', 'new_code_of_a_later_server'])(
    'describeTodo_ReasonThatIsNotACodeThisVersionKnows_IsNeverALookupAndTheTypeTellsWhy_%s',
    (reason) => {
      const fixed = i18n.getFixedT('it');

      const text = describeTodo(activity('IstatDeadline', { reason }), contextOf('it'));

      expect(text.why).toBe(fixed('activity.todo.type.IstatDeadline.why'));
    },
  );

  it('describeTodo_ShortTextOfTheServer_IsStillReadAsItIs', () => {
    expect(describeTodo(activity('IstatDeadline', { reason: 'Il comune ha cambiato la scadenza' }), contextOf('it')).why).toBe('Il comune ha cambiato la scadenza');
  });
});

describe('describeTodo and the month of a property', () => {
  const names = new Map([['p-1', 'Casa Mare']]);
  const ofMonth = (entityType: string) => activity('TouristTaxDeadline', { action: 'DeclareTouristTax', entityType, entityId: 'p-1' });

  it('describeTodo_TwoMonthsOfTheSameProperty_AreTwoDifferentRows', () => {
    const august = describeTodo(ofMonth('PropertyPeriod:2026-08'), contextOf('it', names)).object;
    const september = describeTodo(ofMonth('PropertyPeriod:2026-09'), contextOf('it', names)).object;

    expect(august).toBe('Immobile · Casa Mare · agosto 2026');
    expect(september).toBe('Immobile · Casa Mare · settembre 2026');
  });

  it('describeTodo_MonthInEnglish_UsesTheEnglishName', async () => {
    await i18n.changeLanguage('en');

    expect(describeTodo(ofMonth('PropertyPeriod:2026-08'), contextOf('en', names)).object).toBe('Property · Casa Mare · August 2026');
    await i18n.changeLanguage('it');
  });

  it.each(['PropertyPeriod:2026-13', 'PropertyPeriod:2026-8', 'PropertyPeriod:', 'PropertyPeriod:<script>'])(
    'describeTodo_EntityTypeThatIsNotAMonth_%s_NamesNoMonth',
    (entityType) => {
      expect(describeTodo(ofMonth(entityType), contextOf('it', names)).object).toBe('Casa Mare');
    },
  );

  it('describeTodo_ItemThatIsNotAboutAMonth_IsWhatItWas', () => {
    expect(describeTodo(activity('CheckInPending'), contextOf('it', names)).object).toBe('Prenotazione · Casa Mare');
  });
});

const BACKEND_TYPES = [
  'CheckInPending',
  'CheckOutPending',
  'AlloggiatiDeadline',
  'IstatDeadline',
  'ReceiptToRetrieve',
  'MessageToApprove',
  'PublicationError',
  'FiscalDocument',
  'WizardResume',
  'IntegrationError',
  'CredentialsToRenew',
  'ReconnectChannelManager',
  'CleaningDue',
  'BookingSpecialRequest',
  'ConfirmChannelMapping',
  'CheckImportedListing',
  'BookingOverlap',
  'BookingSyncConflict',
  'ListingChangedOutside',
  'IdentityVerification',
  'TouristTaxDeadline',
  'MunicipalityTaxRateMissing',
  'MessageToReply',
  'OwnerStayToReview',
  'OwnerStaySyncFailed',
  'OwnerDocumentExpiring',
  'OwnerStatementNoticeFailed',
  'RoutineTask',
  'CleaningDateChanged',
  'CheckInLinkToSend',
  'CompanyTenantDecision',
  'ScheduledMessageIssue',
  // The self-billed invoices (TD17) of the agency (FIX/FE-TD17-TODO): one the SDI rejected, and the drafts of a month to check and issue.
  'SelfBillingRejected',
  'SelfBillingDraftsToReview',
  // The cleaning recharged to an owner at its cost whose VAT the cost source does not say (E14/F01/US02/T01, `ActivityType` 140).
  'CleaningVatToState',
] as const;

describe('describeTodo for every type of the backend', () => {
  it.each(['it', 'en'] as const)('describeTodo_EveryTypeOfTheBackend_HasItsOwnTitleAndWhyIn_%s', async (lng) => {
    await i18n.changeLanguage(lng);
    const t = i18n.getFixedT(lng) as TFunction;
    const context = { t, exists: (key: string) => i18n.exists(key), locale: lng, propertyNames: new Map<string, string>() };
    const generic = describeTodo(activity('SomethingNew'), context);

    const titles = new Set<string>();
    for (const type of BACKEND_TYPES) {
      const text = describeTodo(activity(type), context);
      expect(text.title, type).not.toBe(generic.title);
      expect(text.why, type).not.toBe(generic.why);
      expect(text.title, type).not.toMatch(/^activity.todo/);
      titles.add(text.title);
    }
    expect(titles.size).toBe(BACKEND_TYPES.length);
    await i18n.changeLanguage('it');
  });
});

// The two items of the self-billed invoices (TD17, FIX/FE-TD17-TODO) as the server sends them: about the organization, never a property, and the drafts of a month carry the month in the kind of entity
// (`SelfBillingPeriod:yyyy-MM`). Their words are the app's own, in the language of the person, and the object line says the account: never «un immobile», never the raw kind of entity.
describe('describeTodo and the self-billed invoices (TD17)', () => {
  const ITEMS = [
    {
      item: activity('SelfBillingRejected', { action: 'ReviewSelfBilling', entityType: 'FiscalDocument', entityId: 'd-1', propertyId: null }),
      titles: { it: 'Autofattura scartata dallo SDI', en: 'Self-billed invoice rejected by the SDI' },
    },
    {
      item: activity('SelfBillingDraftsToReview', { action: 'ReviewSelfBilling', entityType: 'SelfBillingPeriod:2026-10', entityId: 'o-1', propertyId: null, urgency: 'Medium' }),
      titles: { it: 'Autofatture da controllare ed emettere', en: 'Self-billed invoices to check and issue' },
    },
  ] as const;

  it.each(['it', 'en'] as const)('describeTodo_SelfBillingItems_SayTheirOwnWordsAboutTheAccountIn_%s', async (lng) => {
    await i18n.changeLanguage(lng);
    const fixed = i18n.getFixedT(lng);

    for (const { item, titles } of ITEMS) {
      const text = describeTodo(item, contextOf(lng));

      expect(text.title).toBe(titles[lng]);
      expect(text.why).toBe(fixed(`activity.todo.type.${item.activityType}.why`));
      expect(text.object).toBe(fixed('activity.todo.object.organization'));
    }
    await i18n.changeLanguage('it');
  });
});

// The cleaning recharged to an owner at its cost with no VAT stated (E14/F01/US02/T01, NF-114, ⚖ I13): the item the backend raises when the agency posts the month, about the cleaning request with the action `StateCleaningVat`
// (FIX/BE-CLEANING-VAT; the items raised before carry `ReviewBooking`). It is told with its own words, not as an «Attività da completare», in both languages: the title says what is missing, the sentence says what to do, and the
// two languages do not say the same words.
describe('describeTodo and the cleaning recharge with no VAT stated', () => {
  const item = activity('CleaningVatToState', { action: 'StateCleaningVat', entityType: 'ServiceRequest', urgency: 'Medium' });

  it.each([
    ['it', /IVA/],
    ['en', /VAT/],
  ] as const)('describeTodo_CleaningVatToState_SaysWhatIsMissingAndWhatToDoIn_%s', async (lng, vat) => {
    await i18n.changeLanguage(lng);
    const generic = describeTodo(activity('SomethingNew'), contextOf(lng));

    const text = describeTodo(item, contextOf(lng));

    expect(text.title).toMatch(vat);
    expect(text.title).not.toBe(generic.title);
    expect(text.why).toMatch(vat);
    expect(text.why).not.toBe(generic.why);
    await i18n.changeLanguage('it');
  });

  it('describeTodo_CleaningVatToState_HasDifferentWordsInTheTwoLanguages', () => {
    const inItalian = describeTodo(item, contextOf('it'));
    const inEnglish = describeTodo(item, contextOf('en'));

    expect(inItalian.title).not.toBe(inEnglish.title);
    expect(inItalian.why).not.toBe(inEnglish.why);
  });

  // FIX/FE-CLEANING-VAT-QUESTION: the sentence asks to answer the question of the dialog and says what each of the three answers does.
  it.each([
    ['it', ["l'IVA su questa fattura", '«Sì»', '«No»', '«Non lo so»', 'alla chiusura del rendiconto']],
    ['en', ['charge VAT on this invoice', '«Yes»', '«No»', "«I don't know»", 'when the statement closes']],
  ] as const)('describeTodo_CleaningVatToState_AsksToAnswerTheQuestionAndSaysWhatEachAnswerDoesIn_%s', async (lng, words) => {
    await i18n.changeLanguage(lng);

    const text = describeTodo(item, contextOf(lng));

    for (const word of words) expect(text.why, word).toContain(word);
    await i18n.changeLanguage('it');
  });
});

describe('describeTodo and the To do of a routine', () => {
  it.each(['Pulizia', 'Controlla la casa dopo la partenza', 'a.b', 'constructor', 'connection_inactive', 'activity.todo.type.unknown.why'])(
    'describeTodo_RoutineTaskWithTheWordsOfTheHost_SaysThemAsTheyAre_%s',
    (reason) => {
      expect(describeTodo(activity('RoutineTask', { action: 'ReviewBooking', reason }), contextOf('it')).why).toBe(reason);
    },
  );

  it('describeTodo_RoutineTaskWithSpacesAroundTheWords_SaysThemWithoutTheSpaces', () => {
    expect(describeTodo(activity('RoutineTask', { action: 'ReviewBooking', reason: '  Pulizia  ' }), contextOf('it')).why).toBe('Pulizia');
  });

  it.each([null, '', '   '])('describeTodo_RoutineTaskWithNoWords_SaysWhatItsTypeSays_%j', (reason) => {
    const fixed = i18n.getFixedT('it');

    expect(describeTodo(activity('RoutineTask', { action: 'ReviewBooking', reason }), contextOf('it')).why).toBe(fixed('activity.todo.type.RoutineTask.why'));
  });

  it('describeTodo_OneWordReasonOfAnotherType_IsStillNotShown', () => {
    const fixed = i18n.getFixedT('it');

    expect(describeTodo(activity('IstatDeadline', { reason: 'Pulizia' }), contextOf('it')).why).toBe(fixed('activity.todo.type.IstatDeadline.why'));
  });
});
