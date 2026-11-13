import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { TodoActivity } from '@/api/internal-activities.api';
import i18n from '@/i18n/config';
import { describeTodo } from '../lib/todo-model';

// E03/F02/US01/T03 (NF-52): the types the traffic light of the cockpit raises have their own words, in both languages, not the generic ones.
const TYPES = ['IdentityVerification', 'MunicipalityTaxRateMissing', 'TouristTaxDeadline'] as const;

const activity = (activityType: string): TodoActivity => ({
  id: 'a-1',
  activityType,
  action: 'VerifyIdentity',
  entityType: 'Booking',
  entityId: 'b-1',
  propertyId: 'p-1',
  dueAt: null,
  urgency: 'High',
  reason: 'identity_missing',
  createdAt: '2026-11-01T08:00:00Z',
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
