import { LISTING_LANGUAGES } from '@/types';
import type { ListingLanguage, ListingTexts, SiteProfile, SiteProfileRequest, TextOrigin } from '@/types';

export const LISTING_TITLE_MAX = 60;
export const LISTING_DESCRIPTION_MAX = 10_000;

export const TRANSLATED_LANGUAGES: readonly ListingLanguage[] = LISTING_LANGUAGES.filter((language) => language !== 'it');
export const OPTIONAL_LANGUAGES: readonly ListingLanguage[] = TRANSLATED_LANGUAGES.filter((language) => language !== 'en');

export interface ListingTextDraft {
  title: string;
  description: string;
  spaces?: string;
  access?: string;
  neighborhood?: string;
  transport?: string;
  rules?: string;
}

export const LISTING_EXTRA_FIELDS = ['spaces', 'access', 'neighborhood', 'transport', 'rules'] as const;

export function emptyTextDrafts(): Record<string, ListingTextDraft> {
  return Object.fromEntries(TRANSLATED_LANGUAGES.map((language) => [language, { title: '', description: '' }]));
}

export function textDraftsFromProfile(profile: Pick<SiteProfile, 'translations'> & Partial<Pick<SiteProfile, 'floorNote' | 'checkInMethod' | 'zone'>> | null | undefined): Record<string, ListingTextDraft> {
  const drafts = emptyTextDrafts();
  for (const language of TRANSLATED_LANGUAGES) {
    const stored = profile?.translations?.[language];
    drafts[language] = { ...Object.fromEntries(LISTING_EXTRA_FIELDS.filter((field) => stored?.[field] != null).map((field) => [field, stored?.[field] ?? ''])), title: stored?.title ?? '', description: stored?.description ?? '' };
  }
  const italian = { spaces: profile?.floorNote?.it, access: profile?.checkInMethod?.it, neighborhood: profile?.zone?.it, transport: profile?.translations?.it?.transport };
  const existing = Object.fromEntries(Object.entries(italian).filter(([, value]) => value != null));
  if (Object.keys(existing).length) drafts.it = { title: '', description: '', ...existing };
  return drafts;
}

export function originWhenSaved(text: string, previousText: string | null | undefined, previousOrigin: TextOrigin | undefined): TextOrigin {
  if (!previousText || previousText.trim() === '') return 'UserWritten';
  const origin = previousOrigin ?? 'UserWritten';
  if (previousText.trim() === text.trim()) return origin;
  return origin === 'UserWritten' ? 'UserWritten' : 'ModifiedAfterTranslation';
}

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

export function textDraftsChanged(stored: Record<string, ListingTextDraft>, current: Record<string, ListingTextDraft>): boolean {
  return [...TRANSLATED_LANGUAGES, 'it'].some((language) => {
    const before = stored[language];
    const after = current[language];
    return (['title', 'description', ...LISTING_EXTRA_FIELDS] as const).some((field) => (clean(before?.[field]) ?? '') !== (clean(after?.[field]) ?? ''));
  });
}

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

    for (const field of LISTING_EXTRA_FIELDS) {
      if (draft[field] !== undefined) merged[field] = clean(draft[field]);
    }

    const kept = Object.entries(merged).filter(([, text]) => typeof text === 'string' && text.trim() !== '');
    if (kept.length > 0) translations[language] = Object.fromEntries(kept) as ListingTexts;
    else delete translations[language];
  }

  const italian = drafts.it;
  const italianText = (existing: SiteProfile['floorNote'], value: string | undefined) => value === undefined ? existing ?? null : { ...existing, it: value };
  if (italian?.transport !== undefined) translations.it = { ...translations.it, transport: clean(italian.transport) };

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
    zone: italianText(profile.zone, italian?.neighborhood),
    near: profile.near ?? null,
    floorNote: italianText(profile.floorNote, italian?.spaces),
    outdoorNote: profile.outdoorNote ?? null,
    checkInMethod: italianText(profile.checkInMethod, italian?.access),
    rulesNote: profile.rulesNote ?? null,
    highlights: profile.highlights ?? [],
    safetyNotes: profile.safetyNotes ?? [],
    tags: profile.tags ?? [],
    translations,
  };
}

export function joinList(parts: readonly string[], and: string): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;
}
