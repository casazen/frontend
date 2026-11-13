import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { TodoActivity } from '@/api/internal-activities.api';
import i18n from '@/i18n/config';
import { describeTodo } from '../lib/todo-model';

// E03/F02/US01/T03 (NF-52): the types the traffic light of the cockpit raises have their own words, in both languages, not the generic ones.
const TYPES = ['IdentityVerification', 'MunicipalityTaxRateMissing', 'TouristTaxDeadline'] as const;

// No reason: what the type says is what is read (the reasons are tested below).
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

// The feeder of the compliance sends the code of the reason (`ComplianceReasonCodes`): the words are the cockpit's own, not the generic ones of the type.
describe('describeTodo and the reasons of the traffic light', () => {
  it.each(['it', 'en'] as const)('describeTodo_ReasonCodeOfTheCompliance_SaysItInTheWordsOfTheCockpit_%s', async (lng) => {
    await i18n.changeLanguage(lng);
    const fixed = i18n.getFixedT(lng);

    // The police send is a «ReconnectChannelManager» for the feeder: its type says the connection was lost, which is not what the item says.
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

// An item about a month carries it in its kind of entity (`PropertyPeriod:yyyy-MM`): two months of the same property must not be two rows that look the same.
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
