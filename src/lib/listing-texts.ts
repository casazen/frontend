import { LISTING_LANGUAGES } from '@/types';
import type { ListingLanguage, ListingTexts, SiteProfile, SiteProfileRequest, TextOrigin } from '@/types';

/**
 * The texts of a listing in the languages of the channel manager (NF-31, ADR-035). Italian stays in the columns of the property
 * (`listingTitle`, `description`); every other language, English included, lives in the `translations` of the site profile. The rules
 * here are the ones of the backend (`ListingTextOrigins`, `SitePropertyProfileRules`), kept in one place for the wizard.
 */

/** The limits of the backend: the headline is 60 characters, the description 2,000. */
export const LISTING_TITLE_MAX = 60;
export const LISTING_DESCRIPTION_MAX = 2000;

/** The languages of the channel manager besides Italian: English first (required to publish), then the twelve optional ones. */
export const TRANSLATED_LANGUAGES: readonly ListingLanguage[] = LISTING_LANGUAGES.filter((language) => language !== 'it');
export const OPTIONAL_LANGUAGES: readonly ListingLanguage[] = TRANSLATED_LANGUAGES.filter((language) => language !== 'en');

/** The headline and the description of one language, as typed. */
export interface ListingTextDraft {
  title: string;
  description: string;
}

/** The headline and the description of every language but Italian, empty: what a property without translations starts from. */
export function emptyTextDrafts(): Record<string, ListingTextDraft> {
  return Object.fromEntries(TRANSLATED_LANGUAGES.map((language) => [language, { title: '', description: '' }]));
}

/** The texts the site profile stores, as the fields of the wizard (a language it does not have is empty). */
export function textDraftsFromProfile(profile: Pick<SiteProfile, 'translations'> | null | undefined): Record<string, ListingTextDraft> {
  const drafts = emptyTextDrafts();
  for (const language of TRANSLATED_LANGUAGES) {
    const stored = profile?.translations?.[language];
    drafts[language] = { title: stored?.title ?? '', description: stored?.description ?? '' };
  }
  return drafts;
}

/** The origin of a text a person saves, as the backend works it out (`ListingTextOrigins.WhenPersonSaves`). */
export function originWhenSaved(text: string, previousText: string | null | undefined, previousOrigin: TextOrigin | undefined): TextOrigin {
  if (!previousText || previousText.trim() === '') return 'UserWritten';
  const origin = previousOrigin ?? 'UserWritten';
  if (previousText.trim() === text.trim()) return origin;
  return origin === 'UserWritten' ? 'UserWritten' : 'ModifiedAfterTranslation';
}

/**
 * The origin to show next to a text on screen: the one the server has for it, or the one the save will give it once the person has
 * changed it (a machine translation that was edited reads «modificato dopo la traduzione» at once). `null` for a text that is blank.
 */
export function shownOrigin(
  profile: Pick<SiteProfile, 'translations' | 'origins'> | null | undefined,
  language: ListingLanguage,
  field: 'title' | 'description',
  current: string,
): TextOrigin | null {
  if (current.trim() === '') return null;
  const stored = profile?.translations?.[language]?.[field];
  return originWhenSaved(current, stored, profile?.origins?.[`${language}.${field}`]);
}

const clean = (text: string | null | undefined): string | null => {
  const value = (text ?? '').trim();
  return value === '' ? null : value;
};

/** True when the typed texts of some language differ from the ones stored (blank and absent are the same). */
export function textDraftsChanged(stored: Record<string, ListingTextDraft>, current: Record<string, ListingTextDraft>): boolean {
  return TRANSLATED_LANGUAGES.some((language) => {
    const before = stored[language];
    const after = current[language];
    return (clean(before?.title) ?? '') !== (clean(after?.title) ?? '') || (clean(before?.description) ?? '') !== (clean(after?.description) ?? '');
  });
}

/**
 * The body that saves the translated texts without touching anything else of the site profile. The save of the profile replaces it as a
 * whole, and its `translations` replace the stored ones (a language or a field left out is cleared): so the body repeats every other
 * fact of the profile as the server has it now, and every translation as stored, with only the headline and the description of the
 * languages the person typed in changed. A blank headline or description removes that text; Italian is not here (its texts are the
 * columns of the property), only what the profile keeps for it (the transport) is passed on as it is.
 */
export function buildSiteProfileRequest(profile: SiteProfile, drafts: Record<string, ListingTextDraft>): SiteProfileRequest {
  const translations: Record<string, ListingTexts> = {};
  for (const [language, stored] of Object.entries(profile.translations ?? {})) translations[language] = { ...stored };

  for (const language of TRANSLATED_LANGUAGES) {
    const draft = drafts[language];
    if (!draft) continue;
    const merged: ListingTexts = { ...(translations[language] ?? {}) };
    const title = clean(draft.title);
    const description = clean(draft.description);
    if (title) merged.title = title;
    else delete merged.title;
    if (description) merged.description = description;
    else delete merged.description;

    const kept = Object.entries(merged).filter(([, text]) => typeof text === 'string' && text.trim() !== '');
    if (kept.length > 0) translations[language] = Object.fromEntries(kept) as ListingTexts;
    else delete translations[language];
  }

  return {
    floorLevel: profile.floorLevel ?? null,
    renovatedYear: profile.renovatedYear ?? null,
    energyClass: profile.energyClass ?? null,
    energyIndex: profile.energyIndex ?? null,
    areaKind: profile.areaKind ?? null,
    childrenWelcome: profile.childrenWelcome ?? null,
    checkInTo: profile.checkInTo ?? null,
    videoUrl: profile.videoUrl ?? null,
    tourUrl: profile.tourUrl ?? null,
    zone: profile.zone ?? null,
    near: profile.near ?? null,
    floorNote: profile.floorNote ?? null,
    outdoorNote: profile.outdoorNote ?? null,
    checkInMethod: profile.checkInMethod ?? null,
    rulesNote: profile.rulesNote ?? null,
    highlights: profile.highlights ?? [],
    safetyNotes: profile.safetyNotes ?? [],
    tags: profile.tags ?? [],
    translations,
  };
}
