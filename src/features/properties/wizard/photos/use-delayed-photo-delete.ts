import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { toastUndo } from '@/lib/toast-undo';
import { useRemovePropertyPhotoQuietly } from '@/queries/use-property-photos';

interface Held {
  /** Sends the delete, once: asked a second time it hands back the same answer. */
  commit: () => Promise<void>;
  toastId: string | number;
}

/**
 * Deleting a photo with «Annulla» (SR-07b). A photo that is deleted cannot be brought back, so «Annulla» is only true if the delete
 * **has not been sent yet**: the photo is hidden at once, the delete leaves when the window of the toast closes, and «Annulla» just
 * lets the photo show again. What is held back is never lost: it is sent right away when the person leaves the step or the page
 * (`flush`), and before the next change to the gallery, so the server never sees an order or an upload on top of a photo that is
 * already gone for the person.
 *
 * If a delete fails the photo shows again (the server still has it) and the person is told.
 */
export function useDelayedPhotoDelete(propertyId: string) {
  const { mutateAsync } = useRemovePropertyPhotoQuietly(propertyId);
  const [held, setHeld] = useState<readonly string[]>([]);
  const entries = useRef(new Map<string, Held>());

  const release = useCallback((url: string) => {
    entries.current.delete(url);
    setHeld((previous) => previous.filter((candidate) => candidate !== url));
  }, []);

  /** Hides the photo and offers «Annulla»; the delete is sent when the window closes. */
  const remove = useCallback(
    (url: string) => {
      if (entries.current.has(url)) return;

      let cancelled = false;
      let sending: Promise<void> | null = null;
      const commit = () => {
        if (cancelled) return Promise.resolve();
        sending ??= (async () => {
          try {
            await mutateAsync(url);
          } catch (error) {
            toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('property.photos.deleteFailed'));
          } finally {
            release(url);
          }
        })();
        return sending;
      };
      const undo = () => {
        cancelled = true;
        release(url);
      };

      const toastId = toastUndo(i18n.t('property.photos.deleted'), { commit, undo });
      entries.current.set(url, { commit, toastId });
      setHeld((previous) => [...previous, url]);
    },
    [mutateAsync, release],
  );

  /** Sends every delete that is waiting and resolves when they are all answered. */
  const flush = useCallback(async () => {
    const waiting = [...entries.current.values()];
    await Promise.all(
      waiting.map(({ commit, toastId }) => {
        // Closing the toast would send it too (it asks for the same `commit`): the answer is shared, so this waits for it.
        toast.dismiss(toastId);
        return commit();
      }),
    );
  }, []);

  useEffect(() => {
    const leave = () => void flush();
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [flush]);

  return { held, remove, flush };
}
