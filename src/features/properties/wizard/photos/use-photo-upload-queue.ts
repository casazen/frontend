import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getProblemMessage } from '@/lib/api-errors';
import { useUploadOnePropertyPhoto } from '@/queries/use-property-photos';
import { validatePhotoFile, type PhotoUploadRules } from '../../photo-selection';

export type QueuedPhotoStatus = 'waiting' | 'uploading' | 'failed';

/** A file the person chose, on its way to the property or stopped with the reason. */
export interface QueuedPhoto {
  id: number;
  file: File;
  status: QueuedPhotoStatus;
  /** Why it was not uploaded, in the person's language; only with `failed`. */
  error?: string;
}

const inFlight = (item: QueuedPhoto) => item.status === 'waiting' || item.status === 'uploading';

/**
 * The photos the person chose, sent **one file per request, in order** (SR-07b): the all-or-nothing upload of the gallery tells
 * "it failed" without saying which photo, here each file has its own state and its own reason (type, size, the gallery being full,
 * the server's answer) and one bad file does not hold the others back. A file that failed can be tried again or dismissed.
 *
 * The cap of the gallery counts the photos already there and the ones waiting: a file beyond it is refused on its own, with the
 * reason, instead of making the API refuse a whole selection.
 */
export function usePhotoUploadQueue(propertyId: string, uploaded: number, rules: PhotoUploadRules) {
  const { t } = useTranslation();
  const { mutateAsync } = useUploadOnePropertyPhoto(propertyId);
  const [items, setItems] = useState<readonly QueuedPhoto[]>([]);
  // The queue lives in a ref, which the loop that sends reads, and is mirrored in the state, which the screen draws.
  const queue = useRef<QueuedPhoto[]>([]);
  const running = useRef(false);
  const mounted = useRef(true);
  const nextId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const publish = (next: QueuedPhoto[]) => {
    queue.current = next;
    if (mounted.current) setItems(next);
  };
  const patch = (id: number, changes: Partial<QueuedPhoto>) =>
    publish(queue.current.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const send = async () => {
    if (running.current) return;
    running.current = true;
    try {
      // It goes on when the person has left the step: the files they chose are theirs to find in the gallery, not lost with the screen.
      for (;;) {
        const next = queue.current.find((item) => item.status === 'waiting');
        if (!next) break;
        patch(next.id, { status: 'uploading' });
        try {
          await mutateAsync(next.file);
          publish(queue.current.filter((item) => item.id !== next.id));
        } catch (error) {
          const reason = getProblemMessage(error, t) ?? t('propertyWizard.photos.queue.failedFile', { name: next.file.name });
          patch(next.id, { status: 'failed', error: reason });
          // Nobody is looking at the list any more: say it where it is seen.
          if (!mounted.current) toast.error(`${next.file.name}: ${reason}`);
        }
      }
    } finally {
      running.current = false;
    }
  };

  const overLimit = () => t('property.photos.limitReached', { max: rules.maxPhotos });

  const add = (files: File[]) => {
    let taken = uploaded + queue.current.filter(inFlight).length;
    const added = files.map<QueuedPhoto>((file) => {
      const id = nextId.current++;
      const problem = validatePhotoFile(file, rules, t) ?? (taken >= rules.maxPhotos ? overLimit() : null);
      if (problem) return { id, file, status: 'failed', error: problem };
      taken += 1;
      return { id, file, status: 'waiting' };
    });
    publish([...queue.current, ...added]);
    void send();
  };

  const retry = (id: number) => {
    const item = queue.current.find((candidate) => candidate.id === id);
    if (!item || item.status !== 'failed') return;
    const taken = uploaded + queue.current.filter(inFlight).length;
    const problem = validatePhotoFile(item.file, rules, t) ?? (taken >= rules.maxPhotos ? overLimit() : null);
    if (problem) {
      patch(id, { error: problem });
      return;
    }
    patch(id, { status: 'waiting', error: undefined });
    void send();
  };

  const dismiss = (id: number) => publish(queue.current.filter((item) => item.id !== id));

  return { items, add, retry, dismiss, busy: items.some(inFlight) };
}
