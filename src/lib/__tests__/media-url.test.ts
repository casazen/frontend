import { describe, it, expect } from 'vitest';
import { displayableMediaUrls, isDisplayableMediaUrl } from '../media-url';

describe('media-url (FD-07)', () => {
  it('isDisplayableMediaUrl_absoluteStorageUrl_returnsTrue', () => {
    expect(
      isDisplayableMediaUrl('https://ref.supabase.co/storage/v1/object/public/casazen-prod-public/properties/p/photos/a.jpg'),
    ).toBe(true);
    expect(isDisplayableMediaUrl('http://localhost:5001/storage/public/properties/p/photos/a.jpg')).toBe(true);
    expect(isDisplayableMediaUrl('blob:http://localhost:5173/3f2a')).toBe(true);
  });

  it('isDisplayableMediaUrl_legacyRelativePath_returnsFalse', () => {
    // On Vercel a relative path is rewritten to index.html: never an image.
    expect(isDisplayableMediaUrl('/uploads/properties/p/a.jpg')).toBe(false);
    expect(isDisplayableMediaUrl('uploads/a.jpg')).toBe(false);
    expect(isDisplayableMediaUrl('javascript:alert(1)')).toBe(false);
    expect(isDisplayableMediaUrl('')).toBe(false);
    expect(isDisplayableMediaUrl(null)).toBe(false);
    expect(isDisplayableMediaUrl(undefined)).toBe(false);
  });

  it('displayableMediaUrls_mixedList_keepsAbsoluteUrlsInOrder', () => {
    expect(
      displayableMediaUrls(['/uploads/a.jpg', 'https://cdn.example/b.jpg', null, 'https://cdn.example/c.jpg']),
    ).toEqual(['https://cdn.example/b.jpg', 'https://cdn.example/c.jpg']);
    expect(displayableMediaUrls(undefined)).toEqual([]);
  });
});
