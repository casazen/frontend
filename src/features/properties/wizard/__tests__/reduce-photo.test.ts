import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_PHOTOS_MAX, reducePhotosForAi } from '../photos/reduce-photo';

/** An image that never loads (a network error): what jsdom can stand in for, without a network or a canvas. */
class BrokenImage {
  static sources: string[] = [];
  crossOrigin = '';
  decoding = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(value: string) {
    BrokenImage.sources.push(value);
    queueMicrotask(() => this.onerror?.());
  }
}

describe('reducePhotosForAi', () => {
  afterEach(() => {
    BrokenImage.sources = [];
    vi.unstubAllGlobals();
  });

  it('reducePhotosForAi_ManyPhotos_LoadsOnlyTheFirstOnesInOrder', async () => {
    vi.stubGlobal('Image', BrokenImage);
    const urls = Array.from({ length: AI_PHOTOS_MAX + 3 }, (_, index) => `https://cdn.example/${index}.jpg`);

    await reducePhotosForAi(urls);

    expect(BrokenImage.sources).toEqual(urls.slice(0, AI_PHOTOS_MAX).map((url) => `${url}?for=ai`));
  });

  it('reducePhotosForAi_PhotosThatCannotBeLoaded_AreLeftOut', async () => {
    vi.stubGlobal('Image', BrokenImage);

    await expect(reducePhotosForAi(['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'])).resolves.toEqual([]);
  });
});
