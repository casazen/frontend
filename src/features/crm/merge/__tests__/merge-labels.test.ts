import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { likelihoodLabel, likelihoodOf, reasonLabel } from '../merge-labels';

describe('the words of a merge proposal (E07/F01/US04/T03)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it.each([
    [100, 'veryLikely'],
    [90, 'veryLikely'],
    [89, 'likely'],
    [80, 'likely'],
    [70, 'likely'],
    [69, 'possible'],
    [60, 'possible'],
    [0, 'possible'],
  ] as const)('likelihoodOf_Score%i_Is%s', (score, expected) => {
    expect(likelihoodOf(score)).toBe(expected);
  });

  it.each(['it', 'en'])('says every likelihood and every reason the matching gives in words (%s)', async (language) => {
    await i18n.changeLanguage(language);
    const t = i18n.getFixedT(language);

    const words = [100, 80, 60].map((score) => likelihoodLabel(t, score));
    expect(new Set(words).size).toBe(3);
    for (const reason of ['same_email', 'same_name_birth', 'same_phone', 'same_name_same_property', 'something_new']) {
      const text = reasonLabel(t, reason);
      // A sentence, never the code and never an unresolved key.
      expect(text).not.toContain('_');
      expect(text).not.toMatch(/^crm\./);
      expect(text.length).toBeGreaterThan(15);
    }
    expect(new Set(['same_email', 'same_name_birth', 'same_phone', 'same_name_same_property'].map((reason) => reasonLabel(t, reason))).size).toBe(4);
  });

  it('reasonLabel_TheSameNameAndBirthDate_SaysItWithoutAnyDate', () => {
    const t = i18n.getFixedT('it');

    expect(reasonLabel(t, 'same_name_birth')).toBe('Hanno lo stesso nome e la stessa data di nascita.');
    expect(reasonLabel(t, 'same_name_birth')).not.toMatch(/\d/);
  });
});
