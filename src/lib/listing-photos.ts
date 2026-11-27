import type { PropertyPhotoMeta, PropertyPhotoMetaInput } from '@/types';

/** The longest caption of a photo (the alternative text): the limit of the backend. */
export const PHOTO_CAPTION_MAX = 200;

/** The caption of a photo (Italian and English) and its room, as typed in the wizard. A blank `roomId` is no room. */
export interface PhotoMetaDraft {
  url: string;
  altIt: string;
  altEn: string;
  roomId: string;
}

const blank = (url: string): PhotoMetaDraft => ({ url, altIt: '', altEn: '', roomId: '' });

const hasContent = (draft: PhotoMetaDraft): boolean => draft.altIt.trim() !== '' || draft.altEn.trim() !== '' || draft.roomId !== '';

/** What the server knows of the photos, as the fields of the wizard: only the photos that have a caption or a room. */
export function photoMetaDraftsFromServer(photos: readonly PropertyPhotoMeta[]): PhotoMetaDraft[] {
  return photos
    .map((photo) => ({ url: photo.url, altIt: photo.alt?.it ?? '', altEn: photo.alt?.en ?? '', roomId: photo.roomId ?? '' }))
    .filter(hasContent);
}

/** The fields of one photo: blank when the host wrote nothing for it. */
export function photoMetaOf(drafts: readonly PhotoMetaDraft[], url: string): PhotoMetaDraft {
  return drafts.find((draft) => draft.url === url) ?? blank(url);
}

/** The list with the fields of one photo changed (added when it was not there). */
export function withPhotoMeta(drafts: readonly PhotoMetaDraft[], url: string, change: Partial<Omit<PhotoMetaDraft, 'url'>>): PhotoMetaDraft[] {
  const next = { ...photoMetaOf(drafts, url), ...change };
  return drafts.some((draft) => draft.url === url) ? drafts.map((draft) => (draft.url === url ? next : draft)) : [...drafts, next];
}

/**
 * The body that saves the captions and the rooms: one entry for each photo **of the gallery** that has a caption or a room (the save clears
 * both for the photos it does not list, and answers 404 for an address that is not in the gallery, so a photo that was deleted since is not sent).
 */
export function photoMetaInputs(drafts: readonly PhotoMetaDraft[], galleryUrls: readonly string[]): PropertyPhotoMetaInput[] {
  return galleryUrls
    .map((url) => photoMetaOf(drafts, url))
    .filter(hasContent)
    .map((draft) => {
      const it = draft.altIt.trim();
      const en = draft.altEn.trim();
      return { url: draft.url, alt: it || en ? { it: it || null, en: en || null } : null, roomId: draft.roomId || null };
    });
}

/** A comparable form of the captions and rooms: two lists that say the same thing have the same signature (blank entries and order do not matter). */
export function photoMetaSignature(drafts: readonly PhotoMetaDraft[]): string {
  return JSON.stringify(
    drafts
      .filter(hasContent)
      .map((draft) => [draft.url, draft.altIt.trim(), draft.altEn.trim(), draft.roomId])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
}
