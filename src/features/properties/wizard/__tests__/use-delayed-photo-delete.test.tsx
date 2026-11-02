import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedPhotoDelete } from '../photos/use-delayed-photo-delete';

interface UndoOptions {
  commit?: () => Promise<void> | void;
  undo: () => Promise<void> | void;
}

const { removeApi, toasts } = vi.hoisted(() => ({
  removeApi: vi.fn(),
  toasts: [] as UndoOptions[],
}));

vi.mock('@/api/property-images.api', () => ({ propertyImagesApi: { remove: removeApi } }));
vi.mock('sonner', () => ({ toast: { dismiss: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/toast-undo', () => ({
  toastUndo: (_message: string, options: UndoOptions) => {
    toasts.push(options);
    return `toast-${toasts.length}`;
  },
}));

const PHOTO = 'https://storage.example/p1/a.jpg';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useDelayedPhotoDelete('p1'), { wrapper });
}

describe('useDelayedPhotoDelete', () => {
  beforeEach(() => {
    toasts.length = 0;
    removeApi.mockReset();
    removeApi.mockResolvedValue({ photoUrls: [], maxPhotos: 20, maxFilesPerRequest: 10, maxFileSizeBytes: 1, allowedContentTypes: [] });
  });

  it('remove_Undone_NeverSendsTheDelete', async () => {
    const { result } = setup();

    act(() => result.current.remove(PHOTO));
    // Hidden at once, and nothing has left yet: «Annulla» is only true because of that.
    expect(result.current.held).toEqual([PHOTO]);
    expect(removeApi).not.toHaveBeenCalled();

    act(() => void toasts[0]!.undo());
    expect(result.current.held).toEqual([]);

    // The window closing afterwards (the toast asks its commit as well) must not delete what the person got back.
    await act(async () => void (await toasts[0]!.commit?.()));
    expect(removeApi).not.toHaveBeenCalled();
  });

  it('remove_WindowClosed_SendsTheDeleteOnceWhoeverAsks', async () => {
    const { result } = setup();

    act(() => result.current.remove(PHOTO));
    await act(async () => {
      await Promise.all([toasts[0]!.commit?.(), result.current.flush()]);
    });

    expect(removeApi).toHaveBeenCalledTimes(1);
    expect(removeApi).toHaveBeenCalledWith('p1', PHOTO);
    expect(result.current.held).toEqual([]);
  });

  it('remove_LeavingTheStep_SendsWhatWasHeldBackAtOnce', async () => {
    const { result, unmount } = setup();

    act(() => result.current.remove(PHOTO));
    unmount();

    // Nothing is lost with the screen: the delete goes out when the step goes away, and the toast closing later does not repeat it.
    await waitFor(() => expect(removeApi).toHaveBeenCalledWith('p1', PHOTO));
    await toasts[0]!.commit?.();
    expect(removeApi).toHaveBeenCalledTimes(1);
  });
});
