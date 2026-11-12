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

/** A site profile as the server gives it: facts of the booking site that the descriptions step does not edit, and translations. */
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
    // A new text, or one over a blank, is the person's.
    expect(originWhenSaved('Hello', undefined, undefined)).toBe('UserWritten');
    expect(originWhenSaved('Hello', '  ', 'AutoTranslated')).toBe('UserWritten');
    // Left as it was: it keeps the origin it had.
    expect(originWhenSaved('Hello', 'Hello', 'AutoTranslated')).toBe('AutoTranslated');
    // A person's text that is changed stays the person's; a machine translation that is changed becomes «modified after translation», and stays so.
    expect(originWhenSaved('Hello again', 'Hello', 'UserWritten')).toBe('UserWritten');
    expect(originWhenSaved('Hello again', 'Hello', 'AutoTranslated')).toBe('ModifiedAfterTranslation');
    expect(originWhenSaved('Hello once more', 'Hello again', 'ModifiedAfterTranslation')).toBe('ModifiedAfterTranslation');
  });

  it('shownOrigin_AMachineTranslationTheHostEdits_ReadsModifiedAtOnce', () => {
    // As stored: a machine translation.
    expect(shownOrigin(PROFILE, 'fr', 'title', 'Trullo avec piscine')).toBe('AutoTranslated');
    // The host changes it on screen: the save will call it modified, and so does the screen, before the save.
    expect(shownOrigin(PROFILE, 'fr', 'title', 'Trullo avec piscine privée')).toBe('ModifiedAfterTranslation');
    // What the host wrote stays theirs; a text with no origin recorded is theirs; a blank text has no origin.
    expect(shownOrigin(PROFILE, 'en', 'description', 'A quiet trullo near the sea.')).toBe('UserWritten');
    expect(shownOrigin(null, 'de', 'title', 'Trullo mit Pool')).toBe('UserWritten');
    expect(shownOrigin(PROFILE, 'fr', 'title', '   ')).toBeNull();
  });
});

describe('the texts as fields of the wizard', () => {
  it('textDraftsFromProfile_FillsEveryLanguageAndLeavesTheMissingOnesEmpty', () => {
    const drafts = textDraftsFromProfile(PROFILE);

    expect(Object.keys(drafts)).toEqual([...TRANSLATED_LANGUAGES]);
    expect(drafts.en).toEqual({ title: 'Trullo with pool', description: 'A quiet trullo.' });
    expect(drafts.fr).toEqual({ title: 'Trullo avec piscine', description: '' });
    expect(drafts.de).toEqual({ title: '', description: '' });
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

    // The save of the profile replaces it: everything the step does not edit goes back as the server has it, or it would be wiped.
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
    // The other fields of a language the host edited, the languages they did not touch and the transport of the Italian profile stay.
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
    // The Italian headline and description are the columns of the property; a draft for Italian is ignored, only the transport is kept.
    const drafts = { ...textDraftsFromProfile(PROFILE), it: { title: 'Trullo con piscina', description: 'Un trullo tranquillo.' } };

    expect(buildSiteProfileRequest(PROFILE, drafts).translations.it).toEqual({ transport: 'Fermata a 200 m' });
  });
});
