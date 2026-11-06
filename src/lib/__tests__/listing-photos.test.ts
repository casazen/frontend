import { describe, expect, it } from 'vitest';
import type { PropertyPhotoMeta } from '@/types';
import { photoMetaDraftsFromServer, photoMetaInputs, photoMetaOf, photoMetaSignature, withPhotoMeta } from '../listing-photos';

const SERVER: PropertyPhotoMeta[] = [
  { url: 'https://cdn/a.jpg', alt: { it: 'Soggiorno', en: 'Living room' }, width: 1600, height: 1067, roomId: 'room-1' },
  { url: 'https://cdn/b.jpg', alt: null, width: 1600, height: 1067 },
  { url: 'https://cdn/c.jpg', alt: { it: 'Terrazza' }, width: null, height: null },
];

describe('the captions and rooms of the photos', () => {
  it('photoMetaDraftsFromServer_KeepsOnlyThePhotosThatHaveACaptionOrARoom', () => {
    const drafts = photoMetaDraftsFromServer(SERVER);

    expect(drafts).toEqual([
      { url: 'https://cdn/a.jpg', altIt: 'Soggiorno', altEn: 'Living room', roomId: 'room-1' },
      { url: 'https://cdn/c.jpg', altIt: 'Terrazza', altEn: '', roomId: '' },
    ]);
    expect(photoMetaOf(drafts, 'https://cdn/b.jpg')).toEqual({ url: 'https://cdn/b.jpg', altIt: '', altEn: '', roomId: '' });
  });

  it('withPhotoMeta_ChangesOnePhoto_AndAddsOneThatWasNotThere', () => {
    const drafts = photoMetaDraftsFromServer(SERVER);

    const changed = withPhotoMeta(drafts, 'https://cdn/c.jpg', { altEn: 'Terrace' });
    expect(changed).toHaveLength(2);
    expect(photoMetaOf(changed, 'https://cdn/c.jpg')).toMatchObject({ altIt: 'Terrazza', altEn: 'Terrace' });

    const added = withPhotoMeta(drafts, 'https://cdn/b.jpg', { roomId: 'room-2' });
    expect(added).toHaveLength(3);
    expect(photoMetaOf(added, 'https://cdn/b.jpg').roomId).toBe('room-2');
  });

  it('photoMetaInputs_OnlyThePhotosOfTheGalleryThatHaveSomething_ArePutInTheBody', () => {
    const drafts = [
      ...photoMetaDraftsFromServer(SERVER),
      // A photo that was deleted since: the API answers 404 for an address that is not in the gallery.
      { url: 'https://cdn/deleted.jpg', altIt: 'Vecchia', altEn: '', roomId: '' },
    ];

    expect(photoMetaInputs(drafts, ['https://cdn/b.jpg', 'https://cdn/a.jpg', 'https://cdn/c.jpg'])).toEqual([
      { url: 'https://cdn/a.jpg', alt: { it: 'Soggiorno', en: 'Living room' }, roomId: 'room-1' },
      { url: 'https://cdn/c.jpg', alt: { it: 'Terrazza', en: null }, roomId: null },
    ]);
  });

  it('photoMetaInputs_ARoomWithoutACaption_SendsTheRoomAlone', () => {
    const drafts = [{ url: 'https://cdn/b.jpg', altIt: '  ', altEn: '', roomId: 'room-2' }];

    expect(photoMetaInputs(drafts, ['https://cdn/b.jpg'])).toEqual([{ url: 'https://cdn/b.jpg', alt: null, roomId: 'room-2' }]);
  });

  it('photoMetaSignature_BlankEntriesAndOrderDoNotCount_AChangeDoes', () => {
    const drafts = photoMetaDraftsFromServer(SERVER);
    const same = [...drafts].reverse().concat({ url: 'https://cdn/b.jpg', altIt: ' ', altEn: '', roomId: '' });

    expect(photoMetaSignature(same)).toBe(photoMetaSignature(drafts));
    expect(photoMetaSignature(withPhotoMeta(drafts, 'https://cdn/a.jpg', { roomId: '' }))).not.toBe(photoMetaSignature(drafts));
  });
});
