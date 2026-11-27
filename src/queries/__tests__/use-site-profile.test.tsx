import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropertyPhotosDto, SiteProfile } from '@/types';
import { siteProfileKey, useSaveListingTexts, useSavePhotoMeta } from '../use-site-profile';

const { siteProfileApi, propertyImagesApi } = vi.hoisted(() => ({
  siteProfileApi: { get: vi.fn(), save: vi.fn(), getPhotos: vi.fn(), savePhotos: vi.fn() },
  propertyImagesApi: { getAll: vi.fn() },
}));

vi.mock('@/api/site-profile.api', () => ({ siteProfileApi }));
vi.mock('@/api/property-images.api', () => ({ propertyImagesApi }));

const STORED = {
  propertyId: 'p1',
  floorLevel: 1,
  renovatedYear: null,
  energyClass: null,
  energyIndex: null,
  areaKind: null,
  childrenWelcome: null,
  checkInTo: null,
  videoUrl: null,
  tourUrl: null,
  zone: { it: 'Campagna' },
  near: null,
  floorNote: null,
  outdoorNote: null,
  checkInMethod: null,
  rulesNote: null,
  highlights: [],
  safetyNotes: [],
  tags: ['campagna'],
  translations: { en: { title: 'Old title', rules: 'No parties' } },
  origins: { 'en.title': 'UserWritten' },
} as unknown as SiteProfile;

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, Wrapper };
}

describe('useSaveListingTexts (the save of the profile replaces it as a whole)', () => {
  beforeEach(() => {
    siteProfileApi.get.mockReset();
    siteProfileApi.save.mockReset();
  });

  it('save_ReadsTheProfileAgainRightBefore_AndSendsEverythingElseOfItBack', async () => {
    siteProfileApi.get.mockResolvedValue(STORED);
    siteProfileApi.save.mockImplementation(async (_id: string, body: object) => ({ ...STORED, ...body }));
    const { client, Wrapper } = wrapper();
    const { result } = renderHook(() => useSaveListingTexts(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        propertyId: 'p1',
        drafts: { en: { title: 'New title', description: 'A quiet house.' }, de: { title: 'Neuer Titel', description: '' } },
      });
    });

    expect(siteProfileApi.get).toHaveBeenCalledWith('p1');
    const body = siteProfileApi.save.mock.calls[0]![1] as SiteProfile;
    expect(siteProfileApi.save.mock.calls[0]![0]).toBe('p1');
    expect(body).toMatchObject({ floorLevel: 1, zone: { it: 'Campagna' }, tags: ['campagna'] });
    expect(body.translations).toEqual({
      en: { title: 'New title', description: 'A quiet house.', rules: 'No parties' },
      de: { title: 'Neuer Titel' },
    });
    // What the server stored is what the cache holds now: the origins shown next to the texts follow it.
    expect(client.getQueryData(siteProfileKey('p1'))).toMatchObject({ translations: { de: { title: 'Neuer Titel' } } });
  });

  it('save_TheServerRefuses_NothingIsKeptInTheCacheAndTheErrorReachesTheCaller', async () => {
    siteProfileApi.get.mockResolvedValue(STORED);
    siteProfileApi.save.mockRejectedValue(new Error('422'));
    const { client, Wrapper } = wrapper();
    const { result } = renderHook(() => useSaveListingTexts(), { wrapper: Wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ propertyId: 'p1', drafts: { en: { title: 'x', description: 'y' } } });
      }),
    ).rejects.toThrow('422');
    expect(client.getQueryData(siteProfileKey('p1'))).toBeUndefined();
  });
});

describe('useSavePhotoMeta (the captions and rooms of the photos of the gallery)', () => {
  beforeEach(() => {
    siteProfileApi.savePhotos.mockReset();
    propertyImagesApi.getAll.mockReset();
  });

  it('save_ReadsTheGalleryRightBefore_AndDropsThePhotosThatAreNotInItAnyMore', async () => {
    propertyImagesApi.getAll.mockResolvedValue({ photoUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'] } as PropertyPhotosDto);
    siteProfileApi.savePhotos.mockResolvedValue([]);
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useSavePhotoMeta(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        propertyId: 'p1',
        drafts: [
          { url: 'https://cdn/a.jpg', altIt: 'Soggiorno', altEn: '', roomId: 'r1' },
          { url: 'https://cdn/gone.jpg', altIt: 'Cancellata', altEn: '', roomId: '' },
        ],
      });
    });

    expect(siteProfileApi.savePhotos).toHaveBeenCalledWith('p1', [{ url: 'https://cdn/a.jpg', alt: { it: 'Soggiorno', en: null }, roomId: 'r1' }]);
  });
});
