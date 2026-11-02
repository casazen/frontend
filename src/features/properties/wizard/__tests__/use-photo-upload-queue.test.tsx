import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_PHOTO_RULES } from '../../photo-selection';
import { usePhotoUploadQueue } from '../photos/use-photo-upload-queue';

const { uploadApi } = vi.hoisted(() => ({ uploadApi: vi.fn() }));

vi.mock('@/api/property-images.api', () => ({ propertyImagesApi: { upload: uploadApi } }));
vi.mock('sonner', () => ({ toast: { dismiss: vi.fn(), error: vi.fn(), success: vi.fn() } }));

const jpeg = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

function setup(uploaded: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => usePhotoUploadQueue('p1', uploaded, FALLBACK_PHOTO_RULES), { wrapper });
}

describe('usePhotoUploadQueue', () => {
  beforeEach(() => {
    uploadApi.mockReset();
    uploadApi.mockImplementation(async (_propertyId: string, files: File[]) => {
      if (files[0]!.name === 'broken.jpg') throw new Error('the server said no');
      return { photoUrls: [], maxPhotos: 20, maxFilesPerRequest: 10, maxFileSizeBytes: 1, allowedContentTypes: [] };
    });
  });

  it('add_SeveralFilesOneOfThemBad_SendsOneFilePerRequestInOrderAndKeepsGoing', async () => {
    const { result } = setup(0);

    act(() => result.current.add([jpeg('a.jpg'), jpeg('broken.jpg'), jpeg('c.jpg')]));
    await waitFor(() => expect(result.current.busy).toBe(false));

    // One request per file, in the order chosen, never together: the one that failed does not hold back the next.
    expect(uploadApi.mock.calls.map(([, files]) => (files as File[]).map((file) => file.name))).toEqual([['a.jpg'], ['broken.jpg'], ['c.jpg']]);
    // The ones that went are gone from the list; the one that did not stays with its own reason, and can be tried again.
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ status: 'failed' });
    expect(result.current.items[0]!.error).toContain('broken.jpg');
  });

  it('add_GalleryAlmostFull_RefusesOnlyTheFilesBeyondTheCap', async () => {
    const { result } = setup(19);

    act(() => result.current.add([jpeg('a.jpg'), jpeg('b.jpg'), jpeg('c.jpg')]));
    await waitFor(() => expect(result.current.busy).toBe(false));

    // 19 photos and a cap of 20: room for one. The first goes; the others are refused one by one, without calling the API.
    expect(uploadApi).toHaveBeenCalledTimes(1);
    expect(result.current.items.map((item) => [item.file.name, item.status])).toEqual([
      ['b.jpg', 'failed'],
      ['c.jpg', 'failed'],
    ]);
  });
});
