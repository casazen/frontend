import { describe, expect, it } from 'vitest';
import type { SiteProfile } from '@/types';
import {
  OPTIONAL_LANGUAGES,
  TRANSLATED_LANGUAGES,
  buildSiteProfileRequest,
  emptyTextDrafts,
  originWhenSaved,
  shownOrigin,
  textDraftsChanged,
  textDraftsFromProfile,
} from '../listing-texts';

const PROFILE: SiteProfile = {
  propertyId: 'p1',
  floorLevel: 2,
  renovatedYear: 2021,
  energyClass: 'B',
  energyIndex: 85.5,
  areaKind: 'Coast',
  childrenWelcome: true,
  checkInTo: '20:00:00',
  videoUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk',
  videoProvider: 'YouTube',
  tourUrl: null,
  zone: { it: 'Campagna di Ostuni', en: 'Ostuni countryside', others: { fr: 'Campagne d’Ostuni' } },
  near: { it: 'A 10 minuti dal centro' },
  floorNote: null,
  outdoorNote: null,
  checkInMethod: { it: 'In autonomia', en: 'Self check-in' },
  rulesNote: null,
  highlights: [{ icon: 'waves', title: { it: 'Piscina', en: 'Pool' } }],
  safetyNotes: [{ it: 'La piscina non è sorvegliata' }],
  tags: ['piscina', 'campagna'],
  derivedTags: ['piscina'],
  translations: {
    it: { transport: 'Fermata a 200 m' },
    en: { title: 'Trullo with pool', description: 'A quiet trullo.', spaces: 'Garden and terrace' },
    fr: { title: 'Trullo avec piscine' },
  },
  origins: { 'en.title': 'AutoTranslated', 'en.description': 'UserWritten', 'en.spaces': 'UserWritten', 'fr.title': 'AutoTranslated' },
  updatedAt: '2026-11-05T10:00:00Z',
};

describe('the languages of the descriptions step', () => {
  it('translatedLanguages_AreTheThirteenButItalian_EnglishFirst', () => {
    expect(TRANSLATED_LANGUAGES).toHaveLength(13);
    expect(TRANSLATED_LANGUAGES[0]).toBe('en');
    expect(TRANSLATED_LANGUAGES).not.toContain('it');
    expect(OPTIONAL_LANGUAGES).toHaveLength(12);
    expect(OPTIONAL_LANGUAGES).not.toContain('en');
  });
});

describe('the origin of a text (NF-31)', () => {
  it('originWhenSaved_FollowsTheRuleOfTheBackend', () => {
    expect(originWhenSaved('Hello', undefined, undefined)).toBe('UserWritten');
    expect(originWhenSaved('Hello', '  ', 'AutoTranslated')).toBe('UserWritten');
    expect(originWhenSaved('Hello', 'Hello', 'AutoTranslated')).toBe('AutoTranslated');
    expect(originWhenSaved('Hello again', 'Hello', 'UserWritten')).toBe('UserWritten');
    expect(originWhenSaved('Hello again', 'Hello', 'AutoTranslated')).toBe('ModifiedAfterTranslation');
    expect(originWhenSaved('Hello once more', 'Hello again', 'ModifiedAfterTranslation')).toBe('ModifiedAfterTranslation');
  });

  it('shownOrigin_AMachineTranslationTheHostEdits_ReadsModifiedAtOnce', () => {
    expect(shownOrigin(PROFILE, 'fr', 'title', 'Trullo avec piscine')).toBe('AutoTranslated');
    expect(shownOrigin(PROFILE, 'fr', 'title', 'Trullo avec piscine privée')).toBe('ModifiedAfterTranslation');
    expect(shownOrigin(PROFILE, 'en', 'description', 'A quiet trullo near the sea.')).toBe('UserWritten');
    expect(shownOrigin(null, 'de', 'title', 'Trullo mit Pool')).toBe('UserWritten');
    expect(shownOrigin(PROFILE, 'fr', 'title', '   ')).toBeNull();
  });
});

describe('the texts as fields of the wizard', () => {
  it('textDraftsFromProfile_FillsEveryLanguageAndLeavesTheMissingOnesEmpty', () => {
    const drafts = textDraftsFromProfile(PROFILE);

    expect(Object.keys(drafts)).toEqual([...TRANSLATED_LANGUAGES, 'it']);
    expect(drafts.en).toEqual({ title: 'Trullo with pool', description: 'A quiet trullo.', spaces: 'Garden and terrace' });
    expect(drafts.fr).toEqual({ title: 'Trullo avec piscine', description: '' });
    expect(drafts.de).toEqual({ title: '', description: '' });
    expect(drafts.it).toMatchObject({ access: 'In autonomia', neighborhood: 'Campagna di Ostuni', transport: 'Fermata a 200 m' });
    expect(textDraftsFromProfile(null)).toEqual(emptyTextDrafts());
  });

  it('textDraftsChanged_BlankAndAbsentAreTheSame_AnyDifferenceIsAChange', () => {
    const stored = textDraftsFromProfile(PROFILE);

    expect(textDraftsChanged(stored, textDraftsFromProfile(PROFILE))).toBe(false);
    expect(textDraftsChanged(stored, { ...stored, en: { ...stored.en!, title: ' Trullo with pool ' } })).toBe(false);
    expect(textDraftsChanged(stored, { ...stored, de: { title: 'Trullo mit Pool', description: '' } })).toBe(true);
    expect(textDraftsChanged(stored, { ...stored, fr: { title: '', description: '' } })).toBe(true);
  });
});

describe('what the save of the translated texts sends (data rule)', () => {
  it('buildSiteProfileRequest_OnlyTheTypedTextsChange_EveryOtherFactOfTheProfileIsSentBack', () => {
    const drafts = textDraftsFromProfile(PROFILE);
    drafts.en = { title: 'Trullo with a pool', description: 'A quiet trullo.' };
    drafts.de = { title: 'Trullo mit Pool', description: '' };

    const request = buildSiteProfileRequest(PROFILE, drafts);

    expect(request).toMatchObject({
      floorLevel: 2,
      renovatedYear: 2021,
      energyClass: 'B',
      energyIndex: 85.5,
      areaKind: 'Coast',
      childrenWelcome: true,
      checkInTo: '20:00:00',
      videoUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk',
      tourUrl: null,
      zone: PROFILE.zone,
      near: PROFILE.near,
      checkInMethod: PROFILE.checkInMethod,
      highlights: PROFILE.highlights,
      safetyNotes: PROFILE.safetyNotes,
      tags: ['piscina', 'campagna'],
    });
    expect(request).not.toHaveProperty('derivedTags');
    expect(request).not.toHaveProperty('origins');
    expect(request).not.toHaveProperty('propertyId');
    expect(request.translations).toEqual({
      it: { transport: 'Fermata a 200 m' },
      en: { title: 'Trullo with a pool', description: 'A quiet trullo.', spaces: 'Garden and terrace' },
      fr: { title: 'Trullo avec piscine' },
      de: { title: 'Trullo mit Pool' },
    });
  });

  it('buildSiteProfileRequest_ABlankText_RemovesThatTextAndAnEmptyLanguageDisappears', () => {
    const drafts = textDraftsFromProfile(PROFILE);
    drafts.fr = { title: '', description: '' };
    drafts.en = { title: 'Trullo with pool', description: '' };

    const { translations } = buildSiteProfileRequest(PROFILE, drafts);

    expect(translations).not.toHaveProperty('fr');
    expect(translations.en).toEqual({ title: 'Trullo with pool', spaces: 'Garden and terrace' });
  });

  it('buildSiteProfileRequest_Italian_IsNeverWrittenToTheProfile', () => {
    const drafts = { ...textDraftsFromProfile(PROFILE), it: { title: 'Trullo con piscina', description: 'Un trullo tranquillo.' } };

    expect(buildSiteProfileRequest(PROFILE, drafts).translations.it).toEqual({ transport: 'Fermata a 200 m' });
  });
});


describe('complete listing fields', () => {
  it('persists generated extra fields and Italian profile sections without clearing unrelated data', () => {
    const drafts = textDraftsFromProfile(PROFILE);
    const before = structuredClone(drafts);
    drafts.fr = { ...drafts.fr, spaces: 'Une chambre', access: 'Arrivée à 15h', neighborhood: 'Ostuni', transport: '', rules: 'Non fumeur' };
    drafts.it = { title: '', description: '', spaces: 'Una camera', access: 'Arrivo dalle 15', neighborhood: 'Ostuni', transport: 'Arrivo in auto' };
    expect(textDraftsChanged(before, drafts)).toBe(true);
    const payload = buildSiteProfileRequest(PROFILE, drafts);
    expect(payload.translations.fr).toMatchObject({ spaces: 'Une chambre', access: 'Arrivée à 15h', rules: 'Non fumeur' });
    expect(payload.floorNote?.it).toBe('Una camera');
    expect(payload.checkInMethod).toMatchObject({ it: 'Arrivo dalle 15', en: 'Self check-in' });
    expect(payload.zone?.it).toBe('Ostuni');
    expect(payload.translations.it.transport).toBe('Arrivo in auto');
    expect(payload.highlights).toEqual(PROFILE.highlights);
    expect(payload.safetyNotes).toEqual(PROFILE.safetyNotes);
  });
});
