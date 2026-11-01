import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { OrgActivityEntry } from '@/types/org-team.types';
import { activityPhrase } from '../activity-phrases';

function entry(patch: Partial<OrgActivityEntry>): OrgActivityEntry {
  return {
    id: 'line-1',
    when: '2026-11-01T18:00:00Z',
    actorUserId: 'auth0|owner',
    area: 'short-rent',
    type: 'PropertyActivatedWithReminders',
    subjectType: 'Property',
    subjectId: 'prop-1',
    details: {},
    ...patch,
  };
}

describe('activityPhrase', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('activityPhrase_PropertyActivatedWithReminders_SaysWhichRemindersWereOpen', () => {
    const context = { t: i18n.t, memberName: () => undefined };

    expect(activityPhrase(entry({ details: { reminders: 'documents.safety' } }), context)).toBe(
      'Immobile attivato con i documenti e la scheda di sicurezza da completare',
    );
    expect(activityPhrase(entry({ details: { reminders: 'safety' } }), context)).toBe(
      'Immobile attivato con la scheda di sicurezza da completare',
    );
    // A code this page does not know: the generic sentence, never a raw key.
    expect(activityPhrase(entry({ details: { reminders: 'something' } }), context)).toBe("Modifica all'account");
  });
});
